import { Inbox, RefreshCw, ServerCrash } from "lucide-react";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { cn } from "@/lib/utils";

/** Nothing matched the current filters — not an error. */
export function EmptyState({ icon: Icon = Inbox, title, description, action, className }) {
  return (
    <div
      dir="rtl"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center",
        className
      )}
    >
      <span className="rounded-full bg-muted p-4 text-muted-foreground">
        <Icon className="size-7" />
      </span>
      <div className="space-y-1">
        <p className="font-semibold">{title}</p>
        {description && (
          <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/** The request failed — always offers a way back. */
export function ErrorState({ message, onRetry, className }) {
  return (
    <div
      dir="rtl"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/25 bg-destructive/5 px-6 py-14 text-center",
        className
      )}
    >
      <span className="rounded-full bg-destructive/12 p-4 text-destructive">
        <ServerCrash className="size-7" />
      </span>
      <div className="space-y-1">
        <p className="font-semibold text-destructive">تعذر تحميل البيانات</p>
        <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="size-4" />
          إعادة المحاولة
        </Button>
      )}
    </div>
  );
}

/** Row-shaped placeholder that mirrors the table it stands in for. */
export function TableSkeleton({ rows = 8, columns = 6 }) {
  return (
    <div className="space-y-2.5 p-1">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-3">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={colIndex}
              className="h-9 flex-1"
              style={{ opacity: 1 - rowIndex * 0.06 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** `columns` pins the layout to one row; omit it for a responsive wrap. */
export function CardsSkeleton({ count = 4, columns, className = "h-64" }) {
  return (
    <div
      className={cn(
        "grid h-full gap-4",
        !columns && "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
      )}
      style={
        columns
          ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
          : undefined
      }
    >
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} className={cn("rounded-xl", className)} />
      ))}
    </div>
  );
}
