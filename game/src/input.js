// Keyboard and mouse state. main.js polls `keys` each frame; `pressed` fires once
// per physical key press so menus and car entry do not repeat.

export const keys = new Set();
export const pressed = new Set();
export const mouse = { x: 0, y: 0, down: false, clicked: false };

const CODE_MAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
  Space: 'brake',
  KeyE: 'enter',
  KeyM: 'mute',
  Escape: 'pause',
  KeyP: 'pause',
};

export function initInput(canvas) {
  window.addEventListener('keydown', (event) => {
    const name = CODE_MAP[event.code];
    if (!name) return;
    if (event.code === 'Space') event.preventDefault();
    if (!keys.has(name)) pressed.add(name);
    keys.add(name);
  });
  window.addEventListener('keyup', (event) => {
    const name = CODE_MAP[event.code];
    if (name) keys.delete(name);
  });
  window.addEventListener('blur', () => {
    keys.clear();
    mouse.down = false;
  });
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      mouse.down = true;
      mouse.clicked = true;
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
}

// Called at the end of each frame so `pressed` and `clicked` are one-shot.
export function endFrameInput() {
  pressed.clear();
  mouse.clicked = false;
}

export function isDown(name) {
  return keys.has(name);
}

export function wasPressed(name) {
  return pressed.has(name);
}
