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
