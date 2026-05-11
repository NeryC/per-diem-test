"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import type { WireCategory } from "@/lib/types";

export interface CategoryFilterEntry {
  category: WireCategory | null;
  count: number;
}

export interface CategoryFilterProps {
  categories: CategoryFilterEntry[];
  /** null means "All". */
  selected: string | null;
  onChange: (id: string | null) => void;
}

/**
 * Horizontal-scrollable chip row. Selected chip uses default variant; the
 * rest use outline. The "All" chip is always first so the user can clear
 * the filter without hunting.
 */
export function CategoryFilter({
  categories,
  selected,
  onChange,
}: CategoryFilterProps): ReactNode {
  const total = categories.reduce((acc, c) => acc + c.count, 0);

  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex gap-2 pb-2">
        <Button
          variant={selected === null ? "default" : "outline"}
          onClick={() => onChange(null)}
          aria-pressed={selected === null}
        >
          All
          <Badge variant="secondary" className="ml-2">
            {total}
          </Badge>
        </Button>
        {categories.map(({ category, count }) => {
          const id = category?.id ?? "__uncategorized";
          const name = category?.name ?? "Other";
          const active = selected === id;
          return (
            <Button
              key={id}
              variant={active ? "default" : "outline"}
              onClick={() => onChange(id)}
              aria-pressed={active}
            >
              {name}
              <Badge variant="secondary" className="ml-2">
                {count}
              </Badge>
            </Button>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
