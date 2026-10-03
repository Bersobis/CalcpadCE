import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['tests/**/*.test.ts'],
        environment: 'node',
        // The corpus test walks every file under Examples/ and calls MathLive's parser
        // once per equation line, which is slower than a unit test but still well inside
        // this budget on a developer machine.
        testTimeout: 60_000,
    },
});