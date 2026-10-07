// Pure game rules. A stack is ordered from bottom to top.
export const COLORS = ['#69c7b5', '#f28c9d', '#edc96c', '#b39be0', '#7aaddb', '#dca071'];
export const COLOR_NAMES = ['menthe', 'rose', 'miel', 'lavande', 'ciel', 'abricot'];
export const SYMBOLS = ['✦', '♥', '●', '✿', '◆', '☀'];
export const WORLDS = [
  { name: 'Le jardin éveillé', short: 'Jardin', accent: '#277766', subtitle: 'Un peu de couleur, beaucoup de douceur.' },
  { name: 'La clairière secrète', short: 'Clairière', accent: '#59815f', subtitle: 'Chaque obstacle cache une nouvelle pousse.' },
  { name: 'Le verger doré', short: 'Verger', accent: '#ae7938', subtitle: 'Des couleurs à récolter, des chaînes à inventer.' },
  { name: 'Les jardins suspendus', short: 'Nuages', accent: '#7e77b4', subtitle: 'Prenez de la hauteur. Faites fleurir les possibles.' },
  { name: 'La vallée des aurores', short: 'Aurore', accent: '#ae6582', subtitle: 'Toutes vos découvertes se rencontrent ici.' },
];
const DIRS = [[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]];
export const clone = value => structuredClone(value);
export const top = cell => cell.stack.at(-1);
export function runLength(stack) { let n=0; for(let i=stack.length-1;i>=0 && stack[i]===stack.at(-1);i--) n++; return n; }
export function neighbors(cells, index) { const c=cells[index]; return cells.map((v,i)=>DIRS.some(([q,r])=>v.q===c.q+q&&v.r===c.r+r)?i:-1).filter(i=>i>=0); }
export function random(s) { s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0; return s.rng/4294967296; }
export function dailySeed(date = new Date().toISOString().slice(0,10)) { return [...date].reduce((n,c)=>Math.imul(n^c.charCodeAt(0),16777619)>>>0,2166136261); }
export function levelInfo(level, mode='journey') {
  const n=mode==='daily'?15:mode==='zen'?5:level;
  return { level:n, colors:Math.min(6,3+Math.floor((n-1)/6)), radius:n>=25?3:2,
    target:mode==='zen'?Infinity:240+(n-1)*115,
    flowers:mode!=='zen'&&n>=4?Math.min(3,1+Math.floor((n-4)/9)):0,
    rocks:n>=7?Math.min(4,2+Math.floor((n-7)/10)):0,
    harvest:n>=13 ? {color:(n-13)%Math.min(6,3+Math.floor((n-1)/6)),target:10+Math.floor((n-13)/6)*5}:null,
    sun:n>=10, mixed:n>=3, wild:n>=10, world:Math.min(4,Math.floor((n-1)/6)) };
}
export function createGame(level=1,mode='journey',seed=null) {
  const info=levelInfo(level,mode);
  const s={version:1,level,mode,seed:seed??(level*10739+31),rng:(seed??(level*10739+31))>>>0,cells:[],hand:[],score:0,moves:0,cleared:0,chains:0,bestCombo:0,flowers:0,harvest:Array(6).fill(0),shuffles:3,spades:2,ended:false};
  for(let r=-info.radius;r<=info.radius;r++) for(let q=-info.radius;q<=info.radius;q++) if(Math.abs(q+r)<=info.radius) s.cells.push({q,r,stack:[],rock:0,flower:false,bloomed:false,sun:false});
  const center=s.cells.findIndex(c=>c.q===0&&c.r===0);
  [center,center-2,center+3].forEach((i,n)=>{s.cells[i].stack=Array(4+n%2).fill(n%info.colors);});
  const free=s.cells.map((c,i)=>i).filter(i=>!s.cells[i].stack.length);
  for(let i=0;i<info.rocks;i++) { const j=Math.floor(random(s)*free.length); s.cells[free.splice(j,1)[0]].rock=info.level>=19?2:1; }
  const available=s.cells.map((c,i)=>i).filter(i=>!s.cells[i].rock);
  for(let i=0;i<info.flowers;i++) { const j=Math.floor(random(s)*available.length); s.cells[available.splice(j,1)[0]].flower=true; }
  if(info.sun) s.cells[center].sun=true;
  s.hand=level===1&&mode==='journey'?[Array(6).fill(0),Array(5).fill(1),Array(6).fill(2)]:[offer(s),offer(s),offer(s)];
  return s;
}
export function offer(s) {
  const info=levelInfo(s.level,s.mode);
  if(info.wild && random(s)<.08) return Array(4).fill(-1);
  const exposed=s.cells.filter(c=>c.stack.length).map(top);
  let color=exposed.length&&random(s)<.75?exposed[Math.floor(random(s)*exposed.length)]:Math.floor(random(s)*info.colors);
  const count=3+Math.floor(random(s)*3);
  let out=Array(count).fill(color);
  if(info.mixed&&random(s)<Math.min(.5,.16+info.level*.012)) out=[...Array(2+Math.floor(random(s)*2)).fill((color+1+Math.floor(random(s)*(info.colors-1)))%info.colors),...out];
  return out;
}
function matchingComponent(s,start) {
  const color=top(s.cells[start]); if(color===undefined)return [];
  const set=new Set([start]),todo=[start];
  while(todo.length) for(const i of neighbors(s.cells,todo.pop())) if(!set.has(i)&&top(s.cells[i])===color) { set.add(i);todo.push(i); }
  return [...set];
}
export function goalReached(s) {
  const info=levelInfo(s.level,s.mode);
  return s.mode!=='zen'&&s.score>=info.target&&s.flowers>=info.flowers&&(!info.harvest||s.harvest[info.harvest.color]>=info.harvest.target);
}
export function canPlace(s,i) { return !!s.cells[i]&&!s.cells[i].rock&&!s.cells[i].stack.length&&!s.ended; }
export function blocked(s) { return !s.cells.some((_,i)=>canPlace(s,i)); }
export function place(s,handIndex,index) {
  if(!canPlace(s,index)||!s.hand[handIndex]?.length)return null;
  const events=[];
  let stack=[...s.hand[handIndex]];
  if(stack[0]===-1) {
    const choices=neighbors(s.cells,index).map(i=>s.cells[i]).filter(c=>c.stack.length).sort((a,b)=>runLength(b.stack)-runLength(a.stack));
    const color=choices.length?top(choices[0]):0;stack=stack.map(()=>color);
  }
  s.cells[index].stack=stack;s.hand[handIndex]=null;s.moves++;
  events.push({type:'place',index,snapshot:clone(s.cells)});
  let combo=0,rounds=0,preferred=index;
  // Every transfer reduces the number of exposed matching groups. Clears consume tiles.
  while(rounds++<250) {
    let changed=false;
    const order=[preferred,...s.cells.map((_,i)=>i).filter(i=>i!==preferred)];
    for(const start of order) {
      if(!s.cells[start].stack.length)continue;
      const component=matchingComponent(s,start);
      if(component.length>1) {
        const flower=component.find(i=>s.cells[i].flower&&!s.cells[i].bloomed);
        const anchor=flower??(component.includes(preferred)?preferred:component.reduce((best,i)=>runLength(s.cells[i].stack)>runLength(s.cells[best].stack)?i:best,component[0]));
        const color=top(s.cells[anchor]);
        for(const from of component.filter(i=>i!==anchor)) {
          const count=runLength(s.cells[from].stack);
          s.cells[from].stack.splice(-count);s.cells[anchor].stack.push(...Array(count).fill(color));
          events.push({type:'transfer',from,to:anchor,count,color,snapshot:clone(s.cells)});
        }
        changed=true;preferred=anchor;
      }
      const target=component.length>1?preferred:start;
      const cell=s.cells[target],count=runLength(cell.stack);
      if(count>=10) {
        const color=top(cell);cell.stack.splice(-count);combo++;s.cleared+=count;s.harvest[color]+=count;
        const multiplier=Math.min(combo,5),points=count*10*multiplier*(cell.sun?2:1);
        s.score+=points;
        if(cell.flower&&!cell.bloomed){cell.bloomed=true;s.flowers++;}
        for(const j of neighbors(s.cells,target)) if(s.cells[j].rock>0){s.cells[j].rock--;events.push({type:'rock',index:j});}
        const earned=Math.floor(s.cleared/50)-Math.floor((s.cleared-count)/50);
        if(earned)s.spades=Math.min(5,s.spades+earned);
        events.push({type:'clear',index:target,count,color,points,combo,snapshot:clone(s.cells)});
        changed=true;
      }
      if(changed)break;
    }
    if(!changed)break;
  }
  s.bestCombo=Math.max(s.bestCombo,combo);if(combo>1)s.chains++;
  if(s.moves%4===0)s.shuffles=Math.min(3,s.shuffles+1);
  s.hand[handIndex]=offer(s);
  const info=levelInfo(s.level,s.mode);
  if(info.sun&&s.moves%5===0){s.cells.forEach(c=>c.sun=false);const available=s.cells.filter(c=>!c.rock);available[Math.floor(random(s)*available.length)].sun=true;}
  s.ended=goalReached(s);
  return {events,combo,won:s.ended,blocked:!s.ended&&blocked(s)};
}
export function shuffle(s){if(s.shuffles<=0||s.ended)return false;s.shuffles--;s.hand=[offer(s),offer(s),offer(s)];return true;}
export function removeStack(s,index){if(s.spades<=0||!s.cells[index]?.stack.length||s.ended)return false;s.spades--;s.cells[index].stack=[];return true;}
export function bestHint(s,handIndex) {
  if(!s.hand[handIndex])return -1;
  let best=-1,value=-Infinity;
  for(let i=0;i<s.cells.length;i++)if(canPlace(s,i)) {
    const trial=clone(s);place(trial,handIndex,i);
    const score=(trial.score-s.score)+(trial.flowers-s.flowers)*250+(trial.cells.filter(c=>!c.rock&&!c.stack.length).length-s.cells.filter(c=>!c.rock&&!c.stack.length).length)*24+neighbors(s.cells,i).filter(j=>top(s.cells[j])===s.hand[handIndex].at(-1)).length*12;
    if(score>value){value=score;best=i;}
  }
  return best;
}
