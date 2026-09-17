const {
  FLAGGED_PHRASES,
  SIMILARITY_THRESHOLD
} = require("../config/moderation-config");

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "at",
  "be",
  "but",
  "for",
  "from",
  "i",
  "in",
  "is",
  "it",
  "me",
  "of",
  "on",
  "or",
  "please",
  "that",
  "the",
  "this",
  "to",
  "your"
]);

const EXACT_BLOCKED_TERMS = [
  {
    label: "racial slur",
    compactTerm: ["n", "i", "g", "g", "e", "r"].join("")
  },
  {
    label: "racial slur",
    compactTerm: ["n", "i", "g", "g", "a"].join("")
  }
];

function compactForBlocklist(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[!1|]/g, "i")
    .replace(/[@4]/g, "a")
    .replace(/[3]/g, "e")
    .replace(/[0]/g, "o")
    .replace(/[$5]/g, "s")
    .replace(/[^a-z0-9]/g, "");
}

function runExactBlocklist(message) {
  const compact = compactForBlocklist(message);
  const match = EXACT_BLOCKED_TERMS.find((term) =>
    compact.includes(term.compactTerm)
  );

  if (!match) {
    return {
      blocked: false,
      reason: ""
    };
  }

  return {
    blocked: true,
    matchedLabel: match.label,
    reason: "Blocked because the message contains a prohibited slur."
  };
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .match(/[a-z0-9]+/g)?.map(stemToken)
    .filter((token) => !STOPWORDS.has(token)) || [];
}

function stemToken(token) {
  if (token.length > 5 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 4 && token.endsWith("ed")) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith("s")) return token.slice(0, -1);
  return token;
}

function buildFeatures(tokens) {
  const features = [...tokens];
  for (let i = 0; i < tokens.length - 1; i += 1) {
    features.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return features;
}

function buildTfIdfVectors(documents) {
  const docs = documents.map((doc) => buildFeatures(tokenize(doc)));
  const vocabulary = new Map();
  const documentFrequency = new Map();

  docs.forEach((features) => {
    const uniqueFeatures = new Set(features);
    uniqueFeatures.forEach((feature) => {
      if (!vocabulary.has(feature)) vocabulary.set(feature, vocabulary.size);
      documentFrequency.set(feature, (documentFrequency.get(feature) || 0) + 1);
    });
  });

  const documentCount = docs.length;

  return docs.map((features) => {
    const counts = new Map();
    features.forEach((feature) => counts.set(feature, (counts.get(feature) || 0) + 1));

    const vector = new Array(vocabulary.size).fill(0);
    const totalFeatures = features.length || 1;

    counts.forEach((count, feature) => {
      const index = vocabulary.get(feature);

      const termFrequency = count / totalFeatures;

      const inverseDocumentFrequency =
        Math.log((documentCount + 1) / ((documentFrequency.get(feature) || 0) + 1)) + 1;

      vector[index] = termFrequency * inverseDocumentFrequency;
    });

    return vector;
  });
}

function cosineSimilarity(vectorA, vectorB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vectorA.length; i += 1) {
    dotProduct += vectorA[i] * vectorB[i];
    normA += vectorA[i] * vectorA[i];
    normB += vectorB[i] * vectorB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function runCosinePrefilter(message, options = {}) {
  const referencePhrases = options.referencePhrases || FLAGGED_PHRASES;
  const threshold = Number(options.threshold ?? SIMILARITY_THRESHOLD);
  const documents = [message, ...referencePhrases];
  const [messageVector, ...referenceVectors] = buildTfIdfVectors(documents);

  let highestScore = 0;
  let closestPhrase = "";

  referenceVectors.forEach((referenceVector, index) => {
    const score = cosineSimilarity(messageVector, referenceVector);
    if (score > highestScore) {
      highestScore = score;
      closestPhrase = referencePhrases[index];
    }
  });

  return {
    flaggedForAi: highestScore >= threshold,
    highestScore,
    closestPhrase,
    threshold
  };
}

module.exports = {
  buildTfIdfVectors,
  cosineSimilarity,
  runExactBlocklist,
  runCosinePrefilter,
  tokenize
};
