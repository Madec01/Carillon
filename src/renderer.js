import { COLORS, canPlace } from './engine.js';

const ORB_TAU = Math.PI * 2;
const orbClamp = n => Math.max(0, Math.min(1, n));
const orbEase = n => 1 - (1 - n) ** 3;
const orbSmooth = n => n * n * (3 - 2 * n);
const orbMix = (a, b, t) => a + (b - a) * t;
const orbCopy = cells => cells.map(c => ({...c, piece:c.piece ? {...c.piece} : null}));
const orbSprites = new Map();
const orbGlyphs = ['✦', '●', '◆', '♥', '✿'];
const orbColor = color => COLORS[color] || '#b7a5ff';
function orbTint(hex, target, amount) {
  const rgb = hex.replace('#', '').match(/.{2}/g).map(v => parseInt(v, 16));
  return `rgb(${rgb.map(v => Math.round(orbMix(v, target, amount))).join(',')})`;
}
function orbCircle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(.01, r), 0, ORB_TAU); }
function orbStar(ctx, x, y, r, angle = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * .23 : r; i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill(); ctx.restore();
}
function orbRing(ctx, r, color, back = false) {
  ctx.save(); ctx.rotate(-.36); ctx.scale(1, .35);
  ctx.beginPath(); ctx.arc(0, 0, r * 1.38, back ? Math.PI : 0, back ? ORB_TAU : Math.PI);
  ctx.strokeStyle = back ? orbTint(color, 75, .25) : orbTint(color, 255, .6); ctx.lineWidth = r * .15; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r * 1.51, back ? Math.PI : 0, back ? ORB_TAU : Math.PI);
  ctx.strokeStyle = back ? color + '65' : '#f8ecffc9'; ctx.lineWidth = Math.max(.65, r * .025); ctx.stroke();
  ctx.restore();
}
function orbSprite(piece, radius) {
  const r = Math.round(radius * 2) / 2, dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
  const key = `${piece.color}/${piece.tier}/${r}/${dpr}`;
  if (orbSprites.has(key)) return orbSprites.get(key);
  const dim = Math.ceil(r * 3.7 + 8), center = dim / 2;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = Math.ceil(dim * dpr);
  const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr); ctx.translate(center, center);
  const color = orbColor(piece.color), tier = Math.min(2, piece.tier), body = r * (tier === 0 ? .83 : tier === 1 ? .94 : 1);
  // The cached material includes its bloom and contact shadow; animation only transforms it.
  const aura = ctx.createRadialGradient(0, 0, body * .65, 0, 0, r * 1.8);
  aura.addColorStop(0, color + (tier === 0 ? '35' : '27')); aura.addColorStop(.58, color + '11'); aura.addColorStop(1, color + '00');
  ctx.fillStyle = aura; ctx.fillRect(-center, -center, dim, dim);
  ctx.save(); ctx.translate(r * .1, r * .76); ctx.scale(1, .34);
  const shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.12); shadow.addColorStop(0, '#030718b0'); shadow.addColorStop(1, '#03071800'); ctx.fillStyle = shadow; orbCircle(ctx, 0, 0, r * 1.12); ctx.fill(); ctx.restore();
  if (tier === 2) orbRing(ctx, r, color, true);
  const face = ctx.createRadialGradient(-body * .4, -body * .43, body * .015, body * .13, body * .22, body * 1.26);
  face.addColorStop(0, orbTint(color, 255, .75)); face.addColorStop(.23, orbTint(color, 255, .36)); face.addColorStop(.48, color); face.addColorStop(.8, orbTint(color, 9, .29)); face.addColorStop(1, orbTint(color, 6, .64));
  orbCircle(ctx, 0, 0, body); ctx.fillStyle = face; ctx.fill();
  ctx.save(); orbCircle(ctx, 0, 0, body - .3); ctx.clip();
  if (tier === 2) {
    // Soft cloud bands curve around the sphere instead of sitting on its surface as flat stripes.
    ctx.save(); ctx.rotate(-.26);
    for (let i = 0; i < 5; i++) {
      const y = (-.64 + i * .3) * body;
      ctx.beginPath(); ctx.moveTo(-body * 1.1, y - body * .04); ctx.bezierCurveTo(-body * .2, y + body * .2, body * .4, y - body * .18, body * 1.12, y + body * .04);
      ctx.lineWidth = body * (i % 2 ? .14 : .085); ctx.strokeStyle = i % 2 ? '#ffffff27' : '#23183422'; ctx.stroke();
    }
    ctx.restore();
  } else if (tier === 1) {
    const craters = [[.26,.25,.23],[-.32,.11,.16],[.2,-.42,.10],[-.19,.57,.10],[.54,-.13,.075]];
    craters.forEach(([x,y,size]) => {
      const cx = x * body, cy = y * body, rr = size * body;
      const pit = ctx.createRadialGradient(cx + rr * .3, cy + rr * .45, 0, cx, cy, rr);
      pit.addColorStop(0, color + '12'); pit.addColorStop(.58, orbTint(color, 28, .12)); pit.addColorStop(1, orbTint(color, 12, .32));
      orbCircle(ctx, cx, cy, rr); ctx.fillStyle = pit; ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy + .3, rr, .06, Math.PI * .81); ctx.lineWidth = .8; ctx.strokeStyle = '#fff8ef58'; ctx.stroke();
    });
  } else {
    // A tiny hot star: a pearly core, soft solar bands and a crisp highlight.
    ctx.beginPath(); ctx.ellipse(body * .3, body * .1, body * .7, body * .2, -.75, 0, ORB_TAU); ctx.fillStyle = '#ffffff13'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(-body * .38, body * .35, body * .2, body * .42, -.75, 0, ORB_TAU); ctx.fillStyle = '#2013490d'; ctx.fill();
  }
  const rim = ctx.createLinearGradient(-body, -body, body, body); rim.addColorStop(0, '#fff9e4b9'); rim.addColorStop(.45, '#ffffff06'); rim.addColorStop(.8, color + '22'); rim.addColorStop(1, color + '75');
  orbCircle(ctx, 0, 0, body - .6); ctx.strokeStyle = rim; ctx.lineWidth = 1.3; ctx.stroke();
  const gloss = ctx.createRadialGradient(-body * .39, -body * .45, .1, -body * .3, -body * .35, body * .51); gloss.addColorStop(0, '#fffffb97'); gloss.addColorStop(.32, '#fffff448'); gloss.addColorStop(1, '#ffffff00'); ctx.fillStyle = gloss; ctx.fillRect(-body, -body, body * 2, body * 2);
  ctx.beginPath(); ctx.ellipse(-body * .32, -body * .52, body * .25, body * .09, -.53, 0, ORB_TAU); ctx.fillStyle = '#ffffffb3'; ctx.fill();
  ctx.restore();
  if (tier === 2) orbRing(ctx, r, color);
  if (tier === 0) { ctx.fillStyle = '#fff7e1db'; orbStar(ctx, body * .78, -body * .64, body * .17, .15); ctx.fillStyle = color + 'bc'; orbStar(ctx, -body * .8, body * .64, body * .095, -.2); }
  const result = {canvas, dim, center}; if (orbSprites.size > 140) orbSprites.clear(); orbSprites.set(key, result); return result;
}

