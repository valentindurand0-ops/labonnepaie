import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Configuration Vite. Le serveur de dev tourne par defaut sur le port 5173.
export default defineConfig({
  plugins: [react()],
});
