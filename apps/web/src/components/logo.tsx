import { cn } from "@/lib/utils";

/**
 * AUREVIX geometric mark — concentric tracks bisected by a diagonal slash,
 * suggesting "orbit + path". Renders inline SVG, no external assets.
 */
export function LogoMark({
  className,
  size = 32,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      className={cn("text-[rgb(var(--signal-cyan))]", className)}
      aria-hidden
    >
      {/* Outer track */}
      <circle cx="16" cy="16" r="13" opacity="0.5" />
      {/* Mid track */}
      <circle cx="16" cy="16" r="9" opacity="0.85" />
      {/* Inner core */}
      <circle cx="16" cy="16" r="3.2" fill="currentColor" stroke="none" />
      {/* Diagonal path */}
      <path d="M5 22 L27 10" strokeWidth={1.75} />
      {/* Tick on path start */}
      <circle cx="5" cy="22" r="1.4" fill="currentColor" stroke="none" />
      {/* Tick on path end */}
      <circle cx="27" cy="10" r="1.4" fill="currentColor" stroke="none" />
      {/* Tiny amber waypoint marker */}
      <circle
        cx="22"
        cy="13"
        r="1.4"
        fill="rgb(var(--signal-amber))"
        stroke="none"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex items-center gap-2.5 text-[13px] font-semibold tracking-[0.2em] uppercase",
        className,
      )}
    >
      <LogoMark size={22} />
      <span>AUREVIX</span>
    </span>
  );
}
