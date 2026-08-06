import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

if (typeof window !== "undefined") {
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false
      })
    });
  }

  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = () => undefined;
  }
}

if (!("ResizeObserver" in globalThis)) {
  class ResizeObserver {
    observe() {
      return undefined;
    }

    unobserve() {
      return undefined;
    }

    disconnect() {
      return undefined;
    }
  }

  vi.stubGlobal("ResizeObserver", ResizeObserver);
}
