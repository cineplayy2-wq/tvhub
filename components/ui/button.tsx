import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-all duration-200 ease-smooth disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-gradient-to-r from-primary via-primary-hover to-primary-active text-white shadow-[0_0_20px_rgba(124,42,158,0.4)] hover:shadow-[0_0_28px_rgba(124,42,158,0.65)] hover:brightness-110 active:scale-[0.98]",
        secondary:
          "bg-surface-elevated text-foreground hover:bg-border-strong",
        outline:
          "border border-white/15 text-foreground hover:border-primary/50 hover:bg-white/5",
        ghost: "text-muted-foreground hover:bg-white/5 hover:text-foreground",
        danger: "bg-rose-600 text-white hover:bg-rose-700 shadow-md",
        glass:
          "bg-foreground/10 text-foreground backdrop-blur-md hover:bg-foreground/20 border border-white/10",
      },
      size: {
        sm: "h-9 px-3.5 text-[13px]",
        md: "h-12 px-5 text-sm",
        lg: "h-14 px-7 text-base",
        icon: "h-10 w-10",
      },
      fullWidth: {
        true: "w-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, fullWidth, isLoading, children, disabled, ...props },
    ref,
  ) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  ),
);

Button.displayName = "Button";
