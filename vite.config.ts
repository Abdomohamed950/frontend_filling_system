import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Bind to 0.0.0.0, not just localhost — the panel needs to be reachable
  // from phones/tablets on the same network, not only the dev machine.
  server: {
    host: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Keep the rarely-changing runtime in its own long-lived chunk so a
        // UI tweak doesn't invalidate the whole download on station reload.
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-net": ["axios", "socket.io-client"],
          "vendor-date": ["date-fns", "react-day-picker"],
        },
      },
    },
  },
});
