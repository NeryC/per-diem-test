"use client";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Props = {
  value: string;
  onChange: (q: string) => void;
};

export function SearchBar({ value, onChange }: Props) {
  const [local, setLocal] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- local mirrors parent value to allow uncontrolled debouncing
  useEffect(() => setLocal(value), [value]);

  useEffect(() => {
    const id = setTimeout(() => onChange(local), 150);
    return () => clearTimeout(id);
  }, [local, onChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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
        onChange={(e) => setLocal(e.target.value)}
        placeholder="Search menu (press / to focus)"
        aria-label="Search menu"
      />
      {local.length > 0 && (
        <Button variant="ghost" size="sm" onClick={() => setLocal("")}>
          Clear
        </Button>
      )}
    </div>
  );
}
