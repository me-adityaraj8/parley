/**
 * Renders docs/diagrams/*.d2 → docs/diagrams/*.svg
 *
 * GitHub renders Mermaid natively but NOT D2, so D2 diagrams have to be
 * compiled to SVG and committed. Mermaid is used for everything that should
 * stay live-editable in the README; D2 is used for the showpiece
 * architecture figures where its layout engine is noticeably better.
 */
import { D2 } from "@terrastruct/d2";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DIR = "docs/diagrams";
const d2 = new D2();

const files = (await readdir(DIR)).filter((f) => f.endsWith(".d2"));
if (files.length === 0) {
  console.log("no .d2 files found");
  process.exit(0);
}

let failed = 0;
for (const file of files) {
  const src = await readFile(join(DIR, file), "utf8");
  try {
    const result = await d2.compile(src);
    const svg = await d2.render(result.diagram, result.renderOptions);
    const out = join(DIR, file.replace(/\.d2$/, ".svg"));
    await writeFile(out, svg);
    console.log(`✅ ${file} → ${out} (${(svg.length / 1024).toFixed(1)} KB)`);
  } catch (err) {
    failed++;
    console.error(`❌ ${file}: ${err instanceof Error ? err.message : err}`);
  }
}
process.exit(failed === 0 ? 0 : 1);
