module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "refactor", "perf", "test", "docs", "chore", "build", "ci"],
    ],
    "scope-empty": [2, "never"],
    "subject-case": [0],
  },
};
