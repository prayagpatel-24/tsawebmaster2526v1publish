/**
 * Stage 1 moderation tuning.
 *
 * TF-IDF works best when the reference list includes the wording patterns you
 * care about plus a few common rewrites. Add/remove phrases here as admins find
 * new abuse patterns. You can override the threshold in deployed functions with
 * MODERATION_SIMILARITY_THRESHOLD if you want to tune without a code edit.
 */
const SIMILARITY_THRESHOLD = Number(
  process.env.MODERATION_SIMILARITY_THRESHOLD || 0.75
);

const FLAGGED_PHRASES = [
  "you should disappear from this community",
  "go disappear from this group",
  "nobody wants you here",
  "this fundraiser is a scam",
  "fundraiser scam stealing donations",
  "fake volunteer hours for money",
  "sell fake service hour credits",
  "send money to claim your prize",
  "give me your password",
  "share your login code",
  "illegal drugs at the event",
  "bring a weapon to school",
  "explicit sexual content",
  "hate speech against a protected group",
  "threatening violence against someone"
];

module.exports = {
  FLAGGED_PHRASES,
  SIMILARITY_THRESHOLD
};
