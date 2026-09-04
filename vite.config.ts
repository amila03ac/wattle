import { defineConfig } from "vite";

export default defineConfig({
  base: "./",              // relative paths, so the build also works inside a Capacitor WebView
  build: { target: "es2020", outDir: "dist" },
  server: { host: true },  // reachable from a phone or tablet on the same network
});
