import { describe, expect, it } from 'vitest';
import { circleOf, nodePosition } from '../src/graph/layout';
import { motionsFor } from '../src/graph/tracks';
import { moveTable, type Axis, type Move } from '../src/model/moves';

const onSomeLine = ([x, y]: [number, number]) =>
  [0, 1, 2].some((axis) =>
    [-1, 0, 1].some((layer) => {
      const { c, r } = circleOf(axis, layer);
      return Math.abs(Math.hypot(x - c[0], y - c[1]) - r) < 1e-6;
    }),
  );

const allMoves: Move[] = [];
for (const axis of [0, 1, 2] as Axis[])
  for (const layer of [-1, 0, 1] as const) for (const turns of [1, 2, 3] as const) allMoves.push({ axis, layer, turns });

describe('node motion', () => {
  it('every node of every move travels only along graph lines and ends on its target', () => {
    for (const move of allMoves) {
      const to = new Map(moveTable(move).pairs);
      const motions = motionsFor(move);
      expect(motions.map((m) => m.slot).sort()).toEqual([...to.keys()].sort());
      for (const m of motions) {
        expect(m.to).toBe(to.get(m.slot));
        for (let k = 0; k <= 1.0001; k += 0.05) expect(onSomeLine(m.at(Math.min(k, 1)))).toBe(true);
        const [sx, sy] = m.at(0);
        const [ex, ey] = m.at(1);
        expect(Math.hypot(sx - nodePosition(m.slot)[0], sy - nodePosition(m.slot)[1])).toBeLessThan(1e-6);
        expect(Math.hypot(ex - nodePosition(m.to)[0], ey - nodePosition(m.to)[1])).toBeLessThan(1e-6);
      }
    }
  });
});
