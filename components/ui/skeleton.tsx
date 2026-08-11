import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("skeleton rounded-md", className)}
      aria-hidden
      {...props}
    />
  );
}

/** Placeholder de um card do carrossel, na proporção 2:3 do pôster. */
export function PosterSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("aspect-[2/3] w-full rounded-lg", className)} />;
}
