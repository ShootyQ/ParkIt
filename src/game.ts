export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };
export type State =
  | "waiting"
  | "driving-in"
  | "parked"
  | "requesting-departure"
  | "reversing"
  | "driving-out"
  | "crashed";
export type Spot = Rect & { id: number };
export type Car = {
  id: number;
  x: number;
  y: number;
  angle: number;
  color: string;
  state: State;
  route: Point[];
  index: number;
  spot?: number;
  timer: number;
  wait: number;
  gear: number;
  pause: number;
};
export const CAR_SCALE = 1.15;
export const W = 1440,
  H = 900,
  CAR_L = 62 * CAR_SCALE,
  CAR_W = 34 * CAR_SCALE;
export const spots: Spot[] = Array.from({ length: 16 }, (_, i) => ({
  id: i,
  x: 300 + (i % 8) * 100,
  y: i < 8 ? 228 : 518,
  w: 90,
  h: 140,
}));
export const obstacles: Rect[] = [
  { x: 0, y: 0, w: 1440, h: 187 },
  { x: 245, y: 218, w: 35, h: 150 },
  { x: 1110, y: 218, w: 40, h: 150 },
  { x: 245, y: 518, w: 35, h: 150 },
  { x: 1110, y: 518, w: 40, h: 150 },
];
// Viewport projection expands the aisles while keeping vehicles proportional.
let projectionAspect = 1;
export function setProjectionAspect(ratio: number) {
  projectionAspect = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
}
export function projectedHeading(angle: number) {
  return Math.atan2(Math.sin(angle), projectionAspect * Math.cos(angle));
}
export const distance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y);
export const angleDiff = (a: number, b: number) =>
  Math.atan2(Math.sin(a - b), Math.cos(a - b));
