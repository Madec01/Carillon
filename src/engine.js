// Orbitale — deterministic, dependency-free rules. Cells are row-major, 5 × 7.
export const COLORS = ['#ffae68', '#64d9ed', '#bd94ff', '#ff7fa7', '#8ee0b1'];
export const COLOR_NAMES = ['solaire', 'azur', 'violette', 'corail', 'menthe'];
export const TIER_NAMES = ['Étoile', 'Lune', 'Planète'];
export const WORLDS = [
  { name: 'La pouponnière d’étoiles', short: 'Éveil', subtitle: 'De petites étoiles, de grandes découvertes.' },
  { name: 'Les passages de Cassiopée', short: 'Portails', subtitle: 'L’espace rapproche ce qui semblait éloigné.' },
  { name: 'Le ballet des satellites', short: 'Orbites', subtitle: 'Préparez vos rencontres avant le prochain tour.' },
  { name: 'Les marées célestes', short: 'Gravité', subtitle: 'Laissez les astres se retrouver.' },
  { name: 'La fabrique des galaxies', short: 'Cosmos', subtitle: 'Composez votre plus belle réaction en chaîne.' },
];
export const clone = value => structuredClone(value);
const MODES = ['journey', 'daily', 'zen'];
const DIRECTIONS = ['down', 'left', 'up', 'right'];
const TITLES = [
  'Première lumière', 'Poussières complices', 'Le croissant d’or', 'Une nouvelle planète', 'Constellation', 'Pouponnière solaire',
  'De l’autre côté', 'Les astres jumeaux', 'Archipel céleste', 'Pluie de météorites', 'Les deux passages', 'La porte de Cassiopée',
  'Le premier ballet', 'Satellites en fête', 'La grande ronde', 'Valse à deux temps', 'Le cœur de l’orbite', 'Danse des comètes',
  'La marée montante', 'Tout à l’ouest', 'Le ciel à l’envers', 'Un souffle d’est', 'Les astres voyageurs', 'La vague céleste',
  'Une galaxie s’éveille', 'Les quatre vents', 'Le grand passage', 'L’horloge cosmique', 'Au-delà des étoiles', 'Votre petit univers',
];
const VOIDS = [[], [0,4,30,34], [0,1,3,4,30,31,33,34], [10,24], [0,4,15,19,30,34], [0,4,5,29,30,34]];
const RINGS = [[6,7,8,13,18,17,16,11], [16,17,18,23,28,27,26,21]];
function random(s) { s.rng = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0; return s.rng / 4294967296; }
export function dailySeed(date = new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Paris'}).format(new Date())) {
  return [...date].reduce((n,c) => Math.imul(n ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
}
export function levelInfo(level, mode = 'journey') {
  const n = mode === 'daily' ? 27 : mode === 'zen' ? 13 : Math.max(1, Math.min(30, Math.floor(level) || 1));
  const features = {
    1: {title:'Bienvenue dans votre fabrique', text:'Posez une étoile près de deux étoiles identiques. Trois étoiles deviennent une lune ; trois lunes, une planète. Les couleurs ET les tailles doivent correspondre.'},
    4: {title:'L’attraction des planètes', text:'Chaque nouvelle planète attire jusqu’à deux astres de sa couleur vers les cases libres autour d’elle. Préparez une cascade !'},
    7: {title:'Les portails', text:'Deux cases marquées du même portail sont voisines, même à l’autre bout du plateau. Vos fusions peuvent traverser l’espace.'},
    10: {title:'Les météorites', text:'Une fusion à côté d’une météorite la fissure. Une comète ou l’outil Éclipse peut aussi libérer sa case.'},
    13: {title:'Les orbites', text:'Les cases en pointillés tournent d’un cran tous les quatre coups. Le compteur annonce le prochain déplacement.'},
    19: {title:'La gravité', text:'Tous les trois coups, les astres glissent dans le sens de la flèche. Les nouveaux groupes fusionnent à leur arrivée.'},
    25: {title:'Les vents cosmiques', text:'La gravité change de direction après chaque marée. Portails, orbites et comètes se combinent.'},
  };
  return {level:n, rows:7, columns:5, colors:n < 10 ? 3 : n < 25 ? 4 : 5,
    target:mode === 'zen' ? Infinity : 240 + (n-1)*65,
    planetGoal:mode === 'zen' ? 0 : n < 4 ? 1 : n < 13 ? 2 : n < 25 ? 3 : 4,
    world:Math.floor((n-1)/6), title:mode === 'daily' ? 'La constellation du jour' : mode === 'zen' ? 'L’univers sans fin' : TITLES[n-1],
    description:n >= 25 ? 'Toutes les forces du cosmos se rencontrent.' : n >= 19 ? 'Anticipez la prochaine marée.' : n >= 13 ? 'Les astres dansent autour de vous.' : n >= 7 ? 'Reliez deux coins de l’univers.' : 'Trois astres identiques font naître le suivant.',
    feature:features[n] ?? null, portals:n >= 7, orbit:n >= 13, gravity:n >= 19 ? DIRECTIONS[(n-19)%4] : null,
    changingGravity:n >= 25, rocks:n >= 10 ? (n >= 25 ? 3 : 2) : 0,
    orbitEvery:4, gravityEvery:3, shape:(n-1)%6};
}
function piece(color, tier = 0) { return {color,tier}; }
export function createGame(level = 1, mode = 'journey', seed = null) {
  mode = MODES.includes(mode) ? mode : 'journey';
  level = Math.max(1,Math.min(30,Math.floor(level)||1));
  const info = levelInfo(level, mode), initial = (seed ?? (mode === 'daily' ? dailySeed() : level*10739+31)) >>> 0;
  const s = {version:2,level,mode,seed:initial,rng:initial,cells:[],hand:[],score:0,moves:0,planets:0,novas:0,bestCombo:0,energy:0,shuffles:3,spades:2,ended:false,gravity:info.gravity};
  for(let r=0;r<7;r++) for(let q=0;q<5;q++) s.cells.push({q,r,void:VOIDS[info.shape].includes(r*5+q),rock:0,portal:null,orbit:false,piece:null});
  if(info.portals) {
    const pairs = info.level >= 11 ? [[2,32],[10,24]] : [[2,32]];
    pairs.forEach((pair,n) => pair.forEach(i => {s.cells[i].void=false;s.cells[i].portal=n;}));
  }
  if(info.orbit) RINGS[(info.level-13)%2].forEach(i => {s.cells[i].void=false;s.cells[i].orbit=true;});
  // The first move can make an immediately readable star → moon → planet cascade.
  for(const [i,color,tier] of [[21,0,0],[22,0,0],[17,0,1],[18,0,1],[6,1,0],[7,1,0],[26,2,0],[27,2,0]]) {
    if(!s.cells[i].void) s.cells[i].piece=piece(color,tier);
  }
  if(info.level >= 7) {s.cells[2].piece=piece(1);s.cells[31].void=false;s.cells[31].piece=piece(1);}
  const candidates=s.cells.map((_,i)=>i).filter(i=>!s.cells[i].void&&!s.cells[i].piece&&!s.cells[i].orbit&&s.cells[i].portal===null&&![23,24,12].includes(i));
  for(let k=0;k<info.rocks;k++) {const at=Math.floor(random(s)*candidates.length),i=candidates.splice(at,1)[0];if(i!==undefined)s.cells[i].rock=info.level>=22?2:1;}
  s.hand=[piece(0),piece(1),piece(2)];
  return s;
}
function same(a,b) { return !!a && !!b && a.color===b.color && a.tier===b.tier; }
function orthogonal(cells,index) {
  const c=cells[index];if(!c)return [];
  const out=[];
  for(const [q,r] of [[c.q-1,c.r],[c.q+1,c.r],[c.q,c.r-1],[c.q,c.r+1]]) if(q>=0&&q<5&&r>=0&&r<7) {const i=r*5+q;if(!cells[i].void&&!cells[i].rock)out.push(i);}
  return out;
}
export function neighbors(cells,index) {
  const out=orthogonal(cells,index),c=cells[index];
  if(c?.portal!==null && c?.portal!==undefined) cells.forEach((v,i)=>{if(i!==index&&v.portal===c.portal&&!v.void&&!v.rock&&!out.includes(i))out.push(i);});
  return out;
}
function component(s,start) {
  if(!s.cells[start]?.piece)return [];
  const result=[start],seen=new Set(result);
  for(let p=0;p<result.length;p++) for(const i of neighbors(s.cells,result[p])) if(!seen.has(i)&&same(s.cells[start].piece,s.cells[i].piece)) {seen.add(i);result.push(i);}
  return result;
}
export function goalReached(s) {const i=levelInfo(s.level,s.mode);return s.mode!=='zen'&&s.score>=i.target&&s.planets>=i.planetGoal;}
export function canPlace(s,i) {const c=s.cells[i];return Number.isInteger(i)&&!!c&&!c.void&&!c.rock&&!c.piece&&!s.ended;}
export function blocked(s) {return !s.cells.some(c=>!c.void&&!c.rock&&!c.piece);}
function event(s,events,data,capture) {events.push(capture?{...data,snapshot:clone(s.cells)}:data);}
function award(s,amount,combo) {const points=amount*Math.min(combo,6);s.score+=points;s.energy=Math.min(100,s.energy+14+combo*3);return points;}
function chipRocks(s,around,events,capture) {
  const near=new Set();
  for(const at of around) {const c=s.cells[at];s.cells.forEach((v,i)=>{if(v.rock&&Math.abs(v.q-c.q)+Math.abs(v.r-c.r)===1)near.add(i);});}
  for(const i of near) {s.cells[i].rock--;event(s,events,{type:'rock',index:i,points:0},capture);}
}
function attract(s,index,events,capture) {
  const anchor=s.cells[index],color=anchor.piece?.color;if(color===undefined)return;
  const destinations=orthogonal(s.cells,index).filter(i=>!s.cells[i].piece);
  const sources=s.cells.map((_,i)=>i).filter(i=>i!==index&&!destinations.includes(i)&&s.cells[i].piece?.color===color&&Math.abs(s.cells[i].q-anchor.q)+Math.abs(s.cells[i].r-anchor.r)>1)
    .sort((a,b)=>(Math.abs(s.cells[a].q-anchor.q)+Math.abs(s.cells[a].r-anchor.r))-(Math.abs(s.cells[b].q-anchor.q)+Math.abs(s.cells[b].r-anchor.r)));
  const moves=[];
  for(let k=0;k<Math.min(2,destinations.length,sources.length);k++) {const from=sources[k],to=destinations[k],p=s.cells[from].piece;s.cells[to].piece=p;s.cells[from].piece=null;moves.push({from,to,piece:{...p}});}
  if(moves.length)event(s,events,{type:'gravity',index,color,tier:2,moves,local:true},capture);
}
function mergeGroup(s,group,index,events,combo,capture) {
  const p={...s.cells[index].piece},from=group.filter(i=>i!==index);
  for(const i of group)s.cells[i].piece=null;
  const points=award(s,30*3**p.tier,combo);
  if(p.tier<2) {
    s.cells[index].piece=piece(p.color,p.tier+1);
    if(p.tier===1)s.planets++;
    event(s,events,{type:'merge',index,from,color:p.color,tier:p.tier+1,sourceTier:p.tier,points,combo},capture);
    chipRocks(s,group,events,capture);
    if(p.tier===1)attract(s,index,events,capture);
  } else {
    s.novas++;
    event(s,events,{type:'merge',index,from,color:p.color,tier:3,sourceTier:2,points,combo},capture);
    const center=s.cells[index],cleared=[];
    s.cells.forEach((c,i)=>{if((c.q===center.q||c.r===center.r)&&!c.void&&(c.piece||c.rock)){cleared.push(i);c.piece=null;c.rock=0;}});
    const extra=cleared.length*20*Math.min(combo,6);s.score+=extra;
    event(s,events,{type:'comet',index,from:cleared,color:p.color,tier:3,points:extra,combo,axis:'cross'},capture);
    s.spades=Math.min(5,s.spades+1);
  }
}
function resolve(s,preferred,events,combo=0,capture=true) {
  // Every fusion consumes two occupied cells, so this loop is strictly bounded.
  const order=[preferred,...s.cells.map((_,i)=>i).filter(i=>i!==preferred)];
  while(true) {
    let found=false;
    for(const i of order) {
      const group=component(s,i);
      if(group.length>=3) {mergeGroup(s,group.slice(0,3),i,events,++combo,capture);found=true;break;}
    }
    if(!found)break;
  }
  return combo;
}
function orbit(s,events,capture) {
  const ring=RINGS[(levelInfo(s.level,s.mode).level-13)%2],before=ring.map(i=>s.cells[i].piece),moves=[];
  ring.forEach((from,k)=>{const to=ring[(k+1)%ring.length],p=before[k];s.cells[to].piece=p;if(p)moves.push({from,to,piece:{...p}});});
  if(moves.length)event(s,events,{type:'orbit',index:ring[0],moves},capture);
}
function compact(s,direction,events,capture) {
  const moves=[],vertical=direction==='down'||direction==='up',reverse=direction==='down'||direction==='right';
  for(let line=0;line<(vertical?5:7);line++) {
    let segment=[];
    function flush() {
      if(reverse)segment.reverse();
      let target=0;
      for(const from of segment) if(s.cells[from].piece) {
        const to=segment[target++];if(to===from)continue;
        const p=s.cells[from].piece;s.cells[from].piece=null;s.cells[to].piece=p;moves.push({from,to,piece:{...p}});
      }
      segment=[];
    }
    for(let pos=0;pos<(vertical?7:5);pos++) {const i=vertical?pos*5+line:line*5+pos;if(s.cells[i].void||s.cells[i].rock)flush();else segment.push(i);}
    flush();
  }
  if(moves.length)event(s,events,{type:'gravity',index:moves[0].to,moves,direction,local:false},capture);
}
function offer(s) {
  const info=levelInfo(s.level,s.mode),matches=[];
  // Helpful, deterministic offers keep planning viable without forcing a purchase or a retry.
  for(let i=0;i<35;i++) if(canPlace(s,i)) {
    const unique=new Map();
    for(const j of neighbors(s.cells,i)) if(s.cells[j].piece) {const p=s.cells[j].piece;unique.set(`${p.color}:${p.tier}`,p);}
    for(const p of unique.values()) {
      let count=0;const seen=new Set();
      for(const j of neighbors(s.cells,i)) if(same(p,s.cells[j].piece)) for(const k of component(s,j)) if(!seen.has(k)){seen.add(k);count++;}
      if(count>=2)matches.push({...p});
    }
  }
  if(matches.length&&random(s)<.68)return matches[Math.floor(random(s)*matches.length)];
  const exposed=s.cells.filter(c=>c.piece).map(c=>c.piece);
  if(exposed.length&&random(s)<.68) {
    const p=exposed[Math.floor(random(s)*exposed.length)];
    return piece(p.color,p.tier===2? (random(s)<.32?2:1) : p.tier);
  }
  return piece(Math.floor(random(s)*info.colors),random(s)<.20?1:0);
}
function finish(s,events,combo) {
  s.bestCombo=Math.max(s.bestCombo,combo);s.ended=goalReached(s);
  return {events,combo,won:s.ended,blocked:!s.ended&&blocked(s)};
}
function play(s,handIndex,index,capture) {
  if(!canPlace(s,index)||!Number.isInteger(handIndex)||!s.hand[handIndex])return null;
  const events=[],p={...s.hand[handIndex]},info=levelInfo(s.level,s.mode);
  s.cells[index].piece=p;s.moves++;
  event(s,events,{type:'place',index,color:p.color,tier:p.tier},capture);
  let combo=resolve(s,index,events,0,capture);
  if(info.orbit&&s.moves%info.orbitEvery===0) {orbit(s,events,capture);combo=resolve(s,index,events,combo,capture);}
  if(info.gravity&&s.moves%info.gravityEvery===0) {
    compact(s,s.gravity,events,capture);combo=resolve(s,index,events,combo,capture);
    if(info.changingGravity)s.gravity=DIRECTIONS[(DIRECTIONS.indexOf(s.gravity)+1)%4];
  }
  if(s.moves%4===0)s.shuffles=Math.min(3,s.shuffles+1);
  if(s.moves%8===0)s.spades=Math.min(5,s.spades+1);
  s.hand[handIndex]=offer(s);
  return finish(s,events,combo);
}
export function place(s,handIndex,index) {return play(s,handIndex,index,true);}
export function shuffle(s) {
  if(s.shuffles<=0||s.ended)return false;
  s.shuffles--;s.hand=[offer(s),offer(s),offer(s)];return true;
}
export function usePower(s,kind,index) {
  const c=s.cells[index];if(!c||c.void||s.ended)return null;
  const events=[];let combo=0;
  if(kind==='clear') {
    if(s.spades<=0||(!c.piece&&!c.rock))return null;
    const color=c.piece?.color??0,tier=c.piece?.tier??0;s.spades--;c.piece=null;c.rock=0;
    event(s,events,{type:'clear',index,color,tier,points:0,combo:0},true);
  } else if(kind==='gravity') {
    if(s.energy<100||!c.piece)return null;
    const matching=s.cells.map((_,i)=>i).filter(i=>i!==index&&same(c.piece,s.cells[i].piece));
    if(matching.length<2)return null;
    s.energy-=100;
    // A charged well can fuse three matching astres across the entire board.
    mergeGroup(s,[index,...matching.slice(0,2)],index,events,++combo,true);
    combo=resolve(s,index,events,combo,true);
  } else return null;
  return finish(s,events,combo);
}
export function bestHint(s,handIndex) {
  if(!s.hand[handIndex]||s.ended)return -1;
  let best=-1,value=-Infinity;
  for(let i=0;i<35;i++) if(canPlace(s,i)) {
    const trial=clone(s),r=play(trial,handIndex,i,false),p=s.hand[handIndex];
    const adjacent=neighbors(s.cells,i).filter(j=>same(p,s.cells[j].piece)).length;
    const empties=trial.cells.filter(c=>!c.void&&!c.rock&&!c.piece).length;
    const v=(trial.score-s.score)+(trial.planets-s.planets)*110+r.combo*20+empties*5+adjacent*16-(Math.abs(s.cells[i].q-2)+Math.abs(s.cells[i].r-3))*.1;
    if(v>value){value=v;best=i;}
  }
  return best;
}
export function validGame(s) {
  if(!s||s.version!==2||!MODES.includes(s.mode)||!Number.isInteger(s.level)||s.level<1||s.level>30||!Array.isArray(s.cells)||s.cells.length!==35||!Array.isArray(s.hand)||s.hand.length!==3||typeof s.ended!=='boolean')return false;
  const colors=levelInfo(s.level,s.mode).colors,isPiece=p=>!!p&&Number.isInteger(p.color)&&p.color>=0&&p.color<colors&&Number.isInteger(p.tier)&&p.tier>=0&&p.tier<=2;
  if(!s.hand.every(isPiece))return false;
  if(!s.cells.every((c,i)=>c&&c.q===i%5&&c.r===Math.floor(i/5)&&typeof c.void==='boolean'&&typeof c.orbit==='boolean'&&Number.isInteger(c.rock)&&c.rock>=0&&c.rock<=2&&(c.portal===null||(Number.isInteger(c.portal)&&c.portal>=0&&c.portal<=1))&&(c.piece===null||isPiece(c.piece))&&(!(c.void||c.rock)||!c.piece)))return false;
  if(!['seed','rng','score','moves','planets','novas','bestCombo','energy','shuffles','spades'].every(k=>Number.isSafeInteger(s[k])&&s[k]>=0))return false;
  return s.seed<=4294967295&&s.rng<=4294967295&&s.energy<=100&&s.shuffles<=3&&s.spades<=5&&(s.gravity===null||DIRECTIONS.includes(s.gravity));
}
