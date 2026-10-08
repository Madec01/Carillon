import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const html=await readFile(process.env.PORTABLE_FILE||'/tmp/Orbitale.html','utf8');
const browser=await chromium.launch({headless:true});
try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await ctx.setOffline(true);const page=await ctx.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  await page.setContent(html,{waitUntil:'networkidle'});await page.locator('#rules-play').click();await page.locator('.offer').first().click();
  const p=await page.locator('#board').evaluate(c=>{const b=c.getBoundingClientRect(),s=Number(c.dataset.cellSize);return{x:b.x+Number(c.dataset.gridX)+3.5*s,y:b.y+Number(c.dataset.gridY)+4.5*s};});
  await page.touchscreen.tap(p.x,p.y);await page.waitForFunction(()=>!document.querySelector('#board-wrap').classList.contains('resolving'));
  assert.equal(await page.locator('#score').textContent(),'210');assert.equal(await page.locator('#planet-count').textContent(),'1');
  await page.locator('#sound').click();assert.equal(await page.locator('#sound').getAttribute('aria-label'),'Couper le son');
  const assets=JSON.parse(html.match(/const BUNDLED_ASSETS=(.*);\n/)[1]);
  const decoded=await page.evaluate(async assets=>{const c=new AudioContext(),files=Object.entries(assets).filter(([k])=>k.includes('/audio/'));const results=await Promise.all(files.map(async([name,url])=>{const r=await fetch(url),data=await c.decodeAudioData(await r.arrayBuffer());return{name,duration:data.duration};}));await c.close();return results;},assets);
  assert.equal(decoded.length,5);assert.ok(decoded.every(a=>a.duration>0));assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  console.log('PASS portable HTML: offline two-stage fusion, sound control, all five audio samples decoded, no external requests or browser errors.');
}finally{await browser.close();}
