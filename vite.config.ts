import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base: the built app works from any folder or sub-path.
  base: './',
  server: {
    port: 5173,
    open: true,
  },
  test: {
    environment: 'node',
  },
});
