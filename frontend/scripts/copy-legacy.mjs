// Keeps the plain-language "How it works" page (web/about.html) live alongside the Next.js app.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(here, "../../web"), OUT = path.resolve(here, "../out");
if (!fs.existsSync(path.join(WEB, "about.html"))) process.exit(0);
const html = fs.readFileSync(path.join(WEB, "about.html"), "utf8")
  .replace(/href="methods\.html"/g, 'href="/methods/"')
  .replace(/href="index\.html/g, 'href="/')
  .replace(/href="styles\.css"/g, 'href="/legacy.css"');
fs.writeFileSync(path.join(OUT, "about.html"), html);
fs.copyFileSync(path.join(WEB, "styles.css"), path.join(OUT, "legacy.css"));
for (const old of ["index.html", "methods.html"]) {
  if (old === "methods.html") fs.writeFileSync(path.join(OUT, old), '<!doctype html><meta http-equiv="refresh" content="0; url=/methods/"><link rel="canonical" href="/methods/">');
}
console.log("[legacy] about.html copied");
