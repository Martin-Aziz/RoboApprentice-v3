import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-[2px] text-sm font-medium transition-all duration-150",
    "focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        // Primary "signal" CTA — solid cyan slab with subtle inset glow
        default: [
          "bg-[rgb(var(--signal-cyan))] text-[rgb(var(--ink))]",
          "shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_0_0_1px_rgb(var(--signal-cyan)/0.5),0_8px_24px_-12px_rgb(var(--signal-cyan)/0.7)]",
          "hover:bg-[rgb(var(--signal-cyan)/0.9)] hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_0_0_1px_rgb(var(--signal-cyan)),0_10px_28px_-12px_rgb(var(--signal-cyan)/0.85)]",
          "active:translate-y-px",
        ].join(" "),
        destructive: [
          "bg-[rgb(var(--signal-red))] text-[rgb(var(--bone))]",
          "shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_0_0_1px_rgb(var(--signal-red)/0.5)]",
          "hover:bg-[rgb(var(--signal-red)/0.9)]",
        ].join(" "),
        outline: [
          "border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2)/0.6)] text-[rgb(var(--bone))]",
          "hover:border-[rgb(var(--signal-cyan)/0.7)] hover:text-[rgb(var(--signal-cyan))]",
          "hover:bg-[rgb(var(--signal-cyan)/0.06)]",
        ].join(" "),
        secondary: [
          "bg-[rgb(var(--ink-3))] text-[rgb(var(--bone))]",
          "border border-[rgb(var(--steel)/0.6)]",
          "hover:bg-[rgb(var(--ink-4))]",
        ].join(" "),
        ghost: [
          "text-[rgb(var(--bone))] hover:bg-[rgb(var(--ink-3))]",
          "hover:text-[rgb(var(--signal-cyan))]",
        ].join(" "),
        link: "text-[rgb(var(--signal-cyan))] underline-offset-4 hover:underline",
        // Amber accent — for warnings / "press to commit"
        accent: [
          "bg-[rgb(var(--signal-amber))] text-[rgb(var(--ink))]",
          "shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_0_0_1px_rgb(var(--signal-amber)/0.5)]",
          "hover:bg-[rgb(var(--signal-amber)/0.9)]",
        ].join(" "),
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-7 text-[13px] uppercase tracking-[0.18em]",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
