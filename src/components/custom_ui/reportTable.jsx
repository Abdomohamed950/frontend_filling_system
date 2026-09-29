import { FileBarChart } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Badge } from "../ui/badge";
import { EmptyState } from "./states";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const COLUMNS = [
  "المنفذ",
  "بداية العداد",
  "نهاية العداد",
  "المنصرف بالعداد",
  "المنصرف بالإيصالات",
  "وفر",
  "عجز",
  "عدد السيارات",
];

export default function ReportTable({ reports, totals }) {
  if (!reports.length) {
    return (
      <EmptyState
        icon={FileBarChart}
        title="لا توجد بيانات في هذه الفترة"
        description="اختر منفذًا ونطاقًا زمنيًا يحتوي على عمليات تعبئة مسجلة."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border">
      <Table dir="rtl">
        <TableHeader className="bg-muted/60">
          <TableRow className="hover:bg-transparent">
            {COLUMNS.map((column) => (
              <TableHead
                key={column}
                className="h-11 whitespace-nowrap text-center text-xs font-semibold"
              >
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {reports.map((record, index) => (
            <TableRow key={`${record.portnum}-${index}`} className="even:bg-muted/25">
              <TableCell className="text-center">
                <Badge variant="secondary" className="font-mono uppercase">
                  {record.portnum ?? "—"}
                </Badge>
              </TableCell>
              <TableCell className="text-center tabular-nums">
                {formatNumber(record.startmeter, 2)}
              </TableCell>
              <TableCell className="text-center tabular-nums">
                {formatNumber(record.endmeter, 2)}
              </TableCell>
              <TableCell className="text-center font-semibold tabular-nums">
                {formatNumber(record.metervalue, 2)}
              </TableCell>
              <TableCell className="text-center tabular-nums">
                {formatNumber(record.receiptvalue, 2)}
              </TableCell>
              <TableCell
                className={cn(
                  "text-center tabular-nums",
                  Number(record.saving) > 0 && "font-semibold text-success"
                )}
              >
                {formatNumber(record.saving, 2)}
              </TableCell>
              <TableCell
                className={cn(
                  "text-center tabular-nums",
                  Number(record.deficit) > 0 && "font-semibold text-destructive"
                )}
              >
                {formatNumber(record.deficit, 2)}
              </TableCell>
              <TableCell className="text-center tabular-nums">
                {formatNumber(record.carcount)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>

        {totals && (
          <TableFooter>
            <TableRow className="hover:bg-transparent">
              <TableCell className="text-center font-bold">الإجمالي</TableCell>
              <TableCell className="text-center text-muted-foreground">—</TableCell>
              <TableCell className="text-center text-muted-foreground">—</TableCell>
              <TableCell className="text-center font-bold tabular-nums">
                {formatNumber(totals.metervalue, 2)}
              </TableCell>
              <TableCell className="text-center font-bold tabular-nums">
                {formatNumber(totals.receiptvalue, 2)}
              </TableCell>
              <TableCell className="text-center font-bold tabular-nums text-success">
                {formatNumber(totals.saving, 2)}
              </TableCell>
              <TableCell className="text-center font-bold tabular-nums text-destructive">
                {formatNumber(totals.deficit, 2)}
              </TableCell>
              <TableCell className="text-center font-bold tabular-nums">
                {formatNumber(totals.carcount)}
              </TableCell>
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  );
}
