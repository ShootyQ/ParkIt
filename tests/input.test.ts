import { afterEach, it, expect } from "vitest";
import { Game, setProjectionAspect, type Car } from "../src/game";
import { pickCar } from "../src/input";
afterEach(() => setProjectionAspect(1));
function car(): Car {
  const g = new Game();
  g.spawn();
  return g.cars[0];
}
it("gives touch a CSS-pixel target beyond a small car body", () => {
  const scale = { x: 0.89, y: 0.4 };
  setProjectionAspect(scale.x / scale.y);
  const c = car();
  c.x = 400;
  c.y = 400;
  const near = { x: c.x + 25 / scale.x, y: c.y + 25 / scale.y };
  expect(pickCar([c], near, scale, "touch")).toBe(c);
  expect(pickCar([c], near, scale, "mouse")).toBeUndefined();
});
it("picks the nearest car rather than whichever is first in the array", () => {
  const a = car(),
    b = { ...a, id: 2, x: a.x + 100 };
  expect(pickCar([a, b], { x: b.x + 5, y: b.y }, { x: 1, y: 1 }, "touch")).toBe(
    b,
  );
});
it("prioritizes touching a body over a nearby padded target", () => {
  const a = car(),
    b = { ...a, id: 2, x: a.x + 45 };
  a.angle = b.angle = 0;
  expect(
    pickCar([a, b], { x: b.x + 5, y: b.y }, { x: 1, y: 1 }, "touch"),
  ).toBe(b);
});
it("does not select crashed cars or cars far from the finger", () => {
  const c = car();
  expect(
    pickCar([c], { x: c.x + 200, y: c.y }, { x: 1, y: 1 }, "touch"),
  ).toBeUndefined();
  c.state = "crashed";
  expect(pickCar([c], c, { x: 1, y: 1 }, "touch")).toBeUndefined();
});
