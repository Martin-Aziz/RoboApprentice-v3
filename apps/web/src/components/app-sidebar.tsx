"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Bot, Calculator, Code2, Factory, GraduationCap, History, Library, RotateCcw, Settings, Wrench, X, Zap, BookOpen, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useSessionStore } from "@/lib/store";
import { Wordmark } from "@/components/logo";
import { resetDemoData } from "@/lib/use-demo-data";
import { useLocale } from "@/lib/i18n";
import { LanguageSelector } from "@/components/language-selector";

const navGroups = [
  {
    label: "Workspace",
    items: [
      { href: "/app", key: "nav.overview", icon: BarChart3 },
      { href: "/app/robots", key: "nav.robots", icon: Bot },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/app/skills", key: "nav.skills", icon: Zap },
      { href: "/app/tasks", key: "nav.tasks", icon: BookOpen },
      { href: "/app/library", key: "nav.library", icon: Library },
      { href: "/app/teach", key: "nav.teach", icon: GraduationCap },
    ],
  },
  {
    label: "Analysis",
    items: [
      { href: "/app/executions", key: "nav.executions", icon: History },
      { href: "/app/roi", key: "nav.roi", icon: Calculator },
      { href: "/app/billing", key: "Billing & value", icon: Receipt },
    ],
  },
  {
    label: "Configuration",
    items: [
      { href: "/app/workcell", key: "nav.workcell", icon: Factory },
      { href: "/app/export", key: "nav.export", icon: Code2 },
      { href: "/app/settings", key: "nav.settings", icon: Wrench },
    ],
  },
];

interface AppSidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function AppSidebar({ open = false, onClose }: AppSidebarProps) {
  const pathname = usePathname();
  const sessionId = useSessionStore((state) => state.session_id);
  const { t } = useLocale();
  const shortSession = sessionId ? sessionId.slice(0, 8).toUpperCase() : "LOCAL";

  return (
    <aside
      className={cn(
        "flex w-[268px] shrink-0 flex-col bg-[rgb(var(--ink-2))] border-r border-[rgb(var(--steel)/0.7)]",
        "hidden md:flex",
        open && "fixed inset-y-0 left-0 z-30 flex",
      )}
    >
      <div className="flex h-16 items-center gap-2 border-b border-[rgb(var(--steel)/0.7)] px-5">
        <Wordmark className="text-[12px]" />
        {onClose && (
          <Button variant="ghost" size="icon" className="ml-auto h-8 w-8 md:hidden" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="border-b border-[rgb(var(--steel)/0.7)] px-5 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[rgb(var(--signal-green))]">Workspace active</p>
        <p className="mt-1 text-xs text-[rgb(var(--bone-2))]">Production Facility</p>
      </div>

      <nav className="flex-1 space-y-5 p-3">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[rgb(var(--bone-3))]">{group.label}</p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
                return (
                  <Link key={item.href} href={item.href} onClick={onClose}>
                    <div
                      className={cn(
                        "group flex items-center gap-3 border-l-2 px-3 py-2.5 text-sm transition-colors",
                        isActive
                          ? "border-[rgb(var(--signal-cyan))] bg-[rgb(var(--signal-cyan)/0.08)] text-[rgb(var(--bone))]"
                          : "border-transparent text-[rgb(var(--bone-2))] hover:bg-[rgb(var(--ink-3))] hover:text-[rgb(var(--bone))]",
                      )}
                    >
                      <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-[rgb(var(--signal-cyan))]" : "text-[rgb(var(--bone-3))]")} />
                      <span className="flex-1">{t(item.key)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-2 border-t border-[rgb(var(--steel)/0.7)] p-3">
        <LanguageSelector />
        <div className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-[rgb(var(--ink-3))] font-mono text-[10px] text-[rgb(var(--signal-cyan))]">ID</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">Martin</p>
              <p className="truncate font-mono text-[10px] text-[rgb(var(--bone-3))]">Plant operator · {shortSession}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={resetDemoData} className="h-7 w-7 shrink-0" title={t("action.resetDemo")}>
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}
