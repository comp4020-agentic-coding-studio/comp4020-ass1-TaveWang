#!/usr/bin/env node
/*
 * The checks that need a real layout engine.
 *
 * jsdom has no layout — every getBoundingClientRect() is zero — so the four
 * spec lines about overflow, control visibility and console errors at the two
 * marking viewports cannot be asserted in the vitest suite. They were being
 * done by hand with an ad-hoc script, which meant they were only ever as
 * reliable as remembering to run it. This is that check, committed.
 *
 * It is deliberately NOT part of `pnpm check` or CI: it needs a browser
 * binary, and a flaky download in CI would block the deploy over something
 * that is a rendering check, not a correctness one. Run it against a fresh
 * build before shipping:
 *
 *     pnpm build && pnpm check:viewports
 *
 * It also does something the unit tests cannot: it measures the REAL rendered
 * label boxes and checks they do not overlap, which is the ground truth for
 * the character-count estimate in src/lib/layout.ts.
 */

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST = resolve("dist");
const VIEWPORTS = [
  { width: 1920, height: 1080, name: "desktop" },
  { width: 390, height: 844, name: "phone" },
];
/** Percentages of the zoom range to stop at. */
const STOPS = [0, 8, 16, 24, 32, 40, 48, 56, 64, 72, 80, 88, 96, 100];

const TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function serve() {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    let path = join(DIST, normalize(decodeURIComponent(url.pathname)));
    if (url.pathname.endsWith("/")) path = join(path, "index.html");
    try {
      const body = await readFile(path);
      response.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" });
      response.end(body);
    } catch {
      response.writeHead(404).end("not found");
    }
  });
  return new Promise((done) => {
    server.listen(0, () => done({ server, port: server.address().port }));
  });
}

const failures = [];
const fail = (message) => failures.push(message);

const { server, port } = await serve();
const browser = await chromium.launch();

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => fail(`${viewport.name}: uncaught ${String(error).slice(0, 140)}`));
  page.on("console", (message) => {
    if (message.type() === "error") fail(`${viewport.name}: console error ${message.text().slice(0, 140)}`);
  });

  await page.goto(`http://localhost:${port}/`, { waitUntil: "networkidle" });
  await page.locator(".explorer__stage").focus();

  for (const stop of STOPS) {
    await page.evaluate((percent) => {
      const slider = document.querySelector("[data-testid='zoom-slider']");
      // React listens for `input`, and only reacts if the value really changed,
      // so go through the native setter rather than assigning .value directly.
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      ).set;
      setter.call(slider, String(percent));
      slider.dispatchEvent(new Event("input", { bubbles: true }));
    }, stop);
    await page.waitForTimeout(420);

    const report = await page.evaluate(() => {
      const box = (element) => {
        const r = element.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: r.width, h: r.height };
      };
      const stage = document.querySelector(".explorer__stage").getBoundingClientRect();
      return {
        logR: document.querySelector("[data-testid='scale-readout']")?.getAttribute("data-log-r"),
        overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        controls: [...document.querySelectorAll(
          "[data-testid='zoom-in'],[data-testid='zoom-out'],[data-testid='zoom-slider'],[data-testid='restart']",
        )].map((element) => ({ id: element.dataset.testid, ...box(element) })),
        labels: [...document.querySelectorAll(".label__button")].map((element) => ({
          name: element.querySelector(".label__name")?.textContent ?? "?",
          ...box(element),
        })),
        stage: { left: stage.left, right: stage.right, top: stage.top, bottom: stage.bottom },
      };
    });

    const where = `${viewport.name} @ logR ${report.logR}`;

    if (report.overflowX) fail(`${where}: the page scrolls horizontally`);

    for (const control of report.controls) {
      if (control.w < 44 || control.h < 44) {
        fail(`${where}: ${control.id} is ${Math.round(control.w)}x${Math.round(control.h)}, under the 44px touch target`);
      }
    }

    for (const label of report.labels) {
      if (
        label.left < report.stage.left - 1 ||
        label.right > report.stage.right + 1 ||
        label.top < report.stage.top - 1 ||
        label.bottom > report.stage.bottom + 1
      ) {
        fail(`${where}: label "${label.name}" is drawn outside the stage`);
      }
    }

    // The ground truth for the estimated collision boxes in src/lib/layout.ts.
    for (let i = 0; i < report.labels.length; i++) {
      for (let j = i + 1; j < report.labels.length; j++) {
        const a = report.labels[i];
        const b = report.labels[j];
        const clear = a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom;
        if (!clear) fail(`${where}: labels "${a.name}" and "${b.name}" overlap on screen`);
      }
    }
  }

  await context.close();
  console.log(`  ${viewport.name} (${viewport.width}x${viewport.height}): ${STOPS.length} scales checked`);
}

await browser.close();
server.close();

if (failures.length > 0) {
  console.error(`\n✗ ${failures.length} problem(s):`);
  // A Set is already iterable — the same failure repeats across scales, and
  // deduplicating it does not need a copy of the list.
  for (const message of new Set(failures)) console.error(`  - ${message}`);
  process.exit(1);
}
console.log("\n✓ no overflow, no console errors, controls and labels in bounds at both marking viewports");
