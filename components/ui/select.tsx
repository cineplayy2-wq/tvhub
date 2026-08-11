import { forwardRef, useId } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, id, children, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id ?? generatedId;

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-[13px] font-medium text-muted"
          >
            {label}
          </label>
        )}

        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            aria-invalid={error ? true : undefined}
            className={cn(
              "h-12 w-full appearance-none rounded-md border bg-surface px-3.5 pr-10 text-sm text-foreground",
              "focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/25",
              error ? "border-danger" : "border-border",
              className,
            )}
            {...props}
          >
            {children}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
        </div>

        {error ? (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        ) : hint ? (
          <p className="text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </div>
    );
  },
);

Select.displayName = "Select";
