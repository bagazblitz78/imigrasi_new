import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// jsdom does not implement matchMedia / scrollTo used by some components.
window.matchMedia =
  window.matchMedia ||
  (() => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));

if (!window.URL.createObjectURL) {
  window.URL.createObjectURL = vi.fn(() => "blob:mock");
  window.URL.revokeObjectURL = vi.fn();
}
