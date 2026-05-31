import { cn } from "@/lib/utils";

export function LogoMark({
  size = 32,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <img
      src="/aurevix-app-icon.svg"
      width={size}
      height={size}
      alt=""
      aria-hidden
    />
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
