import type { ReactNode } from "react";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { TimeSimulatorBanner } from "@/components/menu/time-simulator-banner";

export default function MenuLayout({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <>
      <TimeSimulatorBanner />
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">
            Per Diem Menu
          </h1>
          <CartDrawer />
        </header>
        {children}
      </div>
    </>
  );
}
