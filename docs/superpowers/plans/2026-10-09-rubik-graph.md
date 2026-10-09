# Кубик Рубика + граф наклеек — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сайт из двух панелей: слева 3D-кубик Рубика, справа граф из 54 вершин-наклеек, связанные в обе стороны с анимацией.

**Architecture:** Чистая модель (54 цвета + ходы как перестановки, выведенные из 3D-геометрии) не знает про UI. `Player` ставит ходы в очередь, параллельно анимирует оба представления (`CubeView` на three.js и `GraphView` на SVG), затем применяет ход к состоянию и синхронизирует оба вида.

**Tech Stack:** Vite, TypeScript, three.js, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-09-rubik-graph-design.md`

## Global Constraints

- Стек: Vite + TypeScript, three.js (кубик), SVG (граф), Vitest (тесты модели).
- Раскладка графа фиксированная (развёртка-крест из 6 граней), физика не нужна.
- Состояние: массив из 54 цветов, индексы наклеек 0..53, 6 граней по 9.
- 18 ходов: U, U', U2, D, D', D2, L, L', L2, R, R', R2, F, F', F2, B, B', B2.
- Кубик и граф только читают состояние и отправляют ходы; модель не знает про UI.
- Минимализм: две равные панели, без шапки и меню, внизу одна тонкая строка «скрамбл · сброс · отмена».
- Вне объёма: решатель, таймер, темы, мобильная версия.
- Коммиты не делаем, пока пользователь сам не попросит (папка не под git).

## Review Focus

1. Много ходов подряд (быстрые нажатия клавиш, drag во время анимации): очередь должна дать то же состояние, что и последовательное применение.
2. «Сброс» во время анимации: не должно остаться рассинхрона цветов или недоигранного поворота.
3. «Отмена» при пустой истории: ничего не ломается.
4. Короткое или смазанное перетаскивание вершины графа: вершина возвращается, хода нет; клик без смещения делает ход грани.
5. Нулевой размер контейнера / WebGL недоступен: страница не падает, граф продолжает работать.

## Структура файлов

- `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/style.css`: проект и оформление.
- `src/model/facelets.ts`: 54 наклейки, позиции, нормали, solved-состояние.
- `src/model/moves.ts`: `Move`, парсинг имён, таблицы перестановок, `applyMove`.
- `src/model/drag.ts`: `moveFromDrag` (наклейка + направление → ход).
- `src/model/colors.ts`: цвета граней.
- `src/graph/topology.ts`: рёбра графа и соседи.
- `src/graph/layout.ts`: позиции вершин (развёртка).
- `src/graph/dragIntent.ts`: смещение мыши по вершине → ход или `null`.
- `src/app/tween.ts`: общий таймер анимации.
- `src/app/player.ts`: очередь ходов, история, скрамбл, сброс.
- `src/views/cubeView.ts`: 3D-кубик.
- `src/views/graphView.ts`: SVG-граф.
- `src/main.ts`: сборка и управление.
- Тесты: `tests/*.test.ts`.

---

### Task 1: Проект и модель наклеек

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`
- Create: `src/model/facelets.ts`
- Test: `tests/facelets.test.ts`

**Interfaces:**
- Produces: `type Vec = [number, number, number]`; `FACES`, `type Face`; `interface Sticker { index; face; row; col; pos: Vec; normal: Vec }`; `STICKERS: Sticker[]`; `stickerAt(pos: Vec, normal: Vec): number`; `solvedState(): number[]`.

- [ ] **Step 1: Создать проект**

`package.json`:
```json
{
  "name": "rubik-graph",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "three": "0.170.0"
  },
  "devDependencies": {
    "@types/three": "0.170.0",
    "typescript": "5.6.3",
    "vite": "5.4.11",
    "vitest": "2.1.8"
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true
  },
  "include": ["src", "tests"]
}
```

`vite.config.ts`:
```ts
import { defineConfig } from 'vite';

export default defineConfig({
  test: { include: ['tests/**/*.test.ts'] },
});
```

Run: `npm install`
Expected: установка без ошибок.

- [ ] **Step 2: Написать падающий тест**

`tests/facelets.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { STICKERS, stickerAt, solvedState, FACES } from '../src/model/facelets';

describe('facelets', () => {
  it('has 54 stickers with unique (pos, normal)', () => {
    expect(STICKERS).toHaveLength(54);
    const keys = new Set(STICKERS.map((s) => `${s.pos}|${s.normal}`));
    expect(keys.size).toBe(54);
  });

  it('stickerAt is the inverse of the sticker table', () => {
    for (const s of STICKERS) expect(stickerAt(s.pos, s.normal)).toBe(s.index);
  });

  it('solved state has 9 stickers of each of 6 colors, face-major order', () => {
    const st = solvedState();
    for (let c = 0; c < 6; c++) expect(st.filter((x) => x === c)).toHaveLength(9);
    expect(st[0]).toBe(FACES.indexOf('U'));
    expect(st[13]).toBe(FACES.indexOf('R'));
    expect(st[53]).toBe(FACES.indexOf('B'));
  });

  it('center stickers sit on the face normal', () => {
    for (let f = 0; f < 6; f++) {
      const c = STICKERS[f * 9 + 4];
      expect(c.pos).toEqual(c.normal);
    }
  });
});
```

- [ ] **Step 3: Запустить тест, убедиться что падает**

Run: `npx vitest run tests/facelets.test.ts`
Expected: FAIL (модуль `facelets` не найден).

- [ ] **Step 4: Реализация**

`src/model/facelets.ts`:
```ts
export type Vec = [number, number, number];

