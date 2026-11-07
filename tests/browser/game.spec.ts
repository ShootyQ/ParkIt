import { test, expect, type Page } from "@playwright/test";
const parking = [
  { x: 150, y: 614 },
  { x: 150, y: 443 },
  { x: 345, y: 443 },
  { x: 345, y: 298 },
];
async function start(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Skip tutorial" }).click();
}
async function draw(page: Page, points: { x: number; y: number }[]) {
  const box = (await page.locator("canvas").boundingBox())!;
  await page.mouse.move(
    box.x + (points[0].x / 1440) * box.width,
    box.y + (points[0].y / 900) * box.height,
  );
  await page.mouse.down();
  for (const p of points.slice(1))
    await page.mouse.move(
      box.x + (p.x / 1440) * box.width,
      box.y + (p.y / 900) * box.height,
    );
  await page.mouse.up();
}
async function expectCarAt(page: Page, x: number, y: number) {
  await expect
    .poll(
      () =>
        page.evaluate(
          ({ x, y }) => {
            const pixel = document
              .querySelector("canvas")!
              .getContext("2d")!
              .getImageData(x, y, 1, 1).data;
            return Array.from(pixel).slice(0, 3);
          },
          { x, y },
        ),
      { timeout: 7000 },
    )
    .toEqual([223, 115, 93]);
}
test("follows a line to an imperfect stop, then backs up on the next line", async ({
  page,
}) => {
  await start(page);
  await draw(page, [
    { x: 150, y: 614 },
    { x: 150, y: 540 },
  ]);
  await expectCarAt(page, 150, 540);
  await expect(page.locator("#score")).toHaveText("0000");
  await draw(page, [
    { x: 150, y: 540 },
    { x: 150, y: 600 },
  ]);
  await expectCarAt(page, 150, 600);
  await expect(page.locator("#score")).toHaveText("0000");
});
test("parks only by following the drawn corners into the tight bay", async ({
  page,
}) => {
  await start(page);
  await draw(page, parking);
  await expect(page.locator("#score")).toHaveText("0100", { timeout: 10000 });
  await expectCarAt(page, 345, 298);
  await page.getByRole("button", { name: "Pause game" }).click();
  await expect(page.getByText("Take a breather.")).toBeVisible();
  await page.getByRole("button", { name: "Back to the lot" }).click();
  await page.getByRole("button", { name: "Restart game" }).click();
  await expect(page.locator("#score")).toHaveText("0000");
  await expect(page.locator("#best")).toHaveText("0100");
  await page.screenshot({ path: "/tmp/parkit-literal-lines.png" });
});
test("a diagonal into an island is driven and crashes rather than being rerouted or denied", async ({
  page,
}) => {
  await start(page);
  await draw(page, [
    { x: 150, y: 614 },
    { x: 345, y: 298 },
  ]);
  await expect(page.locator("#lives")).toHaveAttribute(
    "aria-label",
    "2 lives",
    { timeout: 7000 },
  );
  await expect(page.locator("#score")).toHaveText("0000");
});
test("a tap without movement explains how to draw and hidden tabs pause", async ({
  page,
}) => {
  await start(page);
  await draw(page, [{ x: 150, y: 614 }]);
  await expect(page.getByRole("status")).toContainText("Draw a line");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByText("Take a breather.")).toBeVisible();
});
test("fullscreen control exits and re-enters without narrowing the game", async ({
  page,
}) => {
  await start(page);
  await expect
    .poll(() => page.evaluate(() => Boolean(document.fullscreenElement)))
    .toBe(true);
  await page.getByRole("button", { name: "Exit fullscreen" }).click();
  await expect
    .poll(() => page.evaluate(() => Boolean(document.fullscreenElement)))
    .toBe(false);
  expect((await page.locator("canvas").boundingBox())!.width).toBe(1440);
  await page.getByRole("button", { name: "Enter fullscreen" }).click();
  await expect
    .poll(() => page.evaluate(() => Boolean(document.fullscreenElement)))
    .toBe(true);
});
test("phone touch follows a straight backward line without requiring a destination", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 570 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    Element.prototype.requestFullscreen = () =>
      Promise.reject(new Error("Embedded browser"));
  });
  await start(page);
  const box = (await page.locator("canvas").boundingBox())!;
  expect(box.width).toBe(1280);
  const session = await context.newCDPSession(page);
  const touch = async (type: string, y?: number) =>
    session.send("Input.dispatchTouchEvent", {
      type,
      touchPoints:
        y === undefined
          ? []
          : [
              {
                x: box.x + (150 / 1440) * box.width,
                y: box.y + (y / 900) * box.height,
              },
            ],
    });
  await touch("touchStart", 614);
  for (let y = 620; y <= 704; y += 7) await touch("touchMove", y);
  await touch("touchMove", 704);
  await touch("touchEnd");
  await expectCarAt(page, 150, 704);
  await expect(page.locator("#score")).toHaveText("0000");
  await page.screenshot({ path: "/tmp/parkit-phone-literal.png" });
  await context.close();
});
test("portrait phones show rotation guidance", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByText("Turn your phone sideways")).toBeVisible();
});
