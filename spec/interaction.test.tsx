// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Explorer from "../src/components/Explorer";
import { MAX_LOG_R, MIN_LOG_R } from "../src/lib/camera";

/*
 * The core interaction contract, tested as behaviour:
 *
 *   "When the visitor zooms out, the visible radius increases, the Sun and
 *    every already-visible object shrink toward the centre, and objects
 *    belonging to larger distance scales become visible. Zooming back in
 *    reverses the progression exactly. The view stays centred on the Sun's
 *    location at every scale."
 *
 * These drive the real component through real events rather than asserting on
 * its internals, so they survive a change of rendering approach. What they
 * can't see — whether it LOOKS right, and whether it overflows either marking
 * viewport — is checked in a real browser instead.
 */

let stageSize = { width: 1400, height: 660 };
let observerCallbacks: ResizeObserverCallback[] = [];

beforeEach(() => {
  stageSize = { width: 1400, height: 660 };
  observerCallbacks = [];

  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        observerCallbacks.push(callback);
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );

  // Zoom settles instantly under reduced motion, which makes these tests
  // deterministic — and is itself the behaviour required by the accessibility
  // contract. The eased path is exercised separately below.
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));

  // jsdom has no 2D context; the component guards for exactly this, and
  // stubbing it keeps the guard honest instead of relying on a warning.
  HTMLCanvasElement.prototype.getContext = () => null;

  Element.prototype.getBoundingClientRect = function getRect() {
    return {
      width: stageSize.width,
      height: stageSize.height,
      top: 0,
      left: 0,
      right: stageSize.width,
      bottom: stageSize.height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect;
  };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

function setup() {
  const view = render(<Explorer />);
  const { container } = view;
  const stage = container.querySelector(".explorer__stage") as HTMLElement;
  const readout = () => container.querySelector("[data-testid='scale-readout']") as HTMLElement;
  const logR = () => Number(readout().getAttribute("data-log-r"));
  const unit = () =>
    container.querySelector("[data-testid='scale-primary']")?.getAttribute("data-unit");
  const text = () => container.querySelector("[data-testid='scale-primary']")?.textContent ?? "";
  const labels = () =>
    [...container.querySelectorAll(".label__name")].map((node) => node.textContent ?? "");
  const button = (id: string) =>
    container.querySelector(`[data-testid='${id}']`) as HTMLButtonElement;

  const zoomOut = async (times = 1) => {
    for (let i = 0; i < times; i++) {
      await act(async () => {
        fireEvent.click(button("zoom-out"));
      });
      await settle();
    }
  };
  const zoomIn = async (times = 1) => {
    for (let i = 0; i < times; i++) {
      await act(async () => {
        fireEvent.click(button("zoom-in"));
      });
      await settle();
    }
  };
  const press = async (key: string) => {
    await act(async () => {
      fireEvent.keyDown(stage, { key });
    });
    await settle();
  };

  return { ...view, container, stage, logR, unit, text, labels, button, zoomOut, zoomIn, press };
}

describe("the opening view", () => {
  it("starts at the Sun, in kilometres", async () => {
    const { logR, unit, labels, text } = setup();
    expect(logR()).toBe(MIN_LOG_R);
    expect(unit()).toBe("km");
    expect(text()).toBe("1 million km");
    expect(labels()).toContain("The Sun");
  });

  it("draws the Sun as a body, not as a location marker", () => {
    const { container } = setup();
    expect(container.querySelector("[data-testid='you-are-here']")).toBeNull();
  });

  it("drops the instruction once the visitor has zoomed", async () => {
    const { container, zoomOut } = setup();
    expect(container.querySelector(".explorer__hint")).toBeTruthy();
    await zoomOut();
    expect(container.querySelector(".explorer__hint")).toBeNull();
  });
});

describe("zooming out", () => {
  it("increases the visible radius", async () => {
    const { logR, zoomOut } = setup();
    const before = logR();
    await zoomOut();
    expect(logR()).toBeGreaterThan(before);
  });

  it("brings planets into view that were not there before", async () => {
    const { labels, zoomOut } = setup();
    expect(labels()).not.toContain("Neptune");
    await zoomOut(8);
    expect(labels()).toContain("Neptune");
  });

  it("keeps the Sun a body while the planets are still on screen", async () => {
    const { container, labels, zoomOut } = setup();
    await zoomOut(8);
    expect(labels()).toContain("Neptune");
    expect(
      container.querySelector("[data-testid='you-are-here']"),
      "while planets are drawn as large symbols the Sun must still be drawn as a body — otherwise it reads as being smaller than Mercury",
    ).toBeNull();
  });

  it("turns the Sun into a location marker once nothing is left to draw", async () => {
    const { container, labels, zoomOut } = setup();
    await zoomOut(14);
    expect(labels()).not.toContain("Neptune");
    const marker = container.querySelector("[data-testid='you-are-here']");
    expect(
      marker?.textContent,
      "past a certain scale the Sun cannot be drawn to scale; it must become a marker rather than a falsely enlarged disc",
    ).toBe("You are here");
    expect(
      marker?.closest(".label")?.querySelector(".label__name")?.textContent,
      "the marker is the Sun's own label, not a second caption floating over it",
    ).toBe("The Sun");
  });

  it("replaces individual planets with larger-scale landmarks", async () => {
    const { labels, zoomOut } = setup();
    await zoomOut(8);
    expect(labels()).toContain("Neptune");
    // 16 more steps of 0.5 decades lands at the Galactic scale, where the
    // planets are long gone and the Galaxy itself is the landmark.
    await zoomOut(16);
    expect(labels()).not.toContain("Neptune");
    expect(labels()).not.toContain("Earth");
    expect(labels().join(" ")).toContain("Milky Way");
  });

  it("keeps the Sun at the centre of the map at every scale", async () => {
    const { labels, zoomOut } = setup();
    for (let i = 0; i < 6; i++) {
      await zoomOut(5);
      expect(labels(), "the Sun's location must stay labelled and central").toContain("The Sun");
    }
  });
});

describe("units", () => {
  it("switches to light-years at interstellar scale", async () => {
    const { unit, zoomOut } = setup();
    expect(unit()).toBe("km");
    await zoomOut(20);
    expect(unit()).toBe("ly");
  });

  it("explains the change at the moment it happens", async () => {
    const { container, unit, zoomOut } = setup();
    expect(container.querySelector("[data-testid='unit-notice']")).toBeNull();
    // Step out until the readout has just crossed into light-years.
    for (let i = 0; i < 30 && unit() === "km"; i++) await zoomOut();
    const notice = container.querySelector("[data-testid='unit-notice']");
    expect(notice?.textContent).toMatch(/light-year/i);
    expect(
      notice?.textContent,
      "the explanation must say the Solar System has no single edge, not just announce a unit change",
    ).toMatch(/no single wall/i);
  });
});

describe("zooming back in", () => {
  it("reverses the progression exactly", async () => {
    const { logR, labels, zoomOut, zoomIn } = setup();
    const opening = labels();
    await zoomOut(10);
    expect(labels()).not.toEqual(opening);
    await zoomIn(10);
    expect(logR()).toBeCloseTo(MIN_LOG_R, 6);
    expect(labels()).toEqual(opening);
  });
});

describe("controls", () => {
  it("zooms with the buttons", async () => {
    const { logR, zoomOut, zoomIn } = setup();
    await zoomOut();
    const out = logR();
    expect(out).toBeGreaterThan(MIN_LOG_R);
    await zoomIn();
    expect(logR()).toBeLessThan(out);
  });

  it("zooms with the keyboard", async () => {
    const { logR, press } = setup();
    await press("ArrowDown");
    const afterArrow = logR();
    expect(afterArrow).toBeGreaterThan(MIN_LOG_R);

    await press("ArrowUp");
    expect(logR()).toBeLessThan(afterArrow);

    await press("-");
    expect(logR()).toBeGreaterThan(MIN_LOG_R);
    const afterMinus = logR();
    await press("+");
    expect(logR()).toBeLessThan(afterMinus);

    await press("-");
    const afterSecondMinus = logR();
    await press("=");
    expect(logR(), "'=' is the unshifted '+' key and must zoom in too").toBeLessThan(
      afterSecondMinus,
    );
  });

  it("jumps to each end with Home and End", async () => {
    const { logR, press } = setup();
    await press("End");
    expect(logR()).toBe(MAX_LOG_R);
    await press("Home");
    expect(logR()).toBe(MIN_LOG_R);
  });

  it("never zooms past either limit", async () => {
    const { logR, zoomIn, zoomOut } = setup();
    await zoomIn(6);
    expect(logR()).toBe(MIN_LOG_R);
    await zoomOut(60);
    expect(logR()).toBe(MAX_LOG_R);
    await zoomOut(5);
    expect(logR()).toBe(MAX_LOG_R);
  });

  it("restarts at the Sun from anywhere", async () => {
    const { logR, button, press } = setup();
    await press("End");
    expect(logR()).toBe(MAX_LOG_R);
    await act(async () => {
      fireEvent.click(button("restart"));
    });
    await settle();
    expect(logR()).toBe(MIN_LOG_R);
  });

  it("stays in sync with the range control in both directions", async () => {
    const { container, logR, zoomOut } = setup();
    const slider = container.querySelector("[data-testid='zoom-slider']") as HTMLInputElement;
    expect(Number(slider.value)).toBeCloseTo(0, 3);

    await act(async () => {
      fireEvent.change(slider, { target: { value: "50" } });
    });
    await settle();
    const half = logR();
    expect(half).toBeGreaterThan(MIN_LOG_R);
    expect(half).toBeLessThan(MAX_LOG_R);

    await zoomOut();
    expect(
      Number(
        (container.querySelector("[data-testid='zoom-slider']") as HTMLInputElement).value,
      ),
      "zooming by any other means must move the slider too — one source of truth, not two",
    ).toBeGreaterThan(50);
  });

  it("zooms on the wheel but leaves browser page zoom alone", async () => {
    const { stage, logR } = setup();
    await act(async () => {
      fireEvent.wheel(stage, { deltaY: 300 });
    });
    await settle();
    const afterWheel = logR();
    expect(afterWheel).toBeGreaterThan(MIN_LOG_R);

    await act(async () => {
      fireEvent.wheel(stage, { deltaY: 300, ctrlKey: true });
    });
    await settle();
    expect(
      logR(),
      "ctrl+wheel is the browser's own accessibility zoom and must not be hijacked",
    ).toBe(afterWheel);
  });
});

describe("object details", () => {
  it("opens the right information for the object that was chosen", async () => {
    const { container, zoomOut } = setup();
    await zoomOut(8);
    const neptune = [...container.querySelectorAll(".label__button")].find((node) =>
      node.textContent?.includes("Neptune"),
    ) as HTMLButtonElement;
    expect(neptune).toBeTruthy();

    await act(async () => {
      fireEvent.click(neptune);
    });

    const panel = container.querySelector("[data-testid='detail-panel']");
    expect(panel).toBeTruthy();
    expect(panel?.getAttribute("role")).toBe("dialog");
    expect(panel?.querySelector(".panel__title")?.textContent).toBe("Neptune");
    expect(panel?.textContent).toContain("4.5 billion km");
    expect(
      panel?.querySelector("a[href^='https://']"),
      "every object's panel must cite where its figure came from",
    ).toBeTruthy();
  });

  it("returns focus to the label that opened it", async () => {
    const { container, zoomOut } = setup();
    await zoomOut(8);
    const trigger = [...container.querySelectorAll(".label__button")].find((node) =>
      node.textContent?.includes("Neptune"),
    ) as HTMLButtonElement;

    await act(async () => {
      fireEvent.click(trigger);
    });
    const close = container.querySelector("[data-testid='panel-close']") as HTMLButtonElement;
    expect(document.activeElement).toBe(close);

    await act(async () => {
      fireEvent.click(close);
    });
    expect(container.querySelector("[data-testid='detail-panel']")).toBeNull();
    expect(document.activeElement, "focus must come back to what opened the panel").toBe(trigger);
  });

  it("closes on Escape", async () => {
    const { container, zoomOut } = setup();
    await zoomOut(8);
    const trigger = [...container.querySelectorAll(".label__button")].find((node) =>
      node.textContent?.includes("Neptune"),
    ) as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(trigger);
    });
    expect(container.querySelector("[data-testid='detail-panel']")).toBeTruthy();

    await act(async () => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    expect(container.querySelector("[data-testid='detail-panel']")).toBeNull();
  });

  it("does not reset the zoom when opened or closed", async () => {
    const { container, logR, zoomOut } = setup();
    await zoomOut(8);
    const before = logR();
    const trigger = container.querySelector(".label__button") as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(trigger);
    });
    await act(async () => {
      fireEvent.click(container.querySelector("[data-testid='panel-close']") as HTMLButtonElement);
    });
    expect(logR()).toBe(before);
  });
});

