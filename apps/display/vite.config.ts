import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "../../dist/display",
    emptyOutDir: true,
  },
  plugins: [react()],
  root: "apps/display",
  server: {
    port: 5174,
    proxy: {
      "/api": "http://localhost:3000",
      "/assets": "http://localhost:3000",
    },
  },
});
