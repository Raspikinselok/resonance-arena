// Mission "Kaltstart": Der Reaktor der Station Kepler-9 ist ausgefallen.
// Die Ursache ist verborgen. Der Agent sieht nur, was observe() liefert.
// Alle Texte, die der Agent liest, sind Englisch (kleine Modelle arbeiten damit zuverlässiger).

import { rng, pick, shuffle } from '../rng.mjs';

export const id = 'coldstart';
export const title = 'Kaltstart';
export const objective = 'Bring the station reactor back online.';
export const variants = {
  standard: 'Standard (Training)',
  relocated: 'Umgeräumt (Transfer: gleiche Mechanik, andere Orte, verschlossenes Labor)',
  altered: 'Verändert (unbekannt: Doppelfehler und neue Startprozedur)',
};

const ROOMS = {
  atrium: { name: 'Atrium', desc: 'Central hub. Dust drifts through emergency lighting.', exits: ['reactor', 'control', 'storage', 'lab'] },
  reactor: { name: 'Reactor Hall', desc: 'A dark fusion core sits silent behind scratched glass.', exits: ['atrium'] },
  control: { name: 'Control Room', desc: 'Consoles flicker on backup power.', exits: ['atrium'] },
  storage: { name: 'Storage Bay', desc: 'Shelves of spare parts, most of them looted.', exits: ['atrium'] },
  lab: { name: 'Laboratory', desc: 'An abandoned lab with sealed sample containers.', exits: ['atrium'] },
};
const FAULTS = ['coolant', 'fuse', 'sensor'];
const NOISE = [
  'W-08 Hydroponics bay offline (non-critical).',
  'W-11 Comms array: no carrier signal.',
  'I-03 Dust storm warning expired 412 days ago.',
  'W-21 Crew quarters life support in standby.',
  'I-09 Last crew login: 1,204 days ago.',
];

export function create({ variant = 'standard', seed = 1, fault } = {}) {
  if (!variants[variant]) throw new Error(`Unbekannte Variante: ${variant}`);
  const r = rng(seed);
  const order = shuffle(r, FAULTS);
  const faults = [fault ?? order[0]];
  if (variant === 'altered') faults.push(order.find((f) => f !== faults[0]));
  const rating = pick(r, [10, 25, 40]);
  const relocated = variant === 'relocated';

  // Objekte: wo steht was, was lässt sich damit tun
  const objects = {
    directory: { room: 'atrium', kind: 'device', commands: [] },
    terminal: { room: 'control', kind: 'device', commands: [] },
    calibration_console: { room: 'control', kind: 'device', commands: ['recalibrate'] },
    reactor_panel: { room: 'reactor', kind: 'device', commands: ['start'] },
    fuse_box: { room: 'reactor', kind: 'device', commands: [] },
    pressure_vent: { room: 'reactor', kind: 'device', commands: ['open'] },
    coolant_valve: { room: relocated ? 'storage' : 'reactor', kind: 'device', commands: ['open', 'close'] },
    locker: { room: 'storage', kind: 'container' },
    supply_cabinet: { room: 'lab', kind: 'container' },
    cable: { in: 'locker', kind: 'item' },
    multimeter: { in: 'supply_cabinet', kind: 'item' },
  };
  const fuseHome = relocated ? 'supply_cabinet' : 'locker';
  for (const a of [10, 25, 40]) objects[`fuse_${a}a`] = { in: fuseHome, kind: 'item' };
  if (relocated) {
    objects.lab_door = { room: 'atrium', kind: 'device', commands: [] };
    objects.keycard = { room: 'control', kind: 'item' };
  }
  if (variant === 'altered') objects.aux_pump = { room: 'reactor', kind: 'device', commands: ['prime'] };

  return {
    variant, seed, room: 'atrium', inventory: [], opened: [], objects,
    faults, rating,
    valveOpen: !faults.includes('coolant'),
    fuseOk: !faults.includes('fuse'),
    sensorOk: !faults.includes('sensor'),
    pumpPrimed: variant !== 'altered',
    labLocked: relocated,
    online: false, trips: 0, done: false, success: false, reason: null,
    noise: shuffle(r, NOISE).slice(0, 2),
    sensorA: (8.5 + r() * 1.4).toFixed(1),
    maxSteps: variant === 'altered' ? 36 : 30,
  };
}