export const FACES = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
export type Face = (typeof FACES)[number];

interface FaceDef {
  normal: Vec;
  right: Vec; // направление роста col, если смотреть на грань снаружи (как на развёртке)
  down: Vec; // направление роста row
}

const FACE_DEFS: Record<Face, FaceDef> = {
  U: { normal: [0, 1, 0], right: [1, 0, 0], down: [0, 0, 1] },
  R: { normal: [1, 0, 0], right: [0, 0, -1], down: [0, -1, 0] },
  F: { normal: [0, 0, 1], right: [1, 0, 0], down: [0, -1, 0] },
  D: { normal: [0, -1, 0], right: [1, 0, 0], down: [0, 0, -1] },
  L: { normal: [-1, 0, 0], right: [0, 0, 1], down: [0, -1, 0] },
  B: { normal: [0, 0, -1], right: [-1, 0, 0], down: [0, -1, 0] },
};

export interface Sticker {
  index: number;
  face: Face;
  row: number;
  col: number;
  pos: Vec; // координаты кубика (-1..1), на котором лежит наклейка
  normal: Vec;
}

export const STICKERS: Sticker[] = [];
const BY_KEY = new Map<string, number>();
const key = (pos: Vec, normal: Vec) => `${pos}|${normal}`;

FACES.forEach((face, f) => {
  const { normal, right, down } = FACE_DEFS[face];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const pos: Vec = [0, 1, 2].map(
        (i) => normal[i] + (col - 1) * right[i] + (row - 1) * down[i],
      ) as Vec;
      const index = f * 9 + row * 3 + col;
      STICKERS.push({ index, face, row, col, pos, normal });
      BY_KEY.set(key(pos, normal), index);
    }
  }
});

export function stickerAt(pos: Vec, normal: Vec): number {
  const i = BY_KEY.get(key(pos, normal));
  if (i === undefined) throw new Error(`No sticker at ${pos} / ${normal}`);
  return i;
}

export function solvedState(): number[] {
  return STICKERS.map((s) => FACES.indexOf(s.face));
}
```

- [ ] **Step 5: Запустить тест, убедиться что проходит**

Run: `npx vitest run tests/facelets.test.ts`
Expected: PASS (4 теста).

---

### Task 2: Ходы

**Files:**
- Create: `src/model/moves.ts`
- Test: `tests/moves.test.ts`

**Interfaces:**
- Consumes: `STICKERS`, `stickerAt`, `Vec` из `facelets.ts`.
- Produces: `type Axis = 0|1|2`; `interface Move { axis: Axis; layer: -1|0|1; turns: 1|2|3 }` (turns — число четвертьоборотов против часовой вокруг +оси); `MOVE_NAMES: string[]`; `parseMove(name): Move`; `invertMove(m): Move`; `rotateVec(v, axis, turns): Vec`; `moveTable(m): { perm: number[]; pairs: [number, number][] }` (`new[j] = old[perm[j]]`, `pairs` — пары `[from, to]` реально сдвинувшихся наклеек); `applyMove(state, m): number[]`; `applyMoves(state, seq: string): number[]`.

- [ ] **Step 1: Написать падающие тесты**

`tests/moves.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { solvedState } from '../src/model/facelets';
import { MOVE_NAMES, applyMove, applyMoves, invertMove, moveTable, parseMove } from '../src/model/moves';

const solved = solvedState();
const repeat = (seq: string, n: number) => Array(n).fill(seq).join(' ');

