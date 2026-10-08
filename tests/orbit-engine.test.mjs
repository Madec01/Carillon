import test from 'node:test';
import assert from 'node:assert/strict';
import {COLORS,createGame,clone,levelInfo,dailySeed,neighbors,canPlace,place,blocked,shuffle,usePower,bestHint,goalReached,validGame} from '../src/engine.js';
const blank=(level=1,mode='journey')=>{const s=createGame(level,mode);for(const c of s.cells){c.piece=null;c.rock=0;}return s;};
const put=(s,i,color=0,tier=0)=>{s.cells[i].void=false;s.cells[i].piece={color,tier};};
const mass=cells=>cells.reduce((n,c)=>n+(c.piece?3**c.piece.tier:0),0);
const occupied=cells=>cells.filter(c=>c.piece).length;
function groups(s,start) {const result=[start],p=s.cells[start].piece;if(!p)return [];for(let x=0;x<result.length;x++)for(const i of neighbors(s.cells,result[x]))if(!result.includes(i)&&s.cells[i].piece?.color===p.color&&s.cells[i].piece?.tier===p.tier)result.push(i);return result;}

test('all 30 levels have a valid 5 × 7 board with progressively unlocked mechanics',()=>{
  for(let level=1;level<=30;level++){
    const s=createGame(level),i=levelInfo(level);
    assert.equal(s.cells.length,35);assert.equal(validGame(s),true);assert.ok(s.cells.filter(c=>!c.void).length>=27);
    assert.equal(i.portals,level>=7);assert.equal(i.orbit,level>=13);assert.equal(!!i.gravity,level>=19);assert.equal(i.changingGravity,level>=25);
    for(let j=0;j<35;j++)if(!s.cells[j].void&&!s.cells[j].rock)for(const k of neighbors(s.cells,j))assert.ok(neighbors(s.cells,k).includes(j));
    for(const c of s.cells)if(c.orbit)assert.ok(!c.void&&!c.rock);
  }
  assert.equal(COLORS.length,5);
});

test('the introductory move creates a star → moon → planet cascade with increasing score',()=>{
  const s=createGame(),result=place(s,0,23);
  assert.equal(result.combo,2);assert.equal(s.score,210);assert.equal(s.planets,1);assert.deepEqual(s.cells[23].piece,{color:0,tier:2});
  assert.deepEqual(result.events.map(e=>e.type),['place','merge','merge']);assert.equal(s.bestCombo,2);assert.equal(result.won,false);
});

test('invalid placements and invalid hand indices leave state untouched',()=>{
  const s=createGame(11),before=clone(s),free=s.cells.findIndex((_,i)=>canPlace(s,i));
  for(const index of [-1,35,1.5,s.cells.findIndex(c=>c.piece),s.cells.findIndex(c=>c.rock)])assert.equal(place(s,0,index),null);
  assert.equal(place(s,3,free),null);assert.equal(place(s,0.5,free),null);assert.deepEqual(s,before);
});

test('three stars merge at the selected anchor and preserve stellar mass',()=>{
  const s=blank();put(s,11);put(s,12);s.hand[0]={color:0,tier:0};const before=mass(s.cells),r=place(s,0,13);
  assert.equal(mass(s.cells),before+1);assert.equal(occupied(s.cells),1);assert.deepEqual(s.cells[13].piece,{color:0,tier:1});
  const merge=r.events.find(e=>e.type==='merge');assert.deepEqual(new Set(merge.from),new Set([11,12]));assert.equal(merge.index,13);assert.equal(merge.points,30);
});

test('color AND tier must match; diagonal neighbors do not merge',()=>{
  for(const setup of [[[11,0,0],[12,0,1]],[[11,1,0],[12,0,0]],[[6,0,0],[18,0,0]]]){
    const s=blank();for(const [i,c,t] of setup)put(s,i,c,t);s.hand[0]={color:0,tier:0};assert.equal(place(s,0,13).combo,0);assert.equal(occupied(s.cells),3);
  }
});

test('new planets attract up to two matching-color bodies without changing their mass',()=>{
  const s=blank(4);put(s,11,0,1);put(s,12,0,1);put(s,0,0);put(s,30,0);put(s,4,1);s.hand[0]={color:0,tier:1};
  const before=mass(s.cells),r=place(s,0,13),attraction=r.events.find(e=>e.type==='gravity');
  assert.ok(attraction.local);assert.equal(attraction.moves.length,2);assert.equal(s.planets,1);assert.equal(mass(s.cells),before+3);assert.deepEqual(s.cells[4].piece,{color:1,tier:0});
  assert.ok(attraction.moves.every(m=>Math.abs(s.cells[m.to].q-s.cells[13].q)+Math.abs(s.cells[m.to].r-s.cells[13].r)===1));
});

