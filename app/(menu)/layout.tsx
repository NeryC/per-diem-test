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
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">
            Per Diem Test
          </h1>
          <CartDrawer />
        </header>
        <main id="main" className="flex flex-1 flex-col gap-6">
          {children}
        </main>
      </div>
    </>
  );
}
