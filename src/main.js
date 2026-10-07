import {createGame,levelInfo,WORLDS,COLOR_NAMES,COLORS,clone,place,shuffle,removeStack,bestHint,canPlace,blocked,goalReached,dailySeed} from './engine.js';
import {BoardRenderer,drawHand,drawStack} from './renderer.js';
import {AudioGarden} from './audio.js';

const $=id=>document.getElementById(id),KEY='hexa-bloom-v1';
const defaults={sound:false,music:true,haptics:true,symbols:false,motion:matchMedia('(prefers-reduced-motion: reduce)').matches};
let profile={unlocked:1,stars:{},best:0,settings:{...defaults},active:'journey',runs:{},tutorial:false,dailyWins:{}};
try{const p=JSON.parse(localStorage.getItem(KEY));if(p&&Number.isInteger(p.unlocked)&&p.unlocked>=1&&p.unlocked<=30){profile={...profile,...p,settings:{...defaults,...p.settings}};profile.best=Number.isFinite(profile.best)?Math.max(0,profile.best):0;profile.stars=p.stars&&typeof p.stars==='object'?p.stars:{};profile.runs=p.runs&&typeof p.runs==='object'?p.runs:{};profile.dailyWins=p.dailyWins&&typeof p.dailyWins==='object'?p.dailyWins:{};}}catch{}
for(const key of Object.keys(defaults))profile.settings[key]=!!profile.settings[key];
if(!['journey','zen','daily'].includes(profile.active))profile.active='journey';
function validGame(s){
  if(!s||s.version!==1||!['journey','zen','daily'].includes(s.mode)||!Number.isInteger(s.level)||s.level<1||s.level>30)return false;
  const reference=createGame(s.level,s.mode),stack=a=>Array.isArray(a)&&a.length<=200&&a.every(n=>Number.isInteger(n)&&n>=0&&n<levelInfo(s.level,s.mode).colors);
  return Array.isArray(s.cells)&&s.cells.length===reference.cells.length&&s.cells.every((c,i)=>c&&c.q===reference.cells[i].q&&c.r===reference.cells[i].r&&stack(c.stack)&&Number.isInteger(c.rock)&&c.rock>=0&&c.rock<=2)&&Array.isArray(s.hand)&&s.hand.length===3&&s.hand.every(h=>Array.isArray(h)&&h.length>0&&(stack(h)||h.every(c=>c===-1)))&&['score','moves','cleared','chains','bestCombo','flowers','shuffles','spades','rng'].every(k=>Number.isFinite(s[k])&&s[k]>=0)&&Array.isArray(s.harvest)&&s.harvest.length===6&&s.harvest.every(n=>Number.isFinite(n)&&n>=0);
}
let game=profile.runs[profile.active];
if(!validGame(game)||game.mode!==profile.active||(game.mode==='daily'&&game.seed!==dailySeed()))game=createGame(profile.active==='journey'?profile.unlocked:1,profile.active,profile.active==='daily'?dailySeed():null);
let selected=-1,busy=false,spadeMode=false,history=[],toastTimer,storageWarned=false;
const icons=new Map();
async function renderIcons(root=document){await Promise.all([...root.querySelectorAll('[data-icon]')].map(async el=>{const name=el.dataset.icon;try{if(!icons.has(name))icons.set(name,fetch(`assets/icons/${name}.svg`).then(r=>{if(!r.ok)throw Error(name);return r.text();}));const svg=await icons.get(name);if(el.isConnected){el.innerHTML=svg;el.querySelector('svg')?.classList.add('icon');el.setAttribute('aria-hidden','true');}}catch{el.textContent='·';}}));}
const audio=new AudioGarden(()=>profile.settings);
const renderer=new BoardRenderer($('board'),()=>game,()=>profile.settings);
function save(){profile.runs[game.mode]=clone(game);profile.active=game.mode;try{localStorage.setItem(KEY,JSON.stringify(profile));}catch{if(!storageWarned){storageWarned=true;toast('Le stockage est indisponible : cette partie reste jouable sans sauvegarde.');}}}
function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').classList.add('visible');toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3100);}
function vibrate(pattern){if(profile.settings.haptics&&!profile.settings.motion&&navigator.vibrate)navigator.vibrate(pattern);}
function wait(ms){return new Promise(resolve=>setTimeout(resolve,profile.settings.motion?0:ms));}
function number(n){return Math.floor(n).toLocaleString('fr-FR');}
let scoreAnimation=0;
function animateScore(from,to){
  const token=++scoreAnimation,start=performance.now(),target=levelInfo(game.level,game.mode).target;
  const paint=value=>{$('score').textContent=number(value);$('progress-fill').style.width=`${game.mode==='zen'?(value%1000)/10:Math.min(100,value/target*100)}%`;};
  if(profile.settings.motion||document.hidden){paint(to);return;}
  const tick=now=>{if(token!==scoreAnimation)return;const t=Math.min(1,(now-start)/410);paint(from+(to-from)*(1-(1-t)**3));if(t<1)requestAnimationFrame(tick);};requestAnimationFrame(tick);
  $('score').classList.remove('score-hit');void $('score').offsetWidth;$('score').classList.add('score-hit');
}
function pop(event){
  renderer.label(event.index,`+${event.points}`,event.color,event.combo>1);
  if(event.combo<2)return;
  const el=$('floating-text');el.innerHTML=`<small>RÉACTION EN CHAÎNE</small><strong>Combo <b>×${event.combo}</b></strong>`;el.classList.remove('show');void el.offsetWidth;el.classList.add('show');
}
function lockMove(slot){
  busy=true;$('board-wrap').classList.add('resolving');
  document.querySelectorAll('.hand-card, .tool, #hint-btn, #board-accessible button').forEach(b=>b.disabled=true);
  $('hand').children[slot]?.classList.add('departing');
  $('hand-instruction').textContent='LAISSEZ LES COULEURS DANSER';
  $('board-caption').textContent='✦ Chaque pièce trouve sa place.';
}
function update(){
  $('sound-btn').setAttribute('aria-label',profile.settings.sound?'Couper le son':'Activer le son');$('sound-btn').innerHTML=`<i data-icon="${profile.settings.sound?'volume-2':'volume-x'}"></i>`;renderIcons($('sound-btn'));
  if(busy)return;
  const info=levelInfo(game.level,game.mode),world=WORLDS[info.world];
  $('level-label').textContent=game.mode==='daily'?'La graine du jour':game.mode==='zen'?'Jardin sans fin':`Jardin ${String(game.level).padStart(2,'0')}`;
  $('score').textContent=number(game.score);$('goal-value').textContent=game.mode==='zen'?'· sans limite':`/ ${number(info.target)}`;
  $('goal-caption').textContent=game.mode==='zen'?'CULTIVEZ VOTRE TRANQUILLITÉ':'FAITES ÉCLORE LE SCORE';
  $('progress-fill').style.width=`${game.mode==='zen'?(game.score%1000)/10:Math.min(100,game.score/info.target*100)}%`;
  $('best-score').textContent=number(profile.best);$('world-name').textContent=world.name;$('world-number').textContent=`0${info.world+1} / 05`;
  $('shuffle-count').textContent=game.shuffles;$('spade-count').textContent=game.spades;$('undo-btn').disabled=busy||!history.length;$('shuffle-btn').disabled=busy||!game.shuffles||game.ended;$('spade-btn').disabled=busy||!game.spades||game.ended;$('hint-btn').disabled=busy||game.ended;
  $('spade-btn').classList.toggle('active',spadeMode);$('move-label').textContent=`${game.moves} coup${game.moves>1?'s joués':' joué'}`;
  $('hand-instruction').textContent=spadeMode?'TOUCHEZ UNE PILE À RETIRER':selected>=0?'PLACEZ VOTRE PILE':'CHOISISSEZ UNE PILE';
  $('board-caption').innerHTML=game.ended?'✿ Jardin réussi · touchez le titre pour continuer.':spadeMode?'✧ Une petite éclaircie fait de la place.':selected>=0?'✦ Dix pièces de même couleur font éclore une pile.':'<span>✦</span> Les couleurs voisines s’attirent.';
  $('extra-goals').innerHTML=(info.flowers?`<span class="goal-chip ${game.flowers>=info.flowers?'done':''}">✿ ${game.flowers} / ${info.flowers} fleurs</span>`:'')+(info.harvest?`<span class="goal-chip ${game.harvest[info.harvest.color]>=info.harvest.target?'done':''}">● ${game.harvest[info.harvest.color]} / ${info.harvest.target} ${COLOR_NAMES[info.harvest.color]}</span>`:'');
  document.body.classList.toggle('reduced-motion',profile.settings.motion);document.body.dataset.world=info.world;
  renderer.selected=selected;renderer.spade=spadeMode;renderer.request();
  renderHand();renderBoardAccess();
}
function renderHand(){
  $('hand').innerHTML='';game.hand.forEach((stack,i)=>{const btn=document.createElement('button');btn.className=`hand-card${selected===i?' selected':''}`;btn.dataset.slot=i;btn.disabled=busy||game.ended;btn.setAttribute('aria-pressed',selected===i?'true':'false');btn.setAttribute('aria-label',`Pile ${i+1}, ${stack.length} pièces, dessus ${stack.at(-1)===-1?'joker':COLOR_NAMES[stack.at(-1)]}`);btn.innerHTML=`<canvas aria-hidden="true"></canvas><span class="hand-number">${stack.length}</span>`;$('hand').append(btn);drawHand(btn.firstElementChild,stack,selected===i,profile.settings);btn.addEventListener('pointerdown',e=>startDrag(e,i));btn.addEventListener('click',()=>{if(suppressClick)return;select(i);});});
}
function renderBoardAccess(){const root=$('board-accessible');root.innerHTML='';game.cells.forEach((c,i)=>{const b=document.createElement('button');b.textContent=String(i+1);b.setAttribute('aria-label',`Case ${i+1}, ${c.rock?'rocher':c.stack.length?c.stack.length+' pièces, '+COLOR_NAMES[c.stack.at(-1)]:'vide'}${c.flower?', fleur':''}${c.sun?', soleil':''}`);b.disabled=busy||game.ended||c.rock>0||(!spadeMode&&c.stack.length>0);b.addEventListener('click',()=>boardAction(i));root.append(b);});}
function select(i){if(busy||game.ended)return;selected=i;spadeMode=false;renderer.hint=-1;audio.unlock();audio.play('pick',1,.35);update();}
let drag=null,ghost=null,suppressClick=false;
function startDrag(e,i){if(e.button!==0||busy||game.ended)return;drag={i,x:e.clientX,y:e.clientY,pointer:e.pointerId,moved:false};audio.unlock();}
document.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.pointer)return;
  if(!drag.moved&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>8){drag.moved=true;selected=drag.i;spadeMode=false;renderer.selected=selected;renderHand();ghost=document.createElement('canvas');ghost.className='drag-ghost';ghost.width=188;ghost.height=220;document.body.append(ghost);const ctx=ghost.getContext('2d');ctx.scale(2,2);drawStack(ctx,47,74,27,game.hand[selected],{symbols:profile.settings.symbols});}
  if(drag.moved){e.preventDefault();ghost.style.left=e.clientX+'px';ghost.style.top=(e.clientY-14)+'px';const p=renderer.eventPoint(e);renderer.hover=renderer.hit(p.x,p.y);renderer.request();}
},{passive:false});
document.addEventListener('pointerup',e=>{if(!drag||e.pointerId!==drag.pointer)return;const d=drag;drag=null;if(d.moved){ghost?.remove();ghost=null;suppressClick=true;setTimeout(()=>suppressClick=false,0);const p=renderer.eventPoint(e),i=renderer.hit(p.x,p.y);renderer.hover=-1;if(i>=0)boardAction(i);else update();}});
document.addEventListener('pointercancel',()=>{drag=null;ghost?.remove();ghost=null;renderer.hover=-1;renderer.request();});
$('board').addEventListener('pointermove',e=>{const p=renderer.eventPoint(e);renderer.hover=renderer.hit(p.x,p.y);renderer.request();});
$('board').addEventListener('pointerleave',()=>{if(!drag){renderer.hover=-1;renderer.request();}});
$('board').addEventListener('click',e=>{if(suppressClick)return;const p=renderer.eventPoint(e);boardAction(renderer.hit(p.x,p.y));});
function remember(){history.push(clone(game));if(history.length>12)history.shift();}
async function boardAction(i){
  if(busy||game.ended||i<0)return;
  audio.unlock();
  if(spadeMode){
    if(!game.cells[i]?.stack.length){toast('Choisissez une case qui porte une pile.');return;}
    remember();const before=clone(game.cells),count=game.cells[i].stack.length,color=game.cells[i].stack.at(-1);
    if(removeStack(game,i)){
      renderer.snapshot=before;renderer.spade=false;lockMove(-1);$('hand-instruction').textContent='UNE PETITE ÉCLAIRCIE';
      await renderer.animate({type:'clear',index:i,count,color,combo:0,snapshot:clone(game.cells)},{onImpact:()=>{audio.play('clear',1.15,.3);vibrate(8);}});
      renderer.snapshot=null;busy=false;spadeMode=false;$('board-wrap').classList.remove('resolving');save();update();toast('Un peu d’espace pour de nouvelles idées.');
    }return;
  }
  if(selected<0){toast('Choisissez d’abord une des trois piles en bas.');return;}
  if(!canPlace(game,i)){toast(game.cells[i].rock?'Une éclosion voisine brisera ce rocher.':'Cette case est occupée. Choisissez une case vide.');return;}
  const slot=selected;
  remember();renderer.snapshot=clone(game.cells);let shownScore=game.score;
  const result=place(game,slot,i);if(!result){history.pop();renderer.snapshot=null;return;}
  selected=-1;renderer.selected=-1;renderer.hint=-1;renderer.hover=-1;lockMove(slot);
  for(const event of result.events){
    await renderer.animate(event,{
      onTile:(n,total)=>audio.stackTick(n,total),
      onImpact:()=>{
        if(event.type==='place'){audio.play('place',.87,.5);vibrate(8);}
        if(event.type==='clear'){
          audio.flourish(event.combo);pop(event);animateScore(shownScore,shownScore+event.points);shownScore+=event.points;
          vibrate(event.combo>1?[10,40,15]:10);
          $('combo-meter').classList.remove('hot');void $('combo-meter').offsetWidth;$('combo-meter').classList.add('hot');
          $('combo-icon').textContent=event.combo>1?'✺':'✿';$('combo-value').textContent=event.combo>1?`Cascade ×${event.combo} !`:'Jolie éclosion !';
          $('combo-sub').textContent=event.combo>1?'Les couleurs prennent leur élan':'10 pièces, une nouvelle pousse';
        }
      },
    });
  }
  renderer.snapshot=null;busy=false;++scoreAnimation;$('board-wrap').classList.remove('resolving');
  profile.best=Math.max(profile.best,game.score);save();update();$('hand').children[slot]?.classList.add('refilled');
  if(result.won){await wait(350);win();}
  else if(result.blocked){await wait(250);blockedModal();}
  else if(game.moves===1&&!profile.tutorial){profile.tutorial=true;save();toast('Bien joué ! Réunissez 10 pièces pour faire éclore une couleur.');}
}
function modal(html){$('modal-content').innerHTML=html;if(!$('modal').open)$('modal').showModal();renderIcons($('modal'));}
function closeModal(){$('modal').close();}
$('modal-close').onclick=closeModal;
$('modal').addEventListener('click',e=>{if(e.target===$('modal')){const b=$('modal').getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)closeModal();}});
function switchMode(mode,level=null){if(busy)return;save();const saved=profile.runs[mode];const chosen=mode==='journey'?(level??profile.unlocked):1;game=validGame(saved)&&(!level||saved.level===chosen)&&!(mode==='daily'&&saved.seed!==dailySeed())?clone(saved):createGame(chosen,mode,mode==='daily'?dailySeed():null);selected=-1;spadeMode=false;history=[];renderer.snapshot=null;renderer.hint=-1;save();closeModal();update();if(game.ended)win();else featureIntro();}
function fresh(level=game.level,mode=game.mode){game=createGame(level,mode,mode==='daily'?dailySeed():null);selected=-1;spadeMode=false;history=[];renderer.hint=-1;renderer.snapshot=null;closeModal();save();update();featureIntro();}
const FEATURES={3:['Les couleurs se superposent','Voici les piles multicolores. Fusionnez le dessus pour révéler la couleur cachée en dessous.'],4:['Réveillez le jardin','Les cases marquées d’une fleur attendent une éclosion : formez une pile de 10 dessus. Remplissez le score ET les fleurs pour avancer.'],7:['Des rochers dans la clairière','Faites éclore une pile à côté d’un rocher pour le briser. Une nouvelle case vous attend dessous.'],10:['Un rayon de soleil','Une éclosion sur la case soleil rapporte deux fois plus. Le soleil se déplace tous les 5 coups. Les piles étoilées prennent la couleur d’une voisine.'],13:['La récolte des couleurs','Un objectif de couleur rejoint le score et les fleurs. Préparez vos cascades pour compléter toute la récolte.'],19:['La pierre a deux faces','Certains rochers demandent deux éclosions voisines. Le petit chiffre indique leur résistance.'],25:['Un jardin plus grand','37 cases et six couleurs : tout l’espace pour composer vos plus belles cascades.']};
function featureIntro(){if(game.mode==='journey'&&game.moves===0&&FEATURES[game.level]){const [title,desc]=FEATURES[game.level];modal(`<div class="modal-flower">✧</div><div class="modal-eyebrow">UNE NOUVELLE DÉCOUVERTE</div><h2>${title}</h2><p>${desc}</p><button class="primary-button" id="feature-ok">C’est parti</button>`);$('feature-ok').onclick=closeModal;}}
function win(){
  const stars=game.moves<=10+game.level*2?3:game.moves<=18+game.level*3?2:1;
  if(game.mode==='journey'){profile.stars[game.level]=Math.max(Number(profile.stars[game.level])||0,stars);profile.unlocked=Math.min(30,Math.max(profile.unlocked,game.level+1));}
  if(game.mode==='daily')profile.dailyWins[new Date().toISOString().slice(0,10)]=game.score;
  save();audio.play('bloom',1.4,.75);
  modal(`<div class="modal-flower">✿</div><div class="modal-eyebrow">${game.mode==='daily'?'LA GRAINE DU JOUR A FLEURI':game.level===30?'TOUT UN MONDE DE COULEURS':'UN PETIT JARDIN, UNE BELLE VICTOIRE'}</div><h2>${game.level===30?'Vous avez fait tout fleurir.':'Ça fait du bien, non ?'}</h2><div class="stars">${'★'.repeat(stars)}<span class="empty">${'★'.repeat(3-stars)}</span></div><div class="result-stats"><div><b>${number(game.score)}</b><small>points récoltés</small></div><div><b>${game.moves}</b><small>coups joués</small></div><div><b>×${Math.max(1,game.bestCombo)}</b><small>meilleur combo</small></div></div><p>${game.mode==='daily'?'Revenez demain pour une nouvelle graine. Les jardins vous attendent entre-temps.':game.level===30?'Les 30 jardins sont à vous. Retrouvez vos préférés, le défi quotidien ou le calme du mode zen.':'Une nouvelle palette de possibilités vous attend.'}</p><button class="primary-button" id="next-level">${game.mode==='daily'?'Retour aux jardins':game.level===30?'Jouer en mode zen':'Le jardin suivant'} <i data-icon="arrow-right"></i></button><button class="secondary-button" id="replay-level">Rejouer ce jardin</button>`);
  $('next-level').onclick=()=>game.mode==='daily'?switchMode('journey'):game.level===30?switchMode('zen'):fresh(game.level+1,'journey');$('replay-level').onclick=()=>fresh();
  renderer.burst(Math.floor(game.cells.length/2),2,55);
}
function blockedModal(){modal(`<div class="modal-flower">❀</div><div class="modal-eyebrow">LE JARDIN A BESOIN D’AIR</div><h2>Une nouvelle perspective ?</h2><p>Le plateau est plein. Annulez votre dernier coup${game.spades?' ou utilisez une éclaircie pour libérer une case':''}. Vous pouvez toujours recommencer, gratuitement.</p>${game.spades?'<button class="primary-button" id="rescue">Faire une éclaircie</button>':''}${history.length?'<button class="secondary-button" id="undo-rescue">Annuler le dernier coup</button>':''}<button class="secondary-button" id="retry">Recommencer le jardin</button>`);if($('rescue'))$('rescue').onclick=()=>{closeModal();spadeMode=true;selected=-1;update();};if($('undo-rescue'))$('undo-rescue').onclick=()=>{closeModal();undo();};$('retry').onclick=()=>fresh();}
function undo(){if(busy||!history.length)return;game=history.pop();selected=-1;spadeMode=false;renderer.hint=-1;renderer.snapshot=null;save();update();toast('Un pas en arrière, toutes les possibilités devant.');}
$('undo-btn').onclick=undo;
$('shuffle-btn').onclick=()=>{if(busy)return;remember();if(shuffle(game)){selected=-1;renderer.hint=-1;audio.unlock();audio.play('pick',.8,.5);save();update();[...$('hand').children].forEach((card,i)=>{card.classList.add('refilled');card.querySelector('canvas').style.animationDelay=`${i*65}ms`;});toast('Trois nouvelles piles. +1 brassage tous les 4 coups.');}else history.pop();};
$('spade-btn').onclick=()=>{spadeMode=!spadeMode;selected=-1;renderer.hint=-1;update();if(spadeMode)toast('Touchez la pile à retirer. +1 éclaircie par 50 pièces écloses.');};
$('hint-btn').onclick=()=>{if(busy||game.ended)return;if(blocked(game)){blockedModal();return;}if(selected<0)selected=0;spadeMode=false;renderer.hint=bestHint(game,selected);update();toast('La case éclairée est une piste. À vous de choisir !');};
function rules(){modal(`<div class="modal-flower">✿</div><div class="modal-eyebrow">PRENEZ VOTRE TEMPS</div><h2>Le bonheur tient<br>en quelques couleurs.</h2><div class="rule"><span class="rule-number">1</span><div><strong>Posez une pile</strong><p>Touchez une pile, puis une case vide. Vous pouvez aussi la glisser avec le doigt.</p></div></div><div class="rule"><span class="rule-number">2</span><div><strong>Les couleurs s’attirent</strong><p>Les pièces du dessus de même couleur se regroupent entre cases voisines.</p></div></div><div class="rule"><span class="rule-number">10</span><div><strong>Et le jardin s’éveille</strong><p>10 pièces de même couleur éclatent ! Les couleurs révélées peuvent créer une cascade : ×2, ×3… jusqu’à ×5 points.</p></div></div><p>Atteignez le score et les objectifs du jardin. Sans chrono, publicité, achat ni vies limitées.</p><button class="primary-button" id="rules-play">Faisons fleurir tout ça</button>`);$('rules-play').onclick=()=>{profile.tutorial=true;save();closeModal();audio.unlock();};}
$('help-btn').onclick=rules;$('rules-link').onclick=rules;
function journey(){modal(`<div class="modal-eyebrow">30 JARDINS À CULTIVER</div><h2>Chaque étape<br>a sa petite surprise.</h2>${WORLDS.map((w,wi)=>`<div class="world-heading">${['✿','❧','☀','☁','✧'][wi]} ${w.short}<span>${wi*6+1}–${wi*6+6}</span></div><div class="level-grid">${Array.from({length:6},(_,j)=>{const n=wi*6+j+1;return `<button class="level-cell ${game.mode==='journey'&&game.level===n?'current':''}" data-level="${n}" ${n>profile.unlocked?'disabled':''} aria-label="Jardin ${n}${n>profile.unlocked?', verrouillé':''}">${n}<small>${'★'.repeat(Math.min(3,Number(profile.stars[n])||0))}</small></button>`;}).join('')}</div>`).join('')}<button class="primary-button" id="journey-continue">Continuer le jardin ${profile.unlocked}</button><button class="secondary-button" id="modal-daily">☀ Le défi du jour</button><button class="secondary-button" id="modal-zen">∞ Jouer en mode zen</button>`);$('modal-content').querySelectorAll('[data-level]').forEach(b=>b.onclick=()=>switchMode('journey',Number(b.dataset.level)));$('journey-continue').onclick=()=>switchMode('journey',profile.unlocked);$('modal-daily').onclick=daily;$('modal-zen').onclick=zen;}
$('journey-btn').onclick=journey;$('level-btn').onclick=()=>{if(!busy){if(game.ended)win();else journey();}};
function daily(){const date=new Date().toISOString().slice(0,10);modal(`<div class="modal-flower">☀</div><div class="modal-eyebrow">LA GRAINE DU ${new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date()).toUpperCase()}</div><h2>Une couleur nouvelle<br>dans votre journée.</h2><p>Le même jardin et les mêmes piles pour tous, chaque jour. Score, fleurs et récolte : les règles avancées se rencontrent ici. Rejouez autant que vous voulez.</p><div class="mode-card"><p>${profile.dailyWins[date]?`✿ Défi déjà réussi · ${number(profile.dailyWins[date])} points`:'✧ 1 850 points · 2 fleurs · 10 pièces miel<br>Rochers, piles joker et case soleil'}</p></div><button class="primary-button" id="daily-play">Planter la graine</button><button class="secondary-button" id="daily-back">Retour aux jardins</button>`);$('daily-play').onclick=()=>switchMode('daily');$('daily-back').onclick=journey;}
function zen(){modal(`<div class="modal-flower">∞</div><div class="modal-eyebrow">JUSTE LE PLAISIR DE JOUER</div><h2>Sans arrivée.<br>Sans se presser.</h2><p>Pas de score à atteindre. Trois couleurs, des piles multicolores et toute la place pour vos idées. Les combos et vos aides gratuites restent avec vous.</p><button class="primary-button" id="zen-play">Entrer dans le jardin zen</button><button class="secondary-button" id="zen-back">Retour aux jardins</button>`);$('zen-play').onclick=()=>switchMode('zen');$('zen-back').onclick=journey;}
$('daily-btn').onclick=daily;$('zen-btn').onclick=zen;
function settings(){modal(`<div class="modal-eyebrow">À VOTRE RYTHME</div><h2>Votre petite bulle.</h2>${[['sound','Sons du jardin','Des petites notes à chaque éclosion'],['music','Piano d’ambiance','Une mélodie douce, qui respire'],['haptics','Retour tactile','De légères vibrations, si disponibles'],['symbols','Symboles sur les couleurs','Reconnaître les pièces sans la couleur'],['motion','Réduire les animations','Moins de mouvements et de particules']].map(([key,label,desc])=>`<label class="settings-row"><span><strong>${label}</strong><small>${desc}</small></span><input class="toggle" type="checkbox" data-setting="${key}" ${profile.settings[key]?'checked':''}></label>`).join('')}<button class="secondary-button" id="restart-btn">Recommencer ce jardin</button><button class="secondary-button" id="settings-journey">Choisir un jardin ou un mode</button><p>Votre progression est sauvegardée sur cet appareil.</p>`);$('modal-content').querySelectorAll('[data-setting]').forEach(input=>input.onchange=()=>{profile.settings[input.dataset.setting]=input.checked;save();update();audio.unlock();audio.sync();});$('restart-btn').onclick=()=>{modal('<div class="modal-flower">❀</div><h2>Repartir d’une page verte ?</h2><p>Seule la partie en cours sera recommencée. Vos jardins débloqués et vos étoiles restent à vous.</p><button class="primary-button" id="confirm-restart">Recommencer</button><button class="secondary-button" id="cancel-restart">Garder ma partie</button>');$('confirm-restart').onclick=()=>fresh();$('cancel-restart').onclick=closeModal;};$('settings-journey').onclick=journey;}
$('settings-btn').onclick=()=>{if(!busy)settings();};
$('sound-btn').onclick=async()=>{profile.settings.sound=!profile.settings.sound;save();update();await audio.unlock();audio.sync();if(profile.settings.sound)audio.play('bloom',1,.4);toast(profile.settings.sound?'Le jardin a trouvé sa voix.':'Le calme, tout simplement.');};
$('credits-btn').onclick=()=>modal(`<div class="modal-flower">♡</div><div class="modal-eyebrow">UN JEU LIBRE DE PRESSION</div><h2>Les belles choses<br>se partagent.</h2><p>Hexa Bloom est un puzzle original inspiré du genre des piles hexagonales. Aucun achat, publicité, suivi ou service distant n’est intégré.</p><div class="rule"><div><strong>Sons · Kenney</strong><p>Starter Kit 3D Platformer · CC0.<br><a class="credit-link" href="https://github.com/KenneyNL/Starter-Kit-3D-Platformer" target="_blank" rel="noopener">Source et licence</a></p></div></div><div class="rule"><div><strong>Piano · Alexander Holm</strong><p>Salamander Grand Piano · CC BY 3.0. Échantillon distribué par Tone.js, arrangement génératif original.<br><a class="credit-link" href="https://github.com/Tonejs/audio/tree/master/salamander" target="_blank" rel="noopener">Source et licence</a></p></div></div><div class="rule"><div><strong>Interface · Nunito & Lucide</strong><p>Nunito par Vernon Adams, Cyreal & Jacques Le Bailly · SIL OFL 1.1. Icônes Lucide · ISC. Illustrations et graphismes originaux.<br><a class="credit-link" href="CREDITS.md" target="_blank" rel="noopener">Tous les crédits</a></p></div></div>`);
document.addEventListener('keydown',e=>{if($('modal').open||busy||e.ctrlKey||e.metaKey||e.altKey)return;if(['1','2','3'].includes(e.key))select(Number(e.key)-1);if(e.key==='Escape'){selected=-1;spadeMode=false;renderer.hint=-1;update();}if(e.key.toLowerCase()==='z')undo();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){save();audio.suspend();}else{audio.unlock();renderer.request();}});
window.addEventListener('pagehide',save);
new ResizeObserver(()=>{for(const c of $('hand').querySelectorAll('canvas')){const i=Number(c.parentElement.dataset.slot);drawHand(c,busy?history.at(-1).hand[i]:game.hand[i],selected===i,profile.settings);}}).observe($('hand'));
renderIcons();update();save();
if(game.ended)setTimeout(win,250);
else if(!profile.tutorial)setTimeout(rules,400);
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{/* HTTP/LAN keeps the game playable; offline needs HTTPS or localhost. */});