test('three planets create a comet that clears their row, column and meteorites',()=>{
  const s=blank();put(s,11,0,2);put(s,12,0,2);put(s,3,1);put(s,14,2);put(s,30,2);s.cells[28].rock=2;s.hand[0]={color:0,tier:2};
  const r=place(s,0,13),comet=r.events.find(e=>e.type==='comet');assert.equal(s.novas,1);assert.equal(s.cells[13].piece,null);assert.equal(s.cells[3].piece,null);assert.equal(s.cells[14].piece,null);assert.equal(s.cells[28].rock,0);assert.ok(s.cells[30].piece);assert.equal(comet.axis,'cross');assert.equal(s.spades,3);
});

test('portals connect remote astres for a real merge',()=>{
  const s=blank(7);put(s,1);put(s,2);s.hand[0]={color:0,tier:0};const r=place(s,0,32);
  assert.equal(r.combo,1);assert.deepEqual(s.cells[32].piece,{color:0,tier:1});assert.equal(s.cells[1].piece,null);assert.equal(s.cells[2].piece,null);
});

test('a fusion chips each adjacent meteorite exactly once with its own snapshot',()=>{
  const s=blank(10);put(s,11);put(s,12);s.cells[7].rock=2;s.hand[0]={color:0,tier:0};const r=place(s,0,13);
  const rocks=r.events.filter(e=>e.type==='rock');assert.equal(rocks.length,1);assert.equal(s.cells[7].rock,1);assert.equal(rocks[0].snapshot[7].rock,1);
});

test('orbital rings rotate simultaneously every four moves',()=>{
  const s=blank(13);put(s,6,0);put(s,7,1);s.moves=3;s.hand[0]={color:2,tier:0};const before=mass(s.cells),r=place(s,0,34),orbit=r.events.find(e=>e.type==='orbit');
  assert.ok(orbit);assert.deepEqual(s.cells[7].piece,{color:0,tier:0});assert.deepEqual(s.cells[8].piece,{color:1,tier:0});assert.equal(s.cells[6].piece,null);assert.equal(mass(s.cells),before+1);
});

test('gravity compacts segments, respects rocks, and triggers arrival merges',()=>{
  const s=blank(19);put(s,1,0);put(s,3,0);s.hand[0]={color:0,tier:0};s.moves=2;const r=place(s,0,2);
  assert.ok(r.events.some(e=>e.type==='gravity'&&!e.local));assert.ok(r.combo>=1);assert.equal(occupied(s.cells),1);assert.ok(s.cells.some(c=>c.r===6&&c.piece?.tier===1));
  const t=blank(19);put(t,1,0);t.cells[16].rock=2;t.hand[0]={color:1,tier:0};t.moves=2;place(t,0,4);assert.deepEqual(t.cells[11].piece,{color:0,tier:0});assert.equal(t.cells[16].rock,2);
});

test('world five changes gravity only after the announced pulse',()=>{
  const s=blank(25);const before=s.gravity;s.moves=1;place(s,0,9);assert.equal(s.gravity,before);place(s,1,14);assert.notEqual(s.gravity,before);assert.equal(validGame(s),true);
});

test('free powers consume resources and a gravity well fuses distant matching astres',()=>{
  const s=blank();put(s,0,0);put(s,14,0);put(s,34,0);s.energy=100;
  const r=usePower(s,'gravity',0);assert.equal(r.combo,1);assert.equal(s.energy,17);assert.deepEqual(s.cells[0].piece,{color:0,tier:1});assert.equal(occupied(s.cells),1);
  const before=clone(s);assert.equal(usePower(s,'gravity',0),null);assert.deepEqual(s,before);
  assert.ok(usePower(s,'clear',0));assert.equal(s.spades,1);assert.equal(s.cells[0].piece,null);assert.equal(usePower(s,'clear',0),null);
});

test('full boards remain recoverable with a free eclipse',()=>{
  const s=blank();s.cells.forEach((c,i)=>{if(!c.void)c.piece={color:i%3,tier:0};});assert.equal(blocked(s),true);
  assert.ok(usePower(s,'clear',12));assert.equal(blocked(s),false);assert.equal(canPlace(s,12),true);
});