// Was im aktuellen Raum sichtbar ist (Inhalt eines Behälters erst nach dem Öffnen)
function visible(s) {
  return Object.entries(s.objects)
    .filter(([, o]) => o.room === s.room || (o.in && s.opened.includes(o.in) && s.objects[o.in].room === s.room))
    .map(([oid, o]) => ({ id: oid, kind: o.kind, commands: o.commands ?? [] }));
}

export function observe(s) {
  const room = ROOMS[s.room];
  return {
    objective,
    room: s.room,
    roomName: room.name,
    description: room.desc,
    exits: room.exits,
    visible: visible(s),
    inventory: [...s.inventory],
  };
}

// Zuschauer-Sicht für die 3D-Szene. Geht NIE an den Agenten.
export function spectate(s) {
  return {
    room: s.room, online: s.online, valveOpen: s.valveOpen, fuseOk: s.fuseOk, sensorOk: s.sensorOk,
    pumpPrimed: s.pumpPrimed, labLocked: s.labLocked, trips: s.trips, inventory: [...s.inventory],
    variant: s.variant, done: s.done, success: s.success,
  };
}

export function reveal(s) {
  return { faults: s.faults, fuseRating: s.rating, variant: s.variant, seed: s.seed };
}

const ok = (text) => ({ ok: true, text });
const bad = (text, kind = 'invalid') => ({ ok: false, text, error: kind });

function panelText(s) {
  const lines = [
    s.online ? 'REACTOR ONLINE.' : 'REACTOR OFFLINE.',
    `Coolant flow: ${s.valveOpen ? '48.0' : '0.0'} l/min.`,
    `Ignition circuit: ${s.fuseOk ? 'closed' : 'OPEN'}.`,
    `Pressure sensor A: ${s.sensorOk ? '0.4' : s.sensorA} MPa, sensor B: 0.4 MPa${s.sensorOk ? '' : ' (MISMATCH)'}.`,
  ];
  if (s.variant === 'altered') lines.push(`Auxiliary pump: ${s.pumpPrimed ? 'primed' : 'idle'}.`);
  lines.push(`Safety trips: ${s.trips}/3. Command: start.`);
  return lines.join(' ');
}

function terminalText(s) {
  const lines = ['KEPLER-9 // REACTOR DIAGNOSTICS', s.noise[0]];
  if (!s.valveOpen) lines.push('E-17 COOLANT FLOW 0.0 l/min. Primary coolant valve reports CLOSED. Start interlock active.');
  if (!s.fuseOk) lines.push('E-42 IGNITION CIRCUIT OPEN. No current through the ignition fuse. Check the fuse box.');
  if (!s.sensorOk) lines.push(`E-63 PRESSURE MISMATCH. Sensor A ${s.sensorA} MPa, sensor B 0.4 MPa. Sensors out of calibration; start inhibited until recalibrated.`);
  if (s.variant === 'altered' && !s.pumpPrimed) lines.push('NOTICE REV-C: ignition now requires the auxiliary pump to be primed before START.');
  if (s.variant === 'relocated') lines.push('NOTE: maintenance moved the coolant valve to the storage bay duct. Spare fuses are kept in the lab.');
  lines.push(s.noise[1]);
  if (s.valveOpen && s.fuseOk && s.sensorOk && s.pumpPrimed) lines.push('No active start inhibits.');
  return lines.join('\n');
}

