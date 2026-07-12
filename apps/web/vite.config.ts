import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const base = process.env.VITE_BASE ?? "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/*.svg", "audio/brass-bell.wav"],
      manifest: {
        name: "RasoiGuide — रसोई साथी",
        short_name: "RasoiGuide",
        description: "Offline-first bilingual cooking companion for Indian kitchens.",
        start_url: base,
        scope: base,
        display: "standalone",
        orientation: "any",
        background_color: "#8B3A2E",
        theme_color: "#8B3A2E",
        lang: "hi-IN",
        categories: ["food", "lifestyle", "utilities"],
        icons: [
          {
            src: "icons/rasoiguide.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any"
          },
          {
            src: "icons/rasoiguide-maskable.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
        navigateFallback: `${base}index.html`,
        globPatterns: ["**/*.{js,css,html,svg,woff,woff2,wav,json}"],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes("/content/") || url.hostname === "cdn.jsdelivr.net",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "recipe-packs-v2",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "stage-frames",
              expiration: { maxEntries: 140, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          }
        ]
      }
    })
  ],
  build: {
    target: "es2022",
    sourcemap: true,
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          storage: ["dexie", "zustand"]
        }
      }
    }
  }
});
