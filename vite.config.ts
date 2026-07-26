import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: Number(process.env.PORT) || 5174,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      // Désactivé en dev par défaut (pas de service worker en local pour éviter cache HMR)
      devOptions: { enabled: false },
      includeAssets: ["Hyla_logo_bold.png", "favicon.ico"],
      manifest: {
        name: "Triibu — CRM Hyla",
        short_name: "Triibu",
        description: "Le CRM pensé pour les conseillers Hyla — ventes, équipe, commissions.",
        theme_color: "#3b82f6",
        background_color: "#0b0e18",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/dashboard",
        icons: [
          { src: "/Hyla_logo_bold.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/Hyla_logo_bold.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/Hyla_logo_bold.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Précache les assets Vite + shell app
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
        // Runtime cache : Supabase REST/auth en NetworkFirst (fresh > stale), fallback si offline
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[a-z0-9]+\.supabase\.co\/rest\/v1\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 }, // 24h
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Storage (fichiers académie) : cache long
            urlPattern: /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "supabase-storage",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 }, // 7j
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Tuiles OSM pour la carte
            urlPattern: /^https:\/\/[a-c]\.tile\.openstreetmap\.org\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "osm-tiles",
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 }, // 30j
            },
          },
        ],
        // SPA fallback : toutes les routes app → index.html
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/auth\//],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Chunks séparés : les libs changent rarement, l'app change souvent → meilleur cache navigateur
    // + Time-to-Interactive plus rapide sur mobile 4G
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes("node_modules")) return;
          if (id.includes("react-router")) return "vendor-router";
          if (id.includes("react-dom") || id.match(/[/\\]react[/\\]/)) return "vendor-react";
          if (id.includes("@supabase")) return "vendor-supabase";
          if (id.includes("@tanstack")) return "vendor-query";
          if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
          if (id.includes("@radix-ui")) return "vendor-radix";
          if (id.includes("lucide-react")) return "vendor-icons";
          if (id.includes("xlsx")) return "vendor-xlsx";
          if (id.includes("pigeon-maps")) return "vendor-maps";
          if (id.includes("@dnd-kit")) return "vendor-dnd";
          if (id.includes("react-markdown") || id.includes("remark-")) return "vendor-markdown";
        },
      },
    },
    // Warning à 700 kB au lieu de 500 pour laisser passer les gros vendor chunks
    chunkSizeWarningLimit: 700,
  },
}));
