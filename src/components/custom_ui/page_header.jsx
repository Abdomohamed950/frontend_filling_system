import { cn } from "@/lib/utils";

/** Consistent title block for every admin screen. */
export default function PageHeader({ icon: Icon, title, description, actions, className }) {
  return (
    <div
      dir="rtl"
      className={cn(
        "flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex items-center gap-3">
        {Icon && (
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-5.5" />
          </span>
        )}
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-2 no-print">{actions}</div>
      )}
    </div>
  );
}
