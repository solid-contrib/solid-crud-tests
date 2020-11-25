module.exports = {
    roots: [
        "<rootDir>/test",
    ],
    preset: 'ts-jest',
    testEnvironment: 'node',
    testTimeout: 5000,
    verbose: false,
    runner: 'jest-serial-runner',
    collectCoverage: false,
    globals: {
        'ts-jest': {
            // reference: https://kulshekhar.github.io/ts-jest/user/config/
        }
    }
};
