"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { CartLine } from "./cart-line";
import { cartCount, cartSubtotal } from "@/lib/cart/selectors";
import { useCart } from "@/lib/cart/store";
import { formatMoney } from "@/lib/money";
import { useHasMounted } from "@/lib/use-has-mounted";

/**
 * CartDrawer
 *
 * useHasMounted defers the persisted-state read to client mount so
 * the SSR pass renders an empty button — matches the first client
 * render and avoids a hydration mismatch warning.
 */
export function CartDrawer(): ReactNode {
  const lines = useCart((s) => s.lines);
  const drawerOpen = useCart((s) => s.drawerOpen);
  const setDrawerOpen = useCart((s) => s.setDrawerOpen);
  const mounted = useHasMounted();

  if (!mounted) {
    return (
      <Button variant="outline" disabled>
        Cart
      </Button>
    );
  }

  const count = cartCount({ locationId: null, lines });
  const subtotal = cartSubtotal({ locationId: null, lines });

  return (
    <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
      <SheetTrigger
        render={
          <Button
            variant="outline"
            aria-label={`Open cart, ${count.toString()} items`}
          >
            Cart
            <span
              className="bg-primary text-primary-foreground ml-2 rounded px-1.5 text-xs"
              aria-live="polite"
            >
              {count}
            </span>
          </Button>
        }
      />
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Your cart</SheetTitle>
          <SheetDescription>
            Items are reserved at this location only.
          </SheetDescription>
        </SheetHeader>
        {lines.length === 0 ? (
          <p className="text-muted-foreground mt-4">
            Your cart is empty. Browse the menu to get started.
          </p>
        ) : (
          <ul className="mt-4 flex-1 overflow-auto">
            {lines.map((l) => (
              <CartLine key={l.lineId} line={l} />
            ))}
          </ul>
        )}
        <div className="mt-4 border-t pt-4">
          <div className="flex items-center justify-between">
            <span className="font-medium">Subtotal</span>
            <span className="font-semibold">{formatMoney(subtotal)}</span>
          </div>
          <Button className="mt-3 w-full" disabled>
            Checkout (coming soon)
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
