import { tween } from '../app/tween';
import type { MoveView } from '../app/player';
import { chooseMove } from '../graph/dragIntent';
import { VIEWBOX, circleOf, nodePosition } from '../graph/layout';
import { arcPath, motionsFor, phiAt, tracksFor } from '../graph/tracks';
import { FACE_COLORS } from '../model/colors';
import { STICKERS } from '../model/facelets';
import type { Move } from '../model/moves';

const NS = 'http://www.w3.org/2000/svg';
const R = 0.4;
const MAX_PULL = 1.3; // насколько далеко вершину можно оттянуть (в шагах)
const TRAIL_SEGMENTS = 18;
const TRAIL_ANGLE = 1.7; // длина хвоста (рад) вдоль окружности

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

export class GraphView implements MoveView {
  private svg = el('svg', { viewBox: VIEWBOX, preserveAspectRatio: 'xMidYMid meet' });
  private nodes: SVGCircleElement[] = [];
  private floating = el('g');
  private trail = el('g');
  private colors: number[] = STICKERS.map(() => 0);
  private drag: { slot: number; sx: number; sy: number } | null = null;

  constructor(
    host: HTMLElement,
    private request: (m: Move) => void,
  ) {
    // Дорожки: окружности всех девяти слоёв, по ним вершины ездят при поворотах.
    const tracks = el('g');
    for (const axis of [0, 1, 2]) {
      for (const layer of [-1, 0, 1]) {
        const { c, r } = circleOf(axis, layer);
        tracks.appendChild(el('circle', { cx: c[0], cy: c[1], r, class: 'track' }));
      }
    }
    for (let i = 0; i < TRAIL_SEGMENTS; i++) {
      this.trail.appendChild(el('path', { class: 'trail', opacity: Math.pow((i + 1) / TRAIL_SEGMENTS, 1.6) * 0.9 }));
    }

    const nodes = el('g');
    for (const s of STICKERS) {
      const [cx, cy] = nodePosition(s.index);
      const c = el('circle', { cx, cy, r: R, class: 'node' });
      this.bind(c, s.index);
      this.nodes.push(c);
      nodes.appendChild(c);
    }
    this.svg.append(tracks, nodes, this.trail, this.floating);
    host.appendChild(this.svg);
  }

  sync(state: readonly number[]): void {
    this.colors = [...state];
    this.nodes.forEach((n, i) => {
      n.setAttribute('fill', FACE_COLORS[state[i]]);
      n.style.visibility = 'visible';
    });
  }

  // Вершины слоя едут по своим кольцам, за первой тянется тёмный хвост.
  animate(move: Move, ms: number): Promise<void> {
    const tracks = tracksFor(move.axis, move.layer);
    const flyers = motionsFor(move).map((m) => {
      const c = el('circle', { r: R, class: 'node', fill: FACE_COLORS[this.colors[m.slot]] });
      this.floating.appendChild(c);
      this.nodes[m.slot].style.visibility = 'hidden';
      return { c, at: m.at };
    });
    const mainStep = move.turns === 3 ? -3 : move.turns * 3;
    // Хвост тянется за узлом основного кольца, которому ехать дальше всех.
    const main = tracks[0];
    let lead = 0;
    for (let i = 0; i < main.slots.length; i++) {
      if (Math.abs(phiAt(main, i + mainStep) - phiAt(main, i)) > Math.abs(phiAt(main, lead + mainStep) - phiAt(main, lead))) lead = i;
    }
    const from = phiAt(main, lead);
    const span = phiAt(main, lead + mainStep) - from;
    const trailPaths = Array.from(this.trail.children) as SVGPathElement[];

    return tween(ms, (k) => {
      for (const f of flyers) {
        const [x, y] = f.at(k);
        f.c.setAttribute('cx', String(x));
        f.c.setAttribute('cy', String(y));
      }
      const head = from + span * k;
      const tail = from + Math.sign(span) * Math.max(0, Math.abs(span * k) - TRAIL_ANGLE);
      trailPaths.forEach((p, j) => {
        const a = tail + ((head - tail) * j) / TRAIL_SEGMENTS;
        const b = tail + ((head - tail) * (j + 1)) / TRAIL_SEGMENTS;
        p.setAttribute('d', Math.abs(b - a) < 1e-6 ? '' : arcPath(main, a, b));
      });
    }).then(() => {
      this.floating.replaceChildren();
      trailPaths.forEach((p) => p.setAttribute('d', ''));
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