test('shuffles and eclipses recharge through play, without purchases',()=>{
  const s=blank();assert.equal(shuffle(s),true);assert.equal(s.shuffles,2);s.moves=7;place(s,0,12);assert.equal(s.shuffles,3);assert.equal(s.spades,3);
  s.shuffles=0;assert.equal(shuffle(s),false);s.ended=true;s.shuffles=3;assert.equal(shuffle(s),false);
});

test('victory requires both score and planets; zen has no end condition',()=>{
  const s=createGame(20),info=levelInfo(20);s.score=info.target;assert.equal(goalReached(s),false);s.planets=info.planetGoal;assert.equal(goalReached(s),true);s.mode='zen';assert.equal(goalReached(s),false);
});

test('daily sessions and normal replay offers are deterministic',()=>{
  assert.notEqual(dailySeed('2026-10-07'),dailySeed('2026-10-08'));
  for(const mode of ['daily','journey','zen']){
    const a=createGame(1,mode,dailySeed('2026-10-08')),b=clone(a);
    for(let move=0;move<20&&!a.ended;move++){const i=bestHint(a,move%3);if(i<0)break;place(a,move%3,i);place(b,move%3,i);}
    assert.deepEqual(a,b);
  }
});

test('event snapshots are independent and expose every authoritative board change',()=>{
  const s=createGame(),r=place(s,0,23),first=clone(r.events[0].snapshot);
  assert.deepEqual(r.events.at(-1).snapshot,s.cells);r.events.at(-1).snapshot[0].rock=2;assert.deepEqual(r.events[0].snapshot,first);assert.equal(s.cells[0].rock,0);
});

test('save validation rejects obsolete, corrupt, and unbounded states',()=>{
  const s=createGame();assert.ok(validGame(s));assert.equal(validGame(null),false);
  for(const mutate of [a=>a.version=1,a=>a.cells.pop(),a=>a.cells[0].q=9,a=>a.hand[0].tier=3,a=>a.rng=Infinity,a=>a.energy=101,a=>a.score=-1,a=>a.cells[0].rock=3,a=>a.cells[0].piece={color:99,tier:0},a=>a.gravity='sideways']){const copy=clone(s);mutate(copy);assert.equal(validGame(copy),false);}
});

test('random legal games preserve mass outside novas and leave no unresolved match',()=>{
  for(let level=1;level<=30;level++){
    const s=createGame(level);for(let turn=0;turn<35&&!s.ended;turn++){
      const legal=s.cells.map((_,i)=>i).filter(i=>canPlace(s,i));if(!legal.length)break;
      let previous=clone(s.cells);const r=place(s,turn%3,legal[(turn*13)%legal.length]);
      for(const event of r.events){const next=event.snapshot;if(event.type==='place')assert.equal(mass(next)-mass(previous),3**event.tier);else if(event.type==='merge')assert.equal(mass(previous)-mass(next),event.tier===3?27:0);else if(event.type==='comet')assert.equal(mass(previous)-mass(next),event.from.reduce((sum,i)=>sum+(previous[i].piece?3**previous[i].piece.tier:0),0));else assert.equal(mass(next),mass(previous));previous=next;}
      assert.ok(validGame(s));for(let i=0;i<35;i++)assert.ok(groups(s,i).length<3);
    }
  }
});

test('a legal planning bot completes all 30 progressive levels',()=>{
  for(let level=1;level<=30;level++){
    const s=createGame(level);
    for(let turn=0;turn<180&&!s.ended;turn++){
      let best;
      for(let h=0;h<3;h++){
        const i=bestHint(s,h);if(i<0)continue;const trial=clone(s),r=place(trial,h,i);
        const value=trial.score-s.score+(trial.planets-s.planets)*110+r.combo*20+trial.cells.filter(c=>!c.void&&!c.rock&&!c.piece).length*5;
        if(!best||value>best.value)best={h,i,value};
      }
      if(best)place(s,best.h,best.i);
      else {let rescued=null;if(s.energy>=100)for(let i=0;i<35&&!rescued;i++)rescued=usePower(s,'gravity',i);if(!rescued&&s.spades)rescued=usePower(s,'clear',s.cells.findIndex(c=>c.piece?.tier===0));if(!rescued)break;}
    }
    assert.equal(s.ended,true,`Level ${level} must be achievable`);assert.ok(validGame(s));
  }
});
