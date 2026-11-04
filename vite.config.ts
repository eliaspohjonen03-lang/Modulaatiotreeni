/// <reference types="vitest/config" />
import { mkdir, writeFile } from "node:fs/promises";
import type { IncomingMessage } from "node:http";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const SAMPLES_DIR = fileURLToPath(new URL("./samples/", import.meta.url));
const MAX_SAMPLE_BYTES = 30 * 1024 * 1024;

/**
 * Hylkää muilta sivustoilta tulevat pyynnöt. Selain lähettää ristiinpyynnön
 * kehityspalvelimelle (esim. http://localhost:5173) ilman CORS-esitarkistusta,
 * jos Content-Type on text/plain, joten tallennus ei saa luottaa pelkkään CORSiin.
 */
function isSameOriginRequest(req: IncomingMessage): boolean {
  const site = req.headers["sec-fetch-site"];
  if (site !== undefined && site !== "same-origin") return false;
  const origin = req.headers.origin;
  if (origin !== undefined) {
    try {
      if (new URL(origin).host !== req.headers.host) return false;
    } catch {
      return false;
    }
  }
  // application/json pakottaa selaimen esitarkistukseen, jonka Viten CORS-asetus rajaa.
  return (req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase() === "application/json";
}

/** Kehityspalvelimen POST /api/samples: tallentaa testinäytteen samples/-kansioon. */
function sampleSaver(): Plugin {
  return {
    name: "sample-saver",
    configureServer(server) {
      server.middlewares.use("/api/samples", (req, res) => {
        const fail = (status: number, message = "") => {
          if (res.headersSent || res.writableEnded) return;
          res.statusCode = status;
          res.end(message);
        };
        if (req.method !== "POST") return fail(405);
        if (!isSameOriginRequest(req)) return fail(403, "Vain sovelluksen omat pyynnöt sallitaan.");
        const raw = new URL(req.url ?? "", "http://localhost").searchParams.get("name") ?? "nayte.json";
        const name = raw.replace(/\.json$/i, "").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 100) + ".json";
        const chunks: Buffer[] = [];
        let size = 0;
        let tooLarge = false;
        req.on("data", (c: Buffer) => {
          if (tooLarge) return;
          size += c.length;
          if (size > MAX_SAMPLE_BYTES) {
            tooLarge = true;
            chunks.length = 0;
            fail(413, "Näyte on liian suuri.");
            req.destroy();
          } else chunks.push(c);
        });
        req.on("end", async () => {
          if (tooLarge) return;
          try {
            const text = Buffer.concat(chunks).toString("utf8");
            if ((JSON.parse(text) as { format?: string }).format !== "modulaatiotreeni-sample") throw new Error("väärä muoto");
            await mkdir(SAMPLES_DIR, { recursive: true });
            // "wx": olemassa olevaa näytettä ei koskaan korvata.
            await writeFile(SAMPLES_DIR + name, text, { flag: "wx" });
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ name: `samples/${name}` }));
          } catch (e) {
            if ((e as NodeJS.ErrnoException).code === "EEXIST") fail(409, "Samanniminen näyte on jo olemassa.");
            else if (e instanceof SyntaxError || (e as Error).message === "väärä muoto") fail(400, "Virheellinen näytetiedosto.");
            else fail(500, "Tallennus epäonnistui.");
          }
        });
      });
    },
  };
}

/**
 * Sisältöturvakäytäntö tuotantoversioon (GitHub Pages ei salli omia otsakkeita,
 * joten se annetaan meta-tagina). Kehityspalvelimessa ei käytetä, koska Vite
 * lisää sinne omia inline-skriptejään.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join("; ");

function contentSecurityPolicy(): Plugin {
  return {
    name: "content-security-policy",
    apply: "build",
    transformIndexHtml: () => [
      { tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: CONTENT_SECURITY_POLICY }, injectTo: "head-prepend" },
    ],
  };
}

export default defineConfig({
  // Suhteelliset polut: toimii sekä juuressa että GitHub Pagesin alikansiossa (/<repo>/).
  base: "./",
  plugins: [react(), sampleSaver(), contentSecurityPolicy()],
  server: { port: 5173, strictPort: false, watch: { ignored: ["**/samples/**"] } },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
