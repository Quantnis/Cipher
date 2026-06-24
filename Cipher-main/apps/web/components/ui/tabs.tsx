"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Tabs({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (tab: string) => void }) {
  return (
    <div className="inline-flex rounded-md border bg-background p-1">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={cn("rounded px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors", active === tab && "bg-secondary text-foreground")}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
