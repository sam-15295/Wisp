import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The browser only talks to the Vite server, which forwards API calls to the Express server.
// Same origin means the httpOnly login cookie just works and no CORS setup is needed.
const backend = "http://localhost:3000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/user": backend,
      "/chat": backend,
      "/msg": backend
    }
  }
});
