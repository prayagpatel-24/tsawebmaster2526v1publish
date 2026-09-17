const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const {
  runCosinePrefilter,
  runExactBlocklist
} = require("./moderation");

admin.initializeApp();

const db = admin.firestore();
const MISTRAL_API_KEY = defineSecret("MISTRAL_API_KEY");
const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions";
const MISTRAL_MODEL = "mistral-small-latest";

function readMessageText(data) {
  return String(data.text || data.message || data.content || data.body || "").trim();
}

function parseAiVerdict(text) {
  const match = String(text || "").match(/\{[\s\S]*\}/);
  if (!match) throw new Error("AI moderation response did not contain JSON");

  const parsed = JSON.parse(match[0]);
  return {
    flagged: Boolean(parsed.flagged),
    reason: String(parsed.reason || "No reason provided").slice(0, 500)
  };
}

async function reviewWithMistral(messageText, prefilter) {
  const prompt = [
    "You are a strict content moderator for Ripple, a community web app.",
    "Review the user-submitted message for harassment, threats, scams, hate, illegal activity, sexual explicitness, or dangerous misinformation.",
    "Return JSON only with this exact shape: { \"flagged\": boolean, \"reason\": string }.",
    "Use flagged=true only when the message should be blocked from public posting."
  ].join(" ");

  const response = await fetch(MISTRAL_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${MISTRAL_API_KEY.value()}`
    },
    body: JSON.stringify({
      model: MISTRAL_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: prompt },
        {
          role: "user",
          content: JSON.stringify({
            message: messageText,
            stage1ClosestPhrase: prefilter.closestPhrase,
            stage1Similarity: prefilter.highestScore
          })
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Mistral moderation failed with HTTP ${response.status}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content || "";
  return parseAiVerdict(content);
}

async function approveMessage(messageRef, prefilter, aiVerdict = null) {
  await messageRef.update({
    moderationStatus: "approved",
    visible: true,
    moderatedBy: aiVerdict ? "ai" : "cosine_prefilter",
    moderationReason: aiVerdict?.reason || "Passed cosine similarity pre-filter.",
    moderationStage1: {
      highestScore: prefilter.highestScore,
      closestPhrase: prefilter.closestPhrase,
      threshold: prefilter.threshold
    },
    moderatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

async function blockMessage(messageRef, messageId, originalData, messageText, prefilter, aiVerdict) {
  await db.collection("flagged_messages").doc(messageId).set({
    ...originalData,
    originalMessageId: messageId,
    text: messageText,
    status: "pending_review",
    blocked: true,
    moderationReason: aiVerdict.reason,
    moderationStage1: {
      highestScore: prefilter.highestScore,
      closestPhrase: prefilter.closestPhrase,
      threshold: prefilter.threshold
    },
    moderationStage2: {
      provider: aiVerdict.provider || "mistral",
      model: aiVerdict.model || MISTRAL_MODEL,
      flagged: aiVerdict.flagged,
      reason: aiVerdict.reason
    },
    flaggedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  await messageRef.delete();
}

async function moderateCreatedMessage(messageRef, messageId, data) {
  const messageText = readMessageText(data);

  if (!messageText) {
    await messageRef.update({
      moderationStatus: "rejected",
      visible: false,
      moderationReason: "Message was empty.",
      moderatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return;
  }

  const exactBlock = runExactBlocklist(messageText);
  if (exactBlock.blocked) {
    await blockMessage(
      messageRef,
      messageId,
      data,
      messageText,
      {
        flaggedForAi: true,
        highestScore: 1,
        closestPhrase: exactBlock.matchedLabel,
        threshold: 1
      },
      {
        flagged: true,
        reason: exactBlock.reason,
        provider: "exact_blocklist",
        model: "none"
      }
    );
    return;
  }

  const prefilter = runCosinePrefilter(messageText);

  
  if (!prefilter.flaggedForAi) {
    await approveMessage(messageRef, prefilter);
    return;
  }

  try {
    
    const aiVerdict = await reviewWithMistral(messageText, prefilter);

    if (aiVerdict.flagged) {
      await blockMessage(messageRef, messageId, data, messageText, prefilter, aiVerdict);
    } else {
      await approveMessage(messageRef, prefilter, aiVerdict);
    }
  } catch (error) {
    logger.error("Stage 2 moderation failed; holding message for admin review.", {
      messageId,
      error: error.message
    });

    await db.collection("flagged_messages").doc(messageId).set({
      ...data,
      originalMessageId: messageId,
      text: messageText,
      status: "pending_review",
      blocked: true,
      moderationReason: "AI review failed after cosine pre-filter match.",
      moderationStage1: prefilter,
      moderationStage2: {
        provider: "mistral",
        model: MISTRAL_MODEL,
        error: error.message
      },
      flaggedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await messageRef.delete();
  }
}

exports.moderateNewMessage = onDocumentCreated(
  {
    document: "messages/{messageId}",
    region: "us-central1",
    secrets: [MISTRAL_API_KEY]
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    await moderateCreatedMessage(snap.ref, event.params.messageId, snap.data());
  }
);

exports.moderateForumNotification = onDocumentCreated(
  {
    document: "notifications/{notificationId}",
    region: "us-central1",
    secrets: [MISTRAL_API_KEY]
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    if (data.type !== "forumMessage") return;

    await moderateCreatedMessage(snap.ref, event.params.notificationId, data);
  }
);
