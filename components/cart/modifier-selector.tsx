"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { formatMoney, parseMoney, zeroMoney } from "@/lib/money";
import type { SelectedModifier } from "@/lib/cart/types";
import type { WireItem, WireModifierList, WireMoney } from "@/lib/types";

/**
 * ModifierSelector
 *
 * Enforces Square's selection_type and min/max constraints exactly
 * as modeled on the catalog, including per-item enabled and
 * min/maxSelectedOverride flags. Validation errors flow back via the
 * onChange callback so the parent decides whether to disable the
 * add-to-cart button — the selector itself stays stateless about
 * cart concerns.
 *
 * Refs: spec §4.2
 */

export interface ModifierSelectorProps {
  item: WireItem;
  modifierLists: WireModifierList[];
  currency: string;
  onChange: (selected: SelectedModifier[], errors: string[]) => void;
}

interface ResolvedList extends WireModifierList {
  minSel: number;
  maxSel: number;
}

type SelectionMap = Record<string, Set<string>>;

function resolveLists(item: WireItem, all: WireModifierList[]): ResolvedList[] {
  const out: ResolvedList[] = [];
  for (const info of item.modifierListInfo) {
    if (!info.enabled) continue;
    const list = all.find((ml) => ml.id === info.modifierListId);
    if (!list) continue;
    const minSel = info.minSelectedOverride ?? list.minSelected ?? 0;
    const maxSel =
      info.maxSelectedOverride ?? list.maxSelected ?? Number.POSITIVE_INFINITY;
    out.push({ ...list, minSel, maxSel });
  }
  return out;
}

function priceMoneyOrZero(m: WireMoney | null, currency: string) {
  return m ? parseMoney(m) : zeroMoney(currency);
}

export function ModifierSelector({
  item,
  modifierLists,
  currency,
  onChange,
}: ModifierSelectorProps): ReactNode {
  const lists = resolveLists(item, modifierLists);

  const [selection, setSelection] = useState<SelectionMap>(() => {
    const init: SelectionMap = {};
    for (const l of lists) init[l.id] = new Set<string>();
    return init;
  });

  function emit(next: SelectionMap): void {
    setSelection(next);
    const flat: SelectedModifier[] = [];
    const errors: string[] = [];
    for (const list of lists) {
      const sel = next[list.id] ?? new Set<string>();
      if (sel.size < list.minSel) {
        errors.push(
          `Select at least ${list.minSel.toString()} from ${list.name}`,
        );
      }
      if (sel.size > list.maxSel) {
        errors.push(
          `Select at most ${list.maxSel.toString()} from ${list.name}`,
        );
      }
      for (const modId of sel) {
        const mod = list.modifiers.find((m) => m.id === modId);
        if (!mod) continue;
        flat.push({
          modifierId: mod.id,
          modifierListId: list.id,
          name: mod.name,
          priceMoney: priceMoneyOrZero(mod.priceMoney, currency),
        });
      }
    }
    onChange(flat, errors);
  }

  function toggle(listId: string, modifierId: string): void {
    const list = lists.find((l) => l.id === listId);
    if (!list) return;
    const current = new Set(selection[listId]);
    if (list.selectionType === "SINGLE") {
      current.clear();
      current.add(modifierId);
    } else if (current.has(modifierId)) {
      current.delete(modifierId);
    } else {
      if (current.size >= list.maxSel) return;
      current.add(modifierId);
    }
    emit({ ...selection, [listId]: current });
  }

  if (lists.length === 0) return null;

  return (
    <div className="mt-6 space-y-4">
      {lists.map((list) => (
        <fieldset
          key={list.id}
          role={list.selectionType === "SINGLE" ? "radiogroup" : "group"}
          aria-label={list.name}
        >
          <legend className="text-sm font-medium">
            {list.name}
            {list.minSel > 0 && (
              <span className="text-muted-foreground ml-1 text-xs">
                (choose{" "}
                {list.minSel === list.maxSel
                  ? `${list.minSel.toString()}`
                  : `${list.minSel.toString()}-${
                      Number.isFinite(list.maxSel)
                        ? list.maxSel.toString()
                        : "any"
                    }`}
                )
              </span>
            )}
          </legend>
          <div className="mt-2 space-y-1">
            {list.modifiers.map((m) => {
              const selected = selection[list.id]?.has(m.id) ?? false;
              const inputType =
                list.selectionType === "SINGLE" ? "radio" : "checkbox";
              return (
                <label
                  key={m.id}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <input
                    type={inputType}
                    name={list.id}
                    checked={selected}
                    onChange={() => {
                      toggle(list.id, m.id);
                    }}
                  />
                  <span>{m.name}</span>
                  {m.priceMoney && (
                    <span className="text-muted-foreground">
                      +{formatMoney(parseMoney(m.priceMoney))}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
