// Complete all authored missions with ordinary legal placements and free rescue tools.
import assert from 'node:assert/strict';
import {createGame,clone,place,bestHint,usePower,validGame,levelInfo} from '../src/engine.js';
const reports=[];
for(let level=1;level<=30;level++) {
  const s=createGame(level);let actions=0,rescues=0;
  while(!s.ended&&actions++<180) {
    let best=null;
    for(let hand=0;hand<3;hand++) {
      const index=bestHint(s,hand);if(index<0)continue;
      const trial=clone(s),result=place(trial,hand,index);
      const value=trial.score-s.score+(trial.planets-s.planets)*110+result.combo*20+trial.cells.filter(c=>!c.void&&!c.rock&&!c.piece).length*5;
      if(!best||value>best.value)best={hand,index,value};
    }
    if(best)place(s,best.hand,best.index);
    else {
      let rescued=null;
      if(s.energy>=100)for(let i=0;i<35&&!rescued;i++)rescued=usePower(s,'gravity',i);
      if(!rescued&&s.spades)rescued=usePower(s,'clear',s.cells.findIndex(c=>c.piece?.tier===0));
      if(!rescued)break;
      rescues++;
    }
    assert.ok(validGame(s),`Mission ${level}: état valide après chaque action`);
  }
  const info=levelInfo(level);
  assert.ok(s.ended&&s.score>=info.target&&s.planets>=info.planetGoal,`Mission ${level}: objectifs atteignables avec des actions légales`);
  reports.push({mission:level,coups:s.moves,score:s.score,planètes:s.planets,novas:s.novas,combo:s.bestCombo,secours:rescues});
}
console.table(reports);
console.log('PASS : 30/30 missions terminées avec des actions légales.');
