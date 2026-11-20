import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Ports stay in the 18000-18999 range reserved for this repository's local
// servers; override with `npm run dev -- --port <n>` when needed.
export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 18080,
    strictPort: true,
  },
  clearScreen: false,
  build: {
    target: "es2023",
  },
});
