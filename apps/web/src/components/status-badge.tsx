import { Circle, CircleOff, LoaderCircle, PlayCircle, TriangleAlert } from "lucide-react";

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const config =
    normalized === "running" || normalized === "done" || normalized === "completed"
      ? { Icon: PlayCircle, classes: "bg-[rgb(var(--signal-green)/0.1)] text-[rgb(var(--signal-green))]", label: normalized }
      : normalized === "idle" || normalized === "pending"
        ? { Icon: Circle, classes: "bg-[rgb(var(--ink-4))] text-[rgb(var(--bone-2))]", label: normalized }
        : normalized === "training" || normalized === "processing"
          ? { Icon: LoaderCircle, classes: "bg-[rgb(var(--signal-cyan)/0.1)] text-[rgb(var(--signal-cyan))]", label: normalized }
          : normalized === "offline"
            ? { Icon: CircleOff, classes: "bg-[rgb(var(--signal-red)/0.1)] text-[rgb(var(--signal-red))]", label: normalized }
            : { Icon: TriangleAlert, classes: "bg-[rgb(var(--signal-amber)/0.1)] text-[rgb(var(--signal-amber))]", label: normalized };
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-mono text-[10px] uppercase ${config.classes}`}><config.Icon className="h-3 w-3" />{config.label}</span>;
}
