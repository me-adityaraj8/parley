/**
 * Validates every ```mermaid block in the repo's markdown.
 *
 * GitHub renders Mermaid client-side; a syntax error shows the reader a red
 * error box instead of a diagram. Since that failure is invisible to
 * linters and typecheckers, it gets its own check.
 */
import puppeteer from "puppeteer-core";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";

const files = ["README.md", ...(await readdir("docs")).filter(f => f.endsWith(".md")).map(f => join("docs", f))];

const blocks = [];
for (const file of files) {
  const md = await readFile(file, "utf8");
  const re = /```mermaid\n([\s\S]*?)```/g;
  let m, i = 0;
  while ((m = re.exec(md))) blocks.push({ file, index: ++i, code: m[1] });
}

if (blocks.length === 0) {
  console.log("no mermaid blocks found");
  process.exit(0);
}
console.log(`\n🧜 Validating ${blocks.length} mermaid diagram(s)\n`);

const browser = await puppeteer.launch({ executablePath: BRAVE, headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setContent(`<!doctype html><body><div id="out"></div>
<script type="module">
  import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
  mermaid.initialize({ startOnLoad: false, theme: "dark" });
  window.__check = async (code) => {
    try { await mermaid.parse(code); return { ok: true }; }
    catch (e) { return { ok: false, error: String(e.message ?? e).split("\\n").slice(0,3).join(" ") }; }
  };
  window.__ready = true;
</script></body>`, { waitUntil: "networkidle0" });

await page.waitForFunction(() => window.__ready === true, { timeout: 30000 });

let failed = 0;
for (const b of blocks) {
  const kind = b.code.trim().split(/\s+/)[0];
  const res = await page.evaluate((code) => window.__check(code), b.code);
  if (res.ok) {
    console.log(`  ✅ ${b.file} #${b.index} (${kind})`);
  } else {
    failed++;
    console.log(`  ❌ ${b.file} #${b.index} (${kind}) — ${res.error}`);
  }
}

await browser.close();
console.log(`\n${failed === 0 ? "✅" : "❌"} ${blocks.length - failed}/${blocks.length} valid\n`);
process.exit(failed === 0 ? 0 : 1);
