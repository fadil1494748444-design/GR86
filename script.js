(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;

/* ================= CONFIG (edit here) ================= */
const MODEL_URL = 'assets/gr86.glb';   // GR86 3D model (glTF binary)
// Approximate names & hex values — verify against the official brochure.
const COLORS = [
  { name: 'Ignition Red',        hex: '#c8102e', img: 'assets/colors/Ignition Red.png' },
  { name: 'Crystal White Pearl', hex: '#ecebe6', img: 'assets/colors/Crystal White Pearl.png' },
  { name: 'Ice Silver Metallic', hex: '#b5b8bd', img: 'assets/colors/Ice Silver Metallic.png' },
  { name: 'Black',               hex: '#101012', img: 'assets/colors/Black.png' },
  { name: 'Blue',                hex: '#1d3f8a', img: 'assets/colors/Blue.png' }
];
// Intro logo: Toyota emblem 3D model (glTF binary). Missing file → flat SVG coin is used instead.
const LOGO_URL = 'assets/toyota-logo.glb';
const LOGO = {
  turns: 3,                // full spins before stopping
  front: 0,                // extra yaw in degrees — use 180 if the coin lands showing its back
  rot: [0, 0, 0],          // extra x/y/z rotation in degrees — use [0, 0, 180] if the emblem lands upside down
  autoOrient: true         // detect the emblem's plane from its vertices and face it to the camera
};
/* ============================================================== */

const canvas = $('#gl'), fb = $('#fallback');
const coin = $('.i-logo');
const coinFlat = () => { coin.classList.add('flat', 'go'); holdIntro(1900); };   // SVG coin fallback
let startCam = 0, logoStop = null, logoPending = false;

/* ---- Intro ---- */
const intro = $('#intro');
let introDone = false;
function endIntro() {
  if (introDone) return;
  introDone = true;
  intro.classList.add('done');
  document.body.classList.remove('intro-on');
  startCam = performance.now();
  setTimeout(() => { intro.remove(); if (logoStop) logoStop(); }, 800);
}
$('#skip').addEventListener('click', endIntro);
const introStart = performance.now();
let introTimer = setTimeout(endIntro, reduce ? 300 : 3300);
// keep the intro open until the logo has finished spinning
function holdIntro(ms) {
  if (introDone || reduce) return;
  clearTimeout(introTimer);
  introTimer = setTimeout(endIntro, Math.max(ms, 3300 - (performance.now() - introStart)));
}
addEventListener('keydown', e => { if (e.key === 'Escape') endIntro(); });

/* ---- Navbar ---- */
const nav = $('#nav'), burger = $('#burger'), topBtn = $('#top'), links = $$('#menu a');
function setMenu(open) {
  document.body.classList.toggle('menu-open', open);
  burger.setAttribute('aria-expanded', open);
  burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
}
burger.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
links.forEach(a => a.addEventListener('click', () => setMenu(false)));
topBtn.addEventListener('click', () => scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }));

/* ---- Hero (scroll progress + text stages) ---- */
let heroP = 0, curStage = -1, heroH = 0;
const track = $('#home'), heroEl = $('#hero'), stages = $$('.stage'), pnum = $('#pnum'), pbar = $('#pbar');
$('#ptotal').textContent = String(stages.length).padStart(2, '0');
function updateHero() {
  const r = track.getBoundingClientRect();
  heroP = Math.min(Math.max(-r.top / Math.max(r.height - heroH, 1), 0), 1);
  pbar.style.transform = `scaleX(${heroP.toFixed(3)})`;
  if (!fb.hidden) heroEl.style.setProperty('--p', heroP.toFixed(3));   // only used by the fallback image
  const idx = Math.min(stages.length - 1, Math.floor(heroP * stages.length));
  if (idx === curStage) return;
  curStage = idx;
  stages.forEach((st, i) => {
    st.classList.toggle('on', i === idx);
    st.classList.toggle('past', i < idx);
    st.setAttribute('aria-hidden', i !== idx);
  });
  pnum.textContent = String(idx + 1).padStart(2, '0');
}

