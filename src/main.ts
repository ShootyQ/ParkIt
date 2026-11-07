import "./style.css";
import {
  Game,
  W,
  H,
  spots,
  obstacles,
  corners,
  distance,
  validate,
  type Car,
  type Point,
} from "./game";
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `<header><a class="brand" href="./"><span class="brand-icon">P<span>↗</span></span>park<span class="brand-light">it.</span></a><span class="tagline">A LITTLE LOT. A LOT GOING ON.</span><div class="header-right"><span class="live-dot"></span> OPEN FOR BUSINESS <button id="sound" aria-label="Toggle sound">♪</button></div></header><main><section class="title-row"><div><div class="eyebrow">THE EVERYDAY, SLIGHTLY MORE CHAOTIC</div><h1>Your lot. Your rules.<span> Mostly.</span></h1></div><button id="help" class="text-button">↗ How to play</button></section><section class="game-shell"><div class="toolbar"><div class="stats"><div><small>TODAY’S SCORE</small><strong id="score">0000</strong></div><div><small>PERSONAL BEST</small><strong id="best">0000</strong></div><div class="traffic"><small>TRAFFIC LEVEL</small><strong><span id="level">01</span><i>▂ ▄ ▆</i></strong></div></div><div class="tools"><span id="lives" aria-label="3 lives">♥ ♥ ♥</span><button id="fullscreen" aria-label="Enter fullscreen">⛶</button><button id="pause" aria-label="Pause game">Ⅱ</button><button id="restart" aria-label="Restart game">↻</button></div></div><div class="canvas-wrap"><canvas aria-label="Parking lot. Draw from a car to an empty space." width="1440" height="900"></canvas><div id="overlay"></div><div id="toast" role="status"></div><div class="lot-label">NORTHSIDE PLAZA <span>•</span> LOT 01</div></div><div class="game-footer"><span><b class="green-dot"></b> <span id="hint">Grab a car. Draw a route. Try not to meet the neighbors.</span></span><span class="weather">☀ 72° &nbsp; A GOOD DAY TO PARK</span></div></section><footer><div><span class="key">01</span> DRAW A PATH <span class="line"></span><span class="key">02</span> NAIL THE PARK <span class="line"></span><span class="key">03</span> GET THEM HOME</div><span>Made for a little organized chaos. <b>✳</b></span></footer></main><div class="rotate"><span>↻</span><h2>A little more room to maneuver.</h2><p>Turn your phone sideways to play ParkIt.</p></div>`;
const canvas = document.querySelector("canvas")!,
  ctx = canvas.getContext("2d")!,
  overlay = document.querySelector<HTMLDivElement>("#overlay")!,
  toast = document.querySelector<HTMLDivElement>("#toast")!;
let game = new Game(),
  selected: Car | undefined,
  draw: Point[] = [],
  hover: Point | undefined,
  started = false,
  tutorial = false,
  best = Number(read("best") || 0),
  muted = read("muted") === "true",
  audio: AudioContext | undefined,
  toastUntil = 0,
  tutorialStep = 0;
