import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === "production" ? "/knjigovodja/" : "/",
  optimizeDeps: {
    exclude: ["lucide-react"],
  },
  server: {
    port: 5175,
    proxy: {
      "/api": {
        target: "http://localhost:3003",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 3003,
  },
}));
