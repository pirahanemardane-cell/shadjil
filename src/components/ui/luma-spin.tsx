import { cn } from "@/lib/utils";

/** اسپینر — وضعیت محصول حلقه = primary برچسب (لایت/دارک) */
export function LumaSpin({ className }: { className?: string }) {
  return (
    <div className={cn("relative aspect-square w-[65px]", className)} aria-hidden>
      <span
        className="animate-loaderAnim absolute rounded-[50px]"
        style={{ boxShadow: "inset 0 0 0 3px var(--shadjil-loader-spin)" }}
      />
      <span
        className="animate-loaderAnim animation-delay-loader absolute rounded-[50px]"
        style={{ boxShadow: "inset 0 0 0 3px var(--shadjil-loader-spin)" }}
      />
    </div>
  );
}

export const Component = LumaSpin;
