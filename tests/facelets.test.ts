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