const spy = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) links.forEach(l => l.classList.toggle('on', l.getAttribute('href') === '#' + e.target.id));
}), { rootMargin: '-45% 0px -50% 0px' });
$$('main section[id]:not(#hero), #home').forEach(s => spy.observe(s));

/* ---- Photos: lazy-load + parallax (visible only) ---- */
const visImgs = new Set();
const photoIO = new IntersectionObserver(es => es.forEach(e => {
  const img = $('img', e.target);
  if (!e.isIntersecting) { visImgs.delete(img); return; }
  visImgs.add(img);
  if (img.dataset.src) {
    img.onerror = () => img.removeAttribute('src');   // no photo: show placeholder
    img.decoding = 'async';
    img.src = img.dataset.src;
    delete img.dataset.src;
  }
  schedule();
}), { rootMargin: '300px' });
$$('.ph').forEach(p => photoIO.observe(p));

/* ---- Scroll (one rAF per frame) ---- */
let ticking = false;
function schedule() { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }
function onScroll() {
  ticking = false;
  updateHero();
  nav.classList.toggle('solid', scrollY > 40);
  topBtn.classList.toggle('show', scrollY > 700);
  if (reduce || !visImgs.size) return;
  // read all measurements first, then write (avoids layout thrashing)
  const rects = [...visImgs].map(img => [img, img.parentElement.getBoundingClientRect()]);
  for (const [img, r] of rects) {
    const p = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
    img.style.transform = `translateY(${(p * -28).toFixed(1)}px)`;
  }
}
function onResize() {
  if (innerWidth > 820) setMenu(false);
  heroH = heroEl.offsetHeight;
  schedule();
}
addEventListener('scroll', schedule, { passive: true });
addEventListener('resize', onResize, { passive: true });
heroH = heroEl.offsetHeight;
onScroll();

/* ---- Reveal ---- */
const io = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  e.target.classList.add('in');
  io.unobserve(e.target);
}), { threshold: .12 });
$$('.reveal').forEach(el => io.observe(el));

/* ---- Gauge ---- */
const hp = $('#hp'), arc = $('#arc');
new IntersectionObserver((es, o) => es.forEach(e => {
  if (!e.isIntersecting) return;
  o.disconnect();
  const to = +hp.dataset.to, t0 = performance.now(), dur = reduce ? 1 : 1800;
  arc.style.strokeDashoffset = 245 - 245 * (to / 300);   // visual scale 0–300 hp
  (function f(t) {
    const k = Math.min(Math.max((t - t0) / dur, 0), 1);
    hp.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(f);
  })(t0);
}), { threshold: .4 }).observe($('.gauge'));

/* ---- Color explorer ---- */
const dotsEl = $('#dots'), cname = $('#cname'), cdot = $('#cdot'), cimg = $('#cimg'), cnote = $('#cnote');
const dotBtns = COLORS.map((c, i) => {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'dot'; b.style.background = c.hex;
  b.setAttribute('role', 'radio'); b.setAttribute('aria-label', c.name);
  b.addEventListener('click', () => pick(i));
  dotsEl.appendChild(b);
  return b;
});
function pick(i) {
  const c = COLORS[i];
  dotBtns.forEach((d, j) => d.setAttribute('aria-checked', j === i));
  cname.textContent = c.name;
  cdot.style.background = c.hex;
  cdot.style.setProperty('--glow', c.hex + '55');
  cimg.onload = () => { cimg.hidden = false; cdot.style.display = 'none'; cnote.textContent = ''; };
  cimg.onerror = () => { cimg.hidden = true; cdot.style.display = ''; cnote.textContent = 'No photo for this color yet — showing a paint swatch only.'; };
  cimg.alt = 'Toyota GR86 ' + c.name;
  cimg.src = encodeURI(c.img);
}
pick(0);

$('#yr').textContent = new Date().getFullYear();

/* ================= THREE.JS ================= */
const T = window.THREE;
let renderer = null;
if (T) {
  try { renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); }
  catch (e) { renderer = null; }
}
if (!renderer) {
  canvas.style.display = 'none';
  fb.hidden = false;
  coinFlat();
  return;
}

