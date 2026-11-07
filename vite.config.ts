import { defineConfig } from "vite";

export default defineConfig({
  build: {
    // three.js is ~550 kB minified (137 kB gzipped). It's already split into its
    // own chunk that loads after the page text, so the default warning is noise.
    chunkSizeWarningLimit: 600,
  },
});
