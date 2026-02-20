export default {
  testEnvironment: "node",

  setupFilesAfterEnv: ["./__tests__/setup.js"],

  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },

  transform: {},

  testMatch: ["**/__tests__/**/*.test.js"],

  collectCoverageFrom: [
    "routes/**/*.js",
    "db/**/*.js",
    "!**/__tests__/**",
    "!**/node_modules/**",
  ],

  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },

  verbose: true,

  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