describe('moves', () => {
  it('has 18 named moves', () => {
    expect(MOVE_NAMES).toHaveLength(18);
  });

  it('every move applied 4 times is identity', () => {
    for (const name of MOVE_NAMES) {
      expect(applyMoves(solved, repeat(name, 4))).toEqual(solved);
    }
  });

  it('a move followed by its inverse is identity', () => {
    for (const name of MOVE_NAMES) {
      const m = parseMove(name);
      expect(applyMove(applyMove(solved, m), invertMove(m))).toEqual(solved);
    }
  });

  it('X2 equals X X', () => {
    expect(applyMoves(solved, 'U2')).toEqual(applyMoves(solved, 'U U'));
  });

  it("(R U R' U') x6 is identity but x3 is not", () => {
    expect(applyMoves(solved, repeat("R U R' U'", 6))).toEqual(solved);
    expect(applyMoves(solved, repeat("R U R' U'", 3))).not.toEqual(solved);
  });

  it('(R U) x105 is identity, x35 is not (checks handedness of all axes)', () => {
    expect(applyMoves(solved, repeat('R U', 105))).toEqual(solved);
    expect(applyMoves(solved, repeat('R U', 35))).not.toEqual(solved);
    expect(applyMoves(solved, repeat("F R' D2 L B' U", 1)).filter((c) => c === 0)).toHaveLength(9);
  });

  it('U sends right-face top row onto the front face (clockwise from above)', () => {
    const st = applyMoves(solved, 'U');
    expect(st.slice(18, 21)).toEqual([1, 1, 1]); // F top row now has R color
    expect(st[4]).toBe(0); // U center unchanged
  });

  it('U moves exactly 20 stickers', () => {
    expect(moveTable(parseMove('U')).pairs).toHaveLength(20);
  });

  it('keeps 9 stickers of each color after a scramble', () => {
    const st = applyMoves(solved, "R U2 F' L D B2 R' U F2 D' L2");
    for (let c = 0; c < 6; c++) expect(st.filter((x) => x === c)).toHaveLength(9);
  });
});
```

- [ ] **Step 2: Запустить, убедиться что падает**

Run: `npx vitest run tests/moves.test.ts`
Expected: FAIL (модуль `moves` не найден).

- [ ] **Step 3: Реализация**

`src/model/moves.ts`:
```ts
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
```

- [ ] **Step 4: Запустить, убедиться что проходит**

Run: `npx vitest run tests/moves.test.ts`
Expected: PASS (9 тестов). Если падает проверка `(R U) x105` или `U sends right-face…`, ошибка в ориентации граней в `facelets.ts` или в таблице `BASE`; исправить, не подгоняя тесты.

---

### Task 3: Топология графа, раскладка и drag → ход

**Files:**
- Create: `src/model/drag.ts`, `src/model/colors.ts`, `src/graph/topology.ts`, `src/graph/layout.ts`, `src/graph/dragIntent.ts`
- Test: `tests/graph.test.ts`

**Interfaces:**
- Consumes: `STICKERS`, `Vec`, `Face` (Task 1); `Move`, `parseMove`, `Axis` (Task 2).
- Produces:
  - `moveFromDrag(slot: number, dir: Vec): Move`: `dir` — единичный вектор вдоль оси, перпендикулярный нормали наклейки; наклейка должна уехать в этом направлении.
  - `FACE_COLORS: string[]` (индекс = цвет).
  - `interface Edge { a: number; b: number; kind: 'grid' | 'cross' }`; `buildEdges(): Edge[]`; `neighborMap(): number[][]`; `neighborDirection(a: number, b: number): Vec`.
  - `nodePosition(slot): [number, number]`; `VIEWBOX: string`.
  - `chooseMove(slot: number, dx: number, dy: number): Move | null` (dx, dy в единицах шага между вершинами; короткий сдвиг = клик → ход грани; средний → `null`).

- [ ] **Step 1: Написать падающие тесты**

`tests/graph.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { buildEdges, neighborDirection, neighborMap } from '../src/graph/topology';
import { nodePosition } from '../src/graph/layout';
import { chooseMove } from '../src/graph/dragIntent';
import { moveFromDrag } from '../src/model/drag';
import { invertMove } from '../src/model/moves';
import { STICKERS, stickerAt } from '../src/model/facelets';
import { moveTable } from '../src/model/moves';

describe('topology', () => {
  it('has 108 edges (72 grid + 36 cross) and every vertex has degree 4', () => {
    const edges = buildEdges();
    expect(edges).toHaveLength(108);
    expect(edges.filter((e) => e.kind === 'grid')).toHaveLength(72);
    expect(neighborMap().every((n) => n.length === 4)).toBe(true);
  });

  it('neighborDirection is a unit axis vector perpendicular to the sticker normal', () => {
    for (const e of buildEdges()) {
      for (const [a, b] of [[e.a, e.b], [e.b, e.a]]) {
        const d = neighborDirection(a, b);
        expect(d.reduce((s, c) => s + Math.abs(c), 0)).toBe(1);
        const n = STICKERS[a].normal;
        expect(d[0] * n[0] + d[1] * n[1] + d[2] * n[2]).toBe(0);
      }
    }
  });
});

describe('layout', () => {
  it('places 54 distinct nodes; grid edges have length 1', () => {
    const pts = new Set(STICKERS.map((s) => nodePosition(s.index).join(',')));
    expect(pts.size).toBe(54);
    for (const e of buildEdges().filter((x) => x.kind === 'grid')) {
      const [ax, ay] = nodePosition(e.a);
      const [bx, by] = nodePosition(e.b);
      expect(Math.hypot(ax - bx, ay - by)).toBeCloseTo(1);
    }
  });
});

describe('moveFromDrag', () => {
  const slot = 19; // F face, top middle

  it('dragging right on the front top row turns the U layer counter-clockwise (U\')', () => {
    const m = moveFromDrag(slot, [1, 0, 0]);
    expect(m).toEqual({ axis: 1, layer: 1, turns: 1 });
    const to = stickerAt([1, 1, 0], [1, 0, 0]); // R face top-middle
    expect(moveTable(m).pairs).toContainEqual([slot, to]);
  });

  it('opposite drags give inverse moves', () => {
    expect(moveFromDrag(slot, [-1, 0, 0])).toEqual(invertMove(moveFromDrag(slot, [1, 0, 0])));
  });
});

describe('chooseMove', () => {
  const slot = 19;

  it('click (no movement) turns the sticker face clockwise', () => {
    expect(chooseMove(slot, 0, 0)).toEqual({ axis: 2, layer: 1, turns: 3 });
  });

  it('a short pull does nothing', () => {
    expect(chooseMove(slot, 0.3, 0)).toBeNull();
  });

  it('pulling right to the next vertex turns the layer', () => {
    expect(chooseMove(slot, 0.9, 0)).toEqual({ axis: 1, layer: 1, turns: 1 });
  });

  it('pulling up across the face boundary turns the middle slice', () => {
    expect(chooseMove(slot, 0, -0.9)).toEqual({ axis: 0, layer: 0, turns: 3 });
  });
});
```

- [ ] **Step 2: Запустить, убедиться что падает**

Run: `npx vitest run tests/graph.test.ts`
Expected: FAIL (модули не найдены).

- [ ] **Step 3: Реализация**

`src/model/colors.ts`:
```ts
// Индекс = порядок граней U R F D L B.
export const FACE_COLORS = ['#f4f4f0', '#d1342f', '#2f9e57', '#f2c230', '#ee8a2b', '#2b63c9'];
```

`src/model/drag.ts`:
```ts
import { STICKERS, type Vec } from './facelets';
import type { Axis, Move } from './moves';

