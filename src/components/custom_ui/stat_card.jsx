import { cn } from "@/lib/utils";
import { Skeleton } from "../ui/skeleton";

const TONES = {
  default: "bg-primary/10 text-primary",
  success: "bg-success/12 text-success",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/12 text-destructive",
  info: "bg-info/12 text-info",
  muted: "bg-muted text-muted-foreground",
};

/** Compact KPI tile used across the operator dashboard and reports. */
export default function StatCard({
  icon: Icon,
  label,
  value,
  unit,
  hint,
  tone = "default",
  loading = false,
  // The operator console is height-constrained; the admin screens are not.
  compact = false,
  className,
}) {
  return (
    <div
      dir="rtl"
      className={cn(
        "flex items-center rounded-xl border bg-card elevate",
        compact ? "gap-2.5 p-2.5" : "gap-3.5 p-4",
        className
      )}
    >
      {Icon && (
        <span
          className={cn(
            "grid shrink-0 place-items-center rounded-lg",
            compact ? "size-8" : "size-11",
            TONES[tone]
          )}
        >
          <Icon className={compact ? "size-4" : "size-5"} />
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
        {loading ? (
          <Skeleton className={cn("w-20", compact ? "mt-1 h-5" : "mt-1.5 h-6")} />
        ) : (
          <p
            className={cn(
              "flex items-baseline gap-1 font-bold leading-tight",
              compact ? "text-base" : "text-xl"
            )}
          >
            <span className="truncate">{value}</span>
            {unit && (
              <span className="text-xs font-medium text-muted-foreground">{unit}</span>
            )}
          </p>
        )}
        {hint && !loading && (
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{hint}</p>
        )}
      </div>
    </div>
  );
}
