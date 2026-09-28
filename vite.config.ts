import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// Bundles the React (shadcn / Tailwind) parts of the app into one classic script + stylesheet
// that the Electron renderer loads from src/renderer/ui/.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    outDir: "src/renderer/ui",
    emptyOutDir: true,
    lib: {
      entry: path.resolve(__dirname, "entries/style-board.tsx"),
      name: "LayoutlyUI",
      formats: ["iife"],
      fileName: () => "style-board.js",
      cssFileName: "style-board",
    },
  },
});
