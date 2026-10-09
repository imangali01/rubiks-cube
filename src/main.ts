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
let cube: CubeView | undefined;
try {
  cube = new CubeView(cubeHost, request);
  views.push(cube);
} catch {
  cubeHost.textContent = 'WebGL недоступен';
  cubeHost.style.cssText = 'display:grid;place-items:center;opacity:.6';
}
views.push(new GraphView(graphHost, request));
player = new Player(views);

window.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (e.key === 'ArrowLeft' || (mod && !e.shiftKey && e.key.toLowerCase() === 'z')) return void player.undo();
  if (e.key === 'ArrowRight' || (mod && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z')))) {
    return void player.redo();
  }
  if (mod || e.altKey) return;
  const k = e.key.toUpperCase();
  if (k.length !== 1 || !'URFDLB'.includes(k)) return;
  player.enqueue(parseMove(k + (e.shiftKey ? "'" : '')));
});

document.getElementById('scramble')!.onclick = () => player.scramble();
document.getElementById('reset')!.onclick = () => void player.reset();
const backButton = document.getElementById('back') as HTMLButtonElement;
const forwardButton = document.getElementById('forward') as HTMLButtonElement;
backButton.onclick = () => player.undo();
forwardButton.onclick = () => player.redo();
const updateSteps = () => {
  backButton.disabled = !player.canUndo;
  forwardButton.disabled = !player.canRedo;
};
player.onChange = updateSteps;
updateSteps();

const size = document.getElementById('size') as HTMLInputElement;
const applySize = () => {
  document.documentElement.style.setProperty('--s', String(+size.value / 100));
  try {
    localStorage.setItem('size', size.value);
  } catch {}
};
try {
  size.value = localStorage.getItem('size') ?? size.value;
} catch {}
size.oninput = applySize;
applySize();

// По умолчанию тёмная тема; выбор пользователя запоминается, ?theme=light|dark его переопределяет.
let dark = true;
try {
  dark = localStorage.getItem('theme') !== 'light';
} catch {}
const forced = new URLSearchParams(location.search).get('theme');
if (forced) dark = forced === 'dark';
const themeButton = document.getElementById('theme')!;
const applyTheme = () => {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  themeButton.textContent = dark ? 'светлая тема' : 'тёмная тема';
  cube?.setTheme(dark);
  try {
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  } catch {}
};
themeButton.onclick = () => {
  dark = !dark;
  applyTheme();
};
applyTheme();