/* ---- Studio environment (shared by the intro logo and the car) ---- */
function studioEnv(rend) {
  const pm = new T.PMREMGenerator(rend), es = new T.Scene();
  es.background = new T.Color(0x000000);
  const softbox = (w, h, x, y, z, power, col) => {
    const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(col).multiplyScalar(power), side: T.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m);
  };
  softbox(14, 7, 0, 9, 0, .5, 0xffffff);        // top: roof & hood highlight
  softbox(.7, 9, -9, 3, 1, 10, 0xdfe8ff);       // cool left strip
  softbox(.7, 9, 9, 3, -1, 8, 0xff2a2a);        // red GR right strip
  softbox(12, .8, 0, 3.5, -10, 6.5, 0xffffff);  // rear strip: rim light
  softbox(8, 2, 0, 1.2, 10, .25, 0xaab4ff);     // soft front fill
  const tex = pm.fromScene(es, .035).texture;
  es.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  pm.dispose();
  return tex;
}

/* ---- Intro logo: 3D emblem that spins like a coin, then stops above the red line ---- */
function eigen3(m) {   // Jacobi eigen-decomposition of a symmetric 3x3 matrix
  const a = m.map(r => r.slice()), V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 24; sweep++) {
    if (a[0][1] ** 2 + a[0][2] ** 2 + a[1][2] ** 2 < 1e-18) break;
    for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
      if (Math.abs(a[p][q]) < 1e-30) continue;
      const th = (a[q][q] - a[p][p]) / (2 * a[p][q]);
      const t = (th < 0 ? -1 : 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < 3; k++) { const x = a[k][p], y = a[k][q]; a[k][p] = c * x - s * y; a[k][q] = s * x + c * y; }
      for (let k = 0; k < 3; k++) { const x = a[p][k], y = a[q][k]; a[p][k] = c * x - s * y; a[q][k] = s * x + c * y; }
      for (let k = 0; k < 3; k++) { const x = V[k][p], y = V[k][q]; V[k][p] = c * x - s * y; V[k][q] = s * x + c * y; }
    }
  }
  return { vals: [a[0][0], a[1][1], a[2][2]], vecs: [0, 1, 2].map(i => new T.Vector3(V[0][i], V[1][i], V[2][i])) };
}
// Orientation of a flat emblem: ex = width, ey = height (top kept upward), ez = face normal (works for tilted or sideways models)
function emblemFrame(root) {
  root.updateMatrixWorld(true);
  const pts = [], v = new T.Vector3();
  root.traverse(o => {
    const a = o.isMesh && o.geometry.attributes.position;
    if (!a) return;
    const step = Math.max(1, Math.floor(a.count / 3000));
    for (let i = 0; i < a.count; i += step) { v.fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld); pts.push(v.x, v.y, v.z); }
  });
  const n = pts.length / 3;
  if (n < 4) return null;
  const mean = [0, 0, 0], cov = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < pts.length; i++) mean[i % 3] += pts[i] / n;
  for (let i = 0; i < pts.length; i += 3) {
    const d = [pts[i] - mean[0], pts[i + 1] - mean[1], pts[i + 2] - mean[2]];
    for (let r = 0; r < 3; r++) for (let c = r; c < 3; c++) cov[r][c] += d[r] * d[c] / n;
  }
  cov[1][0] = cov[0][1]; cov[2][0] = cov[0][2]; cov[2][1] = cov[1][2];
  const { vals, vecs } = eigen3(cov);
  const o = [0, 1, 2].sort((a, b) => vals[b] - vals[a]);
  const ey = vecs[o[1]].clone().normalize(), ez = vecs[o[2]].clone().normalize();
  if ((Math.abs(ey.y) > .5 ? ey.y : -ey.z) < 0) ey.negate();   // keep the emblem's top pointing up (glTF is Y-up)
  // the side holding more of the mass (raised front) should face the camera
  let zMin = Infinity, zMax = -Infinity, zSum = 0;
  for (let i = 0; i < pts.length; i += 3) { const z = pts[i] * ez.x + pts[i + 1] * ez.y + pts[i + 2] * ez.z; zMin = Math.min(zMin, z); zMax = Math.max(zMax, z); zSum += z; }
  if (zSum / n < (zMin + zMax) / 2) ez.negate();
  return { ex: new T.Vector3().crossVectors(ey, ez), ey, ez };
}

