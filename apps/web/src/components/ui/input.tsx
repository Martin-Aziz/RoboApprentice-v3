import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-[2px] border border-[rgb(var(--steel))]",
        "bg-[rgb(var(--ink-2)/0.6)] px-3 py-2 text-sm text-[rgb(var(--bone))]",
        "shadow-[inset_0_1px_0_rgb(0_0_0/0.4)]",
        "transition-colors",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "placeholder:text-[rgb(var(--bone-3))]",
        "focus-visible:border-[rgb(var(--signal-cyan))] focus-visible:outline-none",
        "focus-visible:ring-1 focus-visible:ring-[rgb(var(--signal-cyan)/0.45)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
