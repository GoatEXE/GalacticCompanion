import { copyFileSync, cpSync, existsSync, statSync, createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const staticFiles = ["personnel_manifest.json", "vehicle_manifest.json"];
const staticDirectories = ["Markdown", "Resources"];

function isContentRequest(requestPath) {
  return staticFiles.includes(requestPath)
    || staticDirectories.some((directory) => requestPath.startsWith(`${directory}/`));
}

function contentType(filePath) {
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".md")) return "text/markdown; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".pdf")) return "application/pdf";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

/**
 * Keep the current repository content as its source of truth while making it
 * available under Vite's GitHub Pages base in development and production.
 */
function referenceContentPlugin() {
  let resolvedConfig;

  return {
    name: "aor-reference-content",
    configResolved(config) {
      resolvedConfig = config;
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const requestUrl = request.url?.split("?")[0] ?? "";
        const base = resolvedConfig.base;
        const relativeUrl = requestUrl.startsWith(base)
          ? requestUrl.slice(base.length)
          : requestUrl.replace(/^\//, "");
        const contentPath = decodeURIComponent(relativeUrl).replace(/^\//, "");

        if (!isContentRequest(contentPath)) {
          next();
          return;
        }

        const filePath = path.resolve(repoRoot, contentPath);
        if (!filePath.startsWith(`${repoRoot}${path.sep}`) || !existsSync(filePath) || !statSync(filePath).isFile()) {
          next();
          return;
        }

        response.statusCode = 200;
        response.setHeader("Content-Type", contentType(filePath));
        createReadStream(filePath).pipe(response);
      });
    },
    closeBundle() {
      const outputDirectory = path.resolve(repoRoot, resolvedConfig.build.outDir);
      staticFiles.forEach((file) => copyFileSync(path.join(repoRoot, file), path.join(outputDirectory, file)));
      staticDirectories.forEach((directory) => {
        cpSync(path.join(repoRoot, directory), path.join(outputDirectory, directory), { recursive: true });
      });
    }
  };
}

export default defineConfig({
  // GitHub Pages serves Galactic Companion from /GalacticCompanion/.
  base: "/GalacticCompanion/",
  plugins: [referenceContentPlugin()]
});
