import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";

function publicIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a > 0 && a < 224 && a !== 10 && a !== 127 &&
    !(a === 169 && b === 254) && !(a === 172 && b >= 16 && b <= 31) &&
    !(a === 192 && b === 168) && !(a === 100 && b >= 64 && b <= 127) &&
    !(a === 198 && (b === 18 || b === 19));
}

export async function readPublicHtml(value: string, timeoutMs = 6_000): Promise<string | null> {
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== "https:" || url.port || url.username || url.password ||
    !url.hostname.includes(".") || url.hostname.endsWith(".local") || url.hostname.endsWith(".internal") ||
    /^(?:\d{1,3}\.){3}\d{1,3}$/.test(url.hostname) || url.hostname.includes(":")) return null;
  let address: string;
  try {
    const resolved = await lookup(url.hostname, { all: true, family: 4 });
    if (!resolved.length || resolved.some(entry => !publicIpv4(entry.address))) return null;
    address = resolved[0].address;
  } catch { return null; }

  return new Promise(resolve => {
    const request = httpsRequest(url, {
      method: "GET", timeout: timeoutMs,
      headers: { Accept: "text/html", "User-Agent": "RoyalGlassCompanyResearch/1.0" },
      lookup: (_hostname, _options, callback) => callback(null, address, 4),
    }, response => {
      if (response.statusCode !== 200 || !response.headers["content-type"]?.includes("text/html") ||
        Number(response.headers["content-length"] || 0) > 1_000_000) {
        response.resume(); resolve(null); return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > 1_000_000) { response.destroy(); resolve(null); return; }
        chunks.push(chunk);
      });
      response.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      response.on("error", () => resolve(null));
    });
    request.on("timeout", () => { request.destroy(); resolve(null); });
    request.on("error", () => resolve(null));
    request.end();
  });
}
