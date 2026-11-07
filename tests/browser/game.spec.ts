import { test, expect, type Page } from "@playwright/test";
const parking = [
  { x: 150, y: 614 },
  { x: 150, y: 443 },
  { x: 345, y: 443 },
  { x: 345, y: 298 },
];
async function start(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Let’s park" }).click();
  await expect
    .poll(async () => {
      try {
        await firstCar(page);
        return true;
      } catch {
        return false;
      }
    })
    .toBe(true);
}
async function firstCar(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas")!,
      pixels = canvas.getContext("2d")!.getImageData(0, 0, 1440, 900).data;
    let minX = 1440,
      maxX = 0,
      minY = 900,
      maxY = 0;
    for (let y = 190; y < 875; y++)
      for (let x = 25; x < 1415; x++) {
        const i = (y * 1440 + x) * 4;
        if (
          pixels[i] === 223 &&
          pixels[i + 1] === 115 &&
          pixels[i + 2] === 93
        ) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    if (maxY === 0) throw new Error("First car not rendered");
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  });
}
async function draw(page: Page, points: { x: number; y: number }[]) {
  const box = (await page.locator("canvas").boundingBox())!;
  points = [await firstCar(page), ...points.slice(1)];
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
  const car = await firstCar(page);
  await touch("touchStart", car.y);
  for (let y = car.y + 3; y < 835; y += 3) await touch("touchMove", y);
  await touch("touchMove", 835);
  await touch("touchEnd");
  await expectCarAt(page, 150, 835);
  await expect(page.locator("#score")).toHaveText("0000");
  await page.screenshot({ path: "/tmp/parkit-phone-literal.png" });
  await context.close();
});
test("portrait phones show rotation guidance", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByText("Turn your phone sideways")).toBeVisible();
});

test("normal play continuously introduces moving cars from different sides", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: "Skip tutorial" }).click();
  await page.clock.runFor(6500);
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const data = document
            .querySelector("canvas")!
            .getContext("2d")!
            .getImageData(0, 0, 1440, 900).data;
          const colors = new Set<string>();
          for (let i = 0; i < data.length; i += 4) {
            if (data[i] === 223 && data[i + 1] === 115 && data[i + 2] === 93)
              colors.add("bottom");
            if (data[i] === 178 && data[i + 1] === 165 && data[i + 2] === 207)
              colors.add("left");
            if (data[i] === 213 && data[i + 1] === 222 && data[i + 2] === 208)
              colors.add("right");
          }
          return colors.size;
        }),
      { timeout: 12000 },
    )
    .toBe(3);
  await page.screenshot({ path: "/tmp/parkit-incoming-traffic.png" });
});

test("touch can grab a moving car beside its visible body on a wide phone", async ({
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
  const box = (await page.locator("canvas").boundingBox())!,
    car = await firstCar(page),
    session = await context.newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      {
        x: box.x + (car.x / 1440) * box.width + 25,
        y: box.y + (car.y / 900) * box.height + 25,
      },
    ],
  });
  for (let y = car.y + 3; y < 835; y += 4)
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        {
          x: box.x + (150 / 1440) * box.width,
          y: box.y + (y / 900) * box.height,
        },
      ],
    });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      {
        x: box.x + (150 / 1440) * box.width,
        y: box.y + (835 / 900) * box.height,
      },
    ],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expectCarAt(page, 150, 835);
  await expect(page.locator("#lives")).toHaveAttribute("aria-label", "3 lives");
  await context.close();
});
