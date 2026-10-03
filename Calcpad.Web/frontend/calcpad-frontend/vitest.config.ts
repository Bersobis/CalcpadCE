import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['tests/**/*.test.ts'],
        environment: 'node',
        // The corpus test calls MathLive's parser once per equation line across every
        // .cpd file, which is slower than a unit test.
        testTimeout: 60_000,
    },
});