const assert = require("node:assert/strict");
const {
  runCosinePrefilter,
  runExactBlocklist
} = require("../src/moderation");

const threshold = 0.75;

const cases = [
  {
    name: "allows normal community message",
    message: "Can anyone recommend volunteer opportunities this weekend?",
    expected: false
  },
  {
    name: "flags close harassment rewrite",
    message: "Please go disappear from this group forever",
    expected: true
  },
  {
    name: "flags scam wording that is not an exact blacklist keyword",
    message: "That fundraiser scam is stealing donations",
    expected: true
  },
  {
    name: "flags fake service-hour paraphrase",
    message: "I can sell fake service hour credits tonight",
    expected: true
  }
];

for (const testCase of cases) {
  const result = runCosinePrefilter(testCase.message, { threshold });
  console.log(
    `${testCase.name}: flagged=${result.flaggedForAi}, score=${result.highestScore.toFixed(3)}, closest="${result.closestPhrase}"`
  );
  assert.equal(result.flaggedForAi, testCase.expected);
}

const prohibitedSlur = ["n", "i", "g", "g", "e", "r"].join("");
const exactBlock = runExactBlocklist(`Do not allow this ${prohibitedSlur} term`);
assert.equal(exactBlock.blocked, true);
assert.match(exactBlock.reason, /prohibited slur/i);

console.log("All moderation pre-filter tests passed.");
