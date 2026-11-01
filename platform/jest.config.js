module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  testTimeout: 30000,
  testPathIgnorePatterns: ['/node_modules/','/services/.*/dist/']
};
