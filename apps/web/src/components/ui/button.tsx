import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils.js";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        // One accent, reserved for the single primary action on a screen.
        default: "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80",
        // The workhorse: quiet, bordered, sits on any surface.
        outline:
          "border border-border bg-transparent text-foreground hover:border-border-strong hover:bg-muted/60",
        secondary: "bg-muted text-foreground hover:bg-elevated",
        ghost: "bg-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        accent: "bg-accent text-accent-foreground hover:bg-accent/90",
        danger: "bg-danger text-white hover:bg-danger/90",
        // Destructive, but not the visual centre of the screen.
        "danger-outline":
          "border border-danger/50 bg-danger/10 text-danger hover:border-danger hover:bg-danger/20",
        link: "bg-transparent text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-3.5 text-sm",
        sm: "h-8 px-3 text-xs",
        xs: "h-7 px-2.5 text-2xs",
        lg: "h-11 px-6 text-sm",
        icon: "h-8 w-8 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";

export { buttonVariants };