function inspect(s, t) {
  const o = s.objects[t];
  if (o.kind === 'container') {
    if (!s.opened.includes(t)) s.opened.push(t);
    const inside = Object.entries(s.objects).filter(([, x]) => x.in === t).map(([i]) => i);
    return ok(inside.length ? `You open the ${t}. Inside: ${inside.join(', ')}.` : `The ${t} is empty.`);
  }
  switch (t) {
    // Der Wegweiser ist alt: in der Variante "relocated" stimmt er nicht mehr (Beobachtung schlägt Schild)
    case 'directory': return ok('STATION DIRECTORY. Reactor Hall: core, fuse box, coolant valve. Control Room: diagnostics terminal (lists every start inhibit), sensor calibration. Storage Bay: spare parts locker. Laboratory: supply cabinet.');
    case 'terminal': return ok(terminalText(s));
    case 'reactor_panel': return ok(panelText(s));
    case 'fuse_box': return ok(`Ignition fuse: ${s.fuseOk ? 'intact' : 'BURNT OUT'}. Label: "Use ${s.rating} A fuse only."`);
    case 'coolant_valve': return ok(`Primary coolant valve. Position: ${s.valveOpen ? 'OPEN' : 'CLOSED'}. Commands: open, close.`);
    case 'calibration_console': return ok(`Sensor calibration: ${s.sensorOk ? 'valid' : 'EXPIRED'}. Command: recalibrate.`);
    case 'pressure_vent': return ok('Emergency pressure vent. Opening it dumps the coolant loop. Command: open.');
    case 'aux_pump': return ok(`Auxiliary pump: ${s.pumpPrimed ? 'primed' : 'idle'}. Command: prime.`);
    case 'lab_door': return ok(s.labLocked ? 'The lab door is locked. A card reader glows red.' : 'The lab door stands open.');
    default: return ok(`A ${t.replaceAll('_', ' ')}. Nothing unusual.`);
  }
}

function operate(s, device, command) {
  const o = s.objects[device];
  if (o.kind !== 'device' || !o.commands.includes(command)) {
    return bad(`"${command}" is not a command of ${device}.${o.commands?.length ? ` Commands: ${o.commands.join(', ')}.` : ' It has no commands.'}`);
  }
  if (device === 'coolant_valve') {
    s.valveOpen = command === 'open';
    return ok(`Coolant valve is now ${s.valveOpen ? 'OPEN. Coolant flow 48.0 l/min.' : 'CLOSED. Coolant flow 0.0 l/min.'}`);
  }
  if (device === 'calibration_console') {
    if (s.sensorOk) return ok('Sensors are already in calibration.');
    s.sensorOk = true;
    return ok('Recalibration complete. Sensor A 0.4 MPa, sensor B 0.4 MPa.');
  }
  if (device === 'aux_pump') { s.pumpPrimed = true; return ok('Auxiliary pump primed.'); }
  if (device === 'pressure_vent') {
    s.valveOpen = false;
    return bad('Vent opened. The real pressure was normal: the coolant loop is now drained and the coolant valve closed itself.', 'mistake');
  }
  if (device === 'reactor_panel') {
    if (s.valveOpen && s.fuseOk && s.sensorOk && s.pumpPrimed) {
      s.online = true; s.done = true; s.success = true; s.reason = 'reactor_online';
      return ok('IGNITION. The core spins up and the station lights return. REACTOR ONLINE.');
    }
    s.trips += 1;
    if (s.trips >= 3) {
      s.done = true; s.reason = 'lockout';
      return bad('START ABORTED. Third safety trip: the reactor is locked out permanently.', 'mistake');
    }
    return bad(`START ABORTED. Safety interlock tripped (${s.trips}/3). The diagnostics terminal in the control room lists all active start inhibits.`, 'mistake');
  }
  return bad('Nothing happens.');
}

function use(s, item, target) {
  if (!s.inventory.includes(item)) {
    // Rückmeldung zur Bedienung, keine Lösungshilfe: Geräte werden nicht "benutzt", sondern bedient
    return bad(s.objects[item]?.kind === 'device' ? `${item} is a device, not a carried item. Control devices with operate(device, command).` : `You are not carrying ${item}.`);
  }
  if (item === 'keycard' && target === 'lab_door') {
    s.labLocked = false;
    return ok('The reader turns green. The lab door slides open.');
  }
  if (item.startsWith('fuse_') && target === 'fuse_box') {
    if (s.fuseOk) return ok('The fuse box already holds an intact fuse. You keep the spare.');
    s.inventory = s.inventory.filter((i) => i !== item);
    delete s.objects[item];
    if (item === `fuse_${s.rating}a`) { s.fuseOk = true; return ok('The fuse fits. Ignition circuit closed.'); }
    return bad(`Wrong rating: the ${item} burns out instantly and is destroyed.`, 'mistake');
  }
  return bad(`Using ${item} on ${target} does nothing.`);
}