export function corners(p: Point, a: number, pad = 0): Point[] {
  a = projectedHeading(a);
  return [
    [-CAR_L / 2 - pad, -CAR_W / 2 - pad],
    [CAR_L / 2 + pad, -CAR_W / 2 - pad],
    [CAR_L / 2 + pad, CAR_W / 2 + pad],
    [-CAR_L / 2 - pad, CAR_W / 2 + pad],
  ].map(([x, y]) => ({
    x: p.x + (x * Math.cos(a) - y * Math.sin(a)) / projectionAspect,
    y: p.y + x * Math.sin(a) + y * Math.cos(a),
  }));
}
export function overlap(a: Point[], b: Point[]): boolean {
  for (const poly of [a, b])
    for (let i = 0; i < poly.length; i++) {
      const q = poly[i],
        r = poly[(i + 1) % poly.length],
        n = { x: -(r.y - q.y), y: r.x - q.x };
      const aa = a.map((p) => p.x * n.x + p.y * n.y),
        bb = b.map((p) => p.x * n.x + p.y * n.y);
      if (
        Math.max(...aa) < Math.min(...bb) ||
        Math.max(...bb) < Math.min(...aa)
      )
        return false;
    }
  return true;
}
export const rectPoints = (r: Rect): Point[] => [
  { x: r.x, y: r.y },
  { x: r.x + r.w, y: r.y },
  { x: r.x + r.w, y: r.y + r.h },
  { x: r.x, y: r.y + r.h },
];
export function smooth(points: Point[]): Point[] {
  if (points.length < 2) return points;
  let p = points;
  for (let k = 0; k < 2; k++) {
    const n = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      n.push(
        {
          x: 0.75 * p[i].x + 0.25 * p[i + 1].x,
          y: 0.75 * p[i].y + 0.25 * p[i + 1].y,
        },
        {
          x: 0.25 * p[i].x + 0.75 * p[i + 1].x,
          y: 0.25 * p[i].y + 0.75 * p[i + 1].y,
        },
      );
    }
    n.push(p[p.length - 1]);
    p = n;
  }
  const out = [p[0]];
  for (let i = 1; i < p.length; i++) {
    const a = out[out.length - 1],
      b = p[i],
      steps = Math.ceil(distance(a, b) / 5);
    for (let j = 1; j <= steps; j++)
      out.push({
        x: a.x + ((b.x - a.x) * j) / steps,
        y: a.y + ((b.y - a.y) * j) / steps,
      });
  }
  return out;
}
export function parkingSpot(p: Point, a: number): Spot | undefined {
  return spots.find(
    (s) =>
      Math.abs(angleDiff(a, s.id < 8 ? -Math.PI / 2 : Math.PI / 2)) <=
        Math.PI / 12 &&
      corners(p, a).every(
        (c) =>
          c.x > s.x + 3 &&
          c.x < s.x + s.w - 3 &&
          c.y > s.y + 3 &&
          c.y < s.y + s.h - 3,
      ),
  );
}
export function validate(
  car: Car,
  raw: Point[],
  cars: Car[],
): { error?: string; path: Point[]; spot?: number; gear: number } {
  const depart = car.state === "requesting-departure";
  let path = smooth(raw),
    gear = -1;
  if (depart) {
    const enter = raw.findIndex((p) => p.y > 405 && p.y < 480);
    if (enter >= 0) {
      let pivot = enter;
      const sign = car.y < 443 ? 1 : -1;
      while (
        pivot + 1 < raw.length &&
        (raw[pivot + 1].y - raw[pivot].y) * sign > 0
      )
        pivot++;
      const back = smooth(raw.slice(0, pivot + 1)),
        forward = smooth(raw.slice(pivot));
      gear = back.length - 1;
      path = [...back, ...forward.slice(1)];
    }
  }
  if (path.length < 3 || distance(path[0], path[path.length - 1]) < 15)
    return { error: "Draw a complete route.", path, gear };
  if (depart) {
    if (gear < 0)
      return { error: "Reverse into the center aisle first.", path, gear };
    if (path[path.length - 1].x < 1270 || path[path.length - 1].y < 730)
      return { error: "Finish at the EXIT arrow.", path, gear };
  }
  const end = path[path.length - 1],
    prev = path[path.length - 2],
    heading = Math.atan2(end.y - prev.y, end.x - prev.x),
    spot = depart ? undefined : parkingSpot(end, heading);
  if (!depart && !spot)
    return { error: "Finish inside a space, facing into it.", path, gear };
  if (spot && cars.some((c) => c.id !== car.id && c.spot === spot.id))
    return { error: "That space is already reserved.", path, gear };
  let previous = car.angle;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i],
      d = distance(a, b);
    if (d < 0.01) continue;
    let angle = Math.atan2(b.y - a.y, b.x - a.x);
    if (depart && i <= gear) angle += Math.PI;
    if (
      !(depart && Math.abs(i - gear) <= 3) &&
      Math.abs(angleDiff(angle, previous)) > Math.max(0.16, d / 18 + 0.06)
    )
      return { error: "Too sharp! Draw a wider turn.", path, gear };
    previous = angle;
    const box = corners(b, angle);
    if (
      box.some((p) => p.x < 35 || p.x > 1415 || p.y < 190 || p.y > 865) ||
      obstacles.some((r) => overlap(box, rectPoints(r)))
    )
      return { error: "Watch the curb — give your car some room.", path, gear };
    if (
      cars.some(
        (c) =>
          c.id !== car.id &&
          ["parked", "requesting-departure"].includes(c.state) &&
          overlap(box, corners(c, c.angle)),
      )
    )
      return { error: "There’s a parked car in the way.", path, gear };
  }
  return { path, spot: spot?.id, gear };
}
export class Game {
  cars: Car[] = [];
  score = 0;
  lives = 3;
  exits = 0;
  time = 0;
  spawnTimer = 2;
  nextId = 1;
  over = false;
  paused = false;
  events: string[] = [];
  tutorial = false;
  get level() {
    return 1 + Math.floor(this.exits / 5);
  }
  spawn() {
    if (this.cars.filter((c) => c.state === "waiting").length >= 3) {
      this.mistake("Entrance backed up!");
      return;
    }
    const n =
      [0, 1, 2].find(
        (i) =>
          !this.cars.some(
            (c) => c.state === "waiting" && Math.abs(c.y - (614 + i * 78)) < 60,
          ),
      ) ?? 0;
    this.cars.push({
      id: this.nextId++,
      x: 150,
      y: 614 + n * 78,
      angle: -Math.PI / 2,
      color: ["#e7ab53", "#9cbfbd", "#df735d", "#b2a5cf", "#d5ded0"][
        this.nextId % 5
      ],
      state: "waiting",
      route: [],
      index: 1,
      timer: 30,
      wait: 0,
      gear: -1,
      pause: 0,
    });
  }
  mistake(message: string) {
    this.lives = Math.max(0, this.lives - 1);
    this.events.push(message);
    if (!this.lives) this.over = true;
  }
  commit(car: Car, raw: Point[]) {
    const v = validate(car, raw, this.cars);
    if (v.error) return v.error;
    car.route = v.path;
    car.index = 1;
    car.gear = v.gear;
    car.spot = v.spot ?? car.spot;
    car.state =
      car.state === "requesting-departure" ? "reversing" : "driving-in";
    return undefined;
  }
  update(dt: number) {
    if (this.paused || this.over) return;
    this.time += dt;
    if (!this.tutorial) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawn();
        this.spawnTimer = Math.max(3, 8 - Math.floor(this.exits / 5) * 0.5);
      }
    }
    for (const c of [...this.cars]) {
      if (c.state === "waiting" || c.state === "requesting-departure") {
        if (!this.tutorial) c.timer -= dt;
        if (c.timer <= 0) {
          this.mistake("A driver ran out of patience.");
          this.remove(c);
        }
        continue;
      }
      if (c.state === "parked") {
        c.wait -= dt;
        if (c.wait <= 0) {
          c.state = "requesting-departure";
          c.timer = 30;
          this.events.push("Reverse lights! Draw this car to the exit.");
        }
        continue;
      }
      if (c.state === "crashed") {
        c.timer -= dt;
        if (c.timer <= 0) this.remove(c);
        continue;
      }
      if (c.pause > 0) {
        c.pause -= dt;
        continue;
      }
      let travel = (c.state === "reversing" ? 55 : 90) * dt;
      while (travel > 0 && c.index < c.route.length) {
        const target = c.route[c.index],
          d = distance(c, target);
        const a = Math.atan2(target.y - c.y, target.x - c.x);
        c.angle = a + (c.state === "reversing" ? Math.PI : 0);
        if (d <= travel) {
          c.x = target.x;
          c.y = target.y;
          travel -= d;
          c.index++;
          if (c.state === "reversing" && c.index > c.gear) {
            c.state = "driving-out";
            c.pause = 0.45;
            travel = 0;
          }
        } else {
          c.x += ((target.x - c.x) / d) * travel;
          c.y += ((target.y - c.y) / d) * travel;
          travel = 0;
        }
      }
      if (c.index >= c.route.length) {
        if (c.state === "driving-in") {
          c.state = "parked";
          c.wait = this.tutorial ? 3 : 15 + Math.random() * 10;
          this.score += 100;
          this.events.push("Perfectly parked. +100");
        } else {
          this.score += 150;
          this.exits++;
          this.remove(c);
          this.events.push("Safe travels! +150");
        }
      }
    }
    const active = this.cars.filter((c) => c.state !== "crashed");
    const hit = new Set<Car>();
    for (let i = 0; i < active.length; i++)
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i],
          b = active[j];
        if (
          !["driving-in", "reversing", "driving-out"].includes(a.state) &&
          !["driving-in", "reversing", "driving-out"].includes(b.state)
        )
          continue;
        if (
          distance(a, b) < 70 &&
          overlap(corners(a, a.angle), corners(b, b.angle))
        ) {
          hit.add(a);
          hit.add(b);
        }
      }
    if (hit.size) {
      for (const c of hit) {
        c.state = "crashed";
        c.timer = 1;
        c.spot = undefined;
      }
      this.mistake("Bumper meeting. Keep an eye on crossing routes!");
    }
  }
  remove(c: Car) {
    this.cars = this.cars.filter((v) => v !== c);
  }
}
