import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { tween } from '../app/tween';
import type { MoveView } from '../app/player';
import { FACE_COLORS } from '../model/colors';
import { STICKERS, type Vec } from '../model/facelets';
import type { Move } from '../model/moves';

const DRAG_THRESHOLD = 10; // px

function roundedSquare(size: number, radius: number): THREE.ShapeGeometry {
  const h = size / 2;
  const r = radius;
  const shape = new THREE.Shape();
  shape.moveTo(-h + r, -h);
  shape.lineTo(h - r, -h);
  shape.quadraticCurveTo(h, -h, h, -h + r);
  shape.lineTo(h, h - r);
  shape.quadraticCurveTo(h, h, h - r, h);
  shape.lineTo(-h + r, h);
  shape.quadraticCurveTo(-h, h, -h, h - r);
  shape.lineTo(-h, -h + r);
  shape.quadraticCurveTo(-h, -h, -h + r, -h);
  return new THREE.ShapeGeometry(shape, 6);
}

interface Home {
  p: THREE.Vector3;
  q: THREE.Quaternion;
}

export class CubeView implements MoveView {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private bodyMat = new THREE.MeshStandardMaterial({ color: 0xeceae3, roughness: 0.55 });
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

    this.camera.position.set(6.2, 5.5, 8.8);
    this.camera.lookAt(0, 0, 0);
    this.scene.add(this.pivot);
    this.scene.add(new THREE.AmbientLight(0xffffff, 2.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(-3, 7, 5);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.4);
    fill.position.set(6, -2, 3);
    this.scene.add(fill);
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

  setTheme(dark: boolean): void {
    this.bodyMat.color.set(dark ? 0x1d1d1b : 0xeceae3);
  }

  sync(state: readonly number[]): void {
    this.stickers.forEach((m, i) => (m.material as THREE.MeshStandardMaterial).color.set(FACE_COLORS[state[i]]));
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

    const bodyGeo = new RoundedBoxGeometry(0.98, 0.98, 0.98, 4, 0.12);
    for (let x = -1; x <= 1; x++)
      for (let y = -1; y <= 1; y++)
        for (let z = -1; z <= 1; z++) {
          const mesh = new THREE.Mesh(bodyGeo, this.bodyMat);
          mesh.position.set(x, y, z);
          add(mesh, [x, y, z], { kind: 'body' });
        }

    const stickerGeo = roundedSquare(0.8, 0.15);
    const zAxis = new THREE.Vector3(0, 0, 1);
    for (const s of STICKERS) {
      const mesh = new THREE.Mesh(stickerGeo, new THREE.MeshStandardMaterial({ roughness: 0.35 }));
      const n = new THREE.Vector3(...s.normal);
      mesh.position.set(...s.pos).addScaledVector(n, 0.492);
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
    const normal = new THREE.Vector3(...s.normal);
    let best: { axis: 0 | 1 | 2; dot: number } | null = null;
    for (const axis of [0, 1, 2] as const) {
      if (s.normal[axis] !== 0) continue;
      const a = new THREE.Vector3();
      a.setComponent(axis, 1);
      const v = a.clone().cross(normal); // направление движения при +90°
      const sp = this.screenDir(new THREE.Vector3(...s.pos).addScaledVector(normal, 0.5), v);
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
