import puppeteer from "puppeteer-core";
const BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const BASE = "http://localhost:3100";
const rid = Array.from({length:3},()=>Array.from({length:4},()=>"abcdefghjkmnpqrstuvwxyz23456789"[Math.floor(Math.random()*31)]).join("")).join("-");

const br = await puppeteer.launch({ executablePath: BRAVE, headless: true,
  args:["--no-sandbox","--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream","--autoplay-policy=no-user-gesture-required"]});
const page = await br.newPage();
const errs=[];
page.on("pageerror",e=>errs.push("pageerror: "+e.message));
page.on("console",m=>{if(m.type()==="error")errs.push("console: "+m.text())});
await page.goto(`${BASE}/r/${rid}`,{waitUntil:"networkidle0"});
await page.waitForSelector("#display-name");
await page.type("#display-name","Solo");
await page.waitForFunction(()=>{const b=[...document.querySelectorAll("button")].find(x=>x.textContent?.includes("Join call"));return b&&!b.disabled});
await page.evaluate(()=>{[...document.querySelectorAll("button")].find(x=>x.textContent?.includes("Join call"))?.click()});
await new Promise(r=>setTimeout(r,3000));

console.log("buttons:", JSON.stringify(await page.evaluate(()=>
  [...document.querySelectorAll("button")].map(b=>b.getAttribute("aria-label")||b.textContent?.trim().slice(0,20))
)));

await page.evaluate(()=>{[...document.querySelectorAll("button")].find(x=>x.getAttribute("aria-label")==="Chat")?.click()});
await new Promise(r=>setTimeout(r,1500));
console.log("chat input present:", await page.evaluate(()=>!!document.querySelector("#chat-input")));
console.log("aside present:", await page.evaluate(()=>!!document.querySelector("aside")));
console.log("errors:", JSON.stringify(errs.slice(0,8),null,1));
await br.close();
