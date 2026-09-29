import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../ui/button";
import { formatNumber } from "@/lib/format";

/** Builds `1 … 4 5 6 … 20` so long histories stay one row of controls. */
function pageWindow(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  return sorted.flatMap((page, index) => {
    const previous = sorted[index - 1];
    return previous && page - previous > 1 ? ["…", page] : [page];
  });
}

export default function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}) {
  if (totalPages <= 1) {
    return (
      <p dir="rtl" className="py-3 text-center text-xs text-muted-foreground">
        {formatNumber(totalItems)} سجل
      </p>
    );
  }

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, totalItems);

  return (
    <div
      dir="rtl"
      className="flex flex-col items-center justify-between gap-3 border-t pt-4 sm:flex-row no-print"
    >
      <p className="text-xs text-muted-foreground">
        عرض <span className="font-semibold text-foreground">{formatNumber(first)}</span>
        {" – "}
        <span className="font-semibold text-foreground">{formatNumber(last)}</span>
        {" من "}
        <span className="font-semibold text-foreground">{formatNumber(totalItems)}</span> سجل
      </p>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="الصفحة السابقة"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronRight className="size-4" />
        </Button>

        {pageWindow(page, totalPages).map((entry, index) =>
          entry === "…" ? (
            <span
              key={`gap-${index}`}
              className="px-1.5 text-sm text-muted-foreground select-none"
            >
              …
            </span>
          ) : (
            <Button
              key={entry}
              variant={entry === page ? "default" : "ghost"}
              size="icon-sm"
              aria-current={entry === page ? "page" : undefined}
              onClick={() => onPageChange(entry)}
            >
              {entry}
            </Button>
          )
        )}

        <Button
          variant="outline"
          size="icon-sm"
          aria-label="الصفحة التالية"
          disabled={page === totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
      </div>
    </div>
  );
}
