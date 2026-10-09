import { STICKERS, stickerAt, type Vec } from './facelets';

export type Axis = 0 | 1 | 2;
export interface Move {
  axis: Axis;
  layer: -1 | 0 | 1;
  turns: 1 | 2 | 3; // четвертьобороты против часовой вокруг +оси (правило правой руки)
}

export function rotateVec(v: Vec, axis: Axis, turns: number): Vec {
  let [x, y, z] = v;
  const n = ((turns % 4) + 4) % 4;
  for (let i = 0; i < n; i++) {
    if (axis === 0) [y, z] = [-z, y];
    else if (axis === 1) [x, z] = [z, -x];
    else [x, y] = [-y, x];
  }
  return [x, y, z];
}

// Поворот по часовой стрелке, если смотреть на грань снаружи.
const BASE: Record<string, Move> = {
  U: { axis: 1, layer: 1, turns: 3 },
  D: { axis: 1, layer: -1, turns: 1 },
  R: { axis: 0, layer: 1, turns: 3 },
  L: { axis: 0, layer: -1, turns: 1 },
  F: { axis: 2, layer: 1, turns: 3 },
  B: { axis: 2, layer: -1, turns: 1 },
};

export const MOVE_NAMES: string[] = [];
for (const f of ['U', 'D', 'L', 'R', 'F', 'B']) for (const s of ['', "'", '2']) MOVE_NAMES.push(f + s);

export function invertMove(m: Move): Move {
  return { ...m, turns: (4 - m.turns) as 1 | 2 | 3 };
}

export function parseMove(name: string): Move {
  const base = BASE[name[0]];
  if (!base) throw new Error(`Unknown move: ${name}`);
  const suffix = name.slice(1);
  if (suffix === '') return { ...base };
  if (suffix === "'") return invertMove(base);
  if (suffix === '2') return { ...base, turns: 2 };
  throw new Error(`Unknown move: ${name}`);
}

export interface MoveTable {
  perm: number[]; // new[j] = old[perm[j]]
  pairs: [number, number][]; // [from, to] для сдвинувшихся наклеек
}

const cache = new Map<string, MoveTable>();

export function moveTable(m: Move): MoveTable {
  const k = `${m.axis},${m.layer},${m.turns}`;
  const hit = cache.get(k);
  if (hit) return hit;
  const perm = Array.from({ length: STICKERS.length }, (_, i) => i);
  const pairs: [number, number][] = [];
  for (const s of STICKERS) {
    if (s.pos[m.axis] !== m.layer) continue;
    const j = stickerAt(rotateVec(s.pos, m.axis, m.turns), rotateVec(s.normal, m.axis, m.turns));
    perm[j] = s.index;
    if (j !== s.index) pairs.push([s.index, j]);
  }
  const table = { perm, pairs };
  cache.set(k, table);
  return table;
}

export function applyMove(state: readonly number[], m: Move): number[] {
  const { perm } = moveTable(m);
  return perm.map((from) => state[from]);
}

export function applyMoves(state: readonly number[], seq: string): number[] {
  return seq
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .reduce((st, name) => applyMove(st, parseMove(name)), [...state]);
}
