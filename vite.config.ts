import path from "path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";

// hero/ is a separate app (its own vite config, own "@" -> hero/src alias) whose
// source we import directly into this app. Vite's built-in resolve.alias runs
// before any user plugin (even enforce: "pre"), so a plain alias can't tell an
// hero/src importer from a root/src one — this plugin replaces that alias entirely
// and picks the base itself from the importing file's path.
function atAlias(): Plugin {
  const rootSrc = path.resolve(__dirname, "./src");
  const heroSrc = path.resolve(__dirname, "./hero/src");
  return {
    name: "at-alias",
    enforce: "pre",
    async resolveId(source, importer) {
      if (!source.startsWith("@/")) return null;
      const base = importer?.replace(/\\/g, "/").includes("/hero/src/") ? heroSrc : rootSrc;
      return this.resolve(path.join(base, source.slice(2)), importer, { skipSelf: true });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.NODE_ENV === "development" ? "/" : process.env.VITE_BASE_PATH || "/",
  optimizeDeps: {
    entries: ["src/main.tsx", "src/tempobook/**/*"],
    // Pre-bundle maplibre-gl so its web worker initialises correctly in dev.
    include: ["maplibre-gl"],
    // Do NOT pre-bundle onnxruntime-web (leaf scanner). esbuild's dep bundle
    // rewrites the import.meta.url that ort uses to locate its .wasm runtime,
    // so in dev the fetch 404s and Vite serves index.html instead — the WASM
    // loader then fails with "expected magic word 00 61 73 6d, found 3c 21 64
    // 6f" (that's "<!do"). Excluded, Vite serves it straight from
    // node_modules/onnxruntime-web/dist/ and the .wasm path resolves.
    exclude: ["onnxruntime-web"],
  },
  plugins: [
    atAlias(),
    react(),
  ],
  resolve: {
    preserveSymlinks: true,
    // hero/ ships its own node_modules for its standalone dev server. Node's nearest-wins
    // resolution would otherwise give files under hero/src a second, separate copy of these
    // packages (notably react itself), breaking hooks/context across the two instances.
    // Force everything onto this project's single copy instead.
    dedupe: ["react", "react-dom", "lucide-react", "three", "gsap", "lenis"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          maplibre: ["maplibre-gl"],
          recharts: ["recharts"],
        },
      },
    },
  },
  server: {
    // @ts-ignore
    allowedHosts: process.env.TEMPO === "true" ? true : undefined,
    host: process.env.TEMPO === "true" ? '0.0.0.0' : undefined,
    watch: {
      ignored: ['**/backend/**']
    }
  }
});