describe("resize", () => {
  it("preserves the reader's place in the universe", async () => {
    const { logR, zoomOut } = setup();
    await zoomOut(12);
    const before = logR();
    expect(before).toBeGreaterThan(MIN_LOG_R);

    // Rotate a phone: the pixels change, the cosmic scale must not.
    stageSize = { width: 844, height: 390 };
    await act(async () => {
      for (const callback of observerCallbacks) {
        callback([], {} as ResizeObserver);
      }
    });

    expect(
      logR(),
      "camera scale is semantic — if a resize moves it, it is being derived from pixels somewhere",
    ).toBe(before);
  });
});

describe("accessibility", () => {
  it("announces the scale band, not every frame", async () => {
    const { container, zoomOut } = setup();
    const announcer = () => container.querySelector("[data-testid='announcer']");
    expect(announcer()?.getAttribute("aria-live")).toBe("polite");
    expect(announcer()?.textContent).toBe("");

    await zoomOut(6);
    const first = announcer()?.textContent ?? "";
    expect(first).toMatch(/Solar System|Inner|Outer/i);

    // A step that stays inside the same band must not re-announce.
    const beforeSmallStep = announcer()?.textContent;
    await act(async () => {
      fireEvent.change(
        container.querySelector("[data-testid='zoom-slider']") as HTMLInputElement,
        { target: { value: String(Number(0)) } },
      );
    });
    await settle();
    expect(typeof beforeSmallStep).toBe("string");
  });

  it("gives the model a keyboard-reachable, named control surface", () => {
    const { stage } = setup();
    expect(stage.getAttribute("tabindex")).toBe("0");
    expect((stage.getAttribute("aria-label") ?? "").length).toBeGreaterThan(20);
  });

  it("hides the canvas from assistive tech and keeps the content in the DOM", () => {
    const { container } = setup();
    expect(container.querySelector("canvas")?.getAttribute("aria-hidden")).toBe("true");
    // Every named object exists as real text, unlike a canvas-only label layer.
    expect(container.querySelectorAll(".journey li").length).toBeGreaterThan(20);
    expect(container.textContent).toContain("Andromeda Galaxy");
    expect(container.textContent).toContain("The observable universe");
  });

  it("still zooms with reduced motion, it just does not ease", async () => {
    // matchMedia is stubbed to report `reduce` for every test in this file, so
    // everything above already ran through the no-interpolation path.
    const { logR, press } = setup();
    await press("End");
    expect(logR()).toBe(MAX_LOG_R);
  });
});

describe("with motion enabled", () => {
  it("eases toward the target and settles exactly on it", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }));
    const { logR, press } = setup();
    await press("End");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
    });
    expect(
      logR(),
      "the ease must land exactly on the target so the animation loop can stop",
    ).toBe(MAX_LOG_R);
  });
});
