import { afterEach, describe, it, expect, vi } from "vitest";
import {
  Game,
  CAR_L,
  CAR_W,
  setProjectionAspect,
  spots,
  parkingSpot,
  corners,
  overlap,
  rectPoints,
  smooth,
  validate,
  type Point,
} from "../src/game";
afterEach(() => {
  setProjectionAspect(1);
  vi.restoreAllMocks();
});
function setup() {
  const game = new Game();
  game.tutorial = true;
  game.spawn();
  const car = game.cars[0];
  car.x = 150;
  car.y = 614;
  car.state = "waiting";
  car.route = [];
  car.undirected = false;
  return { game, car };
}
const parking: Point[] = [
  { x: 150, y: 614 },
  { x: 150, y: 443 },
  { x: 345, y: 443 },
  { x: 345, y: 298 },
];
describe("literal drawn routes", () => {
  it("preserves corners and the exact endpoint without smoothing or alignment", () => {
    const { game, car } = setup();
    const raw = [
      { x: 150, y: 614 },
      { x: 170, y: 560 },
      { x: 345, y: 330 },
      { x: 320, y: 330 },
    ];
    const plan = validate(car, raw, game.cars);
    expect(plan.error).toBeUndefined();
    for (const p of raw) expect(plan.path).toContainEqual(p);
    expect(plan.path.at(-1)).toEqual(raw.at(-1));
    expect(plan.path.some((p) => p.y === 443)).toBe(false);
  });
  it("subdivides segments without changing a sharp turn or a retraced segment", () => {
    const raw = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 100 },
      ],
      path = smooth(raw);
    expect(path.filter((p) => p.x === 100 && p.y === 0)).toHaveLength(1);
    expect(path.at(-1)).toEqual(raw.at(-1));
    expect(path.every((p) => p.x === 0 || p.y === 0)).toBe(true);
  });
  it("accepts a route outside a space and stops exactly where drawn", () => {
    const { game, car } = setup();
    expect(game.commit(car, [car, { x: 150, y: 550 }])).toBeUndefined();
    game.update(1);
    expect(car.y).toBeCloseTo(550);
    expect(car.x).toBe(150);
    expect(car.state).toBe("waiting");
    expect(game.score).toBe(0);
  });
  it("moves backward when the line starts behind the car", () => {
    const { game, car } = setup();
    game.commit(car, [car, { x: 150, y: 700 }]);
    expect(car.state).toBe("reversing");
    game.update(0.5);
    expect(car.y).toBeCloseTo(641.5);
    expect(Math.cos(car.angle + Math.PI / 2)).toBeCloseTo(1);
  });
  it("infers repeated reverse and forward changes from retraced lines", () => {
    const { game, car } = setup();
    const plan = validate(
      car,
      [car, { x: 150, y: 700 }, { x: 150, y: 550 }, { x: 150, y: 600 }],
      game.cars,
    );
    expect(plan.reverse[1]).toBe(true);
    expect(plan.reverse).toContain(false);
    game.commit(car, [
      car,
      { x: 150, y: 700 },
      { x: 150, y: 550 },
      { x: 150, y: 600 },
    ]);
    game.update(8);
    expect(car.y).toBeCloseTo(600);
    expect(car.state).toBe("waiting");
    expect(Math.cos(car.angle + Math.PI / 2)).toBeCloseTo(1);
  });
  it("allows another line after an imperfect stop", () => {
    const { game, car } = setup();
    game.commit(car, [car, { x: 150, y: 550 }]);
    game.update(1);
    expect(game.commit(car, [car, { x: 150, y: 510 }])).toBeUndefined();
    game.update(1);
    expect(car.y).toBeCloseTo(510);
  });
  it("only refuses a tap with no route", () => {
    const { game, car } = setup();
    expect(game.commit(car, [car])).toBeTruthy();
    expect(game.commit(car, [car, { x: 150, y: 613 }])).toBeUndefined();
  });
});
describe("parking as an outcome", () => {
  it("uses nearly car-sized bays on desktop and wide phones", () => {
    for (const ratio of [0.85, 1, 2.5]) {
      setProjectionAspect(ratio);
      expect(spots[0].w * ratio).toBeCloseTo(CAR_W + 24);
      expect(spots[0].h).toBeCloseTo(CAR_L + 28);
      expect(parkingSpot({ x: 345, y: 298 }, -Math.PI / 2)?.id).toBe(0);
      expect(parkingSpot({ x: 345, y: 298 }, Math.PI / 2)?.id).toBe(0);
      expect(parkingSpot({ x: 345, y: 330 }, -Math.PI / 2)).toBeUndefined();
    }
  });
  it("awards parking only after the car fits, and does not snap a poor stop", () => {
    const { game, car } = setup();
    game.commit(car, parking.slice(0, -1).concat({ x: 345, y: 330 }));
    game.update(7);
    expect(car.y).toBeCloseTo(330);
    expect(car.state).toBe("waiting");
    expect(game.score).toBe(0);
    game.commit(car, [car, { x: 345, y: 298 }]);
    game.update(0.5);
    expect(car.state).toBe("parked");
    expect(game.score).toBe(100);
  });
  it("allows backing into a bay and moving a parked car without farming points", () => {
    const { game, car } = setup();
    car.x = 345;
    car.y = 443;
    car.angle = Math.PI / 2;
    game.commit(car, [car, { x: 345, y: 298 }]);
    game.update(3);
    expect(game.score).toBe(100);
    expect(car.credited).toBe(true);
    game.commit(car, [car, { x: 345, y: 300 }]);
    game.update(0.1);
    expect(game.score).toBe(100);
    expect(car.state).toBe("parked");
  });
  it("requests departure and follows drawn reverse and drive segments to exit", () => {
    const { game, car } = setup();
    game.commit(car, parking);
    game.update(6);
    car.wait = 0.1;
    game.update(0.2);
    expect(car.state).toBe("requesting-departure");
    expect(
      game.commit(car, [
        car,
        { x: 345, y: 443 },
        { x: 1260, y: 443 },
        { x: 1260, y: 770 },
        { x: 1370, y: 770 },
      ]),
    ).toBeUndefined();
    expect(car.state).toBe("reversing");
    game.update(22);
    expect(game.exits).toBe(1);
    expect(game.score).toBe(250);
    expect(game.cars).toHaveLength(0);
  });
});
describe("chaos happens during driving", () => {
  it("accepts a curb-crossing route and crashes when the car hits it", () => {
    const { game, car } = setup();
    expect(game.commit(car, [car, { x: 300, y: 614 }])).toBeUndefined();
    expect(car.state).toBe("driving-in");
    game.update(0.8);
    expect(car.state).toBe("crashed");
    expect(game.lives).toBe(2);
  });
  it("does not pre-reject an occupied space; cars collide during the maneuver", () => {
    const { game, car } = setup();
    game.commit(car, parking);
    game.update(6);
    const occupied = car;
    game.spawn();
    const second = game.cars[1];
    second.x = 345;
    second.y = 443;
    expect(game.commit(second, [second, { x: 345, y: 298 }])).toBeUndefined();
    game.update(1);
    expect(second.state).toBe("crashed");
    expect(occupied.state).toBe("crashed");
    expect(game.lives).toBe(2);
  });
  it("prevents tunneling through curbs on a long frame", () => {
    const { game, car } = setup();
    game.commit(car, [car, { x: 1200, y: 614 }]);
    game.update(3);
    expect(game.lives).toBe(2);
    expect(car.x).toBeLessThan(245);
  });
  it("pauses and expires patience only while running", () => {
    const { game, car } = setup();
    game.tutorial = false;
    game.spawnTimer = 100;
    game.paused = true;
    game.update(31);
    expect(game.lives).toBe(3);
    game.paused = false;
    game.update(31);
    expect(game.lives).toBe(2);
    expect(game.cars).not.toContain(car);
  });
  it("detects rotated rectangles and ends at zero lives", () => {
    expect(
      overlap(
        corners({ x: 0, y: 0 }, 0.4),
        rectPoints({ x: 0, y: 0, w: 10, h: 10 }),
      ),
    ).toBe(true);
    const { game } = setup();
    game.mistake("one");
    game.mistake("two");
    game.mistake("three");
    expect(game.over).toBe(true);
    expect(game.lives).toBe(0);
  });
});

