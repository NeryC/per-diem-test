"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart/store";
import { lineItemTotal } from "@/lib/cart/selectors";
import type { CartLineItem } from "@/lib/cart/types";
import { formatMoney } from "@/lib/money";

export function CartLine({ line }: { line: CartLineItem }): ReactNode {
  const updateQty = useCart((s) => s.updateQty);
  const removeLine = useCart((s) => s.removeLine);
  return (
    <li className="border-b py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            {line.itemName}{" "}
            <span className="text-muted-foreground">
              — {line.variationName}
            </span>
          </p>
          {line.modifiers.length > 0 && (
            <ul className="text-muted-foreground mt-1 flex flex-wrap gap-1 text-xs">
              {line.modifiers.map((m, i) => (
                <li
                  key={`${m.modifierId}-${i.toString()}`}
                  className="bg-muted rounded px-1.5 py-0.5"
                >
                  {m.name}
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="text-sm font-medium">
          {formatMoney(lineItemTotal(line))}
        </p>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            updateQty(line.lineId, line.qty - 1);
          }}
          aria-label="Decrease quantity"
        >
          −
        </Button>
        <span className="w-6 text-center" aria-live="polite">
          {line.qty}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            updateQty(line.lineId, line.qty + 1);
          }}
          aria-label="Increase quantity"
        >
          +
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            removeLine(line.lineId);
          }}
        >
          Remove
        </Button>
      </div>
    </li>
  );
}