const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

// Поворот на +90° вокруг оси a двигает точку q в направлении a × q;
// в плоскости грани это a × normal. Берём a = normal × dir, тогда a × normal = dir.
export function moveFromDrag(slot: number, dir: Vec): Move {
  const s = STICKERS[slot];
  const a = cross(s.normal, dir);
  const axis = a.findIndex((c) => c !== 0) as Axis;
  return { axis, layer: s.pos[axis] as -1 | 0 | 1, turns: a[axis] > 0 ? 1 : 3 };
}
```

`src/graph/topology.ts`:
```ts
import { STICKERS, type Vec } from '../model/facelets';

export interface Edge {
  a: number;
  b: number;
  kind: 'grid' | 'cross';
}

const same = (u: Vec, v: Vec) => u[0] === v[0] && u[1] === v[1] && u[2] === v[2];

export function buildEdges(): Edge[] {
  const edges: Edge[] = [];
  for (let i = 0; i < STICKERS.length; i++) {
    for (let j = i + 1; j < STICKERS.length; j++) {
      const s = STICKERS[i];
      const t = STICKERS[j];
      if (same(s.normal, t.normal)) {
        const dist = Math.abs(s.pos[0] - t.pos[0]) + Math.abs(s.pos[1] - t.pos[1]) + Math.abs(s.pos[2] - t.pos[2]);
        if (dist === 1) edges.push({ a: i, b: j, kind: 'grid' });
      } else if (same(s.pos, t.pos)) {
        edges.push({ a: i, b: j, kind: 'cross' }); // две наклейки одного кубика
      }
    }
  }
  return edges;
}

export function neighborMap(): number[][] {
  const map: number[][] = STICKERS.map(() => []);
  for (const e of buildEdges()) {
    map[e.a].push(e.b);
    map[e.b].push(e.a);
  }
  return map;
}

// Направление (в 3D), в котором наклейка a уезжает, если её тянут к соседу b.
export function neighborDirection(a: number, b: number): Vec {
  const s = STICKERS[a];
  const t = STICKERS[b];
  if (same(s.normal, t.normal)) {
    return [t.pos[0] - s.pos[0], t.pos[1] - s.pos[1], t.pos[2] - s.pos[2]];
  }
  return t.normal;
}
```

`src/graph/layout.ts`:
```ts
import { STICKERS, type Face } from '../model/facelets';

const BLOCK: Record<Face, [number, number]> = {
  U: [1, 0],
  L: [0, 1],
  F: [1, 1],
  R: [2, 1],
  B: [3, 1],
  D: [1, 2],
};
const PITCH = 3.8; // расстояние между блоками граней (грань занимает 3 клетки)

export function nodePosition(slot: number): [number, number] {
  const s = STICKERS[slot];
  const [bx, by] = BLOCK[s.face];
  return [bx * PITCH + s.col + 0.5, by * PITCH + s.row + 0.5];
}

export const VIEWBOX = `-0.5 -0.5 ${3 * PITCH + 3 + 1} ${2 * PITCH + 3 + 1}`;
```

`src/graph/dragIntent.ts`:
```ts
import { STICKERS } from '../model/facelets';
import { moveFromDrag } from '../model/drag';
import { parseMove, type Move } from '../model/moves';
import { nodePosition } from './layout';
import { neighborDirection, neighborMap } from './topology';

const CLICK = 0.15; // меньше — это клик
const PULL = 0.6; // меньше — вершина вернётся на место без хода
const MIN_COS = 0.7;

const NEIGHBORS = neighborMap();

// dx, dy — смещение мыши в единицах шага между вершинами.
export function chooseMove(slot: number, dx: number, dy: number): Move | null {
  const len = Math.hypot(dx, dy);
  if (len < CLICK) return parseMove(STICKERS[slot].face);
  if (len < PULL) return null;
  const [ax, ay] = nodePosition(slot);
  let best = -Infinity;
  let bestNeighbor = -1;
  for (const b of NEIGHBORS[slot]) {
    const [bx, by] = nodePosition(b);
    const ux = bx - ax;
    const uy = by - ay;
    const cos = (dx * ux + dy * uy) / (len * Math.hypot(ux, uy));
    if (cos > best) {
      best = cos;
      bestNeighbor = b;
    }
  }
  if (best < MIN_COS) return null;
  return moveFromDrag(slot, neighborDirection(slot, bestNeighbor));
}
```

- [ ] **Step 4: Запустить, убедиться что проходит**

Run: `npx vitest run`
Expected: PASS (все тесты Task 1-3).

---

### Task 4: Player (очередь ходов)

**Files:**
- Create: `src/app/tween.ts`, `src/app/player.ts`
- Test: `tests/player.test.ts`

**Interfaces:**
- Consumes: `solvedState`, `Move`, `applyMove`, `invertMove`, `MOVE_NAMES`, `parseMove`.
- Produces:
  - `interface MoveView { sync(state: readonly number[]): void; animate(move: Move, ms: number): Promise<void> }`
  - `class Player` с `constructor(views: MoveView[], duration = 260)`, `state: number[]`, `enqueue(move: Move, opts?: { ms?: number; record?: boolean }): void`, `undo(): void`, `scramble(n = 20): void`, `reset(): Promise<void>`, `idle(): Promise<void>`.
  - `tween(ms: number, onFrame: (t: number) => void): Promise<void>`: `t` проходит 0..1 с easing; при `ms <= 0` сразу `onFrame(1)`.

- [ ] **Step 1: Написать падающие тесты**

`tests/player.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { Player, type MoveView } from '../src/app/player';
import { applyMoves } from '../src/model/moves';
import { parseMove } from '../src/model/moves';
import { solvedState } from '../src/model/facelets';