(function initLogo() {
  if (!T.GLTFLoader) return coinFlat();
  const cv = $('#logo-gl');
  let lr;
  try { lr = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); } catch (e) { return coinFlat(); }
  const px = Math.max(Math.round(coin.offsetWidth), 64);   // square buffer → no stretched emblem
  lr.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  lr.setSize(px, px, false);
  lr.outputEncoding = T.sRGBEncoding;
  lr.toneMapping = T.ACESFilmicToneMapping;
  lr.toneMappingExposure = .8;

  const VIEW = 2.2, rad = d => d * Math.PI / 180;       // visible height in scene units
  const ls = new T.Scene();
  const cam = new T.OrthographicCamera(-VIEW / 2, VIEW / 2, VIEW / 2, -VIEW / 2, .1, 50);   // no perspective → no apparent tilt
  cam.position.set(0, 0, 10);
  const dl = new T.DirectionalLight(0xffffff, .8); dl.position.set(-2, 3, 4); ls.add(dl);

  let raf = 0, done = false;
  const stop = () => {
    if (done) return; done = true;
    cancelAnimationFrame(raf);
    if (ls.environment) ls.environment.dispose();
    lr.dispose(); lr.forceContextLoss();
  };
  logoStop = stop;

  logoPending = true;
  new T.GLTFLoader().load(LOGO_URL, g => {
    logoPending = false; loadCar();   // the car model may start downloading now
    if (done || introDone) return;
    const model = g.scene, orient = new T.Group(), holder = new T.Group(), pv = new T.Group();
    orient.add(model); holder.add(orient); pv.add(holder); ls.add(pv);

    if (LOGO.autoOrient) {
      const f = emblemFrame(model);
      if (f) orient.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(f.ex, f.ey, f.ez).transpose());
    }
    orient.rotation.x += rad(LOGO.rot[0]); orient.rotation.y += rad(LOGO.rot[1]); orient.rotation.z += rad(LOGO.rot[2]);

    // fit, center, and rest the bottom edge on the canvas bottom (= just above the red line)
    ls.updateMatrixWorld(true);
    const bb = new T.Box3().setFromObject(orient), sz = bb.getSize(new T.Vector3()), c = bb.getCenter(new T.Vector3());
    const s = 1.8 / Math.max(sz.x, sz.y);
    orient.position.sub(c);
    holder.scale.setScalar(s);
    pv.position.y = -VIEW / 2 + .04 + sz.y * s / 2;

    model.traverse(o => { const m = o.isMesh && o.material; if (m && m.isMeshStandardMaterial) m.envMapIntensity = 1.4; });

    const D = reduce ? 1 : 1300, t0 = performance.now(), front = rad(LOGO.front);
    coin.classList.add('go');
    holdIntro(D + 600);
    (function tick(now) {
      const k = Math.min(Math.max((now - t0) / D, 0), 1), e = 1 - Math.pow(1 - k, 3);
      pv.rotation.y = front + e * LOGO.turns * Math.PI * 2;
      lr.render(ls, cam);
      if (k < 1) raf = requestAnimationFrame(tick);
    })(t0);
  }, undefined, () => { logoPending = false; loadCar(); if (done) return; stop(); coinFlat(); });

  ls.environment = studioEnv(lr);   // built while the model downloads
})();

let pr = Math.min(devicePixelRatio || 1, coarse ? 1.75 : 2), accum = 0, cnt = 0;
const minPr = 1;
renderer.setPixelRatio(pr);
renderer.outputEncoding = T.sRGBEncoding;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = .62;

const scene = new T.Scene();
const camera = new T.PerspectiveCamera(32, 1, .1, 100);
const rig = new T.Group(); scene.add(rig);

scene.environment = studioEnv(renderer);

