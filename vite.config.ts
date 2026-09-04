import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // Relative paths, so the same build works from a GitHub Pages subpath
  // (/wattle/) and from inside a Capacitor WebView.
  base: "./",
  build: { target: "es2020", outDir: "dist" },
  server: { host: true }, // reachable from a phone or tablet on the same wifi
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["icon-192.png", "icon-512.png", "icon-maskable-512.png"],
      manifest: {
        name: "Wattle",
        short_name: "Wattle",
        description: "Spelling and maths practice. Works offline.",
        lang: "en-AU",
        // Relative, so an install from a subpath scopes correctly.
        start_url: "./",
        scope: "./",
        display: "standalone",
        orientation: "portrait",
        background_color: "#0E1A14",
        theme_color: "#0E1A14",
        categories: ["education"],
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          // Android crops icons to its own shape; the maskable art keeps a
          // safe margin so the bloom is not clipped.
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Everything the app needs is precached, fonts included, so the first
        // launch after install works with no network at all.
        globPatterns: ["**/*.{js,css,html,woff2,png,svg,webmanifest}"],
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
});
