export type Vec = [number, number, number];

export const FACES = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
export type Face = (typeof FACES)[number];

export interface FaceDef {
  normal: Vec;
  right: Vec; // направление роста col, если смотреть на грань снаружи (как на развёртке)
  down: Vec; // направление роста row
}

export const FACE_DEFS: Record<Face, FaceDef> = {
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
