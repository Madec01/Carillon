import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createGame,canPlace,clone,place,neighbors} from '../src/engine.js';

const modulePath=process.env.PLAYWRIGHT_MODULE;
const {chromium}=await import(modulePath?pathToFileURL(modulePath).href:'playwright');
const base=process.env.TEST_URL||'http://localhost:8080/';
const out=process.env.TEST_OUT||'/tmp/hexa-bloom-tests';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
const errors=[],requests=[];let assertions=0;
function ok(value,message){assert.ok(value,message);assertions++;}
async function state(page){return page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('hexa-bloom-v1'));return p.runs[p.active];});}
async function point(page,index){return page.evaluate(({index})=>{const p=JSON.parse(localStorage.getItem('hexa-bloom-v1')),s=p.runs[p.active],b=document.querySelector('#board').getBoundingClientRect(),radius=Math.max(...s.cells.map(c=>Math.max(Math.abs(c.q),Math.abs(c.r)))),r=Math.min(b.width/(Math.sqrt(3)*(radius*2+1)+.8),(b.height-45)/(radius*3+1.7),42),c=s.cells[index];return{x:b.left+b.width/2+Math.sqrt(3)*r*(c.q+c.r/2),y:b.top+b.height*.5+9+1.5*r*c.r*.91};},{index});}
async function settle(page){await page.waitForFunction(()=>!document.querySelector('.hand-card').disabled||JSON.parse(localStorage.getItem('hexa-bloom-v1')).runs[JSON.parse(localStorage.getItem('hexa-bloom-v1')).active].ended);}
async function put(page,h,i,touch=false){await page.locator(`.hand-card[data-slot="${h}"]`).click();const p=await point(page,i);if(touch)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);await settle(page);}
async function seed(page,game){await page.evaluate(g=>sessionStorage.setItem('test-next-run',JSON.stringify(g)),game);await page.addInitScript(()=>{const next=sessionStorage.getItem('test-next-run');if(!next)return;const g=JSON.parse(next),p=JSON.parse(localStorage.getItem('hexa-bloom-v1'));p.runs[g.mode]=g;p.active=g.mode;p.tutorial=true;p.unlocked=Math.max(p.unlocked,g.level);localStorage.setItem('hexa-bloom-v1',JSON.stringify(p));sessionStorage.removeItem('test-next-run');});await page.reload({waitUntil:'networkidle'});}
function observe(page){page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)requests.push(`${r.status()} ${r.url()}`);});}
try{
  for(const [name,w,h] of [['desktop',1440,1024],['iphone',390,844],['android-small',360,640]]){
    const context=await browser.newContext({viewport:{width:w,height:h},isMobile:w<500,hasTouch:w<500,deviceScaleFactor:w<500?2:1});
    const page=await context.newPage();observe(page);await page.goto(base,{waitUntil:'networkidle'});await page.locator('#rules-play').click();
    ok(await page.title()==='Hexa Bloom — faites fleurir les couleurs',`${name}: title`);
    const bounds=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,tools:document.querySelector('.tools').getBoundingClientRect().bottom,height:innerHeight}));
    ok(bounds.width===bounds.scroll,`${name}: no horizontal overflow`);if(w<500)ok(bounds.tools<=bounds.height,`${name}: tools in viewport`);
    const start=await state(page),target=start.cells.findIndex(c=>c.q===1&&c.r===0);
    await page.locator('.hand-card').first().click();const firstPoint=await point(page,target);
    if(w<500)await page.touchscreen.tap(firstPoint.x,firstPoint.y);else await page.mouse.click(firstPoint.x,firstPoint.y);
    await page.waitForFunction(()=>document.querySelector('#board').dataset.animating==='transfer');
    ok(await page.locator('#score').textContent()==='0',`${name}: points wait for the actual bloom`);
    await page.locator('#sound-btn').click();ok(await page.locator('#score').textContent()==='0',`${name}: sound toggle does not reveal final score early`);await page.locator('#sound-btn').click();
    await settle(page);let s=await state(page);ok(s.score===100&&s.moves===1,`${name}: actual placement and bloom`);
    await page.locator('#undo-btn').click();s=await state(page);ok(s.score===0&&s.moves===0,`${name}: undo restores board`);
    // Real drag from a hand card onto the canvas; the same Pointer Events path supports touch.
    const box=await page.locator('.hand-card').first().boundingBox(),dest=await point(page,target);
    if(w<500){const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2}]});for(let n=1;n<=8;n++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+box.width/2+(dest.x-box.x-box.width/2)*n/8,y:box.y+box.height/2+(dest.y-box.y-box.height/2)*n/8}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
    else{await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(dest.x,dest.y,{steps:8});await page.mouse.up();}
    await settle(page);s=await state(page);ok(s.score===100&&s.moves===1,`${name}: dragging places exactly once`);
    await page.reload({waitUntil:'networkidle'});s=await state(page);ok(s.score===100&&s.moves===1,`${name}: saved run resumes`);
    await page.locator('#sound-btn').click();await page.waitForTimeout(700);ok(await page.locator('#sound-btn').getAttribute('aria-label')==='Couper le son',`${name}: audio unlock`);
    await page.locator('#settings-btn').click();await page.locator('[data-setting="symbols"]').check();await page.locator('[data-setting="motion"]').check();await page.locator('#modal-close').click();
    await page.screenshot({path:`${out}/${name}.png`,fullPage:true});
    ok(await page.locator('body').evaluate(el=>el.classList.contains('reduced-motion')),`${name}: accessibility settings`);
    if(name==='desktop'){
      // Complete the first garden entirely through normal controls.
      for(let n=0;n<12&&!(await state(page)).ended;n++){
        s=await state(page);let best=null,value=-Infinity;
        for(let h=0;h<3;h++)for(let i=0;i<s.cells.length;i++)if(canPlace(s,i)){const t=clone(s);place(t,h,i);const v=t.score-s.score+t.cells.filter(c=>!c.stack.length&&!c.rock).length*10;if(v>value){value=v;best={h,i};}}
        assert.ok(best);await put(page,best.h,best.i);
      }
      await page.locator('#next-level').waitFor();ok((await state(page)).ended,'victory reached with normal controls');await page.locator('#next-level').click();ok((await state(page)).level===2,'next garden unlocks');
      // A designed mixed stack scenario exercises actual cascade animation and audio.
      const cascade=createGame(3);cascade.cells.forEach(c=>c.stack=[]);const a=cascade.cells.findIndex(c=>c.q===0&&c.r===0),b=cascade.cells.findIndex(c=>c.q===1&&c.r===0);
      cascade.cells[a].stack=[1,1,1,1,0,0,0,0];cascade.hand[0]=[1,1,1,1,1,1,0,0,0,0,0,0];await seed(page,cascade);await put(page,0,b);s=await state(page);ok(s.score===300&&s.bestCombo===2,'actual browser cascade x2');ok((await page.locator('#combo-value').textContent()).includes('×2'),'combo feedback');
      // Open modes from the same navigation available on mobile.
      await page.locator('#level-btn').click();await page.locator('#modal-daily').click();await page.locator('#daily-play').click();s=await state(page);ok(s.mode==='daily'&&s.cells.some(c=>c.rock)&&s.cells.some(c=>c.flower),'daily mode starts advanced layout');
      await page.locator('#level-btn').click();await page.locator('#modal-zen').click();await page.locator('#zen-play').click();ok((await state(page)).mode==='zen','zen mode starts');
      // Worker must finish precaching, then reload and play with networking disabled.
      await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
      await context.setOffline(true);await page.reload({waitUntil:'networkidle'});s=await state(page);const empty=s.cells.findIndex((c,i)=>canPlace(s,i));await put(page,0,empty);ok((await state(page)).moves===1,'offline reload and gameplay');await context.setOffline(false);
      // Full-board recovery consumes an earned tool, never asks for payment.
      const full=createGame(2);full.cells.forEach((c,i)=>{c.stack=[i%3];c.rock=0;});await seed(page,full);await page.locator('#hint-btn').click();await page.locator('#rescue').click();const p=await point(page,0);await page.mouse.click(p.x,p.y);await settle(page);ok((await state(page)).cells[0].stack.length===0,'blocked board recovery');
    }
    await context.close();console.log(`PASS ${name}`);
  }
  ok(errors.length===0,`No browser errors: ${errors.join('\n')}`);ok(requests.length===0,`No failed responses: ${requests.join('\n')}`);
  console.log(`PASS ${assertions} browser assertions. Screenshots: ${out}`);
}finally{await browser.close();}
