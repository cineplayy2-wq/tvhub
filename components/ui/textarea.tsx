import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const generatedId = useId();
    const textareaId = id ?? generatedId;

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-[13px] font-medium text-muted"
          >
            {label}
          </label>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          aria-invalid={error ? true : undefined}
          className={cn(
            "w-full rounded-md border bg-surface px-3.5 py-3 text-sm text-foreground",
            "placeholder:text-muted-foreground",
            "focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/25",
            error ? "border-danger" : "border-border",
            className,
          )}
          {...props}
        />

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

Textarea.displayName = "Textarea";
