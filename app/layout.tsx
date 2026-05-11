import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { TimeSimulatorBanner } from "@/components/menu/time-simulator-banner";
import { RegisterServiceWorker } from "@/components/register-sw";
import { TimeProvider } from "@/lib/time/provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Per Diem Test — Square menu browser",
  description:
    "Browse menus by location with real-time availability. Take-home for Per Diem.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="focus:bg-primary focus:text-primary-foreground sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:px-3 focus:py-2"
        >
          Skip to main content
        </a>
        <Suspense fallback={null}>
          <TimeProvider>
            <TimeSimulatorBanner />
            <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 pt-6 pb-2">
              <Link
                href="/"
                className="text-2xl font-semibold tracking-tight hover:underline"
              >
                Per Diem Test
              </Link>
              <CartDrawer />
            </header>
            {children}
          </TimeProvider>
        </Suspense>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
