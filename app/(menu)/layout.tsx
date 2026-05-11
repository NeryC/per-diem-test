import type { ReactNode } from "react";

export default function MenuLayout({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 pb-6"
    >
      {children}
    </main>
  );
}
