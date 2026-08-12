import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

/*
 * Assignment 1 — "UP: How Far Until Earth Disappears?" — the checkable half
 * of this week's spec, plus the design decisions worth defending as
 * contracts.
 *
 * Everything runs against dist/, so it checks what actually ships. Whether
 * the scroll journey itself is legible, whether the milestones are
 * scientifically well-chosen, and whether it reads well at both marking
 * viewports are left to a person looking at the live page — a machine can't
 * judge any of those. These tests hold the parts that a machine can.
 */

const DIST = resolve("dist");

function htmlFiles(dir: string = DIST): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.name.endsWith(".html") ? [path] : [];
  });
}

function cssFiles(): string {
  // Astro inlines small stylesheets straight into a page's <style> tag
  // instead of emitting a separate file under _astro/ — so both need
  // checking, or this only holds by accident once the CSS grows past
  // whatever size threshold triggers extraction.
  const dir = join(DIST, "_astro");
  const external = readdirSync(dir)
    .filter((f) => f.endsWith(".css"))
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .join("\n");
  const inline = pages
    .flatMap(({ doc }) => [...doc.querySelectorAll("style")])
    .map((style) => style.textContent ?? "")
    .join("\n");
  return `${external}\n${inline}`;
}

const pages = htmlFiles().map((path) => ({
  path,
  doc: new JSDOM(readFileSync(path, "utf8")).window.document,
}));
const home = pages.find((p) => p.path.endsWith("index.html"))!.doc;

/*
 * The core interaction: "when the visitor scrolls forward, the displayed
 * distance from Earth increases ... scrolling backward decreases the
 * distance." A machine can't simulate a real scroll-linked animation
 * against jsdom (no layout, no IntersectionObserver), but it can demand
 * that the page expose *a* machine-readable position so the contract is
 * checkable at all, and that it starts at ground level.
 */
describe("the distance indicator", () => {
  it("exists and is machine-readable", () => {
    const indicator = home.querySelector('[data-testid="distance"]');
    expect(indicator, "expected a [data-testid=\"distance\"] element").toBeTruthy();
    expect(
      indicator?.hasAttribute("data-distance-m"),
      "the current distance must be exposed as data-distance-m (metres), not just as display text, so it's readable by more than a human eye",
    ).toBe(true);
  });

  it("starts at ground level", () => {
    const indicator = home.querySelector('[data-testid="distance"]');
    const metres = Number(indicator?.getAttribute("data-distance-m"));
    expect(metres).toBeGreaterThanOrEqual(0);
    expect(metres).toBeLessThanOrEqual(10);
  });
});

describe("the restart control", () => {
  it("is a real, keyboard-operable control", () => {
    const restart = home.querySelector('[data-testid="restart"]');
    expect(restart, "expected a [data-testid=\"restart\"] element").toBeTruthy();
    expect(
      ["A", "BUTTON"].includes(restart?.tagName ?? ""),
      "the restart control must be an <a> or <button>, not a styled <div>, so it lands in the tab order for free",
    ).toBe(true);
  });
});

describe("sources and the scale-compression disclosure", () => {
  it("cites at least one real external source", () => {
    const sources = home.querySelector('[data-testid="sources"]');
    expect(sources, "expected a [data-testid=\"sources\"] region").toBeTruthy();
    const links = [...(sources?.querySelectorAll("a[href]") ?? [])];
    expect(
      links.some((a) => a.getAttribute("href")?.startsWith("https://")),
      "the sources region needs at least one https:// link to a real source",
    ).toBe(true);
  });

  it("discloses that the scale is compressed, in plain language", () => {
    const notice = home.querySelector('[data-testid="scale-notice"]');
    expect(notice, "expected a [data-testid=\"scale-notice\"] element").toBeTruthy();
    expect(notice?.textContent?.trim().length ?? 0).toBeGreaterThan(0);
  });
});

it("honours prefers-reduced-motion", () => {
  const css = cssFiles();
  expect(
    /prefers-reduced-motion\s*:\s*reduce/i.test(css),
    "no @media (prefers-reduced-motion: reduce) rule found in the built CSS",
  ).toBe(true);
});

describe("GitHub Pages subpath safety", () => {
  it("never emits a root-relative href or src", () => {
    for (const { path, doc } of pages) {
      for (const el of doc.querySelectorAll("[href], [src]")) {
        const attr = el.hasAttribute("href") ? "href" : "src";
        const value = el.getAttribute(attr) ?? "";
        expect(
          value.startsWith("/") && !value.startsWith("//"),
          `${path}: <${el.tagName.toLowerCase()} ${attr}="${value}"> is root-relative and will 404 under the GitHub Pages subpath — use a relative path instead`,
        ).toBe(false);
      }
    }
  });
});
