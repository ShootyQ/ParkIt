import { describe, it, expect } from "vitest";
import {
  Game,
  CAR_L,
  CAR_W,
  obstacles,
  setProjectionAspect,
  parkingSpot,
  corners,
  overlap,
  rectPoints,
  smooth,
  validate,
  type Point,
} from "../src/game";
function inbound(): Point[] {
  const p: Point[] = [
    { x: 150, y: 614 },
    { x: 150, y: 533 },
  ];
  for (let i = 0; i <= 20; i++) {
    const a = Math.PI + ((i / 20) * Math.PI) / 2;
    p.push({ x: 240 + 90 * Math.cos(a), y: 533 + 90 * Math.sin(a) });
  }
  p.push({ x: 285, y: 443 });
  for (let i = 0; i <= 20; i++) {
    const a = Math.PI / 2 - ((i / 20) * Math.PI) / 2;
    p.push({ x: 285 + 60 * Math.cos(a), y: 383 + 60 * Math.sin(a) });
  }
  p.push({ x: 345, y: 300 });
  return p;
}
describe("parking geometry", () => {
  it("requires full containment and inward orientation", () => {
    expect(parkingSpot({ x: 345, y: 300 }, -Math.PI / 2)?.id).toBe(0);
    expect(parkingSpot({ x: 345, y: 300 }, 0)).toBeUndefined();
    expect(parkingSpot({ x: 305, y: 300 }, -Math.PI / 2)).toBeUndefined();
  });
  it("detects rotated car intersections", () => {
    expect(
      overlap(
        corners({ x: 0, y: 0 }, 0.4),
        rectPoints({ x: 0, y: 0, w: 10, h: 10 }),
      ),
    ).toBe(true);
    expect(
      overlap(corners({ x: 0, y: 0 }, 0), corners({ x: 100, y: 0 }, 0)),
    ).toBe(false);
  });
  it("smooths while preserving endpoints", () => {
    const p = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ];
    const q = smooth(p);
    expect(q[0]).toEqual(p[0]);
    expect(q.at(-1)).toEqual(p.at(-1));
    expect(q.length).toBeGreaterThan(30);
  });
  it("accepts a wide, navigable parking route and reserves its space", () => {
    const g = new Game();
    g.spawn();
    expect(validate(g.cars[0], inbound(), g.cars).error).toBeUndefined();
    expect(g.commit(g.cars[0], inbound())).toBeUndefined();
    g.spawn();
    expect(
      validate(g.cars[1], [{ x: 150, y: 692 }, ...inbound().slice(1)], g.cars)
        .error,
    ).toContain("reserved");
  });
  it("routes around a curb crossing but rejects incomplete input", () => {
    const g = new Game();
    g.spawn();
    const result = validate(
      g.cars[0],
      [
        { x: 150, y: 614 },
        { x: 150, y: 100 },
        { x: 345, y: 300 },
      ],
      g.cars,
    );
    expect(result.error).toBeUndefined();
    for (let i = 1; i < result.path.length; i++) {
      const p = result.path[i],
        before = result.path[i - 1],
        angle = Math.atan2(p.y - before.y, p.x - before.x);
      expect(
        obstacles.some((o) => overlap(corners(p, angle), rectPoints(o))),
      ).toBe(false);
    }
    expect(validate(g.cars[0], [], g.cars).error).toBeTruthy();
  });
});
describe("simulation", () => {
  it("parks, awards points, and requests departure", () => {
    const g = new Game();
    g.tutorial = true;
    g.spawn();
    g.commit(g.cars[0], inbound());
    for (let i = 0; i < 1200; i++) g.update(1 / 60);
    expect(g.score).toBe(100);
    expect(g.cars[0].state).toBe("requesting-departure");
  });
  it("pauses timers and expires impatient drivers", () => {
    const g = new Game();
    g.spawn();
    g.spawnTimer = 100;
    g.paused = true;
    g.update(31);
    expect(g.lives).toBe(3);
    g.paused = false;
    g.update(31);
    expect(g.lives).toBe(2);
    expect(g.cars).toHaveLength(0);
  });
  it("penalizes queue overflow and ends at zero lives", () => {
    const g = new Game();
    g.spawn();
    g.spawn();
    g.spawn();
    g.spawn();
    expect(g.lives).toBe(2);
    g.mistake("test");
    g.mistake("test");
    expect(g.over).toBe(true);
    expect(g.lives).toBe(0);
  });
  it("detects moving car collisions once per incident", () => {
    const g = new Game();
    g.tutorial = true;
    g.spawn();
    g.spawn();
    g.cars[0].state = "driving-in";
    g.cars[0].route = [
      { x: 150, y: 614 },
      { x: 150, y: 500 },
    ];
    g.cars[1].y = 600;
    g.update(1 / 60);
    expect(g.lives).toBe(2);
    g.update(1 / 60);
    expect(g.lives).toBe(2);
  });
});
export { inbound };
describe("departure maneuver", () => {
  it("reverses, switches gear, exits and frees its space", () => {
    const g = new Game();
    g.tutorial = true;
    g.spawn();
    const c = g.cars[0];
    c.x = 345;
    c.y = 300;
    c.angle = -Math.PI / 2;
    c.spot = 0;
    c.state = "requesting-departure";
    const p: Point[] = [
      { x: 345, y: 300 },
      { x: 345, y: 465 },
      { x: 345, y: 443 },
    ];
    for (let i = 0; i <= 20; i++) {
      const a = Math.PI + ((i / 20) * Math.PI) / 2;
      p.push({ x: 375 + 30 * Math.cos(a), y: 443 + 30 * Math.sin(a) });
    }
    p.push({ x: 1180, y: 413 });
    for (let i = 0; i <= 20; i++) {
      const a = -Math.PI / 2 + ((i / 20) * Math.PI) / 2;
      p.push({ x: 1180 + 90 * Math.cos(a), y: 503 + 90 * Math.sin(a) });
    }
    p.push({ x: 1270, y: 680 });
    for (let i = 0; i <= 20; i++) {
      const a = Math.PI - ((i / 20) * Math.PI) / 2;
      p.push({ x: 1360 + 90 * Math.cos(a), y: 680 + 90 * Math.sin(a) });
    }
    p.push({ x: 1370, y: 770 });
    const sampled: Point[] = [p[0]];
    for (const v of p.slice(1))
      if (
        Math.hypot(
          v.x - sampled[sampled.length - 1].x,
          v.y - sampled[sampled.length - 1].y,
        ) > 7
      )
        sampled.push(v);
    sampled.push(p[p.length - 1]);
    expect(g.commit(c, sampled)).toBeUndefined();
    expect(c.state).toBe("reversing");
    for (let i = 0; i < 1800; i++) g.update(1 / 60);
    expect(g.cars).toHaveLength(0);
    expect(g.exits).toBe(1);
    expect(g.score).toBe(150);
  });
});

