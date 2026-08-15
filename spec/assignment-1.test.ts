import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { OBJECTS } from "../src/data/cosmos";
import { MIN_LOG_R } from "../src/lib/camera";

/*
 * Assignment 1 — "The Sun, in Context" — the half of the contract a machine
 * can hold, asserted against dist/ so it checks what actually ships.
 *
 * The zoom interaction itself is behaviour, and lives in
 * spec/interaction.test.tsx. What neither file can judge — whether the thing
 * is legible, whether the sequence lands, whether it reads well at 1920×1080
 * and 390×844 — is checked in a real browser and then by a person.
 *
 * The load-bearing claim here is that the built HTML carries the content
 * BEFORE any JavaScript runs. The island is client:load, never client:only,
 * so every label, every measurement and the whole text journey are on disk.
 */

const DIST = resolve("dist");

function htmlFiles(dir: string = DIST): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.name.endsWith(".html") ? [path] : [];
  });
}

const pages = htmlFiles().map((path) => ({
  path,
  doc: new JSDOM(readFileSync(path, "utf8")).window.document,
}));
const home = pages.find((p) => p.path.endsWith("index.html"))!.doc;

function cssFiles(): string {
  // Astro inlines small stylesheets into a page's <style> tag rather than
  // always emitting _astro/*.css, so a test that reads only the external file
  // passes or fails on the stylesheet's size rather than on its content.
  const dir = join(DIST, "_astro");
  const external = readdirSync(dir)
    .filter((file) => file.endsWith(".css"))
    .map((file) => readFileSync(join(dir, file), "utf8"))
    .join("\n");
  const inline = pages
    .flatMap(({ doc }) => [...doc.querySelectorAll("style")])
    .map((style) => style.textContent ?? "")
    .join("\n");
  return `${external}\n${inline}`;
}

describe("document structure", () => {
  it("uses real landmarks and exactly one top-level heading", () => {
    expect(home.querySelector("header")).toBeTruthy();
    expect(home.querySelector("main")).toBeTruthy();
    expect(home.querySelector("footer")).toBeTruthy();
    expect(home.querySelector("nav")).toBeTruthy();
    expect(home.querySelectorAll("h1").length).toBe(1);
    expect(home.querySelector("h1")?.textContent).toMatch(/Sun/i);
  });
});

describe("the opening state, before any JavaScript runs", () => {
  it("is centred on the Sun at the closest scale", () => {
    const readout = home.querySelector('[data-testid="scale-readout"]');
    expect(readout, 'expected a [data-testid="scale-readout"] element').toBeTruthy();
    expect(
      Number(readout?.getAttribute("data-log-r")),
      "the built page must open at the tightest scale, with the Sun filling the view",
    ).toBe(MIN_LOG_R);
    expect(home.body.textContent).toContain("The Sun");
  });

  it("reads in kilometres, not light-years", () => {
    const primary = home.querySelector('[data-testid="scale-primary"]');
    expect(primary?.getAttribute("data-unit")).toBe("km");
    expect(primary?.textContent).toMatch(/km$/);
  });

  it("shows only the Sun, not the whole catalogue", () => {
    const labels = [...home.querySelectorAll(".label__name")].map((n) => n.textContent);
    expect(labels).toEqual(["The Sun"]);
  });

  it("tells the visitor what to do without making them press start", () => {
    const hint = home.querySelector(".explorer__hint");
    expect(hint?.textContent).toMatch(/zoom out/i);
    expect(
      home.querySelector("[data-start], [data-testid='start']"),
      "the first viewport must already be interactive — no start button",
    ).toBeNull();
  });
});

describe("controls", () => {
  const real = (testid: string, tags: string[]) => {
    const element = home.querySelector(`[data-testid="${testid}"]`);
    expect(element, `expected a [data-testid="${testid}"] element`).toBeTruthy();
    expect(
      tags.includes(element?.tagName ?? ""),
      `${testid} must be a real ${tags.join(" or ")}, not a styled <div>, so it lands in the tab order and works by keyboard for free`,
    ).toBe(true);
    return element;
  };

  it("ships real, keyboard-operable zoom controls", () => {
    real("zoom-in", ["BUTTON"]);
    real("zoom-out", ["BUTTON"]);
    real("restart", ["BUTTON", "A"]);
  });

  it("ships an accessible range control with a name", () => {
    const slider = real("zoom-slider", ["INPUT"]);
    expect(slider?.getAttribute("type")).toBe("range");
    expect((slider?.getAttribute("aria-label")?.trim().length ?? 0) > 0).toBe(true);
  });

  it("gives every control an accessible name", () => {
    for (const control of home.querySelectorAll("button, input, a[href]")) {
      const name =
        control.getAttribute("aria-label")?.trim() ||
        control.textContent?.trim() ||
        control.getAttribute("title")?.trim() ||
        "";
      expect(
        name.length,
        `<${control.tagName.toLowerCase()}> in the built page has no accessible name`,
      ).toBeGreaterThan(0);
    }
  });
});

describe("essential content lives outside the canvas", () => {
  it("hides the canvas from assistive technology", () => {
    const canvas = home.querySelector("canvas");
    expect(canvas, "expected the model to be drawn on a canvas").toBeTruthy();
    expect(
      canvas?.getAttribute("aria-hidden"),
      "the canvas is decoration; everything it draws also exists as DOM",
    ).toBe("true");
  });

  it("ships the whole scale journey as readable text", () => {
    const journey = home.querySelector(".journey");
    expect(journey, "expected a textual fallback summary of the journey").toBeTruthy();
    const items = [...(journey?.querySelectorAll("li") ?? [])];
    expect(items.length).toBe(OBJECTS.length);
    for (const object of OBJECTS) {
      expect(
        journey?.textContent?.includes(object.name),
        `${object.name} is on the map but missing from the text version`,
      ).toBe(true);
    }
  });

  it("cites a source for every object in the text journey", () => {
    const items = [...home.querySelectorAll(".journey li")];
    for (const item of items) {
      expect(
        item.querySelector('a[href^="https://"]'),
        `"${item.querySelector("strong")?.textContent}" is shown without a source link`,
      ).toBeTruthy();
    }
  });
});

