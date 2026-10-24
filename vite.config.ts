/// <reference types="vitest/config" />
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const SAMPLES_DIR = fileURLToPath(new URL("./samples/", import.meta.url));
const MAX_SAMPLE_BYTES = 30 * 1024 * 1024;

/** Kehityspalvelimen POST /api/samples: tallentaa testinäytteen samples/-kansioon. */
function sampleSaver(): Plugin {
  return {
    name: "sample-saver",
    configureServer(server) {
      server.middlewares.use("/api/samples", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end();
          return;
        }
        const raw = new URL(req.url ?? "", "http://localhost").searchParams.get("name") ?? "nayte.json";
        const name = raw.replace(/\.json$/i, "").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 100) + ".json";
        const chunks: Buffer[] = [];
        let size = 0;
        req.on("data", (c: Buffer) => {
          size += c.length;
          if (size > MAX_SAMPLE_BYTES) req.destroy();
          else chunks.push(c);
        });
        req.on("end", async () => {
          try {
            const text = Buffer.concat(chunks).toString("utf8");
            if ((JSON.parse(text) as { format?: string }).format !== "modulaatiotreeni-sample") throw new Error("väärä muoto");
            await mkdir(SAMPLES_DIR, { recursive: true });
            await writeFile(SAMPLES_DIR + name, text);
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ name: `samples/${name}` }));
          } catch (e) {
            res.statusCode = 400;
            res.end(String(e));
          }
        });
      });
    },
  };
}

export default defineConfig({
  // Suhteelliset polut: toimii sekä juuressa että GitHub Pagesin alikansiossa (/<repo>/).
  base: "./",
  plugins: [react(), sampleSaver()],
  server: { port: 5173, strictPort: false, watch: { ignored: ["**/samples/**"] } },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
