import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Bind the LAN so a phone can open a QR join link from this machine.
    host: true,
    port: 5174,
    proxy: {
      "/game": {
        target: "http://127.0.0.1:2568",
        ws: true,
        rewrite: (path) => path.replace(/^\/game/, ""),
      },
    },
  },
});
