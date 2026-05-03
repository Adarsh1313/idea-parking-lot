import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";

if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, "crypto", {
    value: {
      randomUUID: () => `test-id-${Math.random().toString(16).slice(2)}`
    }
  });
}