function read(k: string) {
  try {
    return localStorage.getItem("parkit-" + k);
  } catch {
    return null;
  }
}
function save(k: string, v: string) {
  try {
    localStorage.setItem("parkit-" + k, v);
  } catch {
    /* storage is optional */
  }
}
function sound(freq = 600) {
  if (muted) return;
  try {
    audio ??= new AudioContext();
    void audio.resume();
    const o = audio.createOscillator(),
      g = audio.createGain();
    o.connect(g);
    g.connect(audio.destination);
    o.frequency.setValueAtTime(freq, audio.currentTime);
    o.frequency.exponentialRampToValueAtTime(
      freq / 2,
      audio.currentTime + 0.12,
    );
    g.gain.setValueAtTime(0.04, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.16);
    o.start();
    o.stop(audio.currentTime + 0.17);
  } catch {
    /* audio is optional */
  }
}
function notify(s: string) {
  toast.textContent = s;
  toastUntil = performance.now() + 3500;
  toast.classList.add("show");
}
function show(title: string, body: string, button: string, action: () => void) {
  overlay.innerHTML = `<div class="modal"><div class="eyebrow">WELCOME TO YOUR LITTLE EMPIRE</div><h2>${title}</h2><p>${body}</p><button class="primary">${button} <span>↗</span></button>${!started ? '<button class="skip">Skip tutorial →</button>' : ""}</div>`;
  overlay.classList.add("visible");
  overlay.querySelector(".primary")!.addEventListener("click", action);
  overlay.querySelector(".skip")?.addEventListener("click", () => start(false));
}
type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element;
  webkitExitFullscreen?: () => void;
};
type FullscreenRoot = HTMLElement & { webkitRequestFullscreen?: () => void };
const fullscreenDoc = document as FullscreenDocument;
const fullscreenRoot = document.documentElement as FullscreenRoot;
function isFullscreen() {
  return Boolean(
    document.fullscreenElement || fullscreenDoc.webkitFullscreenElement,
  );
}
function updateFullscreenButton() {
  const active =
    isFullscreen() || document.body.classList.contains("immersive");
  document
    .querySelector("#fullscreen")!
    .setAttribute(
      "aria-label",
      active ? "Exit fullscreen" : "Enter fullscreen",
    );
}
function enterFullscreen() {
  document.body.classList.add("immersive");
  updateFullscreenButton();
  if (isFullscreen()) return;
  try {
    if (fullscreenRoot.requestFullscreen) {
      void fullscreenRoot.requestFullscreen().catch(() => {
        // Some mobile browsers allow only the viewport-filling layout.
      });
    } else {
      fullscreenRoot.webkitRequestFullscreen?.();
    }
  } catch {
    // Keep the viewport-filling layout when browser fullscreen is unavailable.
  }
}
function fullscreenChanged() {
  if (!isFullscreen()) document.body.classList.remove("immersive");
  updateFullscreenButton();
}
document.addEventListener("fullscreenchange", fullscreenChanged);
document.addEventListener("webkitfullscreenchange", fullscreenChanged);
document.querySelector("#fullscreen")!.addEventListener("click", () => {
  if (isFullscreen()) {
    if (document.exitFullscreen) void document.exitFullscreen().catch(() => {});
    else fullscreenDoc.webkitExitFullscreen?.();
  } else if (document.body.classList.contains("immersive")) {
    document.body.classList.remove("immersive");
    updateFullscreenButton();
  } else enterFullscreen();
});
function start(teach: boolean) {
  enterFullscreen();
  game = new Game();
  started = true;
  tutorial = teach;
  tutorialStep = 0;
  game.tutorial = teach;
  game.spawn();
  game.spawnTimer = 8;
  toast.classList.remove("show");
  toastUntil = 0;
  overlay.classList.remove("visible");
  draw = [];
  selected = undefined;
  sync();
  if (teach)
    notify(
      "01 / Draw from the car, up the left aisle, then into any space. Finish facing in.",
    );
  sound();
}
function sync() {
  document.querySelector("#score")!.textContent = String(game.score).padStart(
    4,
    "0",
  );
  document.querySelector("#best")!.textContent = String(best).padStart(4, "0");
  document.querySelector("#level")!.textContent = String(game.level).padStart(
    2,
    "0",
  );
  document.querySelector("#lives")!.textContent =
    "♥ ".repeat(game.lives) + "♡ ".repeat(3 - game.lives);
  document
    .querySelector("#lives")!
    .setAttribute("aria-label", `${game.lives} lives`);
  document.querySelector("#pause")!.textContent = game.paused ? "▶" : "Ⅱ";
  document.querySelector("#sound")!.textContent = muted ? "♪̸" : "♪";
}
function pause() {
  if (!started || game.over) return;
  game.paused = !game.paused;
  if (game.paused)
    show(
      "Take a breather.",
      "Your drivers can wait. The lot is paused.",
      "Back to the lot",
      () => {
        game.paused = false;
        overlay.classList.remove("visible");
        sync();
      },
    );
  else overlay.classList.remove("visible");
  sync();
}
document.querySelector("#pause")!.addEventListener("click", pause);
document
  .querySelector("#restart")!
  .addEventListener("click", () => start(false));