// Direct lights (no shadow map → much lighter; shadows use a contact shadow)
scene.add(new T.HemisphereLight(0x8a93a8, 0x050506, .04));
const key = new T.SpotLight(0xffffff, .6, 30, .45, .8); key.position.set(-4, 8, 5); scene.add(key);
const rim = new T.PointLight(0xeb0a1e, 1.5, 16); rim.position.set(4.5, 1.6, -4.5); scene.add(rim);
const cool = new T.PointLight(0x6677ff, .3, 14); cool.position.set(-4.5, 1.2, -3.5); scene.add(cool);

function radial(stops, size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(s => g.addColorStop(s[0], s[1]));
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  return new T.CanvasTexture(c);
}

// Dark glossy floor, fading into the background
const floor = new T.Mesh(new T.CircleGeometry(10, 48), new T.MeshStandardMaterial({
  color: 0x060608, roughness: .2, metalness: .85, envMapIntensity: .35,
  transparent: true, alphaMap: radial([[0, '#fff'], [.28, '#666'], [.6, '#000']])
}));
floor.rotation.x = -Math.PI / 2; scene.add(floor);

// Contact shadow — rotates with the car
const contact = new T.Mesh(new T.PlaneGeometry(6.4, 3.2), new T.MeshBasicMaterial({
  map: radial([[0, 'rgba(0,0,0,.9)'], [.55, 'rgba(0,0,0,.45)'], [1, 'rgba(0,0,0,0)']]), transparent: true, depthWrite: false
}));
contact.rotation.x = -Math.PI / 2; contact.position.y = .012; rig.add(contact);

// Red ring + glow
const ring = new T.Mesh(new T.RingGeometry(3.6, 3.64, 96), new T.MeshBasicMaterial({ color: 0xeb0a1e, side: T.DoubleSide, transparent: true, opacity: .8 }));
ring.rotation.x = -Math.PI / 2; ring.position.y = .02; scene.add(ring);
const ringGlow = new T.Mesh(new T.RingGeometry(3.3, 4.4, 96), new T.MeshBasicMaterial({
  map: radial([[0, 'rgba(235,10,30,0)'], [.6, 'rgba(235,10,30,.07)'], [.75, 'rgba(235,10,30,0)'], [1, 'rgba(0,0,0,0)']]),
  transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
}));
ringGlow.rotation.x = -Math.PI / 2; ringGlow.position.y = .015; scene.add(ringGlow);

// Background glow
const back = new T.Mesh(new T.PlaneGeometry(26, 13), new T.MeshBasicMaterial({
  map: radial([[0, 'rgba(235,10,30,.15)'], [.4, 'rgba(120,10,25,.05)'], [1, 'rgba(0,0,0,0)']]),
  transparent: true, blending: T.AdditiveBlending, depthWrite: false
}));
back.position.set(0, 2.6, -9); scene.add(back);

// Fine dust
const N = coarse ? 60 : 140, pp = new Float32Array(N * 3);
for (let i = 0; i < N; i++) { pp[i * 3] = (Math.random() - .5) * 14; pp[i * 3 + 1] = Math.random() * 5; pp[i * 3 + 2] = (Math.random() - .5) * 12; }
const dustGeo = new T.BufferGeometry(); dustGeo.setAttribute('position', new T.BufferAttribute(pp, 3));
const dust = new T.Points(dustGeo, new T.PointsMaterial({ color: 0xffb0b0, size: .035, transparent: true, opacity: .45, depthWrite: false, blending: T.AdditiveBlending }));
scene.add(dust);

let running = true, visible = true, looping = false;
let scrollRot = 0, yaw = -.6, targetYaw = -.6, dragging = false, lastX = 0, idleAt = 0;
let mx = 0, my = 0, cmx = 0, cmy = 0;

function resize() {
  const r = canvas.getBoundingClientRect();
  const w = Math.max(r.width, 1), h = Math.max(r.height, 1);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w / h < 1 ? 46 : 32;
  if (w / h > 1.2) camera.setViewOffset(w, h, -w * .16, 0, w, h); else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}
if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas); else addEventListener('resize', resize);
resize();

