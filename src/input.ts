import { CAR_L, CAR_W, projectedHeading, type Car, type Point } from "./game";

/** Measure the visible body in CSS pixels so a finger target stays generous on a short phone screen. */
export function pickCar(
  cars: Car[],
  point: Point,
  scale: Point,
  pointerType = "mouse",
): Car | undefined {
  if (scale.x <= 0 || scale.y <= 0) return undefined;
  const padding =
    pointerType === "touch" ? 28 : pointerType === "pen" ? 20 : 14;
  let selected: Car | undefined,
    bestDistance = Infinity,
    bestCenter = Infinity;
  for (const car of cars) {
    if (car.state === "crashed") continue;
    const dx = (point.x - car.x) * scale.x,
      dy = (point.y - car.y) * scale.y,
      a = projectedHeading(car.angle);
    const along = dx * Math.cos(a) + dy * Math.sin(a),
      across = -dx * Math.sin(a) + dy * Math.cos(a);
    const bodyDistance = Math.hypot(
      Math.max(0, Math.abs(along) - (CAR_L / 2) * scale.y),
      Math.max(0, Math.abs(across) - (CAR_W / 2) * scale.y),
    );
    const centerDistance = Math.hypot(dx, dy);
    if (
      bodyDistance <= padding &&
      (bodyDistance < bestDistance - 1e-6 ||
        (Math.abs(bodyDistance - bestDistance) < 1e-6 &&
          centerDistance < bestCenter))
    ) {
      selected = car;
      bestDistance = bodyDistance;
      bestCenter = centerDistance;
    }
  }
  return selected;
}
