import { describe, expect, it, beforeEach } from "vitest";
import { readCache, writeCache, clearCache } from "@/lib/offline-cache";

beforeEach(() => {
  localStorage.clear();
});

describe("offline-cache", () => {
  it("round-trips a value through localStorage", () => {
    writeCache("test:v1", { name: "Latte", price: 350 });
    const entry = readCache<{ name: string; price: number }>("test:v1");
    expect(entry).not.toBeNull();
    expect(entry?.value).toEqual({ name: "Latte", price: 350 });
    expect(typeof entry?.savedAt).toBe("number");
    expect(entry?.savedAt ?? 0).toBeGreaterThan(0);
  });

  it("returns null when key is missing", () => {
    expect(readCache("test:missing")).toBeNull();
  });

  it("returns null and clears the key when stored JSON is corrupted", () => {
    localStorage.setItem("test:corrupt", "not-json{");
    expect(readCache("test:corrupt")).toBeNull();
    expect(localStorage.getItem("test:corrupt")).toBeNull();
  });

  it("clearCache removes the key", () => {
    writeCache("test:v1", { a: 1 });
    clearCache("test:v1");
    expect(readCache("test:v1")).toBeNull();
  });

  it("does not throw under SSR-like conditions", () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      "localStorage",
    );
    // Simulate SSR by removing the global. The setup shim defined it
    // as a configurable property, so this is safe to delete and restore.
    // @ts-expect-error -- intentionally removing the global to test SSR fallback
    delete globalThis.localStorage;
    try {
      expect(readCache("test:v1")).toBeNull();
      expect(() => writeCache("test:v1", { a: 1 })).not.toThrow();
      expect(() => clearCache("test:v1")).not.toThrow();
    } finally {
      if (descriptor) {
        Object.defineProperty(globalThis, "localStorage", descriptor);
      }
    }
  });
});
