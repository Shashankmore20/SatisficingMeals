export default {
  // Use node test environment
  testEnvironment: "node",

  // Setup files
  setupFilesAfterEnv: ["./__tests__/setup.js"],

  // Module name mapper for manual mocks
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },

  // Transform ES6 modules
  transform: {},

  // Look for test files
  testMatch: ["**/__tests__/**/*.test.js"],

  // Coverage configuration
  collectCoverageFrom: [
    "routes/**/*.js",
    "db/**/*.js",
    "!**/__tests__/**",
    "!**/node_modules/**",
  ],

  // Coverage thresholds (optional - adjust as needed)
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};