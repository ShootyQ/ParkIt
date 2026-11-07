import { test, expect } from "@playwright/test";
test("start, park with a drawn route, pause, restart and persist score", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Skip tutorial" }).click();
  const canvas = page.locator("canvas");
  const box = (await canvas.boundingBox())!;
  const move = async (x: number, y: number) =>
    page.mouse.move(
      box.x + (x / 1440) * box.width,
      box.y + (y / 900) * box.height,
    );
  await move(150, 614);
  await page.mouse.down();
  await move(150, 533);
  for (let i = 0; i <= 20; i++) {
    const a = Math.PI + ((i / 20) * Math.PI) / 2;
    await move(240 + 90 * Math.cos(a), 533 + 90 * Math.sin(a));
  }
  await move(285, 443);
  for (let i = 0; i <= 20; i++) {
    const a = Math.PI / 2 - ((i / 20) * Math.PI) / 2;
    await move(285 + 60 * Math.cos(a), 383 + 60 * Math.sin(a));
  }
  await move(345, 300);
  await page.mouse.up();
  await expect(page.locator("#score")).toHaveText("0100", { timeout: 12000 });
  await page.getByRole("button", { name: "Pause game" }).click();
  await expect(page.getByText("Take a breather.")).toBeVisible();
  await page.getByRole("button", { name: "Back to the lot" }).click();
  await page.getByRole("button", { name: "Restart game" }).click();
  await expect(page.locator("#score")).toHaveText("0000");
  await expect(page.locator("#best")).toHaveText("0100");
  await page.screenshot({ path: "/tmp/parkit-desktop.png", fullPage: true });
});
test("portrait guidance and mobile landscape touch", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByText("Turn your phone sideways")).toBeVisible();
  await page.setViewportSize({ width: 844, height: 390 });
  await page.getByRole("button", { name: "Skip tutorial" }).tap();
  await expect(page.locator("canvas")).toBeVisible();
  await page.screenshot({ path: "/tmp/parkit-mobile.png" });
  await context.close();
});

test("rejects incomplete routes and pauses when the page becomes hidden", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Skip tutorial" }).click();
  const box = (await page.locator("canvas").boundingBox())!;
  await page.mouse.move(
    box.x + (150 / 1440) * box.width,
    box.y + (614 / 900) * box.height,
  );
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.getByRole("status")).toContainText("Draw a complete route");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByText("Take a breather.")).toBeVisible();
});

test("touch drawing reaches route validation in landscape", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "Skip tutorial" }).tap();
  const box = (await page.locator("canvas").boundingBox())!;
  const session = await context.newCDPSession(page);
  const x = box.x + (150 / 1440) * box.width,
    y = box.y + (614 / 900) * box.height;
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x, y: y - 15 }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(page.getByRole("status")).toContainText("Finish inside a space");
  await context.close();
});

test("tutorial completes a drawn parking and reverse departure cycle", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/");
  await page.getByRole("button", { name: "Let’s park" }).click();
  const box = (await page.locator("canvas").boundingBox())!;
  const draw = async (points: { x: number; y: number }[]) => {
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
  };
  const p = [
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
  await draw(p);
  await expect(page.getByRole("status")).toContainText("02 /", {
    timeout: 14000,
  });
  const q = [
    { x: 345, y: 300 },
    { x: 345, y: 465 },
    { x: 345, y: 443 },
  ];
  for (let i = 0; i <= 20; i++) {
    const a = Math.PI + ((i / 20) * Math.PI) / 2;
    q.push({ x: 375 + 30 * Math.cos(a), y: 443 + 30 * Math.sin(a) });
  }
  q.push({ x: 1180, y: 413 });
  for (let i = 0; i <= 20; i++) {
    const a = -Math.PI / 2 + ((i / 20) * Math.PI) / 2;
    q.push({ x: 1180 + 90 * Math.cos(a), y: 503 + 90 * Math.sin(a) });
  }
  q.push({ x: 1270, y: 680 });
  for (let i = 0; i <= 20; i++) {
    const a = Math.PI - ((i / 20) * Math.PI) / 2;
    q.push({ x: 1360 + 90 * Math.cos(a), y: 680 + 90 * Math.sin(a) });
  }
  q.push({ x: 1370, y: 770 });
  await draw(q);

  await expect(page.locator("#score")).toHaveText("0250", { timeout: 25000 });
  expect(
    await page.evaluate(() => localStorage.getItem("parkit-tutorial")),
  ).toBe("done");
});

test("starting enters fullscreen and the control exits and re-enters", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Skip tutorial" }).click();
  await expect
    .poll(() => page.evaluate(() => Boolean(document.fullscreenElement)))
    .toBe(true);
  const box = (await page.locator("canvas").boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(1100);
  await page.getByRole("button", { name: "Exit fullscreen" }).click();
  await expect
    .poll(() => page.evaluate(() => Boolean(document.fullscreenElement)))
    .toBe(false);
  await page.getByRole("button", { name: "Enter fullscreen" }).click();
  await expect
    .poll(() => page.evaluate(() => Boolean(document.fullscreenElement)))
    .toBe(true);
});

test("fullscreen denial still starts a viewport-filling playable game", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Element.prototype.requestFullscreen = () =>
      Promise.reject(new Error("Unavailable"));
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Skip tutorial" }).click();
  await expect(page.locator("body")).toHaveClass("immersive");
  await expect(page.locator("#overlay")).not.toBeVisible();
  await page.getByRole("button", { name: "Enter fullscreen" }).click();
  await expect(page.locator("body")).toHaveClass("immersive");
});

test("embedded phone browser fills the width before and after starting", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1190, height: 425 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    Element.prototype.requestFullscreen = () =>
      Promise.reject(new Error("Embedded browser"));
  });
  await page.goto("/");
  for (const started of [false, true]) {
    if (started)
      await page.getByRole("button", { name: "Skip tutorial" }).tap();
    const box = (await page.locator("canvas").boundingBox())!;
    expect(box.x).toBeCloseTo(0, 0);
    expect(box.width).toBeCloseTo(1190, 0);
    expect(box.y + box.height).toBeLessThanOrEqual(425);
    expect(box.height).toBeGreaterThan(375);
  }
  await page.screenshot({ path: "/tmp/parkit-edge-to-edge.png" });
  await context.close();
});
