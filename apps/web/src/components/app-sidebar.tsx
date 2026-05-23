"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Bot, Calculator, GraduationCap, Library, RotateCcw, Settings, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuthStore } from "@/lib/store";
import { Wordmark } from "@/components/logo";
import { resetDemoData } from "@/lib/use-demo-data";
import { useLocale } from "@/lib/i18n";

const navItems = [
  { href: "/app", key: "nav.overview", hint: "⌘K", icon: BarChart3 },
  { href: "/app/robots", key: "nav.robots", hint: "⌘K", icon: Bot },
  { href: "/app/skills", key: "nav.skills", hint: "⌘K", icon: Zap },
  { href: "/app/teach", key: "nav.teach", hint: "⌘K", icon: GraduationCap },
  { href: "/app/library", key: "nav.library", hint: "⌘K", icon: Library },
  { href: "/app/roi", key: "nav.roi", hint: "⌘K", icon: Calculator },
];

interface AppSidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function AppSidebar({ open = false, onClose }: AppSidebarProps) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { t } = useLocale();
  const initials = user?.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

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
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[rgb(var(--signal-green))]">Live demo</p>
        <p className="mt-1 text-xs text-[rgb(var(--bone-2))]">Walldorf Assembly Plant</p>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive = item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} onClick={onClose}>
              <div
                className={cn(
                  "group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                  isActive
                    ? "bg-[rgb(var(--signal-cyan)/0.1)] text-[rgb(var(--bone))]"
                    : "text-[rgb(var(--bone-2))] hover:bg-[rgb(var(--ink-3))] hover:text-[rgb(var(--bone))]",
                )}
              >
                <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-[rgb(var(--signal-cyan))]" : "text-[rgb(var(--bone-3))]")} />
                <span className="flex-1">{t(item.key)}</span>
                <span className="font-mono text-[10px] text-[rgb(var(--bone-3))]">{item.hint}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-[rgb(var(--steel)/0.7)] p-3">
        <Link href="/app/settings" onClick={onClose}>
          <div className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors", pathname.startsWith("/app/settings") ? "bg-[rgb(var(--ink-3))]" : "text-[rgb(var(--bone-2))] hover:bg-[rgb(var(--ink-3))]")}>
            <Settings className="h-4 w-4 text-[rgb(var(--bone-3))]" />
            <span className="flex-1">{t("nav.settings")}</span>
          </div>
        </Link>

        <div className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-[rgb(var(--ink-3))] font-mono text-[10px] text-[rgb(var(--signal-cyan))]">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">{user?.name}</p>
              <p className="truncate font-mono text-[10px] text-[rgb(var(--bone-3))]">{user?.email}</p>
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
