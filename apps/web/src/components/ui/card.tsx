import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Card — by default renders the AUREVIX HUD frame with corner brackets.
 * Set `plain` to opt out of the brackets when the card is nested inside
 * another HUD frame (e.g., for sub-panels).
 */
const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { plain?: boolean }
>(({ className, plain, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative rounded-[3px] text-[rgb(var(--bone))]",
      plain
        ? "border border-[rgb(var(--steel)/0.5)] bg-[rgb(var(--ink-2)/0.85)]"
        : "hud",
      className,
    )}
    {...props}
  >
    {!plain && (
      <>
        <span className="hud-corner-tr" />
        <span className="hud-corner-bl" />
      </>
    )}
    {children}
  </div>
));
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-5 md:p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "font-display text-[22px] leading-[1.05] tracking-[-0.005em] text-[rgb(var(--bone))]",
      className,
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-[rgb(var(--bone-2))]", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-5 md:p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-5 md:p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};
