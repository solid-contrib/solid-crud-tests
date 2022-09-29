module.exports = {
  roots: ["<rootDir>/test"],
  preset: "ts-jest",
  testEnvironment: "node",
  testTimeout: 60000,
  verbose: false,
  runner: "jest-serial-runner",
  collectCoverage: false,
  setupFilesAfterEnv: ["jest-extended"],
  globals: {
    "ts-jest": {
      // reference: https://kulshekhar.github.io/ts-jest/user/config/
    },
  },
};
