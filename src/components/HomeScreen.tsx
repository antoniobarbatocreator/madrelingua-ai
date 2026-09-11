import React from "react";
import { Activity, ACTIVITY_META } from "../types";
import { LogoMark } from "./Logo";
import {
  MessageCircle,
  BookOpen,
  Languages,
  Target,
  ArrowLeftRight,
  ChevronRight,
} from "lucide-react";

interface HomeScreenProps {
  onSelectActivity: (activity: Activity) => void;
}

const ACTIVITY_ICONS: Record<Activity, React.FC<{ className?: string }>> = {
  conversazione: MessageCircle,
  lezione: BookOpen,
  vocabolario: Languages,
  quiz: Target,
  traduci: ArrowLeftRight,
};

const ACTIVITY_COLORS: Record<Activity, { bg: string; icon: string; hover: string }> = {
  conversazione: { bg: "bg-amber-700/10", icon: "text-amber-700", hover: "hover:border-amber-600/30" },
  lezione: { bg: "bg-sky-700/10", icon: "text-sky-700", hover: "hover:border-sky-600/30" },
  vocabolario: { bg: "bg-emerald-700/10", icon: "text-emerald-700", hover: "hover:border-emerald-600/30" },
  quiz: { bg: "bg-violet-700/10", icon: "text-violet-700", hover: "hover:border-violet-600/30" },
  traduci: { bg: "bg-rose-700/10", icon: "text-rose-700", hover: "hover:border-rose-600/30" },
};

const activities: Activity[] = ["conversazione", "lezione", "vocabolario", "quiz", "traduci"];

export const HomeScreen: React.FC<HomeScreenProps> = ({ onSelectActivity }) => {
  return (
    <div className="min-h-full pb-4">
      <div className="px-6 pt-10 pb-6">
        <LogoMark />
        <p className="mt-4 text-sm text-muted leading-relaxed max-w-xs">
          Scegli un'attivita e inizia a praticare il tuo inglese con il tuo coach personale.
        </p>
      </div>

      <div className="px-5">
        <h2 className="text-[11px] font-bold text-[#B5A99A] uppercase tracking-widest mb-3 px-1">
          Inizia una sessione
        </h2>
        <div className="space-y-2.5">
          {activities.map((act) => {
            const meta = ACTIVITY_META[act];
            const Icon = ACTIVITY_ICONS[act];
            const colors = ACTIVITY_COLORS[act];
            return (
              <button
                key={act}
                onClick={() => onSelectActivity(act)}
                className={`w-full text-left p-4 rounded-2xl bg-card border border-warm ${colors.hover} hover:shadow-lg hover:shadow-black/[0.03] transition-all duration-200 cursor-pointer group active:scale-[0.98]`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-11 h-11 rounded-xl ${colors.bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-5 h-5 ${colors.icon}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-primary text-[15px]">{meta.label}</div>
                    <div className="text-xs text-muted mt-0.5 leading-snug">{meta.description}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#C8BDB2] group-hover:text-[#8E8278] transition-colors shrink-0" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
