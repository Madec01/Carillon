import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const base=new URL(process.env.TEST_URL||'http://localhost:8080/');
if(!base.pathname.endsWith('/'))base.pathname+='/';
const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
const errors=[],requests=[];

try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  page.on('response',response=>{if(response.status()>=400)requests.push(`${response.status()} ${response.url()}`);});
  page.on('requestfailed',request=>requests.push(`${request.failure()?.errorText} ${request.url()}`));

  // Isolate rendering from application controls and storage while importing the
  // real modules through the same HTTP origin as the playable game.
  const harness=new URL('__renderer_harness.html',base).href;
  await page.route(harness,route=>route.fulfill({contentType:'text/html',body:`<!doctype html>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <link rel="icon" href="data:,">
    <style>body{margin:0;background:#10152b}canvas{width:390px;height:535px}</style>
    <canvas aria-label="Banc de test du rendu"></canvas>`}));
  await page.goto(harness);

  const result=await page.evaluate(async urls=>{
    const engine=await import(urls.engine);
    const {BoardRenderer}=await import(urls.renderer);
    let state=engine.createGame();
    const settings={motion:false};
    const renderer=new BoardRenderer(document.querySelector('canvas'),()=>state,()=>settings);
    const checks=[],types=[];
    const check=(condition,message)=>checks.push({passed:!!condition,message});
    const blank=level=>{const game=engine.createGame(level);game.cells.forEach(cell=>{cell.piece=null;cell.rock=0;});return game;};
    const put=(game,index,color=0,tier=0)=>{game.cells[index].void=false;game.cells[index].piece={color,tier};};

    const scenarios=[
      {name:'introductory cascade',setup:()=>{
        state=engine.createGame();return[0,23];
      }},
      {name:'planet attraction',setup:()=>{
        state=blank(4);put(state,11,0,1);put(state,12,0,1);put(state,0);put(state,30);
        state.hand[0]={color:0,tier:1};return[0,13];
      }},
      {name:'cross comet',setup:()=>{
        state=blank(1);put(state,11,0,2);put(state,12,0,2);put(state,3,1);put(state,14,2);
        state.hand[0]={color:0,tier:2};return[0,13];
      }},
      {name:'orbital rotation',setup:()=>{
        state=blank(13);put(state,6);put(state,7,1);state.moves=3;
        state.hand[0]={color:2,tier:0};return[0,34];
      }},
      {name:'meteorite damage',setup:()=>{
        state=blank(10);put(state,11);put(state,12);state.cells[7].rock=2;
        state.hand[0]={color:0,tier:0};return[0,13];
      }},
    ];

    for(const scenario of scenarios){
      const [hand,index]=scenario.setup();
      renderer.snapshot=structuredClone(state.cells);
      const move=engine.place(state,hand,index);
      for(const [step,event] of move.events.entries()){
        const original=JSON.stringify(event);
        let impacts=0;
        const completion=renderer.animate(event,{onImpact:()=>impacts++});
        // Exercise the real RAF timeline, shortening only its elapsed duration.
        renderer.animation.duration=90;
        await completion;
        types.push(event.type);
        const name=`${scenario.name}, step ${step+1} (${event.type})`;
        check(impacts===1,`${name}: impact fires exactly once`);
        check(JSON.stringify(event)===original,`${name}: engine event stays unchanged`);
        check(JSON.stringify(renderer.snapshot)===JSON.stringify(event.snapshot),`${name}: displayed snapshot reaches the authoritative result`);
      }
    }

    state=engine.createGame();
    renderer.snapshot=structuredClone(state.cells);
    const event=engine.place(state,0,23).events[0];
    settings.motion=true;
    let impacts=0;
    await renderer.animate(event,{onImpact:()=>impacts++});
    check(impacts===1,'reduced motion: impact fires exactly once');
    check(!renderer.animation,'reduced motion: no pending animation');

    settings.motion=false;
    renderer.snapshot=structuredClone(state.cells);
    const completion=renderer.animate(event,{onImpact:()=>impacts++});
    renderer.finishAnimation();
    renderer.finishAnimation();
    await completion;
    check(impacts===2,'forced completion: repeated finish does not repeat the impact');
    check(!renderer.animation,'forced completion: animation promise resolves and clears');
    await new Promise(resolve=>setTimeout(resolve,1000));
    check(renderer.frame===0,'settled effects: no animation frame remains scheduled');
    renderer.destroy();
    return{checks,types:[...new Set(types)].sort()};
  },{engine:new URL('src/engine.js',base).href,renderer:new URL('src/renderer.js',base).href});

  assert.equal(result.checks.length,47,'The complete renderer regression suite runs 47 checks');
  for(const check of result.checks)assert.ok(check.passed,check.message);
  assert.deepEqual(result.types,['comet','gravity','merge','orbit','place','rock'],'All six animation event types are exercised');
  assert.deepEqual(errors,[],`No browser errors: ${errors.join('\n')}`);
  assert.deepEqual(requests,[],`No failed requests: ${requests.join('\n')}`);
  console.log(`PASS ${result.checks.length} renderer assertions; six event types, reduced motion, forced completion and idle RAF. No browser errors.`);
}finally{
  await browser.close();
}
