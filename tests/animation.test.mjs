import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleTransfer,stackStep} from '../src/renderer.js';

test('a transfer conserves every piece throughout the flight',()=>{
  for(const count of [1,5,10,32]){
    const timing={lead:55,flight:320,stagger:Math.min(38,220/Math.max(1,count-1))};
    for(let time=0;time<1000;time+=7){
      const f=sampleTransfer(count,time,timing);
      assert.equal(count-f.departed+f.flights.length+f.arrived,count);
      assert.ok(f.arrived<=f.departed&&f.departed<=count);
    }
  }
});
test('the destination remains empty until the first physical landing',()=>{
  const timing={lead:55,flight:320,stagger:38};
  assert.deepEqual(sampleTransfer(5,54,timing),{departed:0,arrived:0,flights:[]});
  const airborne=sampleTransfer(5,374,timing);assert.equal(airborne.arrived,0);assert.equal(airborne.flights.length,5);
  assert.equal(sampleTransfer(5,375,timing).arrived,1);
  const finished=sampleTransfer(5,528,timing);assert.equal(finished.arrived,5);assert.equal(finished.flights.length,0);
});
test('30, 60 and 120 Hz sampling all deliver each landing exactly once',()=>{
  for(const hz of [30,60,120]){
    let previous=0;const arrivals=[];
    for(let time=0;time<1400;time+=1000/hz){
      const f=sampleTransfer(12,time);
      assert.ok(f.arrived>=previous);
      for(let n=previous;n<f.arrived;n++)arrivals.push(n);
      previous=f.arrived;
    }
    assert.deepEqual(arrivals,Array.from({length:12},(_,i)=>i));
  }
});
test('tall and mixed stacks stay inside a bounded visual height',()=>{
  for(const r of [17,25,33])for(const n of [1,4,8,12,30,100]){assert.ok(stackStep(n,r)>0);assert.ok(stackStep(n,r)*(n-1)<=r*2+.001);}
});
