import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Build: eine einzige HTML-Datei (dist/index.html) mit eingebettetem JS/CSS.
// So funktioniert sie weiterhin per Doppelklick (file://), über den lokalen Starter und später auf dem Server.
export default defineConfig({
  root: "web",
  base: "./",
  plugins: [viteSingleFile()],
  build: { outDir: "../dist", emptyOutDir: true, target: "es2022" },
  // Port 8765: bei Google/Microsoft als Redirect-/Ursprungs-Adresse registriert (siehe SYNC-EINRICHTEN.md)
  server: { port: 8765, strictPort: true },
  preview: { port: 8765, strictPort: true },
  test: { root: ".", include: ["web/tests/**/*.test.js"] }
});
