"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Calculator, Bot, GraduationCap, Languages, RotateCcw, Search, Settings, Zap } from "lucide-react";
import { resetDemoData, useDemoData } from "@/lib/use-demo-data";
import { useLocale } from "@/lib/i18n";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { robots, skills } = useDemoData();
  const { setLocale } = useLocale();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/35 px-4 pt-[12vh]" onClick={() => setOpen(false)}>
      <Command
        className="w-full max-w-2xl overflow-hidden rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-[rgb(var(--steel))] px-4">
          <Search className="h-4 w-4 text-[rgb(var(--bone-3))]" />
          <Command.Input placeholder="Search pages, robots, skills..." className="h-12 flex-1 bg-transparent text-sm outline-none" />
          <kbd className="font-mono text-[10px] text-[rgb(var(--bone-3))]">Esc</kbd>
        </div>
        <Command.List className="max-h-[420px] overflow-auto p-2">
          <Command.Empty className="px-3 py-8 text-center text-sm text-[rgb(var(--bone-2))]">No results</Command.Empty>
          <Command.Group heading="Navigate" className="text-[rgb(var(--bone-2))]">
            <Item onSelect={() => go("/app")} icon={<Search />}>Overview</Item>
            <Item onSelect={() => go("/app/teach")} icon={<GraduationCap />}>Teach a robot</Item>
            <Item onSelect={() => go("/app/robots")} icon={<Bot />}>Robots</Item>
            <Item onSelect={() => go("/app/skills")} icon={<Zap />}>Skills</Item>
            <Item onSelect={() => go("/app/roi")} icon={<Calculator />}>ROI calculator</Item>
            <Item onSelect={() => go("/app/settings")} icon={<Settings />}>Settings</Item>
          </Command.Group>
          <Command.Group heading="Robots">
            {robots.map((robot) => <Item key={robot.id} onSelect={() => go(`/app/robots/${robot.id}`)} icon={<Bot />}>{robot.name} - {robot.model}</Item>)}
          </Command.Group>
          <Command.Group heading="Skills">
            {skills.map((skill) => <Item key={skill.id} onSelect={() => go("/app/skills")} icon={<Zap />}>{skill.name}</Item>)}
          </Command.Group>
          <Command.Group heading="Actions">
            <Item onSelect={() => resetDemoData()} icon={<RotateCcw />}>Reset demo</Item>
            <Item onSelect={() => setLocale("de-DE")} icon={<Languages />}>Switch to German</Item>
            <Item onSelect={() => setLocale("zh-CN")} icon={<Languages />}>Switch to Chinese</Item>
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}

function Item({ children, icon, onSelect }: { children: React.ReactNode; icon: React.ReactElement; onSelect: () => void }) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-[rgb(var(--bone))] aria-selected:bg-[rgb(var(--ink-3))]"
    >
      <span className="[&>svg]:h-4 [&>svg]:w-4 text-[rgb(var(--bone-2))]">{icon}</span>
      {children}
    </Command.Item>
  );
}

