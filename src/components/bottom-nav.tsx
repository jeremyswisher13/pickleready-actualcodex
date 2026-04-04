"use client";

import type { LucideIcon } from "lucide-react";
import { Activity, BarChart3, Home, Settings2, Users } from "lucide-react";

import { cn } from "@/lib/utils";

export type TabId = "home" | "stats" | "matches" | "players" | "settings";

const tabs: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "stats", label: "Stats", icon: BarChart3 },
  { id: "matches", label: "Matches", icon: Activity },
  { id: "players", label: "Players", icon: Users },
  { id: "settings", label: "Settings", icon: Settings2 }
];

export const BottomNav = ({
  activeTab,
  onChange
}: {
  activeTab: TabId;
  onChange: (tab: TabId) => void;
}) => (
  <div className="sticky bottom-4 z-20 mx-4 mt-6 rounded-[26px] border border-white/70 bg-white/90 px-2 py-2 shadow-[0_18px_45px_rgba(17,34,68,0.12)] backdrop-blur-md">
    <div className="grid grid-cols-5 gap-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = tab.id === activeTab;

        return (
          <button
            key={tab.id}
            className={cn(
              "flex flex-col items-center gap-1 rounded-[18px] px-2 py-2 text-[11px] font-semibold transition",
              active ? "bg-gradient-to-br from-cyan-100 via-blue-50 to-violet-100 text-blue-700" : "text-muted"
            )}
            onClick={() => onChange(tab.id)}
            type="button"
          >
            <Icon className={cn("h-4 w-4", active ? "text-blue-700" : "text-muted")} strokeWidth={2.25} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  </div>
);