document.querySelector("#sound")!.addEventListener("click", () => {
  muted = !muted;
  save("muted", String(muted));
  sync();
  if (!muted) sound();
});
document.querySelector("#help")!.addEventListener("click", () => {
  game.paused = true;
  show(
    "A little parking practice.",
    "Draw the entire route into a space. Wide turns work best. When reverse lights blink, draw backward into the center aisle, then forward to the exit. Crossing traffic is your responsibility.",
    "Try the tutorial",
    () => start(true),
  );
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && !game.paused && started && !game.over) pause();
  if (document.hidden) void audio?.suspend();
});
document.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    pause();
  }
  if (e.key === "Escape") {
    draw = [];
    selected = undefined;
  }
});
function point(e: PointerEvent): Point {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) * W) / r.width,
    y: ((e.clientY - r.top) * H) / r.height,
  };
}
canvas.addEventListener("pointerdown", (e) => {
  if (!started || game.paused || game.over) return;
  const p = point(e);
  selected = game.cars.find(
    (c) =>
      ["waiting", "requesting-departure"].includes(c.state) &&
      distance(c, p) < 44,
  );
  if (selected) {
    draw = [{ x: selected.x, y: selected.y }];
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  }
});
canvas.addEventListener("pointermove", (e) => {
  hover = point(e);
  if (selected && distance(draw[draw.length - 1], hover) > 7) draw.push(hover);
});
canvas.addEventListener("pointerup", (e) => {
  if (!selected) return;
  const p = point(e);
  if (distance(draw[draw.length - 1], p) > 1) draw.push(p);
  const err = game.commit(selected, draw);
  if (err) {
    notify(err);
    sound(180);
  } else {
    sound(700);
    if (tutorial && tutorialStep === 0) {
      tutorialStep = 1;
      notify(
        "Nice! Watch the car park. Reverse lights will tell you when it’s ready to leave.",
      );
    }
  }
  draw = [];
  selected = undefined;
});
canvas.addEventListener("pointercancel", () => {
  draw = [];
  selected = undefined;
});
function rr(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
  stroke?: string,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
function text(
  s: string,
  x: number,
  y: number,
  size: number,
  color: string,
  font = "600",
) {
  ctx.fillStyle = color;
  ctx.font = `${font} ${size}px "Arial", sans-serif`;
  ctx.fillText(s, x, y);
}
function tree(x: number, y: number, r = 27) {
  ctx.fillStyle = "#0003";
  ctx.beginPath();
  ctx.ellipse(x + 8, y + 10, r + 3, r, 0, 0, 7);
  ctx.fill();
  for (const [dx, dy, sz, col] of [
    [0, 0, r, "#54765a"],
    [-9, -6, r * 0.7, "#648765"],
    [8, -9, r * 0.6, "#73936c"],
  ] as const) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x + dx, y + dy, sz, 0, 7);
    ctx.fill();
  }
}
function arrow(x: number, y: number, a: number, color = "#c7cec080") {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.lineCap = "square";
  ctx.beginPath();
  ctx.moveTo(-21, 0);
  ctx.lineTo(21, 0);
  ctx.moveTo(8, -12);
  ctx.lineTo(21, 0);
  ctx.lineTo(8, 12);
  ctx.stroke();
  ctx.restore();
}
function line(path: Point[], color: string, dashed = false) {
  if (path.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y);
  for (const p of path) ctx.lineTo(p.x, p.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.setLineDash(dashed ? [9, 9] : []);
  ctx.stroke();
  ctx.setLineDash([]);
}
function car(c: Car, ghost = false) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.angle);
  ctx.globalAlpha = ghost ? 0.45 : 1;
  rr(-29, -12, 64, 32, 9, "#0004");
  rr(-31, -17, 62, 34, 8, c.state === "crashed" ? "#625c55" : c.color);
  rr(-12, -13, 27, 26, 5, "#273c40");
  rr(-9, -12, 18, 24, 4, c.color);
  ctx.fillStyle = "#bcd9d3";
  ctx.fillRect(13, -11, 6, 22);
  ctx.fillStyle = "#455858";
  ctx.fillRect(-18, -11, 5, 22);
  ctx.fillStyle = "#fff3bd";
  ctx.fillRect(25, -12, 5, 7);
  ctx.fillRect(25, 5, 5, 7);
  const reversing =
    c.state === "reversing" ||
    (c.state === "requesting-departure" && Math.sin(game.time * 6) > 0);
  ctx.fillStyle = reversing ? "#fff9db" : "#bb564b";
  ctx.fillRect(-31, -12, 4, 7);
  ctx.fillRect(-31, 5, 4, 7);
  ctx.fillStyle = "#263735";
  ctx.fillRect(-20, -20, 12, 4);
  ctx.fillRect(13, -20, 12, 4);
  ctx.fillRect(-20, 16, 12, 4);
  ctx.fillRect(13, 16, 12, 4);
  ctx.restore();
  if (["waiting", "requesting-departure"].includes(c.state)) {
    const y = c.y - 45;
    rr(c.x - 24, y, 48, 5, 3, "#ffffff20");
    rr(
      c.x - 24,
      y,
      (48 * Math.max(0, c.timer)) / 30,
      5,
      3,
      c.timer < 10 ? "#ee8b66" : "#c9dd96",
    );
    if (c.state === "requesting-departure")
      text("↶", c.x - 7, y - 9, 22, "#f9e9ab");
  }
}
// Seeded grain stays still between frames.
const grain = document.createElement("canvas");
grain.width = W;
grain.height = H;
const gc = grain.getContext("2d")!;
let seed = 47;
for (let i = 0; i < 20000; i++) {
  seed = (seed * 16807) % 2147483647;
  const x = seed % W;
  seed = (seed * 16807) % 2147483647;
  gc.fillStyle = i % 2 ? "#ffffff07" : "#0000000b";
  gc.fillRect(x, seed % H, 2, 2);
}
function render() {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#414b49";
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(grain, 0, 0);
  rr(22, 198, 1396, 675, 28, "#00000000", "#b7bd9e35");
  // Store frontage and pedestrian apron.
  ctx.fillStyle = "#c9c7ad";
  ctx.fillRect(0, 120, W, 65);
  ctx.fillStyle = "#9eaa92";
  ctx.fillRect(0, 182, W, 7);
  rr(96, -12, 1248, 139, 9, "#dbd5bb");
  ctx.fillStyle = "#bfbba3";
  ctx.fillRect(96, 115, 1248, 12);
  for (let i = 0; i < 12; i++) rr(125 + i * 100, 26, 76, 69, 2, "#647874");
  rr(537, -5, 366, 100, 5, "#263e36");
  text("NORTHSIDE", 588, 43, 33, "#f2ebd3", "800");
  text("G O O D S  &  G R O C E R I E S", 575, 71, 11, "#c9d2b7");
  rr(654, 108, 133, 19, 2, "#344c45");
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = "#f3e9cd";
    ctx.fillRect(662 + i * 14, 143, 8, 37);
  }
  text("SLOW · PEDESTRIAN CROSSING", 845, 162, 11, "#687565");
  for (const s of spots) {
    const occupied = game.cars.some((c) => c.spot === s.id);
    ctx.strokeStyle = "#d8dac38c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const open = s.id < 8 ? s.y + s.h : s.y;
    ctx.moveTo(s.x, open);
    ctx.lineTo(s.x, s.id < 8 ? s.y : s.y + s.h);
    ctx.lineTo(s.x + s.w, s.id < 8 ? s.y : s.y + s.h);
    ctx.lineTo(s.x + s.w, open);
    ctx.stroke();
    text(
      String(s.id + 1).padStart(2, "0"),
      s.x + 35,
      s.id < 8 ? s.y + 21 : s.y + s.h - 12,
      11,
      "#d5dbc25c",
    );
    if (!occupied) {
      ctx.fillStyle = "#c8d7ad35";
      ctx.beginPath();
      ctx.arc(s.x + 45, s.y + 70, 3, 0, 7);
      ctx.fill();
    }
  }
  for (const o of obstacles.slice(1)) {
    rr(o.x + 3, o.y + 4, o.w, o.h, 15, "#0003");
    rr(o.x, o.y, o.w, o.h, 14, "#b8bca2");
    rr(o.x + 5, o.y + 5, o.w - 10, o.h - 10, 10, "#6c7e5e");
    tree(o.x + o.w / 2, o.y + 35, 22);
    tree(o.x + o.w / 2, o.y + 108, 20);
  }
  arrow(150, 435, -Math.PI / 2);
  arrow(520, 443, 0);
  arrow(930, 443, 0);
  arrow(1260, 440, Math.PI / 2);
  arrow(1200, 778, 0);
  arrow(150, 814, -Math.PI / 2, "#b7d8bb");
  text("ENTRY", 111, 859, 16, "#b7d8bb");
  text("EXIT", 1281, 837, 16, "#e2c787");
  arrow(1335, 778, 0, "#e2c787");
  ctx.setLineDash([12, 16]);
  ctx.strokeStyle = "#b8bd9d40";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(230, 725);
  ctx.lineTo(1200, 725);
  ctx.stroke();
  ctx.setLineDash([]);
  text("KEEP IT MOVING. KEEP IT KIND.", 510, 815, 16, "#d8dbc348");
  // Edge landscaping, cart return, light poles.
  for (const x of [50, 1390]) for (const y of [250, 600]) tree(x, y, 30);
  rr(45, 50, 25, 90, 4, "#9bada0");
  tree(50, 75, 32);
  rr(1195, 228, 105, 115, 5, "#374440", "#859286");
  text("CARTS", 1219, 250, 12, "#c4ccb8");
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = "#aab9ad";
    ctx.strokeRect(1215, 267 + i * 14, 43, 23);
  }
  for (const [x, y] of [
    [210, 215],
    [1180, 685],
  ]) {
    ctx.strokeStyle = "#0004";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 55, y + 55);
    ctx.stroke();
    ctx.fillStyle = "#c3c7b2";
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, 7);
    ctx.fill();
    rr(x - 17, y - 4, 34, 8, 3, "#d9ddca");
  }
  for (const c of game.cars)
    if (["driving-in", "reversing", "driving-out"].includes(c.state))
      line([{ x: c.x, y: c.y }, ...c.route.slice(c.index)], "#b9d3b755", true);
  for (const c of game.cars) car(c);
  if (selected && draw.length > 1) {
    const v = validate(selected, draw, game.cars);
    line(v.path, v.error ? "#f1c480" : "#c6e5a9");
    const p = v.path[v.path.length - 1],
      q = v.path[v.path.length - 2];
    car(
      {
        ...selected,
        ...p,
        angle: Math.atan2(p.y - q.y, p.x - q.x),
        state: "parked",
      },
      true,
    );
    if (v.gear >= 0) {
      const g = v.path[v.gear];
      rr(g.x - 16, g.y - 16, 32, 32, 16, "#eed79e");
      text("D", g.x - 6, g.y + 6, 16, "#344b3c");
    }
  }
  if (
    hover &&
    !selected &&
    game.cars.some(
      (c) =>
        ["waiting", "requesting-departure"].includes(c.state) &&
        distance(c, hover!) < 44,
    )
  )
    canvas.style.cursor = "grab";
  else canvas.style.cursor = selected ? "crosshair" : "default";
}
let previous = performance.now(),
  accumulator = 0;
