import {createGame,levelInfo,WORLDS,COLOR_NAMES,TIER_NAMES,clone,place,shuffle,usePower,bestHint,canPlace,blocked,dailySeed,validGame} from './engine.js';
import {BoardRenderer,drawHand,drawPlanet} from './renderer.js';
import {AudioGarden} from './audio.js';

const $=id=>document.getElementById(id),KEY='orbitale-v1';
const defaults={sound:false,music:true,haptics:true,symbols:false,motion:matchMedia('(prefers-reduced-motion: reduce)').matches};
let profile={unlocked:1,stars:{},best:0,settings:{...defaults},active:'journey',runs:{},tutorial:false,dailyWins:{},seen:{}};
try{
  const p=JSON.parse(localStorage.getItem(KEY));
  if(p&&Number.isInteger(p.unlocked)&&p.unlocked>=1&&p.unlocked<=30){
    profile={...profile,...p,settings:{...defaults,...p.settings}};
    for(const k of ['stars','runs','dailyWins','seen'])if(!profile[k]||typeof profile[k]!=='object'||Array.isArray(profile[k]))profile[k]={};
    profile.best=Number.isFinite(profile.best)?Math.max(0,profile.best):0;
  }
}catch{}
for(const key of Object.keys(defaults))profile.settings[key]=!!profile.settings[key];
if(!['journey','zen','daily'].includes(profile.active))profile.active='journey';
let game=profile.runs[profile.active];
if(!validGame(game)||game.mode!==profile.active||(game.mode==='daily'&&game.seed!==dailySeed()))game=createGame(profile.active==='journey'?profile.unlocked:1,profile.active);
let selected=-1,busy=false,power=null,history=[],toastTimer,storageWarned=false,comboTimer;
const icons=new Map();
async function renderIcons(root=document){
  await Promise.all([...root.querySelectorAll('[data-icon]')].map(async el=>{
    const name=el.dataset.icon;
    try{if(!icons.has(name))icons.set(name,fetch(`assets/icons/${name}.svg`).then(r=>{if(!r.ok)throw Error(name);return r.text();}));
      const svg=await icons.get(name);if(el.isConnected){el.innerHTML=svg;el.querySelector('svg')?.classList.add('icon');el.setAttribute('aria-hidden','true');}
    }catch{el.textContent='✦';}
  }));
}
const audio=new AudioGarden(()=>profile.settings);
const renderer=new BoardRenderer($('board'),()=>game,()=>profile.settings);
function save(){profile.runs[game.mode]=clone(game);profile.active=game.mode;try{localStorage.setItem(KEY,JSON.stringify(profile));}catch{if(!storageWarned){storageWarned=true;toast('Le stockage est indisponible : votre partie reste jouable.');}}}
function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').classList.add('visible');$('live').textContent=message;toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3500);}
function vibrate(pattern){if(profile.settings.haptics&&!profile.settings.motion&&navigator.vibrate)navigator.vibrate(pattern);}
function pause(ms){return new Promise(resolve=>setTimeout(resolve,profile.settings.motion||document.hidden?0:ms));}
function number(n){return Math.floor(n).toLocaleString('fr-FR');}
let scoreAnimation=0;
function paintScore(value){const info=levelInfo(game.level,game.mode);$('score').textContent=number(value);$('goal-fill').style.width=`${game.mode==='zen'?(value%1000)/10:Math.min(100,value/info.target*100)}%`;}
function animateScore(from,to){
  const token=++scoreAnimation,start=performance.now();
  if(profile.settings.motion||document.hidden){paintScore(to);return;}
  function tick(now){if(token!==scoreAnimation)return;const t=Math.min(1,(now-start)/350);paintScore(from+(to-from)*(1-(1-t)**3));if(t<1)requestAnimationFrame(tick);}
  requestAnimationFrame(tick);
}
function updateSound(){const b=$('sound');b.setAttribute('aria-label',profile.settings.sound?'Couper le son':'Activer le son');b.setAttribute('aria-pressed',String(profile.settings.sound));b.innerHTML=`<i data-icon="${profile.settings.sound?'volume-2':'volume-x'}"></i>`;renderIcons(b);}
function update(){
  updateSound();if(busy)return;
  const info=levelInfo(game.level,game.mode);
  $('level-number').textContent=game.mode==='journey'?`Mission ${String(game.level).padStart(2,'0')}`:game.mode==='daily'?'Défi du jour':'Mode libre';
  $('level-name').textContent=info.title;$('world-name').textContent=WORLDS[info.world].short;
  paintScore(game.score);$('target').textContent=game.mode==='zen'?'sans limite':number(info.target);
  $('planet-count').textContent=game.planets;$('planet-goal').textContent=game.mode==='zen'?'créées':String(info.planetGoal);
  $('energy-fill').style.width=`${game.energy}%`;$('energy-count').textContent=game.energy===100?'Prête !':`${game.energy}%`;
  $('shuffle-count').textContent=game.shuffles;$('clear-count').textContent=game.spades;
  $('undo').disabled=!history.length;$('shuffle').disabled=!game.shuffles||game.ended;$('clear').disabled=!game.spades||game.ended;
  $('gravity').disabled=game.energy<100||game.ended;$('hint').disabled=game.ended;
  $('clear').classList.toggle('active',power==='clear');$('gravity').classList.toggle('active',power==='gravity');
  $('gravity').classList.toggle('charged',game.energy===100);$('gravity').setAttribute('aria-label',`Attraction, ${game.energy}% d’énergie. Fusionne trois astres identiques, même éloignés.`);
  const arrows={down:'↓',left:'←',up:'↑',right:'→'};
  const forecasts=[info.orbit?`Orbite dans ${4-game.moves%4} coups`:null,info.gravity?`Gravité ${arrows[game.gravity]} dans ${3-game.moves%3} coups`:null].filter(Boolean);
  $('rule-line').textContent=game.ended?'Mission accomplie · touchez le titre pour continuer':power==='clear'?'Touchez un astre ou une météorite à retirer':power==='gravity'?'Touchez un astre : deux jumeaux le rejoindront':selected>=0?'Touchez une case libre pour poser votre astre':forecasts.join(' · ')||'3 étoiles → 1 lune · 3 lunes → 1 planète';
  document.body.classList.toggle('reduced-motion',profile.settings.motion);document.body.dataset.world=info.world;
  for(const mode of ['journey','daily','zen']){$(mode).classList.toggle('active',game.mode===mode);$(mode).setAttribute('aria-pressed',String(game.mode===mode));}
  renderer.selected=selected<0?null:game.hand[selected];renderer.spade=power==='clear';renderer.request();
  renderHand();renderBoardAccess();
}
function renderHand(){
  $('hand').querySelectorAll('.offer').forEach((btn,i)=>{
    const p=game.hand[i];btn.classList.toggle('selected',selected===i);btn.classList.remove('departing');btn.disabled=busy||game.ended;
    btn.setAttribute('aria-pressed',String(selected===i));btn.setAttribute('aria-label',`${TIER_NAMES[p.tier]} ${COLOR_NAMES[p.color]}, réserve ${i+1}`);
    btn.querySelector('.offer-label').textContent=TIER_NAMES[p.tier];drawHand(btn.querySelector('canvas'),p,selected===i,profile.settings);
  });
}
function renderBoardAccess(){
  const root=$('board-accessible');if(!root)return;root.replaceChildren();
  game.cells.forEach((c,i)=>{if(c.void)return;const b=document.createElement('button');b.textContent=String(i+1);
    b.setAttribute('aria-label',`Case ${i+1}, ${c.rock?'météorite':c.piece?TIER_NAMES[c.piece.tier]+' '+COLOR_NAMES[c.piece.color]:'vide'}${c.portal!==null?', portail '+(c.portal+1):''}${c.orbit?', orbite':''}`);
    b.disabled=busy||game.ended||(!power&&!canPlace(game,i));b.onclick=()=>boardAction(i);root.append(b);
  });
}
function select(i){if(busy||game.ended)return;selected=i;power=null;renderer.hint=-1;audio.unlock();audio.play('pick',1,.35);update();}
let drag=null,suppressClick=false;
function startDrag(e,i){if(e.button!==0||busy||game.ended)return;drag={i,x:e.clientX,y:e.clientY,pointer:e.pointerId,moved:false};audio.unlock();}
$('hand').querySelectorAll('.offer').forEach((b,i)=>{b.addEventListener('pointerdown',e=>startDrag(e,i));b.onclick=()=>{if(!suppressClick)select(i);};});
document.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.pointer)return;
  if(!drag.moved&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>8){
    drag.moved=true;selected=drag.i;power=null;renderer.selected=game.hand[selected];renderHand();
    const ghost=$('drag-ghost');ghost.width=200;ghost.height=200;ghost.hidden=false;const ctx=ghost.getContext('2d');ctx.clearRect(0,0,200,200);ctx.save();ctx.scale(2,2);drawPlanet(ctx,game.hand[selected],50,50,26,0,{symbols:profile.settings.symbols});ctx.restore();
  }
  if(drag.moved){e.preventDefault();$('drag-ghost').style.left=e.clientX+'px';$('drag-ghost').style.top=(e.clientY-22)+'px';const p=renderer.eventPoint(e);renderer.hover=renderer.hit(p.x,p.y);renderer.request();}
},{passive:false});
document.addEventListener('pointerup',e=>{if(!drag||e.pointerId!==drag.pointer)return;const d=drag;drag=null;if(d.moved){$('drag-ghost').hidden=true;suppressClick=true;setTimeout(()=>suppressClick=false,80);const p=renderer.eventPoint(e),i=renderer.hit(p.x,p.y);renderer.hover=-1;if(i>=0)boardAction(i);else update();}});
document.addEventListener('pointercancel',()=>{drag=null;$('drag-ghost').hidden=true;renderer.hover=-1;renderer.request();});
$('board').addEventListener('pointermove',e=>{if(busy)return;const p=renderer.eventPoint(e);renderer.hover=renderer.hit(p.x,p.y);renderer.request();});
$('board').addEventListener('pointerleave',()=>{if(!drag){renderer.hover=-1;renderer.request();}});
$('board').addEventListener('click',e=>{if(suppressClick)return;const p=renderer.eventPoint(e);boardAction(renderer.hit(p.x,p.y));});
function remember(){history.push(clone(game));if(history.length>20)history.shift();}
function lockMove(slot){busy=true;$('board-wrap').classList.add('resolving');document.querySelectorAll('.offer,#undo,#shuffle,#clear,#hint,#gravity,#board-accessible button').forEach(b=>b.disabled=true);$('hand').querySelector(`[data-slot="${slot}"]`)?.classList.add('departing');$('rule-line').textContent='Une petite réaction… de grandes possibilités.';}
function showCombo(event){
  if(!event.combo)return;
  const el=$('combo');el.textContent=event.type==='comet'?`COMÈTE · ×${event.combo}`:event.combo>=2?`COMBO ×${event.combo}`:event.tier===2?'UNE PLANÈTE EST NÉE':'NOUVELLE LUNE';
  clearTimeout(comboTimer);el.classList.remove('show');void el.offsetWidth;el.classList.add('show');comboTimer=setTimeout(()=>el.classList.remove('show'),1500);
}
async function boardAction(index){
  if(busy||game.ended||index<0)return;
  audio.unlock();
  if(!power&&selected<0){toast('Choisissez un astre dans la réserve, puis une case libre.');return;}
  if(!power&&!canPlace(game,index)){toast(game.cells[index]?.rock?'Une fusion voisine fissure cette météorite.':'Choisissez une case libre. Les astres fusionnent côte à côte.');return;}
  const before=clone(game),slot=selected,kind=power;
  const result=kind?usePower(game,kind,index):place(game,selected,index);
  if(!result){toast(kind==='gravity'?'Il faut trois astres de la même couleur et de la même taille sur le plateau.':'Touchez un astre ou une météorite à retirer.');return;}
  history.push(before);if(history.length>20)history.shift();renderer.snapshot=before.cells;selected=-1;power=null;renderer.selected=null;renderer.hint=-1;renderer.hover=-1;renderer.spade=false;lockMove(slot);
  let shownScore=before.score,shownPlanets=before.planets;
  try{
    for(const event of result.events){
      await renderer.animate(event,{onTile:(n,total)=>audio.stackTick(n,total),onImpact:()=>{
        if(event.type==='place'){audio.play('place',.95,.5);vibrate(8);}
        if(event.type==='merge'||event.type==='comet'){
          audio.flourish(event.combo);showCombo(event);vibrate(event.combo>1?[12,25,18]:10);
          if(event.type==='merge'&&event.tier===2){shownPlanets++;$('planet-count').textContent=shownPlanets;}
        }
        if(event.type==='clear'||event.type==='rock')audio.play('clear',1.2,.28);
        if(event.type==='gravity'||event.type==='orbit')audio.play('pick',.65,.3);
        if(event.points){renderer.label(event.index,`+${event.points}`,event.color);animateScore(shownScore,shownScore+event.points);shownScore+=event.points;}
      }});
    }
  }finally{renderer.snapshot=null;busy=false;++scoreAnimation;$('board-wrap').classList.remove('resolving');profile.best=Math.max(profile.best,game.score);save();update();}
  const resolvedGame=game;
  if(result.won){await pause(400);if(game===resolvedGame&&game.ended)win();}
  else if(result.blocked){await pause(200);if(game===resolvedGame&&blocked(game))blockedModal();}
  else if(game.moves===1&&!profile.seen.first){profile.seen.first=true;save();toast('Les fusions enchaînées multiplient les points. Préparez la prochaine !');}
}
function modal(html){$('dialog-body').innerHTML=html;if(!$('dialog').open)$('dialog').showModal();renderIcons($('dialog'));}
function closeModal(){$('dialog').close();}
$('close-dialog').onclick=closeModal;
$('dialog').addEventListener('click',e=>{if(e.target===$('dialog')){const r=$('dialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();}});
function resetUI(){selected=-1;power=null;history=[];renderer.snapshot=null;renderer.hint=-1;renderer.hover=-1;$('combo').classList.remove('show');closeModal();save();update();}
function switchMode(mode,level=null){
  if(busy)return;save();const saved=profile.runs[mode],chosen=mode==='journey'?(level??profile.unlocked):1;
  game=validGame(saved)&&(!level||saved.level===chosen)&&!(mode==='daily'&&saved.seed!==dailySeed())?clone(saved):createGame(chosen,mode);
  resetUI();if(game.ended)win();else featureIntro();
}
function fresh(level=game.level,mode=game.mode){game=createGame(level,mode);resetUI();featureIntro();}
function featureIntro(){const f=levelInfo(game.level,game.mode).feature;if(game.mode==='journey'&&game.moves===0&&f&&!profile.seen[`feature${game.level}`]){
  profile.seen[`feature${game.level}`]=true;save();modal(`<div class="modal-eyebrow">NOUVELLE DÉCOUVERTE · MISSION ${game.level}</div><h2>${f.title}</h2><p>${f.text}</p><button class="primary-button" id="feature-ok">Explorer</button>`);$('feature-ok').onclick=closeModal;
}}
function win(){
  if(!game.ended||game.mode==='zen')return;
  const stars=game.moves<=9+game.level*2?3:game.moves<=18+game.level*3?2:1;
  if(game.mode==='journey'){profile.stars[game.level]=Math.max(Number(profile.stars[game.level])||0,stars);profile.unlocked=Math.min(30,Math.max(profile.unlocked,game.level+1));}
  if(game.mode==='daily')profile.dailyWins[game.seed]=game.score;
  save();audio.flourish(4);
  modal(`<div class="modal-eyebrow">${game.mode==='daily'?'CONSTELLATION DU JOUR COMPLÉTÉE':game.level===30?'VOTRE UNIVERS EST NÉ':'MISSION ACCOMPLIE'}</div><h2>${game.level===30?'Tout un univers à vous.':'Vous avez fait des merveilles.'}</h2><div class="stars">${'★'.repeat(stars)}<span class="empty">${'★'.repeat(3-stars)}</span></div><div class="result-stats"><div><b>${number(game.score)}</b><small>points</small></div><div><b>${game.planets}</b><small>planètes créées</small></div><div><b>×${game.bestCombo}</b><small>meilleur combo</small></div></div><p>${game.mode==='daily'?'Un nouveau ciel vous attend demain. Continuez l’aventure ou rejouez librement.':game.level===30?'Les trente missions sont à vous. Retrouvez vos préférées, le défi du jour ou le mode libre.':'Un autre coin du cosmos attend sa première lumière.'}</p><button class="primary-button" id="next-level">${game.mode==='daily'?'Retour à l’aventure':game.level===30?'Explorer en mode libre':'Mission suivante'} <i data-icon="arrow-right"></i></button><button class="secondary-button" id="replay-level">Rejouer cette mission</button>`);
  $('next-level').onclick=()=>game.mode==='daily'?switchMode('journey'):game.level===30?switchMode('zen'):fresh(game.level+1,'journey');$('replay-level').onclick=()=>fresh();renderer.burst(17,2,45);
}
function blockedModal(){
  modal(`<div class="modal-eyebrow">LE CIEL EST UN PEU ENCOMBRÉ</div><h2>Faisons de la place.</h2><p>Le plateau est plein. Vos outils sont gratuits et vous pouvez recommencer autant que vous voulez.</p>${game.spades?'<button class="primary-button" id="rescue">Éclipse · libérer une case</button>':''}${game.energy===100?'<button class="secondary-button" id="rescue-gravity">Attraction · réunir trois astres</button>':''}${history.length?'<button class="secondary-button" id="undo-rescue">Annuler le dernier coup</button>':''}<button class="secondary-button" id="retry">Recommencer la mission</button>`);
  if($('rescue'))$('rescue').onclick=()=>{closeModal();power='clear';selected=-1;update();};if($('rescue-gravity'))$('rescue-gravity').onclick=()=>{closeModal();power='gravity';selected=-1;update();};if($('undo-rescue'))$('undo-rescue').onclick=()=>{closeModal();undo();};$('retry').onclick=()=>fresh();
}
function undo(){if(busy||!history.length)return;game=history.pop();selected=-1;power=null;renderer.hint=-1;renderer.snapshot=null;save();update();toast('Dernier coup annulé. À vous de réinventer la suite.');}
$('undo').onclick=undo;
$('shuffle').onclick=()=>{if(busy)return;remember();if(shuffle(game)){selected=-1;power=null;renderer.hint=-1;audio.unlock();audio.play('pick',.8,.5);save();update();toast('Nouvelle réserve. Une recharge tous les quatre coups.');}else history.pop();};
$('clear').onclick=()=>{if(busy||game.ended||!game.spades)return;power=power==='clear'?null:'clear';selected=-1;renderer.hint=-1;update();if(power)toast('Touchez un astre ou une météorite à retirer. Recharge tous les huit coups.');};
$('gravity').onclick=()=>{if(busy||game.ended||game.energy<100)return;power=power==='gravity'?null:'gravity';selected=-1;renderer.hint=-1;update();if(power)toast('Trois astres identiques, même éloignés : touchez celui qui doit les attirer.');};
$('hint').onclick=()=>{if(busy||game.ended)return;if(blocked(game)){blockedModal();return;}if(selected<0)selected=0;power=null;renderer.hint=bestHint(game,selected);update();toast('La case lumineuse est une bonne piste pour cet astre.');};
function rules(){
  modal(`<div class="modal-eyebrow">LA FABRIQUE DES PETITS MONDES</div><h2>Un petit geste.<br>Tout un univers.</h2><div class="rule"><span class="rule-number">1</span><div><strong>Posez un astre</strong><p>Touchez un astre en bas, puis une case vide. Ou glissez-le avec le doigt.</p></div></div><div class="rule"><span class="rule-number">3</span><div><strong>Réunissez trois jumeaux</strong><p>Trois astres de même couleur et de même taille, côte à côte : étoiles → lune → planète.</p></div></div><div class="rule"><span class="rule-number">✦</span><div><strong>Déclenchez une cascade</strong><p>Une planète attire les astres de sa couleur. Trois planètes forment une supernova et une comète balaie leur ligne et leur colonne. Chaque fusion enchaînée augmente le multiplicateur, jusqu’à ×6.</p></div></div><p>Atteignez le score et créez les planètes demandées. L’Attraction se charge avec vos fusions. Portails, orbites et gravité arrivent au fil des 30 missions.</p><p>Sans chrono, publicité, achats ni vies limitées.</p><button class="primary-button" id="rules-play">Allumer les étoiles</button>`);
  $('rules-play').onclick=()=>{profile.tutorial=true;profile.seen.feature1=true;save();closeModal();audio.unlock();if(game.moves===0){selected=0;renderer.hint=bestHint(game,0);update();toast('Commencez ici : posez l’étoile dorée sur la case lumineuse.');}};
}
$('help').onclick=()=>{if(!busy)rules();};
function journey(){if(busy)return;modal(`<div class="modal-eyebrow">30 MISSIONS · 5 CONSTELLATIONS</div><h2>Votre carnet d’exploration.</h2>${WORLDS.map((w,wi)=>`<div class="world-heading">${w.short}<span>${wi*6+1}–${wi*6+6}</span></div><div class="level-grid">${Array.from({length:6},(_,j)=>{const n=wi*6+j+1;return `<button class="level-card ${game.mode==='journey'&&game.level===n?'current':''}" data-level="${n}" ${n>profile.unlocked?'disabled':''} aria-label="Mission ${n}${n>profile.unlocked?', verrouillée':''}">${n}<small>${'★'.repeat(Math.min(3,Number(profile.stars[n])||0))||'·'}</small></button>`;}).join('')}</div>`).join('')}<button class="primary-button" id="journey-continue">Continuer la mission ${profile.unlocked}</button>`);$('dialog-body').querySelectorAll('[data-level]').forEach(b=>b.onclick=()=>switchMode('journey',Number(b.dataset.level)));$('journey-continue').onclick=()=>switchMode('journey',profile.unlocked);}
$('journey').onclick=journey;$('levels').onclick=()=>{if(!busy){if(game.ended)win();else journey();}};
$('daily').onclick=()=>{if(busy)return;const i=levelInfo(1,'daily');modal(`<div class="modal-eyebrow">LE CIEL DU ${new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long',timeZone:'Europe/Paris'}).format(new Date()).toUpperCase()}</div><h2>La constellation du jour.</h2><p>La même réserve et le même plateau pour tous aujourd’hui. Portails, orbites et gravité se rencontrent : ${number(i.target)} points et ${i.planetGoal} planètes à créer.</p><p>${profile.dailyWins[dailySeed()]?'✦ Défi déjà réussi. Rejouez pour le plaisir !':'Une nouvelle constellation chaque jour, autant de tentatives que vous voulez.'}</p><button class="primary-button" id="daily-play">Explorer ce ciel</button>`);$('daily-play').onclick=()=>switchMode('daily');};
$('zen').onclick=()=>{if(busy)return;modal('<div class="modal-eyebrow">LE MODE LIBRE</div><h2>Sans arrivée.<br>Juste les étoiles.</h2><p>Créez vos planètes sans objectif ni chrono. Les portails et les orbites font vivre le plateau. Vos outils se rechargent pendant la partie ; annulez ou recommencez librement.</p><button class="primary-button" id="zen-play">Prendre le large</button>');$('zen-play').onclick=()=>switchMode('zen');};
function settings(){
  modal(`<div class="modal-eyebrow">À VOTRE RYTHME</div><h2>Votre bulle cosmique.</h2>${[['sound','Effets sonores','Une note à chaque rencontre'],['music','Piano d’ambiance','Une mélodie calme entre les étoiles'],['haptics','Retour tactile','De petites vibrations, si disponibles'],['symbols','Symboles sur les couleurs','Reconnaître les astres sans la couleur'],['motion','Réduire les animations','Moins de mouvements et de particules']].map(([key,label,desc])=>`<label class="settings-row"><span><strong>${label}</strong><small>${desc}</small></span><input type="checkbox" data-setting="${key}" ${profile.settings[key]?'checked':''}></label>`).join('')}<button class="secondary-button" id="restart">Recommencer la mission</button><p>Votre progression est sauvegardée sur cet appareil.</p>`);
  $('dialog-body').querySelectorAll('[data-setting]').forEach(input=>input.onchange=()=>{profile.settings[input.dataset.setting]=input.checked;save();update();audio.unlock();audio.sync();});
  $('restart').onclick=()=>{modal('<h2>Une nouvelle première lumière ?</h2><p>La partie en cours recommencera. Vos missions débloquées et vos étoiles seront conservées.</p><button class="primary-button" id="confirm-restart">Recommencer</button><button class="secondary-button" id="cancel-restart">Garder ma partie</button>');$('confirm-restart').onclick=()=>fresh();$('cancel-restart').onclick=closeModal;};
}
$('settings').onclick=()=>{if(!busy)settings();};
$('sound').onclick=async()=>{profile.settings.sound=!profile.settings.sound;save();updateSound();await audio.unlock();audio.sync();if(profile.settings.sound)audio.play('bloom',1,.4);};
if($('credits'))$('credits').onclick=()=>{if(busy)return;modal('<div class="modal-eyebrow">CRÉDITS & LICENCES</div><h2>Un univers à partager.</h2><p>Orbitale est un jeu original et gratuit, sans publicité, achat ni suivi. Astres et animations sont dessinés pour ce jeu.</p><p><strong>Effets : Kenney</strong> · CC0.<br><strong>Piano : Alexander Holm</strong>, Salamander Grand Piano · CC BY 3.0, distribué par Tone.js. Arrangement génératif original.<br><strong>Police : Nunito</strong>, Vernon Adams, Cyreal et Jacques Le Bailly · SIL OFL 1.1.<br><strong>Icônes : Lucide</strong> · ISC.</p><p><a class="credit-link" href="CREDITS.md" target="_blank" rel="noopener">Tous les crédits</a></p>');};
document.addEventListener('keydown',e=>{if($('dialog').open||busy||e.ctrlKey||e.metaKey||e.altKey)return;if(['1','2','3'].includes(e.key))select(Number(e.key)-1);if(e.key==='Escape'){selected=-1;power=null;renderer.hint=-1;update();}if(e.key.toLowerCase()==='z')undo();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){save();audio.suspend();}else{renderer.request();if(audio.ctx)audio.unlock();}});
window.addEventListener('pagehide',save);
new ResizeObserver(()=>{if(!busy)renderHand();}).observe($('hand'));
renderIcons();update();save();
if(game.ended)setTimeout(win,200);else if(!profile.tutorial)setTimeout(rules,300);else featureIntro();
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{/* Local HTTP remains playable. Installation and offline need a secure context. */});