describe("photographs", () => {
  it("ships every photograph as a real file on a relative path", () => {
    // The photographs are drawn onto the canvas and shown in the details
    // panel, so they are not <img> tags in the built HTML — but the files have
    // to exist and the paths have to survive the Pages subpath.
    for (const object of OBJECTS) {
      if (!object.photo) continue;
      const file = join(DIST, "images", "objects", object.photo.file);
      expect(existsSync(file), `${object.id}'s photograph is missing from dist/`).toBe(true);
    }
  });

  it("keeps every photograph on a relative path", () => {
    for (const image of home.querySelectorAll("img")) {
      const src = image.getAttribute("src") ?? "";
      expect(
        src.startsWith("/") && !src.startsWith("//"),
        `<img src="${src}"> is root-relative and will 404 under the Pages subpath`,
      ).toBe(false);
    }
  });

  it("credits every photograph it can show, in the sources region", () => {
    const sources = home.querySelector('[data-testid="sources"]')?.textContent ?? "";
    for (const credit of ["NASA/SDO", "NASA/JPL", "Carnegie Institution of Washington"]) {
      expect(sources, `photo credit "${credit}" missing from the sources region`).toContain(credit);
    }
  });
});

describe("honesty about the model", () => {
  it("discloses the logarithmic compression", () => {
    const method = home.querySelector(".method")?.textContent ?? "";
    expect(method).toMatch(/logarithmic/i);
    expect(method).toMatch(/each step outward covers vastly more space/i);
  });

  it("says plainly that a symbol's size is not the object's size", () => {
    const method = home.querySelector(".method")?.textContent ?? "";
    expect(
      method,
      "a symbol is not a scale drawing, and the page must say so rather than let a big planet read as a big planet",
    ).toMatch(/not at their true size/i);
    expect(
      method,
      "it must state the ordering guarantee it now keeps — enforced across the whole zoom range in spec/dataset.test.ts",
    ).toMatch(/never drawn smaller than a smaller one/i);
    expect(
      method,
      "and must say the ranking is compressed, so nobody reads a symbol ratio as a size ratio",
    ).toMatch(/compressed/i);
  });

  it("states that the orbits are real and the epoch is fixed", () => {
    const method = home.querySelector(".method")?.textContent ?? "";
    expect(method).toMatch(/J2000/);
    expect(method).toMatch(/one focus/i);
    expect(
      method,
      "a computed position is still a static arrangement, and must not be mistaken for an ephemeris",
    ).toMatch(/not an ephemeris/i);
  });

  it("explains which things are tilted and which stay circular", () => {
    const method = home.querySelector(".method")?.textContent ?? "";
    expect(method).toMatch(/inclinations/i);
    expect(
      method,
      "a shell drawn tilted would be a nicer picture and a worse claim — say why it is not",
    ).toMatch(/sphere's outline is a circle/i);
  });

  it("says the bearings are diagrammatic and the map is not a sky map", () => {
    const method = home.querySelector(".method")?.textContent ?? "";
    expect(method).toMatch(/distance model, not a sky map/i);
  });

  it("distinguishes illustrative background from sourced objects", () => {
    const method = home.querySelector(".method")?.textContent ?? "";
    expect(method).toMatch(/background stars are illustrative/i);
  });

  it("collects its sources with the date each was read", () => {
    const sources = home.querySelector('[data-testid="sources"]');
    expect(sources, 'expected a [data-testid="sources"] region').toBeTruthy();
    const links = [...(sources?.querySelectorAll("a[href]") ?? [])];
    expect(links.length).toBeGreaterThan(5);
    expect(links.every((a) => a.getAttribute("href")?.startsWith("https://"))).toBe(true);
    expect(sources?.textContent).toMatch(/read \d{4}-\d{2}-\d{2}/);
  });

  it("credits the two reference interfaces without borrowing from them", () => {
    const footer = home.querySelector("footer")?.textContent ?? "";
    expect(footer).toMatch(/TheSkyLive/i);
    expect(footer).toMatch(/Eyes on the Solar System/i);
    expect(footer).toMatch(/original/i);
  });

  it("ends on the observable universe, not on an edge of everything", () => {
    const ending = home.querySelector(".ending")?.textContent ?? "";
    expect(ending.trim().length).toBeGreaterThan(40);
    const journey = home.querySelector(".journey")?.textContent ?? "";
    expect(journey).toMatch(/Not the edge of the universe/i);
  });
});

it("honours prefers-reduced-motion", () => {
  expect(
    /prefers-reduced-motion\s*:\s*reduce/i.test(cssFiles()),
    "no @media (prefers-reduced-motion: reduce) rule found in the built CSS",
  ).toBe(true);
});

describe("GitHub Pages subpath safety", () => {
  it("never emits a root-relative href or src", () => {
    for (const { path, doc } of pages) {
      for (const element of doc.querySelectorAll("[href], [src]")) {
        const attribute = element.hasAttribute("href") ? "href" : "src";
        const value = element.getAttribute(attribute) ?? "";
        expect(
          value.startsWith("/") && !value.startsWith("//"),
          `${path}: <${element.tagName.toLowerCase()} ${attribute}="${value}"> is root-relative and will 404 under the GitHub Pages subpath — use a relative path instead`,
        ).toBe(false);
      }
    }
  });
});
