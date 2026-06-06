import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    {
      name: "inject-sw-assets",
      closeBundle() {
        const distDir = path.resolve(__dirname, "dist");
        const swPath = path.resolve(distDir, "firebase-messaging-sw.js");
        
        if (!fs.existsSync(swPath)) {
          console.warn("[SW Injection] Service Worker file not found in dist, skipping asset injection");
          return;
        }

        const getFiles = (dir) => {
          let results = [];
          const list = fs.readdirSync(dir);
          list.forEach((file) => {
            const filePath = path.resolve(dir, file);
            const stat = fs.statSync(filePath);
            if (stat && stat.isDirectory()) {
              results = results.concat(getFiles(filePath));
            } else {
              const relPath = path.relative(distDir, filePath).replace(/\\/g, "/");
              results.push("/" + relPath);
            }
          });
          return results;
        };

        try {
          const allFiles = getFiles(distDir);
          const filesToCache = allFiles.filter((f) => {
            if (f.includes("firebase-messaging-sw.js")) return false;
            return (
              f.endsWith(".js") ||
              f.endsWith(".css") ||
              f.endsWith(".html") ||
              f.endsWith(".svg") ||
              f.endsWith(".png") ||
              f.endsWith(".webp") ||
              f.endsWith(".woff2") ||
              f.endsWith(".json")
            );
          });

          let swContent = fs.readFileSync(swPath, "utf8");
          const filesListString = JSON.stringify(filesToCache, null, 2);
          swContent = swContent.replace(
            "const SHELL_URLS = ['/', '/manifest.json', '/favicon.svg'];",
            `const SHELL_URLS = ${filesListString};`
          );
          
          fs.writeFileSync(swPath, swContent, "utf8");
          console.log(`[SW Injection] Injected ${filesToCache.length} build assets into Service Worker.`);
        } catch (err) {
          console.error("[SW Injection] Failed to inject assets:", err);
        }
      }
    }
  ],
  server: {
    proxy: {
      "/api": "http://localhost:5000",
      "/socket.io": {
        target: "http://localhost:5000",
        ws: true,
      },
    },
  },
  build: {
    outDir: "dist",
    minify: "oxc",
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react") || id.includes("react-dom") || id.includes("react-router-dom")) {
              return "vendor";
            }
            if (id.includes("firebase")) {
              return "firebase";
            }
            if (id.includes("zustand") || id.includes("axios")) {
              return "libs-core";
            }
            return "libs";
          }
        },
      },
    },
  },
});