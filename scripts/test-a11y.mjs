/**
 * Accessibility checks that a screenshot cannot prove.
 * The critical one: with prefers-reduced-motion, content must still be VISIBLE.
 */
import puppeteer from "puppeteer-core";
const BRAVE="/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const BASE=process.env.PARLEY_URL ?? "http://localhost:3100";
let pass=0,fail=0;
function ok(c,m){ if(c){pass++;console.log(`  ✅ ${m}`);}else{fail++;console.log(`  ❌ ${m}`);} }

const br = await puppeteer.launch({executablePath:BRAVE,headless:true,args:["--no-sandbox"]});

console.log("\n♿ Accessibility\n");
console.log("prefers-reduced-motion: reduce");
const p = await br.newPage();
await p.setViewport({width:1440,height:900});
await p.emulateMediaFeatures([{name:"prefers-reduced-motion",value:"reduce"}]);
await p.goto(BASE,{waitUntil:"domcontentloaded",timeout:45000});
await p.waitForSelector("h1",{timeout:30000});
await p.evaluate(()=>document.fonts.ready);
await new Promise(r=>setTimeout(r,1500));

const hidden = await p.evaluate(()=>{
  const check=[...document.querySelectorAll("h1, h2, [data-hero], [data-feature], [data-step]")];
  return check.filter(el=>{
    const s=getComputedStyle(el);
    return Number(s.opacity) < 0.9 && el.offsetParent !== null;
  }).map(el=>`${el.tagName}.${el.className.toString().slice(0,30)} opacity=${getComputedStyle(el).opacity}`);
});
ok(hidden.length===0, `all content visible with reduced motion (${hidden.length} hidden)`);
hidden.slice(0,5).forEach(h=>console.log("     "+h));

const h1 = await p.evaluate(()=>document.querySelector("h1")?.innerText.trim());
ok(Boolean(h1 && h1.length>5), `headline readable: "${h1}"`);

console.log("\nsemantics");
const a11y = await p.evaluate(()=>({
  h1Count: document.querySelectorAll("h1").length,
  skipLink: Boolean(document.querySelector('a[href="#main"]')),
  landmarks: {main:document.querySelectorAll("main").length, nav:document.querySelectorAll("nav").length, footer:document.querySelectorAll("footer").length},
  unlabelledButtons: [...document.querySelectorAll("button")].filter(b=>!b.getAttribute("aria-label") && !b.textContent?.trim()).length,
  imgsNoAlt: [...document.querySelectorAll("img")].filter(i=>!i.hasAttribute("alt")).length,
}));
ok(a11y.h1Count===1, `exactly one h1 (${a11y.h1Count})`);
ok(a11y.skipLink, "skip-to-content link present");
ok(a11y.landmarks.main===1 && a11y.landmarks.nav>=1, "main and nav landmarks present");
ok(a11y.unlabelledButtons===0, `every button has an accessible name (${a11y.unlabelledButtons} missing)`);
ok(a11y.imgsNoAlt===0, "no images missing alt");

console.log("\nkeyboard");
await p.keyboard.press("Tab");
const firstFocus = await p.evaluate(()=>{
  const el=document.activeElement;
  const s=getComputedStyle(el);
  return {tag:el?.tagName, text:el?.textContent?.trim().slice(0,24), outline:s.outlineStyle, ring:s.boxShadow.slice(0,30)};
});
ok(firstFocus.tag==="A", `first Tab reaches the skip link (${firstFocus.tag}: ${firstFocus.text})`);

await br.close();
console.log(`\n${fail===0?"✅":"❌"} ${pass} passed, ${fail} failed\n`);
process.exit(fail===0?0:1);
