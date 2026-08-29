import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        // Split the heavy, rarely-changing pieces into their own chunks so a
        // UI tweak doesn't force everyone to re-download the charting library
        // or the bundled dataset.
        manualChunks: {
          react: ["react", "react-dom"],
          charts: ["recharts"],
          capture: ["html-to-image"],
        },
      },
    },
  },
});
