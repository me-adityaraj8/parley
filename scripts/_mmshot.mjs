import puppeteer from "puppeteer-core";
import { readFile } from "node:fs/promises";
const md = await readFile("README.md","utf8");
const blocks=[...md.matchAll(/```mermaid\n([\s\S]*?)```/g)].map(m=>m[1]);
const br = await puppeteer.launch({executablePath:"/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",headless:true,args:["--no-sandbox"]});
const p = await br.newPage();
await p.setViewport({width:1400,height:1000,deviceScaleFactor:1});
const pick=[2,3]; // sequence + perfect negotiation
for (const i of pick) {
  await p.setContent(`<!doctype html><body style="margin:0;background:#0d1117;padding:20px">
  <pre class="mermaid">${blocks[i-1].replace(/</g,"&lt;").replace(/>/g,"&gt;")}</pre>
  <script type="module">
   import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
   mermaid.initialize({startOnLoad:true,theme:"dark"});
  </script></body>`,{waitUntil:"networkidle0"});
  await new Promise(r=>setTimeout(r,2500));
  await p.screenshot({path:`/private/tmp/parley-shots/mm_${i}.png`,fullPage:true});
  console.log("rendered block",i);
}
await br.close();