// Einzige Stelle, an der sich die Welt verändert. Liefert { ok, text, error? }.
export function apply(s, action) {
  const { tool, args = {} } = action ?? {};
  if (s.done) return bad('The mission is already over.');
  const here = visible(s).map((v) => v.id);
  const need = (name) => (typeof args[name] === 'string' ? args[name].trim().toLowerCase() : '');
  const seen = `Visible: ${here.join(', ') || 'nothing'}.`;

  if (tool === 'go') {
    const to = need('room');
    if (!ROOMS[to]) return bad(`Unknown room "${to}". Exits: ${ROOMS[s.room].exits.join(', ')}.`);
    if (to === s.room) return bad(`You are already in ${to}.`);
    if (!ROOMS[s.room].exits.includes(to)) return bad(`No direct way from ${s.room} to ${to}. Exits: ${ROOMS[s.room].exits.join(', ')}.`);
    if (to === 'lab' && s.labLocked) return bad('The lab door is locked. A card reader (lab_door) glows red.');
    s.room = to;
    return ok(`You enter the ${ROOMS[to].name}. ${ROOMS[to].desc}`);
  }
  if (tool === 'inspect') {
    const t = need('target');
    if (!here.includes(t)) return bad(`There is no "${t}" here. ${seen}`);
    return inspect(s, t);
  }
  if (tool === 'take') {
    const t = need('item');
    if (s.inventory.includes(t)) return bad(`You already carry ${t}.`);
    if (!here.includes(t)) return bad(`There is no "${t}" to take here. ${seen}`);
    if (s.objects[t].kind !== 'item') return bad(`${t} cannot be carried.${s.objects[t].kind === 'device' ? ' Control devices with operate(device, command).' : ' Open containers with inspect.'}`);
    s.objects[t] = { kind: 'item', held: true };
    s.inventory.push(t);
    return ok(`You take the ${t}.`);
  }
  if (tool === 'use') {
    const t = need('target');
    if (!here.includes(t)) return bad(`There is no "${t}" here. ${seen}`);
    return use(s, need('item'), t);
  }
  if (tool === 'operate') {
    const d = need('device');
    if (!here.includes(d)) return bad(`There is no "${d}" here. ${seen}`);
    return operate(s, d, need('command'));
  }
  return bad(`Unknown tool "${tool}". Tools: go, inspect, take, use, operate.`);
}

// Musterlösung mit Blick in den verborgenen Zustand. Nur für Tests (Lösbarkeit).
export function oracle(s) {
  const plan = [];
  let at = s.room;
  const travel = (room) => {
    if (at === room) return;
    if (at !== 'atrium') plan.push({ tool: 'go', args: { room: 'atrium' } });
    if (room !== 'atrium') plan.push({ tool: 'go', args: { room } });
    at = room;
  };
  if (!s.sensorOk) { travel('control'); plan.push({ tool: 'operate', args: { device: 'calibration_console', command: 'recalibrate' } }); }
  if (!s.fuseOk) {
    const box = s.variant === 'relocated' ? 'supply_cabinet' : 'locker';
    if (s.labLocked) {
      travel('control'); plan.push({ tool: 'take', args: { item: 'keycard' } });
      travel('atrium'); plan.push({ tool: 'use', args: { item: 'keycard', target: 'lab_door' } });
    }
    travel(s.objects[box].room);
    plan.push({ tool: 'inspect', args: { target: box } }, { tool: 'take', args: { item: `fuse_${s.rating}a` } });
    travel('reactor'); plan.push({ tool: 'use', args: { item: `fuse_${s.rating}a`, target: 'fuse_box' } });
  }
  if (!s.valveOpen) { travel(s.objects.coolant_valve.room); plan.push({ tool: 'operate', args: { device: 'coolant_valve', command: 'open' } }); }
  travel('reactor');
  if (!s.pumpPrimed) plan.push({ tool: 'operate', args: { device: 'aux_pump', command: 'prime' } });
  plan.push({ tool: 'operate', args: { device: 'reactor_panel', command: 'start' } });
  return plan;
}

export const roomIds = Object.keys(ROOMS);
