"use client";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Props = {
  value: string;
  onChange: (q: string) => void;
};

/**
 * SearchBar owns the *visible* input state so typing never lags by a
 * debounce tick. The parent's `value` is treated as a one-shot
 * initializer (controlled inputs whose source-of-truth lives in the
 * child would force the user to wait 150ms between keystrokes for
 * the filter state to round-trip back). The latest `onChange` is read
 * through a ref so the debounce effect doesn't have to re-subscribe
 * every render — this is the React-19-safe substitute for
 * useEffectEvent until it ships stable.
 */
export function SearchBar({ value, onChange }: Props) {
  const [local, setLocal] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateQueryDebounced = (e: ChangeEvent<HTMLInputElement>): void => {
    const next = e.target.value;
    setLocal(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onChangeRef.current(next), 150);
  };

  const clearQuery = (): void => {
    setLocal("");
    if (timer.current) clearTimeout(timer.current);
    onChangeRef.current("");
  };

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex w-full max-w-md items-center gap-2">
      <Input
        ref={ref}
        type="search"
        value={local}
        onChange={updateQueryDebounced}
        placeholder="Search menu (press / to focus)"
        aria-label="Search menu"
      />
      {local.length > 0 && (
        <Button variant="ghost" size="sm" onClick={clearQuery}>
          Clear
        </Button>
      )}
    </div>
  );
}
