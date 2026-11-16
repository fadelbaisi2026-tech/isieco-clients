import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  envDir: "../../",
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api/v1": {
        target: "https://isieco-api-staging.onrender.com",
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
