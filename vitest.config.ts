import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // spec/interaction.test.tsx drives the real component through dozens of
    // real zoom steps, each waiting a frame for the camera to settle. That is
    // slower than a unit test and is meant to be: it is the only place the
    // interaction contract is exercised end to end.
    testTimeout: 30_000,
  },
});
