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
export type Car = Point & {
  id: number;
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
  reverse?: boolean[];
  credited?: boolean;
};
export const CAR_SCALE = 1.15;
export const W = 1440,
  H = 900,
  CAR_L = 62 * CAR_SCALE,
  CAR_W = 34 * CAR_SCALE;
let projectionAspect = 1;
export const spots: Spot[] = Array.from({ length: 16 }, (_, id) => ({
  id,
  x: 0,
  y: 0,
  w: 0,
  h: 0,
}));
export function setProjectionAspect(ratio: number) {
  projectionAspect = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  for (const s of spots) {
    s.w = (CAR_W + 12) / projectionAspect;
    s.h = CAR_L + 14;
    s.x = 345 + (s.id % 8) * 100 - s.w / 2;
    s.y = (s.id < 8 ? 298 : 588) - s.h / 2;
  }
}
setProjectionAspect(1);
export function projectedHeading(a: number) {
  return Math.atan2(Math.sin(a), projectionAspect * Math.cos(a));
}
export const obstacles: Rect[] = [
  { x: 0, y: 0, w: 1440, h: 187 },
  { x: 245, y: 218, w: 35, h: 150 },
  { x: 1110, y: 218, w: 40, h: 150 },
  { x: 245, y: 518, w: 35, h: 150 },
  { x: 1110, y: 518, w: 40, h: 150 },
];
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
      const p = poly[i],
        q = poly[(i + 1) % poly.length],
        n = { x: p.y - q.y, y: q.x - p.x };
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
/** Parking is an outcome of driving, never a prerequisite for accepting a line. */
export function parkingSpot(p: Point, a: number): Spot | undefined {
  return spots.find((s) =>
    corners(p, a).every(
      (c) =>
        c.x >= s.x - 1 &&
        c.x <= s.x + s.w + 1 &&
        c.y >= s.y - 1 &&
        c.y <= s.y + s.h + 1,
    ),
  );
}
/** Subdivide only. Preserve every drawn corner, crossing, turnaround and endpoint. */
export function smooth(points: Point[]): Point[] {
  if (!points.length) return [];
  const out = [{ ...points[0] }];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      steps = distance(a, b) < 1e-6 ? 0 : Math.ceil(distance(a, b) / 4);
    for (let j = 1; j <= steps; j++)
      out.push({
        x: a.x + ((b.x - a.x) * j) / steps,
        y: a.y + ((b.y - a.y) * j) / steps,
      });
  }
  return out;
}
export function validate(
  car: Car,
  raw: Point[],
  _cars: Car[],
): { error?: string; path: Point[]; gear: number; reverse: boolean[] } {
  const path = smooth([{ x: car.x, y: car.y }, ...raw]);
  if (path.length < 2)
    return {
      error: "Draw a line from the car to get moving.",
      path,
      gear: -1,
      reverse: [],
    };
  const reverse: boolean[] = [false];
  let heading = car.angle,
    gear = -1;
  for (let i = 1; i < path.length; i++) {
    const a = Math.atan2(path[i].y - path[i - 1].y, path[i].x - path[i - 1].x);
    const back =
      Math.abs(angleDiff(projectedHeading(a), projectedHeading(heading))) >
      Math.PI / 2 + 1e-6;
    reverse.push(back);
    heading = a + (back ? Math.PI : 0);
    if (i > 1 && reverse[i - 1] && !back && gear < 0) gear = i;
  }
  return { path, gear, reverse };
}
const moving = (c: Car) =>
  ["driving-in", "driving-out", "reversing"].includes(c.state);
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
    const waiting = this.cars.filter(
      (c) => c.state === "waiting" && !c.credited,
    );
    if (waiting.length >= 3) {
      this.mistake("Entrance backed up!");
      return;
    }
    const n =
      [0, 1, 2].find(
        (i) =>
          !this.cars.some((c) => distance(c, { x: 150, y: 614 + i * 78 }) < 70),
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
    if (car.state === "crashed") return "That car is out of action.";
    const plan = validate(car, raw, this.cars);
    if (plan.error) return plan.error;
    car.route = plan.path;
    car.reverse = plan.reverse;
    car.index = 1;
    car.gear = plan.gear;
    car.spot = undefined;
    car.pause = 0;
    car.state = plan.reverse[1]
      ? "reversing"
      : car.credited
        ? "driving-out"
        : "driving-in";
    return undefined;
  }
  private wallHit(c: Car) {
    const box = corners(c, c.angle);
    return (
      box.some((p) => p.x < 25 || p.x > 1415 || p.y < 190 || p.y > 875) ||
      obstacles.some((o) => overlap(box, rectPoints(o)))
    );
  }
  private finish(c: Car) {
    if (c.x >= 1270 && c.y >= 730) {
      if (c.credited) {
        this.score += 150;
        this.exits++;
        this.events.push("Safe travels! +150");
      } else this.events.push("Just passing through!");
      this.remove(c);
      return;
    }
    const spot = parkingSpot(c, c.angle);
    if (
      spot &&
      !this.cars.some((other) => other.id !== c.id && other.spot === spot.id)
    ) {
      c.spot = spot.id;
      c.state = "parked";
      c.wait = this.tutorial ? 3 : 15 + Math.random() * 10;
      if (!c.credited) {
        c.credited = true;
        this.score += 100;
        this.events.push("Nice parking! +100");
      }
    } else {
      c.state = "waiting";
      c.timer = 30;
      this.events.push("Stopped. Draw another line to keep going.");
    }
  }
  update(dt: number) {
    if (this.paused || this.over) return;
    // Bound movement steps even when a caller provides a long frame.
    while (dt > 1e-8 && !this.over && !this.paused) {
      const step = Math.min(dt, 1 / 60);
      this.step(step);
      dt -= step;
    }
  }
  private step(dt: number) {
    this.time += dt;
    if (!this.tutorial) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawn();
        this.spawnTimer = Math.max(3, 8 - Math.floor(this.exits / 5) * 0.5);
      }
    }
    const moved = new Set<number>();
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
          this.events.push("Reverse lights! Draw this car toward the exit.");
        }
        continue;
      }
      if (c.state === "crashed") {
        c.timer -= dt;
        if (c.timer <= 0) this.remove(c);
        continue;
      }
      if (!moving(c)) continue;
      moved.add(c.id);
      let time = dt;
      while (time > 1e-8 && c.index < c.route.length) {
        const target = c.route[c.index],
          d = distance(c, target);
        if (d < 1e-8) {
          c.index++;
          continue;
        }
        const back = c.reverse?.[c.index] ?? false;
        c.state = back
          ? "reversing"
          : c.credited
            ? "driving-out"
            : "driving-in";
        c.angle =
          Math.atan2(target.y - c.y, target.x - c.x) + (back ? Math.PI : 0);
        const speed = back ? 55 : 90,
          travel = Math.min(d, speed * time);
        c.x += ((target.x - c.x) / d) * travel;
        c.y += ((target.y - c.y) / d) * travel;
        time -= travel / speed;
        if (c.x >= 1370 && c.y >= 730 && target.x - c.x >= -1e-8) {
          this.finish(c);
          break;
        }
        if (this.wallHit(c)) {
          c.state = "crashed";
          c.timer = 1;
          c.spot = undefined;
          this.mistake("Crunch! That line met a curb.");
          break;
        }
        if (travel >= d - 1e-8) c.index++;
      }
    }
    const active = this.cars.filter((c) => c.state !== "crashed"),
      hit = new Set<Car>();
    for (let i = 0; i < active.length; i++)
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i],
          b = active[j];
        if (!moved.has(a.id) && !moved.has(b.id)) continue;
        if (overlap(corners(a, a.angle), corners(b, b.angle))) {
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
      this.mistake("Bumper meeting! Watch those crossing lines.");
    }
    for (const c of this.cars)
      if (moving(c) && c.index >= c.route.length) this.finish(c);
  }
  remove(c: Car) {
    this.cars = this.cars.filter((v) => v !== c);
  }
}