it("infers reverse from the visible heading on a wide screen", () => {
  setProjectionAspect(2.5);
  const { game, car } = setup();
  car.angle = Math.PI / 4;
  const a = (2 * Math.PI) / 3;
  const plan = validate(
    car,
    [car, { x: car.x + 50 * Math.cos(a), y: car.y + 50 * Math.sin(a) }],
    game.cars,
  );
  expect(plan.reverse[1]).toBe(true);
});

it("lets a departing car follow a line off the exit edge", () => {
  const { game, car } = setup();
  car.x = 1260;
  car.y = 770;
  car.angle = 0;
  car.credited = true;
  game.commit(car, [car, { x: 1500, y: 770 }]);
  game.update(3);
  expect(game.cars).toHaveLength(0);
  expect(game.exits).toBe(1);
  expect(game.lives).toBe(3);
});

describe("constant traffic and parking stays", () => {
  it("spawns cars already driving straight from three different gates", () => {
    const game = new Game();
    game.tutorial = true;
    game.spawn();
    game.spawn();
    game.spawn();
    expect(game.cars.map((c) => c.entry)).toEqual(["bottom", "left", "right"]);
    const starts = game.cars.map((c) => ({ x: c.x, y: c.y }));
    game.update(1);
    expect(game.cars[0].y).toBeCloseTo(starts[0].y - 70);
    expect(game.cars[1].x).toBeCloseTo(starts[1].x + 70);
    expect(game.cars[2].x).toBeCloseTo(starts[2].x - 70);
    expect(
      game.cars.every((c) => c.undirected && c.state === "driving-in"),
    ).toBe(true);
  });
  it("keeps feeding different sides without waiting for player actions", () => {
    const game = new Game();
    game.update(10.2);
    expect(game.cars.map((c) => c.entry)).toEqual(["bottom", "left", "right"]);
    expect(game.lives).toBe(3);
    expect(game.arrivalInterval).toBe(3);
    game.exits = 10;
    expect(game.arrivalInterval).toBeLessThan(3);
  });
  it("holds only the selected car while a line is being drawn", () => {
    const game = new Game();
    game.tutorial = true;
    game.spawn();
    game.spawn();
    const first = game.cars[0],
      second = game.cars[1];
    game.heldCar = first.id;
    game.update(1);
    expect(first.y).toBe(820);
    expect(second.x).toBeCloseTo(160);
    game.commit(first, [first, { x: 150, y: 700 }]);
    game.heldCar = undefined;
    game.update(0.5);
    expect(first.undirected).toBe(false);
    expect(first.y).toBeCloseTo(775);
  });
  it("skips an occupied gate instead of overlapping a new arrival", () => {
    const game = new Game();
    game.tutorial = true;
    game.spawn();
    game.spawn();
    game.spawn();
    expect(game.spawn()).toBe(false);
    expect(game.cars).toHaveLength(3);
  });
  it.each([0, 0.999])(
    "parks for 10–30 seconds, then explicitly requests removal (%s)",
    (random) => {
      vi.spyOn(Math, "random").mockReturnValue(random);
      const { game, car } = setup();
      game.commit(car, parking);
      game.update(5.7);
      expect(car.state).toBe("parked");
      expect(car.wait).toBeGreaterThan(9.9);
      expect(car.wait).toBeLessThanOrEqual(30);
      const remaining = car.wait;
      game.update(remaining - 0.1);
      expect(car.state).toBe("parked");
      game.update(0.2);
      expect(car.state).toBe("requesting-departure");
      expect(game.cars).toContain(car);
    },
  );
  it("counts an unhandled arrival as a miss instead of silently parking it", () => {
    const game = new Game();
    game.tutorial = true;
    game.spawn();
    const car = game.cars[0];
    game.update(9);
    expect(game.cars).not.toContain(car);
    expect(game.lives).toBe(2);
    expect(game.score).toBe(0);
  });
  it.each([
    { x: 200, y: 418, end: { x: 50, y: 418 } },
    { x: 1250, y: 478, end: { x: 1390, y: 478 } },
  ])("lets parked drivers depart through either side gate", ({ x, y, end }) => {
    const { game, car } = setup();
    car.x = x;
    car.y = y;
    car.credited = true;
    car.angle = end.x < x ? Math.PI : 0;
    game.commit(car, [car, end]);
    game.update(3);
    expect(game.exits).toBe(1);
    expect(game.lives).toBe(3);
  });
});

it("allows an off-center parking stop with a little steering angle", () => {
  setProjectionAspect(1.8);
  expect(parkingSpot({ x: 349, y: 304 }, -Math.PI / 2 + 0.08)?.id).toBe(0);
});
it("leaves room to drive across the ends of the shortened curb islands", () => {
  const { game, car } = setup();
  car.x = 150;
  car.y = 515;
  car.angle = 0;
  game.commit(car, [car, { x: 330, y: 515 }]);
  game.update(2.1);
  expect(game.lives).toBe(3);
  expect(car.x).toBeCloseTo(330);
});