function frame(now: number) {
  accumulator += Math.min((now - previous) / 1000, 0.1);
  previous = now;
  while (accumulator >= 1 / 60) {
    if (started) game.update(1 / 60);
    accumulator -= 1 / 60;
  }
  while (game.events.length) {
    const event = game.events.shift()!;
    notify(event);
    sound(event.includes("+") ? 800 : 240);
  }
  if (game.score > best) {
    best = game.score;
    save("best", String(best));
  }
  if (
    tutorial &&
    tutorialStep === 1 &&
    game.cars.some((c) => c.state === "requesting-departure")
  ) {
    tutorialStep = 2;
    notify(
      "02 / Draw backward to the center aisle, then forward to the EXIT at bottom right.",
    );
  }
  if (tutorial && game.exits > 0) {
    tutorial = false;
    game.tutorial = false;
    save("tutorial", "done");
    notify("You’ve got this! The lot is open.");
    game.spawnTimer = 2;
  }
  if (game.over && !overlay.classList.contains("visible")) {
    show(
      "That’s a wrap.",
      `${game.score} points · ${game.exits} happy departures. Your next shift has your name on it.`,
      "One more shift",
      () => start(false),
    );
  }
  if (now > toastUntil) toast.classList.remove("show");
  sync();
  render();
  requestAnimationFrame(frame);
}
show(
  "Small lot. Big responsibility.",
  "Draw a path to park each car. Watch for reverse lights. Get everyone home in one piece. You’ve got this.",
  "Let’s park",
  () => start(read("tutorial") !== "done"),
);
sync();
requestAnimationFrame(frame);
