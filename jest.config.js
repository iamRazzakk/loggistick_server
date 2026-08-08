module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",

  roots: ["<rootDir>"],

  testMatch: ["**/tests/**/*.test.ts"],

  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],

  moduleFileExtensions: ["ts", "js"],

  clearMocks: true,
};
