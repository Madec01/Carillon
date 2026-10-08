import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createGame,canPlace,clone,place,bestHint} from '../src/engine.js';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const base=process.env.TEST_URL||'http://localhost:8080/';
const out=process.env.TEST_OUT||'/tmp/orbitale-tests';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
const errors=[],requests=[];let assertions=0;
function ok(value,message){assert.ok(value,message);assertions++;}
async function state(page){return page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('orbitale-v1'));return p.runs[p.active];});}
async function point(page,index){return page.evaluate(i=>{const c=document.querySelector('#board'),b=c.getBoundingClientRect();return{x:b.left+Number(c.dataset.gridX)+(i%5+.5)*Number(c.dataset.cellSize),y:b.top+Number(c.dataset.gridY)+(Math.floor(i/5)+.5)*Number(c.dataset.cellSize)};},index);}
async function settle(page){await page.waitForFunction(()=>!document.querySelector('#board-wrap').classList.contains('resolving'));}
async function put(page,h,i,touch=false){await page.locator(`.offer[data-slot="${h}"]`).click();const p=await point(page,i);if(touch)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);await settle(page);}
async function seed(page,game){await page.evaluate(g=>sessionStorage.setItem('test-next-run',JSON.stringify(g)),game);await page.addInitScript(()=>{const next=sessionStorage.getItem('test-next-run');if(!next)return;const g=JSON.parse(next),p=JSON.parse(localStorage.getItem('orbitale-v1'));p.runs[g.mode]=g;p.active=g.mode;p.tutorial=true;p.unlocked=Math.max(p.unlocked,g.level);p.seen??={};p.seen[`feature${g.level}`]=true;localStorage.setItem('orbitale-v1',JSON.stringify(p));sessionStorage.removeItem('test-next-run');});await page.reload({waitUntil:'networkidle'});}
function observe(page){page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)requests.push(`${r.status()} ${r.url()}`);});}
try{
  for(const [name,w,h] of [['desktop',1440,1024],['iphone',390,844],['android-small',360,640]]){
    const context=await browser.newContext({viewport:{width:w,height:h},isMobile:w<500,hasTouch:w<500,deviceScaleFactor:w<500?2:1});
    const page=await context.newPage();observe(page);await page.goto(base,{waitUntil:'networkidle'});await page.locator('#rules-play').click();
    ok((await page.title()).startsWith('Orbitale'),`${name}: title`);
    const bounds=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,tools:document.querySelector('#clear').getBoundingClientRect().bottom,height:innerHeight,board:document.querySelector('#board').getBoundingClientRect().height}));
    ok(bounds.width===bounds.scroll,`${name}: no horizontal overflow`);if(w<500){ok(bounds.tools<=bounds.height,`${name}: tools visible`);ok(bounds.board>bounds.height*.48,`${name}: large board`);}
    await page.locator('.offer').first().click();const firstPoint=await point(page,23);
    if(w<500)await page.touchscreen.tap(firstPoint.x,firstPoint.y);else await page.mouse.click(firstPoint.x,firstPoint.y);
    await page.waitForFunction(()=>document.querySelector('#board-wrap').classList.contains('resolving'));
    ok(await page.locator('#score').textContent()==='0',`${name}: score waits for merge`);
    await page.locator('#sound').click();ok(Number((await page.locator('#score').textContent()).replace(/\D/g,''))<210,`${name}: sound toggle does not reveal final score`);await page.locator('#sound').click();
    await settle(page);let s=await state(page);ok(s.score===210&&s.moves===1&&s.planets===1,`${name}: real two-stage cascade`);
    await page.locator('#undo').click();s=await state(page);ok(s.score===0&&s.moves===0,`${name}: undo restores state`);
    const box=await page.locator('.offer').first().boundingBox(),dest=await point(page,23);
    if(w<500){const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2}]});for(let n=1;n<=8;n++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+box.width/2+(dest.x-box.x-box.width/2)*n/8,y:box.y+box.height/2+(dest.y-box.y-box.height/2)*n/8}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
    else{await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(dest.x,dest.y,{steps:8});await page.mouse.up();}
    await settle(page);s=await state(page);ok(s.score===210&&s.moves===1,`${name}: drag places exactly once`);
    await page.reload({waitUntil:'networkidle'});s=await state(page);ok(s.score===210&&s.moves===1,`${name}: saved game resumes`);
    await page.locator('#sound').click();await page.waitForTimeout(350);ok(await page.locator('#sound').getAttribute('aria-label')==='Couper le son',`${name}: audio unlock`);
    await page.screenshot({path:`${out}/${name}.png`,fullPage:true});
    await page.locator('#settings').click();await page.locator('[data-setting="symbols"]').check();await page.locator('[data-setting="motion"]').check();await page.locator('#close-dialog').click();ok(await page.locator('body').evaluate(e=>e.classList.contains('reduced-motion')),`${name}: accessibility`);
    if(name==='desktop'){
      for(let n=0;n<20&&!(await state(page)).ended;n++){
        s=await state(page);let best=null,value=-Infinity;
        for(let hand=0;hand<3;hand++){const i=bestHint(s,hand);if(i<0)continue;const t=clone(s);place(t,hand,i);const v=t.score-s.score+(t.planets-s.planets)*110;if(v>value){value=v;best={hand,i};}}
        assert.ok(best);await put(page,best.hand,best.i);
      }
      await page.locator('#next-level').waitFor();ok((await state(page)).ended,'normal controls win');await page.locator('#next-level').click();ok((await state(page)).level===2,'next level unlocks');
      const nova=createGame(6);nova.cells.forEach(c=>{c.piece=null;c.rock=0;});for(const i of [16,17])nova.cells[i].piece={color:0,tier:2};nova.cells[3].piece={color:1,tier:0};nova.hand[0]={color:0,tier:2};await seed(page,nova);await put(page,0,18);s=await state(page);ok(s.novas===1&&s.cells[3].piece===null,'real comet clears column');
      const power=createGame(6);power.energy=100;power.cells.forEach(c=>{c.piece=null;c.rock=0;});for(const i of [6,18,28])power.cells[i].piece={color:2,tier:1};await seed(page,power);await page.locator('#gravity').click();let p=await point(page,18);await page.mouse.click(p.x,p.y);await settle(page);s=await state(page);ok(s.planets===1&&s.energy<100&&s.cells[18].piece.tier===2,'charged attraction tool');
      await page.locator('#daily').click();await page.locator('#daily-play').click();s=await state(page);ok(s.mode==='daily'&&s.cells.some(c=>c.orbit)&&s.gravity,'daily advanced layout');
      await page.locator('#zen').click();await page.locator('#zen-play').click();ok((await state(page)).mode==='zen','free mode');
      await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);await page.reload({waitUntil:'networkidle'});s=await state(page);await put(page,0,s.cells.findIndex((c,i)=>canPlace(s,i)));ok((await state(page)).moves===1,'offline reload and gameplay');await context.setOffline(false);
      // Undo in the short post-victory pause must cancel the stale victory callback.
      await page.locator('#settings').click();await page.locator('[data-setting="motion"]').uncheck();await page.locator('#close-dialog').click();
      const race=createGame(1);race.score=210;race.planets=1;await seed(page,race);await put(page,1,8);await page.locator('#undo').click();await page.waitForTimeout(550);
      ok(!(await state(page)).ended&&!(await page.locator('#dialog').evaluate(d=>d.open)),'undo cancels a pending victory');
      const full=createGame(2);full.cells.forEach((c,i)=>{if(!c.void)c.piece={color:i%3,tier:0};c.rock=0;});await seed(page,full);await page.locator('#hint').click();await page.locator('#rescue').click();p=await point(page,1);await page.mouse.click(p.x,p.y);await settle(page);ok((await state(page)).cells[1].piece===null,'full-board free recovery');
    }
    await context.close();console.log(`PASS ${name}`);
  }
  ok(errors.length===0,`No browser errors: ${errors.join('\n')}`);ok(requests.length===0,`No failed responses: ${requests.join('\n')}`);
  console.log(`PASS ${assertions} browser assertions. Screenshots: ${out}`);
}finally{await browser.close();}