/** Radius is the sphere's body radius; a planet's rings extend to 1.5 × radius. */
export function drawPlanet(ctx, piece, x, y, r, time = 0, options = {}) {
  if (!piece || r <= 0) return;
  if (typeof time === 'object') { options = time; time = 0; }
  const {alpha = 1, scale = 1, rotation = 0, squash = 0, symbols = false} = options;
  if (alpha <= 0 || scale <= 0) return;
  const art = orbSprite(piece, r);
  ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x, y); ctx.rotate(rotation); ctx.scale(scale * (1 + squash * .08), scale * (1 - squash * .1));
  ctx.drawImage(art.canvas, -art.center, -art.center, art.dim, art.dim);
  if (symbols) { ctx.font = `900 ${r * .61}px Nunito, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 2; ctx.strokeStyle = '#12213bb3'; ctx.fillStyle = '#fff9f5'; ctx.strokeText(orbGlyphs[piece.color % orbGlyphs.length], 0, r * .13); ctx.fillText(orbGlyphs[piece.color % orbGlyphs.length], 0, r * .13); }
  ctx.restore();
}
export function drawHand(canvas, piece, selected = false, settings = {}) {
  const box = canvas.getBoundingClientRect(), dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
  const w = box.width || 100, h = box.height || 64;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
  drawPlanet(ctx, piece, w / 2, h / 2 + 1, Math.min(24, w * .245, h * .33), 0, {symbols:settings.symbols, scale:selected ? 1.08 : 1});
}

export class BoardRenderer {
  constructor(canvas, getState, getSettings) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.getState = getState; this.getSettings = getSettings;
    this.points = []; this.particles = []; this.rings = []; this.labels = []; this.impacts = new Map();
    this.hover = -1; this.hint = -1; this.selected = null; this.spade = false; this.snapshot = null; this.animation = null; this.frame = 0;
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(canvas); this.resize();
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.finishAnimation(); else this.request(); });
  }
  reduced() { return !!this.getSettings()?.motion; }
  resize() {
    const b = this.canvas.getBoundingClientRect(); this.width = b.width; this.height = b.height;
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2); this.canvas.width = Math.max(1, Math.round(b.width * dpr)); this.canvas.height = Math.max(1, Math.round(b.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); this.layout(); this.request();
  }
  layout() {
    const state = this.getState(); if (!state?.cells?.length) return;
    const cols = Math.max(...state.cells.map(c => c.q)) + 1, rows = Math.max(...state.cells.map(c => c.r)) + 1;
    this.cellSize = Math.max(1, Math.min((this.width - 8) / cols, (this.height - 8) / rows)); this.r = this.cellSize / 2;
    this.canvas.dataset.cellSize = String(this.cellSize); this.canvas.dataset.gridX = String((this.width - this.cellSize * cols) / 2); this.canvas.dataset.gridY = String((this.height - this.cellSize * rows) / 2);
    this.points = state.cells.map(c => ({x:(this.width - this.cellSize * cols) / 2 + (c.q + .5) * this.cellSize, y:(this.height - this.cellSize * rows) / 2 + (c.r + .5) * this.cellSize}));
  }
  hit(x, y) {
    const cells = this.snapshot || this.getState()?.cells || [];
    return this.points.findIndex((p, i) => !cells[i]?.void && Math.abs(x - p.x) < this.r * .96 && Math.abs(y - p.y) < this.r * .96);
  }
  eventPoint(event) { const b = this.canvas.getBoundingClientRect(); return {x:event.clientX - b.left, y:event.clientY - b.top}; }
  request() {
    if (!this.frame) this.frame = requestAnimationFrame(now => { this.frame = 0; this.draw(now); if (this.animation || this.particles.length || this.rings.length || this.labels.length || this.impacts.size) this.request(); });
  }
  impact(index, strength = 1) { if (!this.reduced() && !document.hidden) this.impacts.set(index, {start:performance.now(), strength}); this.request(); }
  burst(index, color, count = 30) {
    const point = this.points[index]; if (!point || this.reduced() || document.hidden) return;
    const start = performance.now();
    for (let i = 0; i < count; i++) {
      const a = i / count * ORB_TAU + (Math.random() - .5) * .2, speed = 35 + Math.random() * 80;
      this.particles.push({x:point.x, y:point.y, vx:Math.cos(a) * speed, vy:Math.sin(a) * speed, start, duration:480 + Math.random() * 450, size:1 + Math.random() * 2.5, color:i % 4 === 0 ? '#fff4dc' : orbColor(color), star:i % 3 === 0, angle:a});
    }
    this.particles = this.particles.slice(-150);
    this.rings.push({x:point.x, y:point.y, start, color:orbColor(color), strength:Math.min(1.3, count / 28)}); this.request();
  }
  label(index, text, color = 0) {
    const p = this.points[index]; if (!p || this.reduced() || document.hidden) return;
    this.labels.push({x:p.x, y:p.y - this.r * .62, text, color:typeof color === 'string' ? color : orbColor(color), start:performance.now()}); this.request();
  }
  animate(event, {onImpact = () => {}, onTile = () => {}} = {}) {
    this.finishAnimation();
    if (!event?.snapshot) { onImpact(); return Promise.resolve(); }
    const before = orbCopy(this.snapshot || this.getState().cells), after = orbCopy(event.snapshot);
    if (this.reduced() || document.hidden) { this.snapshot = after; onImpact(); this.request(); return Promise.resolve(); }
    this.layout();
    const durations = {place:365, merge:740, gravity:590, orbit:700, comet:870, clear:560, rock:310};
    return new Promise(resolve => {
      this.animation = {...event, before, after, start:performance.now(), duration:durations[event.type] || 450, progress:0, resolve, onImpact, onTile, impacted:false, landed:new Set()};
      this.canvas.dataset.animating = event.type; this.request();
    });
  }
  finishAnimation() {
    const a = this.animation; if (!a) return;
    this.snapshot = a.after;
    if (!a.impacted) { a.impacted = true; a.onImpact(); }
    this.animation = null; delete this.canvas.dataset.animating; a.resolve();
  }
  animationCells(now) {
    const a = this.animation; if (!a) return this.snapshot || this.getState().cells;
    const t = orbClamp((now - a.start) / a.duration); a.progress = t;
    const impactAt = a.type === 'place' ? .62 : a.type === 'merge' ? .68 : a.type === 'comet' ? .81 : a.type === 'clear' ? .55 : .84;
    if (t >= impactAt && !a.impacted) {
      a.impacted = true; this.snapshot = a.after; this.impact(a.index, a.type === 'merge' ? 2 : 1);
      if (['merge', 'comet', 'clear'].includes(a.type)) this.burst(a.index, a.color, a.type === 'comet' ? 46 : a.type === 'merge' ? 34 : 20);
      a.onImpact();
    }
    if (t >= 1) { this.finishAnimation(); return this.snapshot; }
    const cells = orbCopy(a.impacted ? a.after : a.before);
    if (a.type === 'place' && !a.impacted) cells[a.index].piece = null;
    if (a.type === 'merge') {
      if (!a.impacted && t > .1) for (const index of a.from || []) if (cells[index]) cells[index].piece = null;
      if (cells[a.index]) cells[a.index].piece = null;
    }
    if ((a.type === 'gravity' || a.type === 'orbit') && !a.impacted) for (const move of a.moves || []) if (cells[move.from]) cells[move.from].piece = null;
    if (a.type === 'clear' && cells[a.index]) cells[a.index].piece = null;
    if (a.type === 'comet' && !a.impacted) {
      for (const index of a.from || []) if (this.points[index] && t >= this.cometArrival(a.index, index)) cells[index].piece = null;
    }
    return cells;
  }
  drawSlot(ctx, cell, index) {
    const p = this.points[index], r = this.r;
    if (cell.void) { ctx.fillStyle = '#b7b3df4d'; orbStar(ctx, p.x + (index % 3 - 1) * r * .2, p.y, 1.8, .2); return; }
    const piece = typeof this.selected === 'number' ? this.getState().hand[this.selected] : this.selected;
    const active = index === this.hint || index === this.hover && (!!piece || this.spade);
    const color = this.spade ? '#ff91aa' : orbColor(piece?.color ?? 2);
    const legal = !cell.piece && !cell.rock;
    const radius = Math.max(8, r * .42), x = p.x - r * .91, y = p.y - r * .91, size = r * 1.82;
    const fill = ctx.createLinearGradient(0, p.y - r, 0, p.y + r); fill.addColorStop(0, active ? '#343550bc' : '#20243d9e'); fill.addColorStop(1, active ? '#292f4cab' : '#171c3390');
    ctx.beginPath(); ctx.roundRect(x, y, size, size, radius); ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = active ? color + 'ac' : cell.orbit ? '#ac9fe239' : '#ccd2ff0e'; ctx.lineWidth = active ? 1.45 : .8; ctx.stroke();
    if (active) { ctx.save(); ctx.beginPath(); ctx.roundRect(x + 3, y + 3, size - 6, size - 6, radius - 2); ctx.strokeStyle = color + '26'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore(); }
    if (cell.orbit) { ctx.save(); ctx.strokeStyle = '#c7b8ee54'; ctx.lineWidth = 1; ctx.setLineDash([2, 5]); orbCircle(ctx, p.x, p.y, r * .75); ctx.stroke(); ctx.restore(); }
    if (cell.portal !== null && cell.portal !== undefined) this.drawPortal(ctx, p, cell.portal, r, !!cell.piece);
    else if (legal) { ctx.fillStyle = active ? color + 'b0' : '#a8b4df29'; orbCircle(ctx, p.x, p.y, active ? 2.4 : 1.3); ctx.fill(); }
    if (cell.rock) this.drawRock(ctx, p, cell.rock, r);
  }
  drawPortal(ctx, p, portal, r, occupied) {
    const color = portal % 2 ? '#6ce7df' : '#b5a1ff'; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(portal ? .6 : -.2);
    ctx.globalAlpha = occupied ? .48 : .9;
    const halo = ctx.createRadialGradient(0, 0, r * .22, 0, 0, r * .83); halo.addColorStop(0, color + '00'); halo.addColorStop(.6, color + '18'); halo.addColorStop(1, color + '00'); ctx.fillStyle = halo; ctx.fillRect(-r, -r, r * 2, r * 2);
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(0, 0, r * (.45 + i * .115), r * (.37 + i * .1), i * .32, i * .9, i * .9 + Math.PI * 1.45); ctx.strokeStyle = color + ['48', '9b', 'd8'][i]; ctx.lineWidth = i === 2 ? 1.5 : .8; ctx.stroke(); }
    ctx.fillStyle = '#f3eaff'; orbStar(ctx, r * .63, 0, 2.5); ctx.restore();
  }
  drawRock(ctx, p, health, r) {
    const rr = r * .61; ctx.save(); ctx.translate(p.x, p.y);
    const rock = ctx.createLinearGradient(-rr, -rr, rr, rr); rock.addColorStop(0, '#a1aec0'); rock.addColorStop(.4, '#68758c'); rock.addColorStop(1, '#333b56');
    ctx.beginPath(); for (let i = 0; i < 9; i++) { const a = i / 9 * ORB_TAU, size = rr * (i % 3 ? 1 : .87); i ? ctx.lineTo(Math.cos(a) * size, Math.sin(a) * size) : ctx.moveTo(Math.cos(a) * size, Math.sin(a) * size); } ctx.closePath(); ctx.fillStyle = rock; ctx.fill(); ctx.strokeStyle = '#dceaff70'; ctx.lineWidth = .9; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-rr * .2, -rr * .8); ctx.lineTo(rr * .1, -rr * .17); ctx.lineTo(-rr * .16, rr * .15); ctx.lineTo(rr * .25, rr * .77); ctx.strokeStyle = '#263048b0'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.fillStyle = '#17203978'; orbCircle(ctx, rr * .43, -rr * .18, rr * .17); ctx.fill(); orbCircle(ctx, -rr * .4, rr * .25, rr * .12); ctx.fill();
    for (let n = 0; n < health; n++) { ctx.fillStyle = '#eff3ffbd'; orbCircle(ctx, (n - (health - 1) / 2) * 6, rr * .52, 1.45); ctx.fill(); } ctx.restore();
  }
  draw(now = performance.now()) {
    const state = this.getState(); if (!state || !this.width) return;
    this.layout(); if (this.reduced() && this.animation) this.finishAnimation(); const ctx = this.ctx; ctx.clearRect(0, 0, this.width, this.height);
    const cells = this.animationCells(now), a = this.animation;
    if (!cells) return;
    this.drawOrbitPaths(ctx, cells);
    cells.forEach((cell, i) => this.drawSlot(ctx, cell, i));
    this.drawRings(now);
    const radius = this.r * .64;
    cells.forEach((cell, index) => {
      if (!cell.piece) return;
      const point = this.points[index], impact = this.impacts.get(index); let squash = 0;
      if (impact) { const age = (now - impact.start) / 1000; squash = Math.sin(age * 27) * Math.exp(-age * 9) * impact.strength; if (age > .58) this.impacts.delete(index); }
      drawPlanet(ctx, cell.piece, point.x, point.y, radius, now, {symbols:this.getSettings()?.symbols, squash, alpha:this.spade && this.hover === index ? .6 : 1});
    });
    if (!a && this.hover >= 0 && canPlace(state, this.hover)) {
      const piece = typeof this.selected === 'number' ? state.hand[this.selected] : this.selected, p = this.points[this.hover];
      if (piece && p) drawPlanet(ctx, piece, p.x, p.y - 2, radius, now, {alpha:.55, symbols:this.getSettings()?.symbols});
    }
    if (a) this.drawAnimation(a, now);
    this.drawParticles(now); this.drawLabels(now);
    // Impacts on cells that became empty still expire, avoiding an idle animation loop.
    for (const [index, impact] of this.impacts) if (now - impact.start > 580) this.impacts.delete(index);
  }
  drawOrbitPaths(ctx, cells) {
    const points = cells.map((cell, i) => cell.orbit ? this.points[i] : null).filter(Boolean); if (points.length < 3) return;
    const center = {x:points.reduce((n,p) => n + p.x, 0) / points.length, y:points.reduce((n,p) => n + p.y, 0) / points.length};
    points.sort((a,b) => Math.atan2(a.y - center.y, a.x - center.x) - Math.atan2(b.y - center.y, b.x - center.x));
    ctx.save(); ctx.beginPath(); points.forEach((p,i) => i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y)); ctx.closePath(); ctx.strokeStyle = '#b4a3fd25'; ctx.lineWidth = 1; ctx.setLineDash([2, 5]); ctx.stroke(); ctx.restore();
  }
  drawAnimation(a, now) {
    const ctx = this.ctx, t = a.progress, p = this.points[a.index], radius = this.r * .64;
    const opts = {symbols:this.getSettings()?.symbols}; if (!p) return;
    if (a.type === 'place' && !a.impacted) {
      const u = orbClamp(t / .62), e = orbEase(u), y = p.y + (1 - e) * this.r * 1.7;
      this.drawTrail([{x:p.x + 8,y:y + 16},{x:p.x,y}], orbColor(a.color), (1-u)*.65, 2);
      drawPlanet(ctx, a.after[a.index]?.piece, p.x + Math.sin(u * Math.PI) * 4, y, radius, now, {...opts, scale:.5 + .5 * e, alpha:.35 + .65 * e, rotation:(1 - e) * -.25});
    }
    if (a.type === 'merge') {
      if (!a.impacted) {
        const u = orbClamp((t - .1) / .58), e = orbSmooth(u);
        this.drawVortex(p, a.color, u, a.tier === 3);
        if (t > .1) for (const index of a.from || []) {
          const from = this.points[index], piece = a.before[index]?.piece; if (!from || !piece) continue;
          const dx = p.x - from.x, dy = p.y - from.y, sign = index % 2 ? 1 : -1, bow = Math.sin(u * Math.PI) * .24 * sign;
          const x = orbMix(from.x, p.x, e) - dy * bow, y = orbMix(from.y, p.y, e) + dx * bow;
          const tail = []; for (let k = 0; k < 9; k++) { const v = Math.max(0, u - (8-k) * .025), z = orbSmooth(v), b = Math.sin(v * Math.PI) * .24 * sign; tail.push({x:orbMix(from.x,p.x,z)-dy*b,y:orbMix(from.y,p.y,z)+dx*b}); }
          this.drawTrail(tail, orbColor(piece.color), Math.sin(u * Math.PI) * .8, 3.5);
          drawPlanet(ctx, piece, x, y, radius, now, {...opts, scale:1 - .7 * e, rotation:sign * u * .75, alpha:1 - u * .25});
        }
        drawPlanet(ctx, a.before[a.index]?.piece, p.x, p.y, radius, now, {...opts, scale:1 - .32 * Math.sin(u * Math.PI / 2), squash:-Math.sin(u * Math.PI) * .6});
      } else {
        const u = orbClamp((t - .68) / .32), scale = 1 - Math.exp(-u * 7) * Math.cos(u * 10) * .6;
        drawPlanet(ctx, a.after[a.index]?.piece, p.x, p.y, radius, now, {...opts, scale});
        if (a.tier === 3) this.drawNova(p, a.color, u);
      }
    }
    if ((a.type === 'gravity' || a.type === 'orbit') && !a.impacted) {
      const moves = a.moves || [];
      moves.forEach((move, index) => {
        const from = this.points[move.from], to = this.points[move.to]; if (!from || !to) return;
        const delay = moves.length < 10 ? index * .013 : index * .005, u = orbClamp((t - delay) / (.76 - delay)), e = orbSmooth(u);
        const dx = to.x - from.x, dy = to.y - from.y, curve = a.type === 'orbit' ? .18 : .14 * (index % 2 ? 1 : -1), bow = Math.sin(u * Math.PI) * curve;
        const x = orbMix(from.x, to.x, e) - dy * bow, y = orbMix(from.y, to.y, e) + dx * bow;
        const tail = []; for (let k = 0; k < 7; k++) { const v = Math.max(0, u - (6-k) * .035), z = orbSmooth(v), b = Math.sin(v * Math.PI) * curve; tail.push({x:orbMix(from.x,to.x,z)-dy*b,y:orbMix(from.y,to.y,z)+dx*b}); }
        this.drawTrail(tail, orbColor(move.piece.color), Math.sin(u * Math.PI) * .55, 2.5);
        drawPlanet(ctx, move.piece, x, y, radius, now, {...opts, scale:1 + Math.sin(u * Math.PI) * .08, rotation:Math.sin(u * Math.PI) * .15});
        if (u === 1 && !a.landed.has(index)) { a.landed.add(index); a.onTile(index, moves.length); this.impact(move.to, .8); }
      });
    }
    if (a.type === 'comet') this.drawComet(a, now);
    if (a.type === 'clear' && !a.impacted) { const u = orbClamp(t / .55); this.drawVortex(p, a.color, u, false); drawPlanet(ctx, a.before[a.index]?.piece, p.x, p.y, radius, now, {...opts, scale:1 - orbEase(u) * .88, rotation:u * 1.2, alpha:1 - u}); }
  }
  drawTrail(points, color, alpha, width) {
    if (points.length < 2 || alpha <= .01) return;
    const ctx = this.ctx, first = points[0], last = points.at(-1); if (Math.hypot(first.x - last.x, first.y - last.y) < .2) return;
    const gradient = ctx.createLinearGradient(first.x, first.y, last.x, last.y); gradient.addColorStop(0, color + '00'); gradient.addColorStop(.65, color); gradient.addColorStop(1, '#fff9f1');
    ctx.save(); ctx.globalAlpha = alpha; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = gradient; ctx.beginPath(); points.forEach((p,i) => i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y)); ctx.lineWidth = width * 3.5; ctx.globalAlpha = alpha * .1; ctx.stroke(); ctx.lineWidth = width; ctx.globalAlpha = alpha; ctx.stroke(); ctx.restore();
  }
  drawVortex(point, color, t, nova = false) {
    const ctx = this.ctx, r = this.r, alpha = Math.sin(t * Math.PI * .9), tint = orbColor(color);
    ctx.save(); ctx.translate(point.x, point.y); ctx.rotate(t * 2.2); ctx.globalAlpha = alpha;
    const glow = ctx.createRadialGradient(0,0,0,0,0,r*(1.8-t*.6)); glow.addColorStop(0,'#fff9eb65'); glow.addColorStop(.25,tint+'45'); glow.addColorStop(1,tint+'00'); ctx.fillStyle=glow; ctx.fillRect(-r*2,-r*2,r*4,r*4);
    for(let i=0;i<3;i++) { const size=r*(1.2-t*.58)+i*3; ctx.beginPath(); ctx.ellipse(0,0,size,size*.78,i*.9,i*2,i*2+Math.PI*1.3); ctx.strokeStyle=i===0?'#fff2e7b5':tint+'80'; ctx.lineWidth=i===0?1.7:.85; ctx.stroke(); }
    if(nova){ctx.fillStyle='#fff5df';for(let i=0;i<6;i++){const angle=i/6*ORB_TAU;orbStar(ctx,Math.cos(angle)*r*(1.4-t*.9),Math.sin(angle)*r*(1.4-t*.9),2.5+t*2,t);}}
    ctx.restore();
  }
  drawNova(point,color,t) {
    const ctx=this.ctx,r=this.r*(.2+orbEase(t)*3);ctx.save();ctx.globalAlpha=(1-t)**1.6;
    const halo=ctx.createRadialGradient(point.x,point.y,0,point.x,point.y,r);halo.addColorStop(0,'#fff9db');halo.addColorStop(.12,'#fff4e9a0');halo.addColorStop(.38,orbColor(color)+'75');halo.addColorStop(1,orbColor(color)+'00');ctx.fillStyle=halo;ctx.fillRect(point.x-r,point.y-r,r*2,r*2);ctx.fillStyle='#fff9e0';orbStar(ctx,point.x,point.y,r*.63,.2);ctx.restore();
  }
  drawComet(a, now) {
    const ctx=this.ctx,p=this.points[a.index],t=a.progress,color=orbColor(a.color),travel=orbEase(orbClamp(t/.82));
    const rays=[{x:1,y:0,len:this.width-p.x+this.r},{x:-1,y:0,len:p.x+this.r},{x:0,y:1,len:this.height-p.y+this.r},{x:0,y:-1,len:p.y+this.r}];
    rays.forEach(ray=>{
      const distance=travel*ray.len,tail=Math.min(distance,this.r*3.2),head={x:p.x+ray.x*distance,y:p.y+ray.y*distance};
      const opacity=1-orbClamp((t-.74)/.26);
      this.drawTrail([{x:head.x-ray.x*tail,y:head.y-ray.y*tail},{x:head.x,y:head.y}],color,opacity,5.5);
      ctx.save();ctx.globalAlpha=opacity;const glow=ctx.createRadialGradient(head.x,head.y,0,head.x,head.y,this.r*.7);glow.addColorStop(0,'#fff9e9f2');glow.addColorStop(.16,color+'c5');glow.addColorStop(1,color+'00');ctx.fillStyle=glow;ctx.fillRect(head.x-this.r,head.y-this.r,this.r*2,this.r*2);ctx.fillStyle='#fffdf0';orbStar(ctx,head.x,head.y,this.r*.21,now*.002);ctx.restore();
    });
    if(t<.6)this.drawNova(p,a.color,t/.6);
    if(t<.81)for(const index of a.from||[]){const from=this.points[index],piece=a.before[index]?.piece;if(!from||!piece)continue;const u=orbClamp((t-this.cometArrival(a.index,index))/.23);if(u<=0||u>=1)continue;drawPlanet(ctx,piece,from.x+Math.sin(index)*u*12,from.y-u*13,this.r*.64,now,{scale:1-u*.7,alpha:1-u,rotation:u*.5});}
  }
  cometArrival(origin, index) {
    const p = this.points[origin], target = this.points[index]; if (!p || !target) return 0;
    const dx = target.x - p.x, dy = target.y - p.y;
    const extent = Math.abs(dx) > Math.abs(dy) ? dx > 0 ? this.width - p.x + this.r : p.x + this.r : dy > 0 ? this.height - p.y + this.r : p.y + this.r;
    return .82 * (1 - (1 - orbClamp(Math.hypot(dx, dy) / extent)) ** (1 / 3));
  }
  drawRings(now) {
    const ctx=this.ctx;this.rings=this.rings.filter(ring=>now-ring.start<760);
    for(const ring of this.rings){const t=orbClamp((now-ring.start)/760),radius=this.r*(.35+orbEase(t)*2.55)*ring.strength;ctx.save();ctx.globalAlpha=(1-t)**1.6;const glow=ctx.createRadialGradient(ring.x,ring.y,radius*.58,ring.x,ring.y,radius);glow.addColorStop(0,ring.color+'00');glow.addColorStop(.86,ring.color+'20');glow.addColorStop(1,ring.color+'00');ctx.fillStyle=glow;ctx.fillRect(ring.x-radius,ring.y-radius,radius*2,radius*2);ctx.strokeStyle=ring.color+'c7';ctx.lineWidth=1.7*(1-t)+.3;ctx.beginPath();ctx.ellipse(ring.x,ring.y,radius,radius*.87,-.2,0,ORB_TAU);ctx.stroke();ctx.strokeStyle='#fff6e695';ctx.lineWidth=.6;ctx.beginPath();ctx.ellipse(ring.x,ring.y,radius*.79,radius*.7,-.2,0,ORB_TAU);ctx.stroke();ctx.restore();}
  }
  drawParticles(now) {
    const ctx=this.ctx;this.particles=this.particles.filter(p=>now-p.start<p.duration);
    for(const p of this.particles){const age=(now-p.start)/1000,t=(now-p.start)/p.duration,drag=1-Math.exp(-age*2.6),x=p.x+p.vx*drag*.5,y=p.y+p.vy*drag*.5+age*age*8;ctx.save();ctx.globalAlpha=(1-t)**1.35;ctx.fillStyle=p.color;if(p.star)orbStar(ctx,x,y,p.size*(1-t*.55),p.angle+age);else{ctx.beginPath();ctx.ellipse(x,y,p.size*(1-t*.55),p.size*.45,p.angle,0,ORB_TAU);ctx.fill();}ctx.restore();}
  }
  drawLabels(now) {
    const ctx=this.ctx;this.labels=this.labels.filter(label=>now-label.start<1000);
    for(const label of this.labels){const t=orbClamp((now-label.start)/1000);ctx.save();ctx.globalAlpha=Math.min(1,t*10)*(1-orbClamp((t-.6)/.4));ctx.translate(label.x,label.y-18*orbEase(t));ctx.scale(1+Math.sin(Math.min(1,t*4)*Math.PI)*.08,1+Math.sin(Math.min(1,t*4)*Math.PI)*.08);ctx.font=`900 ${Math.max(14,this.r*.48)}px Nunito,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.strokeStyle='#11162df0';ctx.lineWidth=4;ctx.lineJoin='round';ctx.strokeText(label.text,0,0);ctx.fillStyle=label.color;ctx.fillText(label.text,0,0);ctx.restore();}
  }
  destroy() { this.finishAnimation(); this.observer.disconnect(); cancelAnimationFrame(this.frame); }
}