const solved = solvedState();

function fakeView() {
  const view: MoveView & { synced: number[][] } = {
    synced: [],
    sync(state) {
      view.synced.push([...state]);
    },
    animate: () => new Promise((r) => setTimeout(r, 0)),
  };
  return view;
}

describe('Player', () => {
  it('applies queued moves in order and syncs the views', async () => {
    const v = fakeView();
    const p = new Player([v], 0);
    for (const n of ['R', 'U', "R'", "U'", 'F2']) p.enqueue(parseMove(n));
    await p.idle();
    expect(p.state).toEqual(applyMoves(solved, "R U R' U' F2"));
    expect(v.synced.at(-1)).toEqual(p.state);
  });

  it('undo reverts the last move; undo on empty history is a no-op', async () => {
    const p = new Player([fakeView()], 0);
    p.undo();
    expect(p.state).toEqual(solved);
    p.enqueue(parseMove('R'));
    await p.idle();
    p.undo();
    await p.idle();
    expect(p.state).toEqual(solved);
    p.undo();
    await p.idle();
    expect(p.state).toEqual(solved);
  });

  it('reset in the middle of a queue lands on the solved state with empty history', async () => {
    const v = fakeView();
    const p = new Player([v], 0);
    for (const n of ['R', 'U', 'F', 'D']) p.enqueue(parseMove(n));
    await p.reset();
    expect(p.state).toEqual(solved);
    expect(v.synced.at(-1)).toEqual(solved);
    p.undo();
    await p.idle();
    expect(p.state).toEqual(solved);
  });

  it('scramble applies 20 moves and keeps 9 stickers per color', async () => {
    const p = new Player([fakeView()], 0);
    p.scramble();
    await p.idle();
    expect(p.state).not.toEqual(solved);
    for (let c = 0; c < 6; c++) expect(p.state.filter((x) => x === c)).toHaveLength(9);
  });
});
```

- [ ] **Step 2: Запустить, убедиться что падает**

Run: `npx vitest run tests/player.test.ts`
Expected: FAIL (модуль `player` не найден).

- [ ] **Step 3: Реализация**

`src/app/tween.ts`:
```ts
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function tween(ms: number, onFrame: (t: number) => void): Promise<void> {
  if (ms <= 0) {
    onFrame(1);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      onFrame(easeInOut(k));
      if (k < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}
```

`src/app/player.ts`:
```ts
import { solvedState } from '../model/facelets';
import { MOVE_NAMES, applyMove, invertMove, parseMove, type Move } from '../model/moves';

export interface MoveView {
  sync(state: readonly number[]): void;
  animate(move: Move, ms: number): Promise<void>;
}

interface Job {
  move: Move;
  ms: number;
  record: boolean;
}

export class Player {
  state: number[] = solvedState();
  private history: Move[] = [];
  private queue: Job[] = [];
  private busy = false;
  private epoch = 0;
  private current: Promise<void> = Promise.resolve();

  constructor(
    private views: MoveView[],
    private duration = 260,
  ) {
    this.sync();
  }

  enqueue(move: Move, opts: { ms?: number; record?: boolean } = {}): void {
    this.queue.push({ move, ms: opts.ms ?? this.duration, record: opts.record ?? true });
    if (!this.busy) this.current = this.pump();
  }

  undo(): void {
    if (this.busy) return;
    const last = this.history.pop();
    if (last) this.enqueue(invertMove(last), { record: false });
  }

  scramble(n = 20): void {
    let prev = '';
    for (let i = 0; i < n; i++) {
      let name: string;
      do name = MOVE_NAMES[Math.floor(Math.random() * MOVE_NAMES.length)];
      while (name[0] === prev);
      prev = name[0];
      this.enqueue(parseMove(name), { ms: Math.min(this.duration, 90) });
    }
  }

  async reset(): Promise<void> {
    this.epoch++;
    this.queue.length = 0;
    await this.current; // дожидаемся текущей анимации
    this.queue.length = 0;
    this.history.length = 0;
    this.state = solvedState();
    this.sync();
  }

  idle(): Promise<void> {
    return this.current;
  }

  private sync(): void {
    for (const v of this.views) v.sync(this.state);
  }

  private async pump(): Promise<void> {
    this.busy = true;
    const epoch = this.epoch;
    try {
      while (this.queue.length) {
        const job = this.queue.shift()!;
        await Promise.all(this.views.map((v) => v.animate(job.move, job.ms)));
        if (epoch !== this.epoch) return; // reset сам синхронизирует виды
        this.state = applyMove(this.state, job.move);
        if (job.record) this.history.push(job.move);
        this.sync();
      }
    } finally {
      this.busy = false;
    }
  }
}
```

- [ ] **Step 4: Запустить, убедиться что проходит**

Run: `npx vitest run`
Expected: PASS (все тесты).

---

### Task 5: 3D-кубик (CubeView)

**Files:**
- Create: `src/views/cubeView.ts`

**Interfaces:**
- Consumes: `MoveView` (Task 4), `tween`, `STICKERS`, `Vec`, `Move`, `FACE_COLORS`.
- Produces: `class CubeView implements MoveView` с `constructor(host: HTMLElement, request: (m: Move) => void)`, `sync(state)`, `animate(move, ms)`.

Модель слоёв: 27 чёрных кубиков-тел + 54 наклейки закреплены на «слотах». Во время хода участники слоя перецепляются в `pivot` и вращаются; по окончании возвращаются на домашние позиции, а цвета наклеек перекрашивает `sync` по новому состоянию.

- [ ] **Step 1: Реализация**

`src/views/cubeView.ts`:
```ts
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { tween } from '../app/tween';
import type { MoveView } from '../app/player';
import { FACE_COLORS } from '../model/colors';
import { STICKERS, type Vec } from '../model/facelets';
import type { Move } from '../model/moves';

const DRAG_THRESHOLD = 10; // px

interface Home {
  p: THREE.Vector3;
  q: THREE.Quaternion;
}

export class CubeView implements MoveView {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private pivot = new THREE.Group();
  private raycaster = new THREE.Raycaster();
  private all: THREE.Mesh[] = [];
  private stickers: THREE.Mesh[] = [];
  private drag: { slot: number; x: number; y: number; done: boolean } | null = null;

  constructor(
    private host: HTMLElement,
    private request: (m: Move) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.domElement.style.display = 'block';
    host.appendChild(this.renderer.domElement);

    this.camera.position.set(5.2, 4.2, 6.4);
    this.camera.lookAt(0, 0, 0);
    this.scene.add(this.pivot);
    this.build();

    // Перехватываем pointerdown раньше OrbitControls: если попали в наклейку, камера не крутится.
    host.addEventListener('pointerdown', this.onDown, true);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enablePan = false;
    this.controls.enableZoom = false;
    this.controls.enableDamping = true;

    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
    this.renderer.setAnimationLoop(() => {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    });
  }

  sync(state: readonly number[]): void {
    this.stickers.forEach((m, i) => (m.material as THREE.MeshBasicMaterial).color.set(FACE_COLORS[state[i]]));
  }

  animate(move: Move, ms: number): Promise<void> {
    const members = this.all.filter((o) => (o.userData.pos as Vec)[move.axis] === move.layer);
    for (const m of members) this.pivot.attach(m);
    const total = ((move.turns === 3 ? -1 : move.turns) * Math.PI) / 2;
    const key = (['x', 'y', 'z'] as const)[move.axis];
    return tween(ms, (k) => {
      this.pivot.rotation[key] = total * k;
    }).then(() => {
      for (const m of members) {
        this.scene.attach(m);
        const home = m.userData.home as Home;
        m.position.copy(home.p);
        m.quaternion.copy(home.q);
      }
      this.pivot.rotation.set(0, 0, 0);
    });
  }

  private build(): void {
    const add = (mesh: THREE.Mesh, pos: Vec, extra: object) => {
      mesh.userData = { pos, ...extra, home: { p: mesh.position.clone(), q: mesh.quaternion.clone() } };
      this.scene.add(mesh);
      this.all.push(mesh);
    };

    const bodyGeo = new THREE.BoxGeometry(0.96, 0.96, 0.96);
    const bodyMat = new THREE.MeshBasicMaterial({ color: 0x161616 });
    for (let x = -1; x <= 1; x++)
      for (let y = -1; y <= 1; y++)
        for (let z = -1; z <= 1; z++) {
          const mesh = new THREE.Mesh(bodyGeo, bodyMat);
          mesh.position.set(x, y, z);
          add(mesh, [x, y, z], { kind: 'body' });
        }

    const stickerGeo = new THREE.PlaneGeometry(0.84, 0.84);
    const zAxis = new THREE.Vector3(0, 0, 1);
    for (const s of STICKERS) {
      const mesh = new THREE.Mesh(stickerGeo, new THREE.MeshBasicMaterial());
      const n = new THREE.Vector3(...s.normal);
      mesh.position.set(...s.pos).addScaledVector(n, 0.485);
      mesh.quaternion.setFromUnitVectors(zAxis, n);
      add(mesh, s.pos, { kind: 'sticker', slot: s.index });
      this.stickers.push(mesh);
    }
  }

  private resize(): void {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private pick(e: PointerEvent): number | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObjects(this.all, false)[0];
    return hit && hit.object.userData.kind === 'sticker' ? (hit.object.userData.slot as number) : null;
  }

  private onDown = (e: PointerEvent): void => {
    const slot = this.pick(e);
    if (slot === null) return;
    this.controls.enabled = false;
    this.drag = { slot, x: e.clientX, y: e.clientY, done: false };
  };

  private onMove = (e: PointerEvent): void => {
    const d = this.drag;
    if (!d || d.done) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    d.done = true;

    // Среди двух осей, лежащих в плоскости грани, берём ту, чьё экранное движение лучше совпадает с мышью.
    const s = STICKERS[d.slot];
    let best: { axis: 0 | 1 | 2; dot: number } | null = null;
    for (const axis of [0, 1, 2] as const) {
      if (s.normal[axis] !== 0) continue;
      const a = new THREE.Vector3();
      a.setComponent(axis, 1);
      const v = a.clone().cross(new THREE.Vector3(...s.normal)); // направление движения при +90°
      const sp = this.screenDir(new THREE.Vector3(...s.pos).addScaledVector(new THREE.Vector3(...s.normal), 0.5), v);
      const dot = sp.x * dx + sp.y * dy;
      if (!best || Math.abs(dot) > Math.abs(best.dot)) best = { axis, dot };
    }
    if (best) {
      this.request({ axis: best.axis, layer: s.pos[best.axis] as -1 | 0 | 1, turns: best.dot > 0 ? 1 : 3 });
    }
  };

  private onUp = (): void => {
    this.drag = null;
    this.controls.enabled = true;
  };

  private screenDir(point: THREE.Vector3, v: THREE.Vector3): THREE.Vector2 {
    const r = this.renderer.domElement.getBoundingClientRect();
    const toPx = (p: THREE.Vector3) => {
      const n = p.clone().project(this.camera);
      return new THREE.Vector2(((n.x + 1) / 2) * r.width, ((1 - n.y) / 2) * r.height);
    };
    return toPx(point.clone().addScaledVector(v, 0.5)).sub(toPx(point));
  }
}
```

- [ ] **Step 2: Проверить типы**

Run: `npx tsc --noEmit`
Expected: без ошибок (кроме, возможно, отсутствия `main.ts`; он ещё не создан и в проверку не входит).

---

### Task 6: SVG-граф (GraphView)

**Files:**
- Create: `src/views/graphView.ts`

**Interfaces:**
- Consumes: `MoveView`, `tween`, `moveTable`, `chooseMove`, `buildEdges`, `nodePosition`, `VIEWBOX`, `FACE_COLORS`, `Move`.
- Produces: `class GraphView implements MoveView` с `constructor(host: HTMLElement, request: (m: Move) => void)`, `sync(state)`, `animate(move, ms)`.

Во время хода реальные узлы затронутых слотов скрываются, вместо них по дугам едут временные кружки, затем `sync` перекрашивает слоты.

- [ ] **Step 1: Реализация**

`src/views/graphView.ts`:
```ts
import { tween } from '../app/tween';
import type { MoveView } from '../app/player';
import { chooseMove } from '../graph/dragIntent';
import { VIEWBOX, nodePosition } from '../graph/layout';
import { buildEdges } from '../graph/topology';
import { FACE_COLORS } from '../model/colors';
import { STICKERS } from '../model/facelets';
import { moveTable, type Move } from '../model/moves';

const NS = 'http://www.w3.org/2000/svg';
const R = 0.4;
const MAX_PULL = 1.3; // насколько далеко вершину можно оттянуть (в шагах)

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

export class GraphView implements MoveView {
  private svg = el('svg', { viewBox: VIEWBOX, preserveAspectRatio: 'xMidYMid meet' });
  private nodes: SVGCircleElement[] = [];
  private floating = el('g');
  private colors: number[] = STICKERS.map(() => 0);
  private drag: { slot: number; sx: number; sy: number } | null = null;

  constructor(
    host: HTMLElement,
    private request: (m: Move) => void,
  ) {
    const edges = el('g');
    for (const e of buildEdges()) {
      const [x1, y1] = nodePosition(e.a);
      const [x2, y2] = nodePosition(e.b);
      const far = Math.hypot(x1 - x2, y1 - y2) > 2;
      edges.appendChild(el('line', { x1, y1, x2, y2, class: far ? 'edge far' : 'edge' }));
    }
    const nodes = el('g');
    for (const s of STICKERS) {
      const [cx, cy] = nodePosition(s.index);
      const c = el('circle', { cx, cy, r: R, class: 'node' });
      this.bind(c, s.index);
      this.nodes.push(c);
      nodes.appendChild(c);
    }
    this.svg.append(edges, nodes, this.floating);
    host.appendChild(this.svg);
  }

  sync(state: readonly number[]): void {
    this.colors = [...state];
    this.nodes.forEach((n, i) => {
      n.setAttribute('fill', FACE_COLORS[state[i]]);
      n.style.visibility = 'visible';
    });
  }

  animate(move: Move, ms: number): Promise<void> {
    const { pairs } = moveTable(move);
    const bulge = move.turns === 3 ? -0.2 : 0.2;
    const flyers = pairs.map(([from, to]) => {
      const c = el('circle', { r: R, class: 'node', fill: FACE_COLORS[this.colors[from]] });
      this.floating.appendChild(c);
      this.nodes[from].style.visibility = 'hidden';
      this.nodes[to].style.visibility = 'hidden';
      return { c, a: nodePosition(from), b: nodePosition(to) };
    });
    return tween(ms, (k) => {
      for (const { c, a, b } of flyers) {
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const bend = Math.sin(Math.PI * k) * bulge;
        c.setAttribute('cx', String(a[0] + dx * k - dy * bend));
        c.setAttribute('cy', String(a[1] + dy * k + dx * bend));
      }
    }).then(() => {
      this.floating.replaceChildren();
    });
  }

  private bind(circle: SVGCircleElement, slot: number): void {
    const delta = (e: PointerEvent): [number, number] => {
      const scale = this.svg.getScreenCTM()?.a || 1;
      const dx = (e.clientX - this.drag!.sx) / scale;
      const dy = (e.clientY - this.drag!.sy) / scale;
      const len = Math.hypot(dx, dy);
      const k = len > MAX_PULL ? MAX_PULL / len : 1;
      return [dx * k, dy * k];
    };
    circle.addEventListener('pointerdown', (e) => {
      circle.setPointerCapture(e.pointerId);
      this.drag = { slot, sx: e.clientX, sy: e.clientY };
    });
    circle.addEventListener('pointermove', (e) => {
      if (!this.drag || this.drag.slot !== slot) return;
      const [dx, dy] = delta(e);
      circle.setAttribute('transform', `translate(${dx} ${dy})`);
    });
    const finish = (e: PointerEvent, cancelled: boolean) => {
      if (!this.drag || this.drag.slot !== slot) return;
      const [dx, dy] = delta(e);
      this.drag = null;
      circle.removeAttribute('transform');
      if (cancelled) return;
      const move = chooseMove(slot, dx, dy);
      if (move) this.request(move);
    };
    circle.addEventListener('pointerup', (e) => finish(e, false));
    circle.addEventListener('pointercancel', (e) => finish(e, true));
  }
}
```

- [ ] **Step 2: Проверить типы**

Run: `npx tsc --noEmit`
Expected: без ошибок.

---

### Task 7: Сборка страницы, управление, ручная проверка

**Files:**
- Create: `index.html`, `src/style.css`, `src/main.ts`

**Interfaces:**
- Consumes: `Player`, `CubeView`, `GraphView`, `parseMove`.

- [ ] **Step 1: Разметка и стили**

`index.html`:
```html
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Кубик и граф</title>
  </head>
  <body>
    <main>
      <section id="cube"></section>
      <section id="graph"></section>
    </main>
    <footer>
      <button id="scramble">скрамбл</button> ·
      <button id="reset">сброс</button> ·
      <button id="undo">отмена</button>
    </footer>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`src/style.css`:
```css
:root {
  --bg: #fafaf8;
  --fg: #2a2a28;
  --edge: #b9b9b2;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #131313;
    --fg: #d8d8d2;
    --edge: #4a4a46;
  }
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: var(--bg); color: var(--fg); font: 14px system-ui, sans-serif; }
body { display: flex; flex-direction: column; }
main { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 1fr; }
section { min-width: 0; min-height: 0; position: relative; overflow: hidden; }
svg { width: 100%; height: 100%; display: block; touch-action: none; user-select: none; }
.edge { stroke: var(--edge); stroke-width: 0.06; }
.edge.far { opacity: 0.3; }
.node { stroke: rgba(0, 0, 0, 0.35); stroke-width: 0.05; cursor: grab; touch-action: none; }
footer { height: 44px; display: flex; align-items: center; justify-content: center; gap: 8px; opacity: 0.8; }
button { all: unset; cursor: pointer; padding: 4px 6px; }
button:hover { text-decoration: underline; }
@media (max-width: 800px) {
  main { grid-template-columns: 1fr; grid-template-rows: 1fr 1fr; }
}
```

- [ ] **Step 2: Точка входа**

`src/main.ts`:
```ts
import './style.css';
import { Player, type MoveView } from './app/player';
import { parseMove, type Move } from './model/moves';
import { CubeView } from './views/cubeView';
import { GraphView } from './views/graphView';

const cubeHost = document.getElementById('cube')!;
const graphHost = document.getElementById('graph')!;

let player: Player;
const request = (m: Move) => player.enqueue(m);

const views: MoveView[] = [];
try {
  views.push(new CubeView(cubeHost, request));
} catch {
  cubeHost.textContent = 'WebGL недоступен';
  cubeHost.style.cssText = 'display:grid;place-items:center;opacity:.6';
}
views.push(new GraphView(graphHost, request));
player = new Player(views);

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toUpperCase();
  if (k.length !== 1 || !'URFDLB'.includes(k)) return;
  player.enqueue(parseMove(k + (e.shiftKey ? "'" : '')));
});

document.getElementById('scramble')!.onclick = () => player.scramble();
document.getElementById('reset')!.onclick = () => void player.reset();
document.getElementById('undo')!.onclick = () => player.undo();
```

- [ ] **Step 3: Проверить сборку и тесты**

Run: `npm run build` затем `npm test`
Expected: сборка и тесты проходят без ошибок.

- [ ] **Step 4: Ручная проверка в браузере**

Run: `npm run dev`, открыть выданный адрес. Проверить по списку:
1. Слева кубик, справа развёртка из 54 цветных вершин с линиями-рёбрами; панели равны, внизу «скрамбл · сброс · отмена».
2. Мышь по пустому месту вокруг кубика вращает его; по наклейке поворачивает слой в сторону движения мыши, и тот же поворот анимируется в графе (вершины едут по дугам, цвета совпадают с кубиком после остановки).
3. Клавиши `U R F D L B` делают ход, `Shift`+клавиша обратный; быстрое нажатие 5-10 клавиш подряд даёт те же цвета на кубике и в графе.
4. В графе: клик по вершине поворачивает её грань; потянуть вершину к соседней и отпустить поворачивает слой; короткое смещение возвращает вершину без хода.
5. «Скрамбл» перемешивает, «отмена» шаг за шагом возвращает, «сброс» (в том числе во время скрамбла) приводит к собранному кубику в обоих видах.
6. Изменение размера окна не ломает ни кубик, ни граф; при узком окне панели встают друг под другом.

Если граф с длинными бледными рёбрами между далёкими гранями развёртки выглядит перегруженным, сообщить пользователю и предложить другую раскладку (меняется только `src/graph/layout.ts`).
