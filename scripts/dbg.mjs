import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({
  executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  headless: true, args: ["--no-sandbox"],
});
const p = await b.newPage();
await p.goto("http://localhost:3100", { waitUntil: "networkidle0" });
await new Promise(r => setTimeout(r, 3000));
console.log(JSON.stringify(await p.evaluate(() => ({
  elements: [...document.querySelectorAll("[data-anim]")].map(el => ({
    anim: el.dataset.anim,
    tag: el.tagName,
    text: el.textContent.trim().slice(0, 24),
    inlineStyle: el.getAttribute("style"),
    computedOpacity: getComputedStyle(el).opacity,
    display: getComputedStyle(el).display,
  })),
  bodyFont: getComputedStyle(document.body).fontFamily,
  varGeistSans: getComputedStyle(document.body).getPropertyValue("--font-geist-sans").slice(0,40),
  varFontSans: getComputedStyle(document.body).getPropertyValue("--font-sans").slice(0,40),
  h1Font: getComputedStyle(document.querySelector("h1")).fontFamily,
}), null, 2), null, 2));
await b.close();
