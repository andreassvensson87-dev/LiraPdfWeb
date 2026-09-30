import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "pdf-viewer": ["pdfjs-dist"],
          "pdf-writer": ["pdf-lib"],
        },
      },
    },
  },
});
