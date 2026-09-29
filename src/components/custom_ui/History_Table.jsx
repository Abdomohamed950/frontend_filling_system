import { ArrowUpDown, PackageSearch } from "lucide-react";
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
  { key: "portNum", label: "المنفذ" },
  { key: "operatorId", label: "المشغل" },
  { key: "truckNum", label: "رقم السيارة" },
  { key: "receiptNum", label: "رقم الإيصال" },
  { key: "requiredQuantity", label: "الكمية المطلوبة", numeric: true },
  { key: "actualQuantity", label: "الكمية الفعلية", numeric: true },
  { key: "variance", label: "الفرق", numeric: true },
  { key: "entryTime", label: "وقت الدخول" },
  { key: "exitTime", label: "وقت الخروج" },
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

export default function History_Table({
  logs,
  operatorNames,
  page,
  pageSize,
  totalItems,
  onPageChange,
  sort,
  onSortChange,
}) {
  if (!logs.length) {
    return (
      <EmptyState
        icon={PackageSearch}
        title="لا توجد سجلات مطابقة"
        description="جرّب توسيع نطاق التاريخ أو تغيير المنفذ أو مسح كلمة البحث."
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
            {logs.map((record, index) => {
              const required = Number(record.requiredQuantity) || 0;
              const actual = Number(record.actualQuantity) || 0;
              const variance = actual - required;

              return (
                <TableRow
                  key={`${record.id ?? record.receiptNum}-${startIndex + index}`}
                  className="even:bg-muted/25"
                >
                  <TableCell className="text-center text-xs text-muted-foreground">
                    {startIndex + index + 1}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="font-mono uppercase">
                      {record.portNum ?? "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {/* `operatorId` is the integer FK, not a human code —
                        resolve it to a name when the roster is loaded. */}
                    {operatorNames?.get(String(record.operatorId)) ??
                      (record.operatorId ?? "—")}
                  </TableCell>
                  <TableCell className="text-center font-mono text-sm">
                    {record.truckNum ?? "—"}
                  </TableCell>
                  <TableCell className="text-center font-mono text-sm">
                    {record.receiptNum ?? "—"}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    {formatNumber(record.requiredQuantity, 2)}
                  </TableCell>
                  <TableCell className="text-center font-semibold tabular-nums">
                    {formatNumber(record.actualQuantity, 2)}
                  </TableCell>
                  <TableCell className="text-center">
                    {required ? (
                      <span
                        className={cn(
                          "tabular-nums font-medium",
                          variance < -0.001 && "text-destructive",
                          variance > 0.001 && "text-success"
                        )}
                      >
                        {variance > 0 ? "+" : ""}
                        {formatNumber(variance, 2)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <TimeCell value={record.entryTime} />
                  </TableCell>
                  <TableCell className="text-center">
                    <TimeCell value={record.exitTime} />
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
