"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { CartLineItem, CartState } from "./types";

/**
 * Cart store with bigint-aware localStorage persistence.
 *
 * setLocation returns needsConfirm so the caller can render a modal
 * instead of silently nuking lines. updateQty drops zero-qty lines so
 * the UI never has to special-case '0 of X' rows. The persist storage
 * wraps JSON.parse/stringify with reviver/replacer pairs that round-
 * trip bigints through a 'NNNn' suffix; without this, money amounts
 * serialize to strings and silently break arithmetic on rehydrate.
 */

interface CartUiState {
  drawerOpen: boolean;
}

interface CartActions {
  setLocation: (locationId: string) => { needsConfirm: boolean };
  forceSetLocationAndClear: (locationId: string) => void;
  addLine: (line: Omit<CartLineItem, "lineId">) => void;
  updateQty: (lineId: string, qty: number) => void;
  removeLine: (lineId: string) => void;
  clear: () => void;
  setDrawerOpen: (open: boolean) => void;
}

type CartStore = CartState & CartUiState & CartActions;

/**
 * The subset of CartStore that survives a page reload. drawerOpen is
 * transient UI and stays out so the drawer never reappears on its own.
 * Functions are not persisted by the JSON serializer anyway.
 */
type PersistedCart = Pick<CartStore, "locationId" | "lines">;

function uuid(): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }
  return `l-${Date.now().toString()}-${Math.random().toString(36).slice(2, 10)}`;
}

const BIGINT_PATTERN = /^\d+n$/;

const storage = createJSONStorage<PersistedCart>(() => localStorage, {
  reviver: (key: string, value: unknown): unknown => {
    if (
      key === "amount" &&
      typeof value === "string" &&
      BIGINT_PATTERN.test(value)
    ) {
      return BigInt(value.slice(0, -1));
    }
    return value;
  },
  replacer: (_key: string, value: unknown): unknown => {
    if (typeof value === "bigint") return `${value.toString()}n`;
    return value;
  },
});

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      locationId: null,
      lines: [],
      drawerOpen: false,
      setLocation: (locationId: string): { needsConfirm: boolean } => {
        const current = get().locationId;
        if (current === null || current === locationId) {
          set({ locationId });
          return { needsConfirm: false };
        }
        if (get().lines.length === 0) {
          set({ locationId });
          return { needsConfirm: false };
        }
        // Caller renders a confirm dialog; do not mutate yet.
        return { needsConfirm: true };
      },
      forceSetLocationAndClear: (locationId: string): void => {
        set({ locationId, lines: [] });
      },
      addLine: (line: Omit<CartLineItem, "lineId">): void => {
        set((s) => {
          if (s.locationId !== null && s.locationId !== line.locationId) {
            throw new Error(
              `Cart locationId mismatch: store=${s.locationId}, line=${line.locationId}. ` +
                `Use forceSetLocationAndClear before adding lines from a different location.`,
            );
          }
          return {
            locationId: s.locationId ?? line.locationId,
            lines: [...s.lines, { ...line, lineId: uuid() }],
          };
        });
      },
      updateQty: (lineId: string, qty: number): void => {
        set((s) => ({
          lines: s.lines
            .map((l) => (l.lineId === lineId ? { ...l, qty } : l))
            .filter((l) => l.qty > 0),
        }));
      },
      removeLine: (lineId: string): void => {
        set((s) => ({ lines: s.lines.filter((l) => l.lineId !== lineId) }));
      },
      clear: (): void => {
        set({ lines: [] });
      },
      setDrawerOpen: (open: boolean): void => {
        set({ drawerOpen: open });
      },
    }),
    {
      name: "perdiem-cart-v1",
      storage,
      version: 1,
      // Persist only the durable shopping state. drawerOpen is transient UI
      // and must not survive a reload — otherwise the drawer reappears every
      // time the user lands on the page. Zustand merges the persisted subset
      // back into the full default state on rehydrate, so drawerOpen keeps
      // its initial false.
      partialize: (state): PersistedCart => ({
        locationId: state.locationId,
        lines: state.lines,
      }),
    },
  ),
);
