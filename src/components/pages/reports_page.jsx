import { useMemo, useState } from "react";
import {
  ClipboardMinus,
  Download,
  Droplets,
  Hammer,
  Printer,
  RefreshCw,
  Receipt,
  TrendingDown,
  TrendingUp,
  Truck,
} from "lucide-react";
import SelectBox from "../custom_ui/SelectBox";
import FromToCalendar from "../custom_ui/FromToCalendar";
import ReportTable from "../custom_ui/reportTable";
import PageHeader from "../custom_ui/page_header";
import StatCard from "../custom_ui/stat_card";
import { EmptyState, ErrorState, TableSkeleton } from "../custom_ui/states";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { useApi } from "@/hooks/use-api";
import { useToast } from "@/context/toast-context";
import { exportToCsv, fileStamp } from "@/lib/export";
import { formatDate, formatNumber, toSqlTimestamp } from "@/lib/format";

/**
 * `all_ports`, matching `/api/history`. The old `allPorts` spelling came from
 * the original code, but the reports route does not exist on the service yet
 * — so there is no compatibility to preserve, and no reason to ship two
 * spellings of the same token.
 */
const ALL_PORTS = "all_ports";

function defaultRange() {
  const from = new Date();
  from.setDate(from.getDate() - 29);
  from.setHours(0, 0, 0, 0);
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

function Reports_page() {
  const toast = useToast();
  const [port, setPort] = useState(ALL_PORTS);
  const [dateRange, setDateRange] = useState(defaultRange);

  const { data: portsData } = useApi("/ports", { fallback: [] });

  const portOptions = useMemo(() => {
    const names = (Array.isArray(portsData) ? portsData : [])
      .map((entry) => (typeof entry === "string" ? entry : entry.name))
      .filter(Boolean);
    return [{ value: ALL_PORTS, label: "كل المنافذ" }, ...names];
  }, [portsData]);

  const rangeReady = Boolean(dateRange?.from && dateRange?.to);
  const params = useMemo(
    () =>
      rangeReady
        ? {
            port,
            // Local wall-clock, not UTC — see `toSqlTimestamp`.
            from: toSqlTimestamp(dateRange.from),
            to: toSqlTimestamp(dateRange.to),
          }
        : undefined,
    [port, dateRange, rangeReady]
  );

  const { data, loading, error, refetch } = useApi("/reports", {
    params,
    enabled: rangeReady,
    fallback: [],
  });

  const reports = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  // The service answers unknown routes with `{"error":"Route not found"}`.
  const notImplemented = /route not found/i.test(error ?? "");

  const totals = useMemo(
    () =>
      reports.reduce(
        (acc, record) => ({
          metervalue: acc.metervalue + (Number(record.metervalue) || 0),
          receiptvalue: acc.receiptvalue + (Number(record.receiptvalue) || 0),
          saving: acc.saving + (Number(record.saving) || 0),
          deficit: acc.deficit + (Number(record.deficit) || 0),
          carcount: acc.carcount + (Number(record.carcount) || 0),
        }),
        { metervalue: 0, receiptvalue: 0, saving: 0, deficit: 0, carcount: 0 }
      ),
    [reports]
  );

  const handleExport = () => {
    if (!reports.length) {
      toast.warning("لا توجد بيانات لتصديرها.");
      return;
    }
    exportToCsv(
      `تقرير_المنافذ_${fileStamp()}`,
      [
        { header: "المنفذ", value: (r) => r.portnum },
        { header: "بداية العداد", value: (r) => r.startmeter },
        { header: "نهاية العداد", value: (r) => r.endmeter },
        { header: "المنصرف بالعداد", value: (r) => r.metervalue },
        { header: "المنصرف بالإيصالات", value: (r) => r.receiptvalue },
        { header: "وفر", value: (r) => r.saving },
        { header: "عجز", value: (r) => r.deficit },
        { header: "عدد السيارات", value: (r) => r.carcount },
      ],
      reports
    );
    toast.success(`تم تصدير ${formatNumber(reports.length)} صفوف.`);
  };

  const rangeLabel = rangeReady
    ? `${formatDate(dateRange.from)} — ${formatDate(dateRange.to)}`
    : "—";

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ClipboardMinus}
        title="تقارير المنافذ"
        description="ملخص المنصرف والفروقات لكل منفذ خلال الفترة المحددة."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={refetch} disabled={loading}>
              <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
              تحديث
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="size-4" />
              تصدير CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="size-4" />
              طباعة
            </Button>
          </>
        }
      />

      <div className="print-only mb-4 text-center">
        <h2 className="text-lg font-bold">تقرير المنافذ</h2>
        <p className="text-sm">
          الفترة: {rangeLabel} — المنفذ: {port === ALL_PORTS ? "كل المنافذ" : port}
        </p>
      </div>

      <div
        dir="rtl"
        className="flex flex-wrap items-end gap-4 rounded-xl border bg-card p-4 elevate no-print"
      >
        <div className="space-y-1.5">
          <Label>المنفذ</Label>
          <SelectBox
            label="المنفذ"
            items={portOptions}
            value={port}
            onChange={setPort}
            className="w-44"
          />
        </div>

        <div className="space-y-1.5">
          <Label>الفترة الزمنية</Label>
          <FromToCalendar dateRange={dateRange} setDateRange={setDateRange} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          icon={Droplets}
          label="المنصرف بالعداد"
          value={formatNumber(totals.metervalue, 2)}
          loading={loading}
        />
        <StatCard
          icon={Receipt}
          label="المنصرف بالإيصالات"
          value={formatNumber(totals.receiptvalue, 2)}
          loading={loading}
        />
        <StatCard
          icon={TrendingUp}
          label="إجمالي الوفر"
          value={formatNumber(totals.saving, 2)}
          tone="success"
          loading={loading}
        />
        <StatCard
          icon={TrendingDown}
          label="إجمالي العجز"
          value={formatNumber(totals.deficit, 2)}
          tone="destructive"
          loading={loading}
        />
        <StatCard
          icon={Truck}
          label="عدد السيارات"
          value={formatNumber(totals.carcount)}
          tone="info"
          loading={loading}
        />
      </div>

      {loading && <TableSkeleton rows={6} columns={8} />}

      {/* `GET /api/reports` is not implemented on the service yet. Reporting
          that as a generic failure sends the operator chasing a network
          problem that does not exist. */}
      {!loading && error && notImplemented && (
        <EmptyState
          icon={Hammer}
          title="التقارير غير متاحة بعد"
          description="لم يتم تفعيل مسار /api/reports على الخادم حتى الآن. الأعمدة اللازمة (startMeter و endMeter) مسجَّلة بالفعل مع كل عملية، فالتقارير ستعمل فور إضافة المسار."
        />
      )}

      {!loading && error && !notImplemented && (
        <ErrorState message={error} onRetry={refetch} />
      )}

      {!loading && !error && (
        <ReportTable reports={reports} totals={reports.length ? totals : null} />
      )}
    </div>
  );
}

export default Reports_page;
