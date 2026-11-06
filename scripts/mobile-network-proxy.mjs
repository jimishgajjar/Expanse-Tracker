/** Loopback-only manual M14 harness. Never point this at a live ledger.
 * node scripts/mobile-network-proxy.mjs 3173 3175
 * Write backups/m14-network.json: {"delayMs":1500,"dropNextAction":true}.
 * Drops one Server Action response AFTER the upstream finishes; logs no request bodies.
 */
import http from "node:http";
import { mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { resolve } from "node:path";

const [targetPort, listenPort] = process.argv.slice(2).map(Number);
if (![targetPort, listenPort].every(n => Number.isInteger(n) && n >= 1024 && n <= 65535) || targetPort === listenPort)
  throw new Error("Supply two different local ports above 1023.");
mkdirSync("backups", { recursive: true });
const control = resolve("backups/m14-network.json");
function settings() {
  try { return JSON.parse(readFileSync(control, "utf8")); } catch { return {}; }
}
http.createServer((req, res) => {
  const host = `127.0.0.1:${listenPort}`;
  if (req.headers.host !== host || (req.headers.origin && req.headers.origin !== `http://${host}`)) {
    res.writeHead(403); res.end("Only same-origin loopback test requests are allowed"); return;
  }
  const config = settings();
  const delayMs = Math.min(5000, Math.max(0, Number(config.delayMs) || 0));
  const drop = req.method === "POST" && !!req.headers["next-action"] && config.dropNextAction === true;
  if (drop) writeFileSync(control, JSON.stringify({ ...config, dropNextAction: false }));
  setTimeout(() => {
    const headers = { ...req.headers, host: `127.0.0.1:${targetPort}` };
    if (headers.origin) headers.origin = `http://127.0.0.1:${targetPort}`;
    // Keep Next's same-origin check consistent with this local reverse proxy.
    delete headers["x-forwarded-host"];
    const upstream = http.request({ hostname: "127.0.0.1", port: targetPort, path: req.url, method: req.method, headers }, incoming => {
      if (drop) {
        incoming.resume();
        incoming.on("end", () => {
          const event = JSON.stringify({ at: new Date().toISOString(), event: "dropped-action-response-after-upstream", status: incoming.statusCode, delayMs });
          appendFileSync(resolve("backups/m14-network-events.jsonl"), event + "\n");
          console.log(event);
          res.destroy();
        });
        incoming.on("error", () => res.destroy());
      } else {
        res.writeHead(incoming.statusCode ?? 502, incoming.headers);
        incoming.pipe(res);
      }
    });
    upstream.setTimeout(60000, () => upstream.destroy());
    upstream.on("error", () => { if (!res.headersSent) res.writeHead(502); res.end("Local test upstream unavailable"); });
    req.pipe(upstream);
  }, delayMs);
}).listen(listenPort, "127.0.0.1", () => console.log(`M14 local fault harness: http://127.0.0.1:${listenPort} → loopback:${targetPort}; control ${control}`));
