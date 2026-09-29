import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Velocity Lab — VBT Athlete Monitoring",
        short_name: "Velocity Lab",
        description: "Local-first velocity based training and readiness monitor.",
        theme_color: "#0b1712",
        background_color: "#f3f5ef",
        display: "standalone",
        start_url: ".",
        scope: ".",
        icons: [
          { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png}"]
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ["recharts"],
          database: ["dexie", "dexie-react-hooks"]
        }
      }
    }
  }
});
