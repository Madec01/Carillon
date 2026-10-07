// Solve every authored seed with legal placements only, to guard against impossible goals.
import assert from 'node:assert/strict';
import {createGame,canPlace,place,clone,removeStack,levelInfo} from '../src/engine.js';
const reports=[];
for(let level=1;level<=30;level++){
  const s=createGame(level);let actions=0,removes=0;
  while(!s.ended&&actions++<180){
    let best=null,value=-Infinity;
    for(let h=0;h<3;h++)for(let i=0;i<s.cells.length;i++)if(canPlace(s,i)){
      const trial=clone(s),info=levelInfo(level);place(trial,h,i);
      const flowers=(trial.flowers-s.flowers)*1200;
      const harvest=info.harvest?Math.min(Math.max(0,info.harvest.target-s.harvest[info.harvest.color]),trial.harvest[info.harvest.color]-s.harvest[info.harvest.color])*35:0;
      const empty=trial.cells.filter(c=>!c.rock&&!c.stack.length).length;
      const flowerProgress=trial.cells.reduce((v,c)=>v+(c.flower&&!c.bloomed?c.stack.length*5:0),0);
      const score=(trial.score-s.score)*(s.score<info.target?1:.2)+flowers+harvest+empty*18+flowerProgress;
      if(score>value){best={h,i};value=score;}
    }
    if(best)place(s,best.h,best.i);
    else if(s.spades){const i=s.cells.map((c,i)=>({i,n:c.stack.length})).sort((a,b)=>b.n-a.n)[0].i;removeStack(s,i);removes++;}
    else break;
  }
  assert.ok(s.ended,`Garden ${level} could not be solved by the reference player`);
  reports.push({level,moves:s.moves,score:s.score,flowers:s.flowers,removes});
}
console.table(reports);
console.log('PASS 30/30 gardens completed with legal actions.');
