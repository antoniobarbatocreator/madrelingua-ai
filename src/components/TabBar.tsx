import React from "react";
import { Tab } from "../types";
import { Home, Clock, Settings, Info } from "lucide-react";

interface TabBarProps {
  activeTab: Tab;
  onChangeTab: (tab: Tab) => void;
  historyCount?: number;
}

const TABS: { id: Tab; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { id: "home", label: "Home", Icon: Home },
  { id: "history", label: "Cronologia", Icon: Clock },
  { id: "settings", label: "Impostazioni", Icon: Settings },
  { id: "about", label: "Info", Icon: Info },
];

export const TabBar: React.FC<TabBarProps> = ({ activeTab, onChangeTab, historyCount }) => (
  <nav className="bg-card border-t-2 border-warm pb-safe shrink-0">
    <div className="max-w-lg mx-auto flex">
      {TABS.map(({ id, label, Icon }) => {
        const active = activeTab === id;
        return (
          <button
            key={id}
            onClick={() => onChangeTab(id)}
            className={`flex-1 flex flex-col items-center gap-0.5 pt-2.5 pb-2 relative transition-colors cursor-pointer ${
              active ? "text-[#C2630B]" : "text-[#B5A99A] hover:text-[#8E8278]"
            }`}
          >
            <div className="relative">
              <Icon className={`w-5 h-5 ${active ? "stroke-[2.5]" : ""}`} />
              {id === "history" && historyCount !== undefined && historyCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 bg-[#C2630B] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {historyCount > 9 ? "9+" : historyCount}
                </span>
              )}
            </div>
            <span className={`text-[10px] ${active ? "font-bold" : "font-semibold"}`}>{label}</span>
            {active && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-[3px] bg-[#C2630B] rounded-b-full" />
            )}
          </button>
        );
      })}
    </div>
  </nav>
);