it("keeps enlarged vehicle proportions and collision bounds aligned on wide phones", () => {
  setProjectionAspect(2);
  try {
    const points = corners({ x: 400, y: 400 }, -Math.PI / 2);
    const width =
      Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x));
    const height =
      Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y));
    expect(width * 2).toBeCloseTo(CAR_W);
    expect(height).toBeCloseTo(CAR_L);
  } finally {
    setProjectionAspect(1);
  }
});

it("accepts a natural finger route ending just inside an open space", () => {
  const g = new Game();
  g.spawn();
  const route = [
    { x: 150, y: 614 },
    { x: 150, y: 443 },
    { x: 345, y: 443 },
    { x: 345, y: 350 },
  ];
  expect(g.commit(g.cars[0], route)).toBeUndefined();
  expect(g.cars[0].state).toBe("driving-in");
});
it("ignores a small release wobble inside a parking space", () => {
  const g = new Game();
  g.spawn();
  const route = [...inbound(), { x: 348, y: 299 }, { x: 346, y: 301 }];
  expect(g.commit(g.cars[0], route)).toBeUndefined();
});

it("accepts densely sampled touch corners as well as sparse mouse strokes", () => {
  const g = new Game();
  g.spawn();
  const waypoints = [
    { x: 150, y: 614 },
    { x: 150, y: 443 },
    { x: 345, y: 443 },
    { x: 345, y: 350 },
  ];
  const raw: Point[] = [waypoints[0]];
  for (let i = 1; i < waypoints.length; i++) {
    const a = waypoints[i - 1],
      b = waypoints[i];
    for (let j = 1; j <= 40; j++)
      raw.push({
        x: a.x + ((b.x - a.x) * j) / 40,
        y: a.y + ((b.y - a.y) * j) / 40,
      });
  }
  expect(g.commit(g.cars[0], raw)).toBeUndefined();
  g.tutorial = true;
  for (let i = 0; i < 900; i++) g.update(1 / 60);
  expect(g.score).toBe(100);
});

