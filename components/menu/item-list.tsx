"use client";

import type { ReactNode } from "react";
import { ItemCard } from "@/components/menu/item-card";
import type { CategoryGroup } from "@/lib/menu";

export interface ItemListProps {
  groups: CategoryGroup[];
}

export function ItemList({ groups }: ItemListProps): ReactNode {
  return (
    <div className="flex flex-col gap-8">
      {groups.map((group) => {
        const key = group.category?.id ?? "__uncategorized";
        const name = group.category?.name ?? "Other";
        return (
          <section key={key} className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight">{name}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {group.items.map((item) => (
                <ItemCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