// Load car model (deferred until the logo model has arrived, so the logo gets the bandwidth first)
let carLoading = false;
function loadCar() {
  if (carLoading) return;
  carLoading = true;
  if (!T.GLTFLoader) { fb.hidden = false; return; }
  new T.GLTFLoader().load(MODEL_URL, g => {
    const model = g.scene;
    const box = new T.Box3().setFromObject(model), size = box.getSize(new T.Vector3()), c = box.getCenter(new T.Vector3());
    const s = 5.2 / Math.max(size.x, size.z);
    model.scale.setScalar(s);
    model.position.set(-c.x * s, -box.min.y * s, -c.z * s);
    const an = renderer.capabilities.getMaxAnisotropy();
    model.traverse(o => {
      const m = o.isMesh && o.material;
      if (!m || !m.isMeshStandardMaterial) return;
      ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap'].forEach(k => { if (m[k]) m[k].anisotropy = an; });
      m.envMapIntensity = 1.6;
      if (!m.transparent && m.metalness >= .4) m.roughness = Math.max(.06, m.roughness * .55);
    });
    rig.add(model);
    fb.hidden = true;
  }, undefined, () => { fb.hidden = false; });
}

// Drag interaction (mouse + touch)
canvas.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; });
canvas.addEventListener('pointermove', e => { if (!dragging) return; targetYaw += (e.clientX - lastX) * .01; lastX = e.clientX; idleAt = performance.now(); });
const up = () => { dragging = false; canvas.style.cursor = ''; idleAt = performance.now(); };
canvas.addEventListener('pointerup', up);
canvas.addEventListener('pointercancel', up);
if (!coarse) addEventListener('pointermove', e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; }, { passive: true });

// Render loop (single loop; pauses when the tab/hero is not visible)
let last = 0;
function frame(t) {
  if (!running || !visible || document.hidden) { looping = false; return; }
  requestAnimationFrame(frame);
  const dt = Math.min(Math.max((t - last) / 1000, 0), .05); last = t;
  if (!dragging && t - idleAt > 2500 && !reduce) targetYaw += dt * .35;
  yaw += (targetYaw - yaw) * Math.min(dt * 6, 1);
  scrollRot += (heroP * Math.PI * 1.4 - scrollRot) * Math.min(dt * 5, 1);
  rig.rotation.y = yaw + scrollRot;
  dust.rotation.y += dt * .03; dust.position.y = Math.sin(t / 2500) * .08;
  rim.intensity = 1.5 + Math.sin(t / 900) * .2;

  // Cinematic camera after the intro + smoothed mouse parallax
  const k = reduce ? 1 : startCam ? Math.min(Math.max((t - startCam) / 2200, 0), 1) : 0;
  const e = 1 - Math.pow(1 - k, 3);
  const sm = Math.min(dt * 4, 1);
  cmx += (mx - cmx) * sm; cmy += (my - cmy) * sm;
  const dist = T.MathUtils.clamp(8.6 + (1.5 - camera.aspect) * 5, 8.6, 13.5) * (1 - .14 * Math.sin(heroP * Math.PI)) + (1 - e) * 5;
  camera.position.set(cmx * .8 + (1 - e) * -2, 2.4 - cmy * .4 + (1 - e) * -.8, dist);
  camera.lookAt(0, .7, 0);
  renderer.render(scene, camera);

  // Adaptive quality: lower the resolution only if the device stutters
  accum += dt;
  if (++cnt >= 90) {
    if (accum / cnt > .034 && pr > minPr) { pr = Math.max(minPr, pr - .25); renderer.setPixelRatio(pr); resize(); }
    accum = 0; cnt = 0;
  }
}
function kick() {
  if (looping || !running || !visible || document.hidden) return;
  looping = true; last = performance.now();
  requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', kick);
new IntersectionObserver(es => { visible = es[0].isIntersecting; kick(); }).observe(track);
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); running = false; });
canvas.addEventListener('webglcontextrestored', () => { running = true; resize(); kick(); });
kick();
if (logoPending) setTimeout(loadCar, 2000); else loadCar();   // safety net if the logo model is slow
})();