it("parks from a direct drag into every space regardless of approach direction", () => {
  for (const ratio of [0.85, 1, 1.6, 2.5]) {
    setProjectionAspect(ratio);
    try {
      for (let spot = 0; spot < 16; spot++) {
        const g = new Game();
        g.tutorial = true;
        g.spawn();
        const c = g.cars[0];
        const target = { x: 345 + (spot % 8) * 100, y: spot < 8 ? 298 : 588 };
        expect(
          g.commit(c, [{ x: c.x, y: c.y }, target]),
          `space ${spot + 1}, ratio ${ratio}`,
        ).toBeUndefined();
        expect(c.spot).toBe(spot);
        for (let i = 0; i < 1200; i++) g.update(1 / 60);
        expect(g.score, `space ${spot + 1}, ratio ${ratio}`).toBe(100);
      }
    } finally {
      setProjectionAspect(1);
    }
  }
});
it("a sideways finish inside a space selects that space and aligns the car", () => {
  const g = new Game();
  g.spawn();
  expect(
    g.commit(g.cars[0], [
      { x: 150, y: 614 },
      { x: 150, y: 443 },
      { x: 320, y: 300 },
      { x: 365, y: 300 },
    ]),
  ).toBeUndefined();
  expect(g.cars[0].spot).toBe(0);
});
it("still rejects a reserved destination for a direct drag", () => {
  const g = new Game();
  g.spawn();
  g.commit(g.cars[0], [
    { x: 150, y: 614 },
    { x: 345, y: 300 },
  ]);
  g.spawn();
  expect(
    g.commit(g.cars[1], [
      { x: 150, y: 692 },
      { x: 345, y: 300 },
    ]),
  ).toContain("reserved");
});

it("can reach any remaining space with the other fifteen spaces occupied", () => {
  for (const ratio of [0.85, 2.5]) {
    setProjectionAspect(ratio);
    try {
      for (let target = 0; target < 16; target++) {
        const g = new Game();
        g.spawn();
        const c = g.cars[0];
        for (let i = 0; i < 16; i++)
          if (i !== target)
            g.cars.push({
              ...c,
              id: 100 + i,
              x: 345 + (i % 8) * 100,
              y: i < 8 ? 298 : 588,
              angle: i < 8 ? -Math.PI / 2 : Math.PI / 2,
              state: "parked",
              spot: i,
            });
        expect(
          g.commit(c, [
            { x: c.x, y: c.y },
            { x: 345 + (target % 8) * 100, y: target < 8 ? 298 : 588 },
          ]),
          `space ${target + 1}, ratio ${ratio}`,
        ).toBeUndefined();
      }
    } finally {
      setProjectionAspect(1);
    }
  }
});
