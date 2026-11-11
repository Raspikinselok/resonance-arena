// Die Bühne: Station Kepler-9 als prozedurale three.js-Szene.
// Sie zeigt nur an, was der Server meldet (Zuschauer-Sicht) und entscheidet nichts selbst.
// Grafik und Sprachmodell teilen sich die GPU: Bildrate ist gedeckelt, Qualität passt sich an.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const C = { cyan: 0x35e0ff, red: 0xff3b5c, amber: 0xffb347, green: 0x3dffa2, violet: 0x9b7bff, hull: 0x121a2a, dark: 0x05070d };
const ROOMS = {
  atrium: { pos: [0, 0], color: C.cyan, label: 'ATRIUM' },
  reactor: { pos: [0, -15], color: C.red, label: 'REAKTORHALLE' },
  control: { pos: [15, 0], color: C.violet, label: 'KONTROLLRAUM' },
  storage: { pos: [-15, 0], color: C.amber, label: 'LAGER' },
  lab: { pos: [0, 15], color: C.green, label: 'LABOR' },
};
const QUALITY = [
  { name: 'Niedrig', ratio: 0.75, bloom: false, dust: 300 },
  { name: 'Mittel', ratio: 1, bloom: true, dust: 900 },
  { name: 'Hoch', ratio: 1.5, bloom: true, dust: 1800 },
];

const glow = (color, intensity = 2) => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: intensity });
const metal = (color = C.hull) => new THREE.MeshStandardMaterial({ color, metalness: 0.75, roughness: 0.38 });
const v3 = (room, y = 0, dx = 0, dz = 0) => new THREE.Vector3(ROOMS[room].pos[0] + dx, y, ROOMS[room].pos[1] + dz);

