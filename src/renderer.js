import {COLORS,SYMBOLS,canPlace} from './engine.js';

const TAU=Math.PI*2;
const FACE=.64;
const clamp01=n=>Math.max(0,Math.min(1,n));
const smooth=n=>n*n*(3-2*n);
const outCubic=n=>1-(1-n)**3;
const mix=(a,b,t)=>a+(b-a)*t;
const MATERIALS=[
  ['#b1f5dd','#66d6b3','#34ac8c','#258570'],
  ['#ffd3e0','#fa96b4','#df678c','#b8486f'],
  ['#fff0b5','#f6d475','#dfb345','#b78728'],
  ['#e2d7ff','#bca5f4','#9374d1','#7055aa'],
  ['#d1efff','#90cff3','#5ba7d7','#3c7fae'],
  ['#ffdec1','#f3b584','#d18a58','#a8653e'],
  ['#fff8df','#eee1bd','#cabb92','#a4946a'],
];
const tileSprites=new Map();

function hexVertices(x,y,r,sy=FACE){return Array.from({length:6},(_,i)=>{const a=(i*60-30)*Math.PI/180;return{x:x+Math.cos(a)*r,y:y+Math.sin(a)*r*sy};});}
function roundedHex(ctx,x,y,r,sy=FACE,corner=.16){
  const points=hexVertices(x,y,r,sy);ctx.beginPath();
  for(let i=0;i<6;i++){
    const prev=points[(i+5)%6],p=points[i],next=points[(i+1)%6];
    const a={x:mix(p.x,prev.x,corner),y:mix(p.y,prev.y,corner)};
    const b={x:mix(p.x,next.x,corner),y:mix(p.y,next.y,corner)};
    if(i===0)ctx.moveTo(a.x,a.y);else ctx.lineTo(a.x,a.y);
    ctx.quadraticCurveTo(p.x,p.y,b.x,b.y);
  }ctx.closePath();
}
export function hex(ctx,x,y,r,fill,stroke=null,sy=.89){roundedHex(ctx,x,y,r,sy,.11);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
function material(color){return MATERIALS[color<0?6:color]||MATERIALS[0];}
function sprite(color,r){
  const dpr=Math.min(globalThis.devicePixelRatio||1,2),key=`${color}:${r.toFixed(2)}:${dpr}`;
  if(tileSprites.has(key))return tileSprites.get(key);
  const depth=Math.max(4,r*.205),w=Math.ceil(r*2+8),h=Math.ceil(r*FACE*2+depth+8),x=w/2,y=r*FACE+3;
  const canvas=document.createElement('canvas');canvas.width=Math.ceil(w*dpr);canvas.height=Math.ceil(h*dpr);
  const c=canvas.getContext('2d');c.scale(dpr,dpr);const [light,base,side,dark]=material(color);
  // A rounded extrusion, shaded by face, with a fine seam between actual pieces.
  const body=c.createLinearGradient(0,y-r*FACE,0,y+r*FACE+depth);body.addColorStop(0,base);body.addColorStop(.68,side);body.addColorStop(1,dark);
  roundedHex(c,x,y+depth,r);c.fillStyle=body;c.fill();
  c.save();roundedHex(c,x,y+depth,r);c.clip();
  c.beginPath();c.moveTo(x,y);c.lineTo(x+r,y);c.lineTo(x+r,y+r+depth);c.lineTo(x,y+r+depth);c.closePath();c.fillStyle='#18382914';c.fill();c.restore();
  const top=c.createLinearGradient(x-r*.6,y-r*FACE,x+r*.45,y+r*FACE);top.addColorStop(0,light);top.addColorStop(.42,base);top.addColorStop(1,side);
  roundedHex(c,x,y,r);c.fillStyle=top;c.fill();c.strokeStyle='#ffffff85';c.lineWidth=.75;c.stroke();
  // The inset edge catches light like satin enamel, not a flat outlined polygon.
  roundedHex(c,x,y-.4,r*.89,FACE,.17);c.strokeStyle='#ffffff38';c.lineWidth=.75;c.stroke();
  c.save();roundedHex(c,x,y,r*.92);c.clip();const sheen=c.createLinearGradient(x-r,y-r*.6,x+r,y+r*.4);sheen.addColorStop(0,'#ffffff00');sheen.addColorStop(.35,'#ffffff24');sheen.addColorStop(.57,'#ffffff00');c.fillStyle=sheen;c.fillRect(x-r,y-r,r*2,r*2);c.restore();
  c.strokeStyle='#ffffff95';c.lineWidth=1.25;c.lineCap='round';c.beginPath();c.moveTo(x-r*.64,y-r*.36);c.lineTo(x-r*.21,y-r*.53);c.stroke();
  c.fillStyle='#ffffff9c';c.beginPath();c.ellipse(x-r*.08,y-r*.55,r*.055,r*.025,0,0,TAU);c.fill();
  const result={canvas,w,h,x,y};if(tileSprites.size>96)tileSprites.clear();tileSprites.set(key,result);return result;
}
function drawTile(ctx,x,y,r,color,{alpha=1,rotation=0,scale=1,tilt=1,symbol=false}={}){
  if(alpha<=0||scale<=0)return;const s=sprite(color,r);ctx.save();ctx.globalAlpha*=alpha;ctx.translate(x,y);ctx.rotate(rotation);ctx.scale(scale,scale*tilt);ctx.drawImage(s.canvas,-s.x,-s.y,s.w,s.h);
  if(symbol||color===-1){ctx.fillStyle='#ffffffd9';ctx.font=`900 ${r*.52}px Nunito, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(color===-1?'✦':SYMBOLS[color],0,0);}
  ctx.restore();
}
function shadow(ctx,x,y,r,alpha=.19){
  ctx.save();ctx.translate(x,y);ctx.scale(r*1.14,r*.48);const g=ctx.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,`rgba(33,65,47,${alpha})`);g.addColorStop(.55,`rgba(33,65,47,${alpha*.43})`);g.addColorStop(1,'rgba(33,65,47,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,1,0,TAU);ctx.fill();ctx.restore();
}
export function stackStep(count,r){return Math.min(Math.max(3.6,r*.205),r*2/Math.max(1,count-1));}
export function drawStack(ctx,x,y,r,stack,{symbols=false,alpha=1,small=false,lift=0,squash=0,count=true}={}){
  if(!stack?.length)return;ctx.save();ctx.globalAlpha*=alpha;
  shadow(ctx,x+2,y+r*.5+6,r,.2-Math.min(.09,lift*.001));
  ctx.translate(x,y-lift);ctx.scale(1+squash*.055,1-squash*.075);
  const step=stackStep(stack.length,r);
  for(let i=0;i<stack.length;i++)drawTile(ctx,0,-i*step,r,stack[i],{symbol:i===stack.length-1&&symbols});
  ctx.restore();
  if(!small&&count){ctx.save();ctx.globalAlpha*=alpha;const yy=y+r*.69+7;ctx.fillStyle='#fcfff5ed';ctx.beginPath();ctx.roundRect(x-10,yy-7,20,14,7);ctx.fill();ctx.fillStyle=material(stack.at(-1))[3];ctx.font='900 9px Nunito, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(stack.length,x,yy+.3);ctx.restore();}
}
export function drawHand(canvas,stack,selected,settings){
  const box=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(1,box.width*dpr);canvas.height=Math.max(1,box.height*dpr);const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
  drawStack(ctx,box.width/2,box.height*.69,Math.min(25,box.width*.28),stack,{small:true,symbols:settings.symbols,lift:selected?2:0});
}
// The same timeline drives visible source/target counts, flying pieces and impact sounds.
export function sampleTransfer(count,elapsed,{lead=65,stagger=38,flight=330}={}){
  const flights=[];let departed=0,arrived=0;
  for(let i=0;i<count;i++){const t=(elapsed-lead-i*stagger)/flight;if(t>=0)departed++;if(t>=1)arrived++;else if(t>=0)flights.push({index:i,t});}
  return{departed,arrived,flights};
}
const copyCells=cells=>cells.map(c=>({...c,stack:[...c.stack]}));

export class BoardRenderer{
  constructor(canvas,getState,getSettings){
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.getState=getState;this.getSettings=getSettings;
    this.points=[];this.particles=[];this.rings=[];this.impacts=new Map();this.labels=[];this.hover=-1;this.hint=-1;this.selected=-1;this.spade=false;this.snapshot=null;this.frame=0;this.animation=null;
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);this.resize();
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.finishAnimation();else this.request();});
  }
  resize(){const b=this.canvas.getBoundingClientRect();this.width=b.width;this.height=b.height;const dpr=Math.min(devicePixelRatio||1,2);this.canvas.width=Math.round(b.width*dpr);this.canvas.height=Math.round(b.height*dpr);this.ctx.setTransform(dpr,0,0,dpr,0,0);this.layout();this.draw();}
  layout(){const state=this.getState();if(!state)return;const radius=Math.max(...state.cells.map(c=>Math.max(Math.abs(c.q),Math.abs(c.r))));this.r=Math.min(this.width/(Math.sqrt(3)*(radius*2+1)+.8),(this.height-45)/(radius*3+1.7),42);const cy=this.height*.5+9;this.points=state.cells.map(c=>({x:this.width/2+Math.sqrt(3)*this.r*(c.q+c.r/2),y:cy+1.5*this.r*c.r*.91}));}
  hit(x,y){let best=-1,dist=Infinity;this.points.forEach((p,i)=>{const d=Math.hypot(p.x-x,(p.y-y)/.91);if(d<this.r*.92&&d<dist){dist=d;best=i;}});return best;}
  eventPoint(event){const b=this.canvas.getBoundingClientRect();return{x:event.clientX-b.left,y:event.clientY-b.top};}
  request(){if(!this.frame)this.frame=requestAnimationFrame(t=>{this.frame=0;this.draw(t);if(this.animation||this.particles.length||this.rings.length||this.impacts.size||this.labels.length)this.request();});}
  impact(index,strength=1){if(!this.getSettings().motion)this.impacts.set(index,{start:performance.now(),strength});this.request();}
  burst(index,color,count=24){
    const p=this.points[index];if(!p||this.getSettings().motion||document.hidden)return;const start=performance.now();
    for(let i=0;i<count;i++){const angle=i/count*TAU+(Math.random()-.5)*.3,speed=28+Math.random()*48;this.particles.push({x:p.x,y:p.y-18,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed*.7-30,start,duration:600+Math.random()*420,size:1.5+Math.random()*2.8,color:i%4===0?'#f2d687':COLORS[color]||'#f2d687',star:i%3===0,rotation:Math.random()*TAU});}
    this.particles=this.particles.slice(-110);this.rings.push({x:p.x,y:p.y-8,start,color:COLORS[color]||'#eac572'});this.request();
  }
  label(index,text,color=0,below=false){if(this.getSettings().motion)return;const p=this.points[index];if(p){this.labels.push({x:p.x,y:p.y+(below?this.r:-35),text,color:material(color)[3],start:performance.now()});this.request();}}
  async animate(event,{onTile=()=>{},onImpact=()=>{}}={}){
    if(!event.snapshot){if(event.type==='rock'){this.impact(event.index,.7);this.burst(event.index,2,9);}return;}
    const before=copyCells(this.snapshot||this.getState().cells),after=copyCells(event.snapshot);
    if(this.getSettings().motion||document.hidden){this.snapshot=after;onImpact();this.request();return;}
    this.layout();let duration=400,timing={};
    if(event.type==='transfer'){
      const a=this.points[event.from],b=this.points[event.to];timing={lead:55,flight:Math.min(365,285+Math.hypot(a.x-b.x,a.y-b.y)*.3),stagger:Math.min(38,220/Math.max(1,event.count-1))};duration=timing.lead+timing.flight+(event.count-1)*timing.stagger+115;
    }else if(event.type==='clear')duration=690;
    return new Promise(resolve=>{this.animation={...event,before,after,start:performance.now(),duration,timing,resolve,onTile,onImpact,landed:0,impacted:false};this.canvas.dataset.animating=event.type;this.request();});
  }
  finishAnimation(){const a=this.animation;if(!a)return;this.snapshot=a.after;if(!a.impacted){a.impacted=true;a.onImpact();}this.animation=null;delete this.canvas.dataset.animating;a.resolve();}
  animationCells(now){
    const a=this.animation;if(!a)return this.snapshot||this.getState().cells;
    const elapsed=now-a.start,t=clamp01(elapsed/a.duration);a.elapsed=elapsed;
    const cells=copyCells(a.before);
    if(a.type==='place'){
      a.drop=clamp01(elapsed/245);if(a.drop>=1){cells[a.index]=a.after[a.index];if(!a.impacted){a.impacted=true;this.impact(a.index,1.4);a.onImpact();}}
    }else if(a.type==='transfer'){
      const sample=sampleTransfer(a.count,elapsed,a.timing);a.sample=sample;
      if(sample.departed)cells[a.from].stack.splice(-sample.departed);
      cells[a.to].stack.push(...Array(sample.arrived).fill(a.color));
      if(sample.arrived>a.landed){for(let n=a.landed;n<sample.arrived;n++)a.onTile(n,a.count);a.landed=sample.arrived;this.impact(a.to,.65);}
      if(sample.arrived===a.count&&!a.impacted){a.impacted=true;a.onImpact();}
    }else if(a.type==='clear'){
      a.open=clamp01((elapsed-135)/420);
      if(elapsed>=135){cells[a.index]=a.after[a.index];if(!a.impacted){a.impacted=true;this.burst(a.index,a.color,22+Math.min(a.combo,4)*4);a.onImpact();}}
    }
    if(t>=1){this.finishAnimation();return this.snapshot;}
    return cells;
  }
  drawSlot(ctx,c,i){
    const p=this.points[i],r=this.r,legal=!c.rock&&!c.stack.length,active=(i===this.hover&&this.selected>=0)||i===this.hint;
    // Recessed ceramic wells, separated by a soft rim instead of a dark wire grid.
    hex(ctx,p.x,p.y+3,r*.94,'#d9e2d0');hex(ctx,p.x,p.y,r*.94,'#f7f9ef','#ffffffc9');
    const well=ctx.createLinearGradient(p.x,p.y-r,p.x,p.y+r);well.addColorStop(0,c.flower&&!c.bloomed?'#e4e9cb':'#dfe9d8');well.addColorStop(.55,c.flower&&!c.bloomed?'#f0f2dc':'#edf3e4');well.addColorStop(1,'#f5f8eb');
    hex(ctx,p.x,p.y+1,r*.84,well,'#cfddc655');
    if(c.sun){hex(ctx,p.x,p.y,r*.83,'#f9edc9','#e9cc76');ctx.fillStyle='#c4a251';ctx.font=`${r*.55}px Nunito`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('☀',p.x,p.y);}
    if(c.flower){ctx.fillStyle=c.bloomed?'#73a778':'#b9c589';ctx.font=`${r*.59}px Nunito`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(c.bloomed?'✿':'❀',p.x,p.y);}
    if(c.rock){shadow(ctx,p.x+2,p.y+r*.45,r*.65,.18);hex(ctx,p.x,p.y-1,r*.69,'#a0af96');const stone=ctx.createLinearGradient(p.x-r,p.y-r,p.x+r,p.y+r);stone.addColorStop(0,'#e1e4d9');stone.addColorStop(1,'#b8c2ad');hex(ctx,p.x,p.y-7,r*.69,stone,'#eef0e4');ctx.strokeStyle='#a2af98';ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(p.x-4,p.y-r*.5);ctx.lineTo(p.x+3,p.y-7);ctx.lineTo(p.x-5,p.y+2);ctx.lineTo(p.x+3,p.y+r*.25);ctx.stroke();ctx.fillStyle='#fafff2';ctx.font='900 10px Nunito';ctx.textAlign='center';ctx.fillText(c.rock,p.x+r*.32,p.y+2);}
    if(legal&&active){hex(ctx,p.x,p.y,r*.83,'#cde9c68a','#8dbd91');ctx.strokeStyle='#ffffffdd';ctx.lineWidth=1;roundedHex(ctx,p.x,p.y,r*.73,.89);ctx.stroke();ctx.fillStyle='#79a478';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`700 ${r*.6}px Nunito`;ctx.fillText('+',p.x,p.y);}
    else if(legal&&this.selected>=0){ctx.fillStyle='#b8caaa';ctx.beginPath();ctx.arc(p.x,p.y,2,0,TAU);ctx.fill();}
  }
  draw(now=performance.now()){
    const ctx=this.ctx,state=this.getState();if(!state||!this.width)return;this.layout();ctx.clearRect(0,0,this.width,this.height);
    const cells=this.animationCells(now),a=this.animation,r=this.r*.78;
    ctx.save();ctx.setLineDash([1,7]);ctx.strokeStyle='#d4dfc7';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(this.width/2,this.height*.5+17,this.r*(Math.max(...cells.map(c=>Math.abs(c.q)))+1)*1.64,this.height*.42,0,0,TAU);ctx.stroke();ctx.restore();
    cells.forEach((c,i)=>this.drawSlot(ctx,c,i));
    for(const ring of this.rings){const t=clamp01((now-ring.start)/650);ctx.save();const p=ring;const rr=this.r*(.5+t*2.6);const glow=ctx.createRadialGradient(p.x,p.y,1,p.x,p.y,rr);glow.addColorStop(0,ring.color+'44');glow.addColorStop(1,ring.color+'00');ctx.globalAlpha=(1-t)*.9;ctx.fillStyle=glow;ctx.fillRect(p.x-rr,p.y-rr,rr*2,rr*2);ctx.strokeStyle=ring.color;ctx.lineWidth=2.5*(1-t)+.3;ctx.beginPath();ctx.ellipse(p.x,p.y,rr,rr*.64,0,0,TAU);ctx.stroke();ctx.strokeStyle='#fffaf0';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(p.x,p.y,rr*.82,rr*.52,0,0,TAU);ctx.stroke();ctx.restore();}
    const sorted=cells.map((c,i)=>({c,i})).sort((v,w)=>this.points[v.i].y-this.points[w.i].y);
    for(const {c,i} of sorted){
      const p=this.points[i],impact=this.impacts.get(i);let squash=0,lift=0;
      if(impact){const age=(now-impact.start)/1000;squash=Math.sin(age*24)*Math.exp(-age*9)*impact.strength;if(age>.55)this.impacts.delete(i);}
      if(a?.type==='clear'&&a.index===i&&a.elapsed<135){const t=a.elapsed/135;squash=Math.sin(t*Math.PI)*1.7;lift=-Math.sin(t*Math.PI)*1.5;}
      drawStack(ctx,p.x,p.y-3,r,c.stack,{symbols:this.getSettings().symbols,alpha:this.spade&&i===this.hover?.5:1,squash,lift});
    }
    if(!a&&this.selected>=0&&this.hover>=0&&canPlace(state,this.hover)&&state.hand[this.selected]){const p=this.points[this.hover];drawStack(ctx,p.x,p.y-3,r,state.hand[this.selected],{symbols:this.getSettings().symbols,alpha:.5,lift:9,count:false});}
    if(a?.type==='place'&&a.drop<1){const p=this.points[a.index],e=outCubic(a.drop);drawStack(ctx,p.x,p.y-3,r,a.after[a.index].stack,{symbols:this.getSettings().symbols,lift:(1-e)*this.r*1.9,alpha:.5+.5*e,count:false});}
    if(a?.type==='transfer'){
      const from=this.points[a.from],to=this.points[a.to];
      for(const item of a.sample?.flights||[]){
        const t=item.t,e=smooth(t),arc=Math.sin(t*Math.PI),sourceN=a.before[a.from].stack.length,targetN=a.before[a.to].stack.length+item.index;
        const sy=from.y-3-(sourceN-item.index-1)*stackStep(sourceN,r),dy=to.y-3-targetN*stackStep(targetN+1,r);
        const x=mix(from.x,to.x,e),y=mix(sy,dy,e)-arc*(this.r*1.1+Math.abs(to.x-from.x)*.08);
        shadow(ctx,x,mix(from.y,to.y,e)+r*.48,r*(.6+arc*.13),.07*(1-arc*.3));
        drawTile(ctx,x,y,r,a.color,{rotation:Math.sign(to.x-from.x||1)*arc*.14,tilt:1-arc*.17,scale:1+arc*.045,symbol:this.getSettings().symbols});
      }
    }
    if(a?.type==='clear'&&a.elapsed>=135){
      const p=this.points[a.index],beforeN=a.before[a.index].stack.length,remainingN=a.after[a.index].stack.length;
      for(let n=0;n<a.count;n++){
        const t=clamp01((a.elapsed-135-n*Math.min(9,80/a.count))/380);if(t>=1)continue;
        const angle=n*2.39996,spread=outCubic(t)*r*(.65+n%3*.2),x=p.x+Math.cos(angle)*spread,y=p.y-3-(remainingN+n)*stackStep(beforeN,r)-Math.sin(t*Math.PI)*r*.8-Math.sin(angle)*spread*.28;
        drawTile(ctx,x,y,r,a.before[a.index].stack[remainingN+n],{alpha:(1-t)**1.6,scale:1-.88*outCubic(t),rotation:Math.sin(angle)*t*.3});
      }
    }
    this.drawParticles(now);this.rings=this.rings.filter(p=>now-p.start<650);
    this.labels=this.labels.filter(l=>now-l.start<1000);for(const l of this.labels){const t=clamp01((now-l.start)/1000);ctx.save();ctx.globalAlpha=Math.min(1,t*8)*(1-clamp01((t-.65)/.35));ctx.translate(l.x,l.y-22*outCubic(t));ctx.font='1000 18px Nunito, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.strokeStyle='#fffff4';ctx.lineWidth=4;ctx.lineJoin='round';ctx.strokeText(l.text,0,0);ctx.fillStyle=l.color;ctx.fillText(l.text,0,0);ctx.restore();}
  }
  drawParticles(now){
    const ctx=this.ctx;this.particles=this.particles.filter(p=>now-p.start<p.duration);
    for(const p of this.particles){const age=(now-p.start)/1000,t=(now-p.start)/p.duration;ctx.save();ctx.globalAlpha=Math.sin(Math.min(1,t*4)*Math.PI/2)*(1-t)**1.25;ctx.translate(p.x+p.vx*age,p.y+p.vy*age+18*age*age);ctx.rotate(p.rotation+age*.9);ctx.fillStyle=p.color;
      if(p.star){const r=p.size*(1-.4*t);ctx.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,rr=i%2?r*.24:r;i?ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr):ctx.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);}ctx.closePath();ctx.fill();}
      else{ctx.beginPath();ctx.ellipse(0,0,p.size,p.size*.5,0,0,TAU);ctx.fill();}ctx.restore();}
  }
}
