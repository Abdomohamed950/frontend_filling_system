import { ArrowUpDown, CheckCircle2, CloudOff, PackageSearch } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Badge } from "../ui/badge";
import Pagination from "./pagination";
import { EmptyState } from "./states";
import { formatDate, formatNumber, formatTime, toDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const COLUMNS = [
  { key: "index", label: "#", sortable: false },
  { key: "receiptNum", label: "رقم الإيصال" },
  { key: "waterQuantity", label: "الكمية", numeric: true },
  { key: "checked", label: "الحالة" },
  { key: "syncPending", label: "المزامنة", sortable: false },
  { key: "fetchedAt", label: "تاريخ الجلب" },
];

/** Split timestamp cell — date above, time below. */
function TimeCell({ value }) {
  const date = toDate(value);
  if (!date) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="leading-tight">
      <span className="block text-xs text-muted-foreground">{formatDate(date)}</span>
      <span className="text-sm font-medium tabular-nums">{formatTime(date)}</span>
    </div>
  );
}

export default function Receipts_Table({
  receipts,
  page,
  pageSize,
  totalItems,
  onPageChange,
  sort,
  onSortChange,
}) {
  if (!receipts.length) {
    return (
      <EmptyState
        icon={PackageSearch}
        title="لا توجد إيصالات مطابقة"
        description="جرّب توسيع نطاق التاريخ أو تغيير الحالة أو مسح كلمة البحث."
      />
    );
  }

  const startIndex = (page - 1) * pageSize;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border">
        <Table dir="rtl">
          <TableHeader className="bg-muted/60">
            <TableRow className="hover:bg-transparent">
              {COLUMNS.map((column) => {
                const active = sort?.key === column.key;
                return (
                  <TableHead
                    key={column.key}
                    className="h-11 whitespace-nowrap text-center text-xs font-semibold"
                  >
                    {column.sortable === false ? (
                      column.label
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSortChange(column.key)}
                        className={cn(
                          "mx-auto inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:text-primary",
                          active && "text-primary"
                        )}
                      >
                        {column.label}
                        <ArrowUpDown
                          className={cn("size-3 opacity-40", active && "opacity-100")}
                        />
                      </button>
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>

          <TableBody>
            {receipts.map((receipt, index) => {
              const used = Number(receipt.checked) === 1;
              const pending = Number(receipt.syncPending) === 1;

              return (
                <TableRow
                  key={`${receipt.receiptNum}-${startIndex + index}`}
                  className="even:bg-muted/25"
                >
                  <TableCell className="text-center text-xs text-muted-foreground">
                    {startIndex + index + 1}
                  </TableCell>
                  <TableCell className="text-center font-mono text-sm">
                    {receipt.receiptNum ?? "—"}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    {formatNumber(receipt.waterQuantity, 2)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={used ? "muted" : "success"} className="gap-1">
                      {!used && <CheckCircle2 className="size-3" />}
                      {used ? "مُستخدم" : "متاح"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {pending ? (
                      <Badge
                        variant="warning"
                        className="gap-1"
                        title="لم يتم تأكيد تسجيل الاستهلاك على سيرفر الإيصالات الخارجي بعد"
                      >
                        <CloudOff className="size-3" />
                        لسه بتتزامن
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <TimeCell value={receipt.fetchedAt} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Pagination
        page={page}
        pageSize={pageSize}
        totalItems={totalItems}
        totalPages={Math.ceil(totalItems / pageSize)}
        onPageChange={onPageChange}
      />
    </div>
  );
}