export function createScene(canvas, labelLayer) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C.dark);
  scene.fog = new THREE.FogExp2(C.dark, 0.011);
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 400);
  camera.position.set(24, 21, 30);
  const controls = new OrbitControls(camera, labelLayer);
  Object.assign(controls, { enableDamping: true, dampingFactor: 0.06, maxPolarAngle: 1.45, minDistance: 12, maxDistance: 75, autoRotate: true, autoRotateSpeed: 0.35 });
  const labels = new CSS2DRenderer({ element: labelLayer });
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.6, 0.3);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  scene.add(new THREE.HemisphereLight(0x5f86ff, 0x080a12, 0.55));
  const key = new THREE.DirectionalLight(0x9fc4ff, 0.9);
  key.position.set(-20, 30, 10);
  scene.add(key);

  // ---------- Boden, Sterne, Staub
  const ground = new THREE.Mesh(new THREE.CircleGeometry(70, 64), new THREE.MeshStandardMaterial({ color: 0x070b14, metalness: 0.6, roughness: 0.7 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.5;
  scene.add(ground);
  const grid = new THREE.GridHelper(140, 70, 0x1b3350, 0x0d1a2c);
  grid.position.y = -0.48; grid.material.transparent = true; grid.material.opacity = 0.55;
  scene.add(grid);
  const cloud = (count, spread, height, size, color, opacity) => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, r = spread[0] + Math.random() * (spread[1] - spread[0]);
      pos.set([Math.cos(a) * r, height[0] + Math.random() * (height[1] - height[0]), Math.sin(a) * r], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ color, size, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  };
  scene.add(cloud(1400, [120, 180], [5, 140], 0.7, 0xbfd6ff, 0.8));
  const dust = cloud(1800, [0, 30], [0.3, 9], 0.07, 0x7fd4ff, 0.55);
  scene.add(dust);

  // ---------- Räume und Gänge
  const roomFx = {};
  for (const [id, r] of Object.entries(ROOMS)) {
    const g = new THREE.Group();
    g.position.copy(v3(id));
    const radius = id === 'atrium' ? 5.5 : 4.6;
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius + 0.5, 0.5, 6), metal());
    deck.position.y = -0.25;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.06, 6, 6), glow(r.color, 2.2));
    rim.rotation.x = Math.PI / 2; rim.rotation.z = Math.PI / 6; rim.position.y = 0.03;
    const inner = new THREE.Mesh(new THREE.RingGeometry(radius * 0.55, radius * 0.58, 48), new THREE.MeshBasicMaterial({ color: r.color, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
    inner.rotation.x = -Math.PI / 2; inner.position.y = 0.02;
    g.add(deck, rim, inner);
    for (let i = 0; i < 6; i++) {
      if (id !== 'atrium' && i % 2) continue;
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.4, 0.35), metal(0x18233a));
      pillar.position.set(Math.cos(a) * radius * 0.96, 1.7, Math.sin(a) * radius * 0.96);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.6, 0.08), glow(r.color, 1.6));
      strip.position.copy(pillar.position).multiplyScalar(0.985); strip.position.y = 1.7;
      g.add(pillar, strip);
    }
    const light = new THREE.PointLight(r.color, 10, 16, 1.8);
    light.position.y = 3.2;
    g.add(light);
    const el = document.createElement('div');
    el.className = 'room-label';
    const tag = new CSS2DObject(el);
    tag.position.set(0, 4.6, 0);
    g.add(tag);
    scene.add(g);
    roomFx[id] = { group: g, light, rim, el, base: r.color };
    if (id !== 'atrium') {
      const dir = v3(id).normalize();
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.3, 5.6), metal(0x0f1727));
      bridge.position.copy(dir.clone().multiplyScalar(7.6)); bridge.position.y = -0.2;
      bridge.lookAt(v3(id, -0.2));
      scene.add(bridge);
      for (const side of [-0.95, 0.95]) {
        const line = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 5.4), glow(r.color, 1.4));
        line.position.set(side, 0.18, 0);
        bridge.add(line);
      }
    }
  }

  // ---------- Reaktor
  const reactor = roomFx.reactor.group;
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, 1), glow(C.red, 1.2));
  core.position.y = 2.2;
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 3.6, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x8fd8ff, transparent: true, opacity: 0.08, side: THREE.DoubleSide, metalness: 0.9, roughness: 0.1 }));
  shell.position.y = 2.2;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.3, 0.5, 24), metal(0x1a2740));
  base.position.y = 0.25;
  const rings = [0, 1, 2].map((i) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.75 + i * 0.22, 0.035, 8, 64), glow(C.red, 1.5));
    ring.position.y = 2.2;
    reactor.add(ring);
    return ring;
  });
  reactor.add(core, shell, base);
  const sparks = cloud(260, [0.2, 1.5], [0.6, 5.5], 0.09, C.cyan, 0.9);
  sparks.visible = false;
  reactor.add(sparks);

  // ---------- Geräte: kleine Körper mit Statuslicht. Position je Objekt-ID für Aktionsstrahlen.
  const anchors = {};
  const device = (id, room, dx, dz, w = 0.7, h = 1.3) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.5), metal(0x1b2a45));
    body.position.y = h / 2;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 12), glow(C.cyan, 3));
    lamp.position.set(0, h + 0.18, 0);
    g.add(body, lamp);
    g.position.copy(v3(room, 0, dx, dz));
    scene.add(g);
    anchors[id] = { group: g, lamp };
    return g;
  };
  device('reactor_panel', 'reactor', 0, 3.1, 1.3, 1.1);
  device('fuse_box', 'reactor', -3, 1.2, 0.6, 1.4);
  device('pressure_vent', 'reactor', 3, -1.4, 0.5, 2.2);
  device('coolant_valve', 'reactor', 3, 1.4, 0.5, 1);
  device('aux_pump', 'reactor', -3, -1.4, 0.9, 0.9);
  device('calibration_console', 'control', 2.6, 1.2, 1.1, 1);
  device('locker', 'storage', -2.4, -1.6, 1.6, 2.2);
  device('supply_cabinet', 'lab', 0, 3, 1.6, 1.9);
  device('lab_door', 'atrium', 0, 4.9, 0.4, 1.6);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.07, 8, 20), glow(C.red, 2));
  wheel.position.set(0, 1.25, 0.3);
  anchors.coolant_valve.group.add(wheel);

  // Holo-Terminal im Kontrollraum: Leinwand-Textur mit Laufzeilen
  const holoCanvas = Object.assign(document.createElement('canvas'), { width: 256, height: 160 });
  const holoCtx = holoCanvas.getContext('2d');
  const holoTex = new THREE.CanvasTexture(holoCanvas);
  const terminal = new THREE.Group();
  for (const [x, rot] of [[-1.7, 0.5], [0, 0], [1.7, -0.5]]) {
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1), new THREE.MeshBasicMaterial({ map: holoTex, transparent: true, opacity: 0.85, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    pane.position.set(x, 2, Math.abs(x) * 0.28); pane.rotation.y = rot;
    terminal.add(pane);
  }
  terminal.position.copy(v3('control', 0, 0, -2.4));
  scene.add(terminal);
  anchors.terminal = { group: terminal };
  let holoState = { online: false, alarm: true };
  function drawHolo(t) {
    holoCtx.clearRect(0, 0, 256, 160);
    holoCtx.font = '11px monospace';
    const col = holoState.online ? '#3dffa2' : holoState.alarm ? '#ff6a84' : '#35e0ff';
    for (let i = 0; i < 11; i++) {
      holoCtx.fillStyle = col;
      holoCtx.globalAlpha = 0.35 + 0.5 * Math.abs(Math.sin(t * 0.8 + i * 1.7));
      const w = 60 + ((i * 53 + Math.floor(t * 2)) % 150);
      holoCtx.fillRect(10, 12 + i * 13, w, 5);
    }
    holoCtx.globalAlpha = 1; holoCtx.fillStyle = col;
    holoCtx.fillText(holoState.online ? 'REACTOR ONLINE' : 'REACTOR OFFLINE', 12, 156);
    holoTex.needsUpdate = true;
  }

  // Labor: Probentanks und Sperrfeld vor der Tür
  for (const dx of [-2.4, 2.4]) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 2.4, 18), new THREE.MeshStandardMaterial({ color: 0x0b2a22, emissive: C.green, emissiveIntensity: 0.5, transparent: true, opacity: 0.55 }));
    tank.position.copy(v3('lab', 1.3, dx, -1));
    scene.add(tank);
  }
  const barrier = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.6), new THREE.MeshBasicMaterial({ color: C.red, transparent: true, opacity: 0.32, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  barrier.position.set(0, 1.3, 5.6);
  scene.add(barrier);
  for (const [dx, dz, s] of [[1.8, 1.8, 1], [2.6, 0.2, 0.7], [-0.4, 2.6, 0.8]]) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), metal(0x2a2414));
    crate.position.copy(v3('storage', s / 2, dx, dz)); crate.rotation.y = dx;
    scene.add(crate);
  }

  // ---------- Roboter
  const robot = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 28, 20), new THREE.MeshStandardMaterial({ color: 0xdfe8f5, metalness: 0.55, roughness: 0.25 }));
  body.scale.y = 0.86;
  const visor = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.075, 10, 40, Math.PI * 0.9), glow(C.cyan, 3));
  visor.rotation.set(Math.PI / 2, 0, Math.PI * 0.05); visor.position.y = 0.12;
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.025, 8, 48), glow(C.cyan, 2.5));
  halo.rotation.x = Math.PI / 2; halo.position.y = -0.55;
  const thruster = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.9, 16, 1, true), new THREE.MeshBasicMaterial({ color: C.cyan, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  thruster.position.y = -0.95; thruster.rotation.x = Math.PI;
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.55), metal(0x9fb3cc));
  antenna.position.set(0.2, 0.75, -0.1);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), glow(C.amber, 3));
  tip.position.set(0.2, 1.05, -0.1);
  const mind = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 8, 40, Math.PI * 1.4), glow(C.amber, 3));
  mind.rotation.x = Math.PI / 2; mind.position.y = 1.5; mind.visible = false;
  const robotLight = new THREE.PointLight(C.cyan, 6, 9, 2);
  robot.add(body, visor, halo, thruster, antenna, tip, mind, robotLight);
  robot.position.set(0, 1.5, 0);
  scene.add(robot);
  const bubbleEl = document.createElement('div');
  bubbleEl.className = 'robot-bubble';
  const bubble = new CSS2DObject(bubbleEl);
  bubble.position.set(0, 2.2, 0);
  robot.add(bubble);

  // ---------- Effekte: Impulsring und Strahl zum Ziel
  const pulses = [];
  function pulse(position, color) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.58, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.copy(position); ring.position.y = 0.12;
    scene.add(ring);
    pulses.push({ mesh: ring, age: 0 });
  }
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 8, 1, true), new THREE.MeshBasicMaterial({ color: C.cyan, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(beam);
  let beamAge = 9;
  function shoot(target, color) {
    const from = robot.position.clone(), to = target.clone(); to.y = Math.max(to.y, 1.1);
    beam.position.copy(from).lerp(to, 0.5);
    beam.scale.set(1, from.distanceTo(to), 1);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.sub(from).normalize());
    beam.material.color.setHex(color);
    beamAge = 0;
  }

  // ---------- Zustand und öffentliche Schnittstelle
  let path = [], room = 'atrium', thinking = false, view = {};
  let quality = 1, autoQuality = true, fpsCap = 30, last = 0, slow = 0, shown = 0, shownAt = 0;
  const hooks = { onStats: () => {} };

  function applyQuality(q) {
    quality = Math.max(0, Math.min(2, q));
    const cfg = QUALITY[quality];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, cfg.ratio));
    bloom.enabled = cfg.bloom;
    dust.geometry.setDrawRange(0, cfg.dust);
    resize();
  }
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    labels.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  const status = (ok) => (ok ? C.green : C.red);
  function setView(v) {
    view = v;
    const tint = (id, color) => anchors[id]?.lamp?.material.emissive.setHex(color);
    tint('reactor_panel', v.online ? C.green : v.trips ? C.amber : C.red);
    tint('fuse_box', status(v.fuseOk));
    tint('calibration_console', status(v.sensorOk));
    tint('coolant_valve', status(v.valveOpen));
    wheel.material.emissive.setHex(status(v.valveOpen));
    tint('aux_pump', status(v.pumpPrimed));
    tint('lab_door', status(!v.labLocked));
    anchors.aux_pump.group.visible = v.variant === 'altered';
    anchors.lab_door.group.visible = barrier.visible = v.variant === 'relocated';
    barrier.material.color.setHex(v.labLocked ? C.red : C.green);
    barrier.material.opacity = v.labLocked ? 0.32 : 0.06;
    anchors.coolant_valve.group.position.copy(v.variant === 'relocated' ? v3('storage', 0, -1, 2.6) : v3('reactor', 0, 3, 1.4));
    const hot = v.online ? C.cyan : C.red;
    core.material.emissive.setHex(hot);
    rings.forEach((r) => r.material.emissive.setHex(hot));
    roomFx.reactor.light.color.setHex(hot);
    roomFx.reactor.rim.material.emissive.setHex(hot);
    sparks.visible = Boolean(v.online);
    holoState = { online: v.online, alarm: !(v.fuseOk && v.valveOpen && v.sensorOk) };
    const text = { reactor: v.online ? 'ONLINE' : `OFFLINE${v.trips ? ` · ${v.trips}/3 Fehlstarts` : ''}`, lab: v.labLocked ? 'VERRIEGELT' : '' };
    for (const [id, fx] of Object.entries(roomFx)) fx.el.innerHTML = `<b>${ROOMS[id].label}</b>${text[id] ? `<span>${text[id]}</span>` : ''}`;
    for (const fx of Object.values(roomFx)) fx.light.intensity = v.online ? 16 : 10;
  }
  function moveTo(target) {
    if (!ROOMS[target] || target === room) return;
    path = [];
    if (room !== 'atrium' && target !== 'atrium') path.push(v3('atrium', 1.5));
    path.push(v3(target, 1.5, target === 'atrium' ? 0 : 0.01, target === 'reactor' ? 3.4 : 0));
    room = target;
  }
  function act(step) {
    const color = step.result.ok ? C.cyan : step.result.error === 'mistake' ? C.amber : C.red;
    const targetId = step.action.args.target ?? step.action.args.device ?? step.action.args.item;
    const anchor = anchors[targetId]?.group;
    if (anchor?.visible) shoot(anchor.getWorldPosition(new THREE.Vector3()), color);
    pulse(path.at(-1) ?? robot.position, color);
    visor.material.emissive.setHex(color);
    setTimeout(() => visor.material.emissive.setHex(C.cyan), 900);
  }
  function reset(v) {
    path = []; room = v.room ?? 'atrium';
    robot.position.copy(v3(room, 1.5));
    setView(v);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const cap = thinking ? Math.min(fpsCap, 20) : fpsCap; // während der Inferenz der GPU Luft lassen
    if (now - last < 1000 / cap - 1) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const t = now / 1000;

    if (path.length) {
      const to = path[0], step = 9 * dt, dist = robot.position.distanceTo(to);
      if (dist <= step) { robot.position.copy(to); path.shift(); }
      else {
        const dir = to.clone().sub(robot.position).normalize();
        robot.position.addScaledVector(dir, step);
        robot.rotation.y = Math.atan2(dir.x, dir.z);
      }
    }
    robot.position.y = 1.5 + Math.sin(t * 2.2) * 0.12;
    robot.rotation.z = path.length ? 0.12 : Math.sin(t * 1.3) * 0.03;
    halo.rotation.z = t * 2;
    thruster.scale.y = 1 + Math.sin(t * 18) * 0.12;
    mind.visible = thinking; mind.rotation.z = -t * 5;
    tip.material.emissiveIntensity = thinking ? 2 + Math.sin(t * 12) * 2 : 1.5;

    const speed = view.online ? 2.4 : 0.25;
    rings.forEach((r, i) => { r.rotation.x = t * speed * (0.6 + i * 0.3); r.rotation.y = t * speed * (0.9 - i * 0.2); });
    core.rotation.y = t * speed * 0.5;
    core.material.emissiveIntensity = view.online ? 3.2 + Math.sin(t * 6) * 0.6 : 0.9 + Math.sin(t * 1.4) * 0.5;
    core.scale.setScalar(view.online ? 1.1 + Math.sin(t * 6) * 0.04 : 0.92);
    sparks.rotation.y = t * 1.6;
    dust.rotation.y = t * 0.012;
    wheel.rotation.z = view.valveOpen ? t * 1.5 : 0;
    barrier.material.opacity *= 0.9 + 0.1 * (0.85 + Math.sin(t * 9) * 0.15);
    if (quality > 0 || Math.floor(t * 4) !== Math.floor((t - dt) * 4)) drawHolo(t);

    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      p.age += dt;
      p.mesh.scale.setScalar(1 + p.age * 7);
      p.mesh.material.opacity = Math.max(0, 0.9 - p.age * 1.1);
      if (p.age > 0.85) { scene.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); pulses.splice(i, 1); }
    }
    beamAge += dt;
    beam.material.opacity = Math.max(0, 0.9 - beamAge * 1.6);

    controls.target.lerp(new THREE.Vector3(robot.position.x * 0.55, 1, robot.position.z * 0.55), 0.03);
    controls.update();
    composer.render();
    labels.render(scene, camera);

    // Gemessene Bildrate; bei anhaltend zu wenig Bildern eine Qualitätsstufe runter
    shown += 1;
    if (now - shownAt >= 1000) {
      const fps = Math.round((shown * 1000) / (now - shownAt));
      shown = 0; shownAt = now;
      slow = fps < cap * 0.7 ? slow + 1 : 0;
      if (autoQuality && slow >= 4 && quality > 0) { applyQuality(quality - 1); slow = 0; }
      hooks.onStats({ fps, quality: QUALITY[quality].name, auto: autoQuality });
    }
  }

  controls.addEventListener('start', () => { controls.autoRotate = false; });
  applyQuality(1);
  setView({ variant: 'standard', fuseOk: true, valveOpen: true, sensorOk: true, pumpPrimed: true });
  requestAnimationFrame(frame);

  return {
    setView, moveTo, act, reset, hooks,
    setThinking: (on) => { thinking = on; },
    say: (text) => { bubbleEl.textContent = text ?? ''; bubble.visible = Boolean(text); },
    cycleQuality() {
      // Auto -> Niedrig -> Mittel -> Hoch -> Auto
      if (autoQuality) { autoQuality = false; applyQuality(0); }
      else if (quality < 2) applyQuality(quality + 1);
      else { autoQuality = true; applyQuality(1); }
      hooks.onStats({ fps: '–', quality: QUALITY[quality].name, auto: autoQuality });
    },
  };
}
