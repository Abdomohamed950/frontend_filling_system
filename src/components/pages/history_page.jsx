import { useEffect, useMemo, useState } from "react";
import { ClipboardClock, Download, Printer, RefreshCw, Search, X } from "lucide-react";
import FromToCalendar from "../custom_ui/FromToCalendar";
import SelectBox from "../custom_ui/SelectBox";
import History_Table from "../custom_ui/History_Table";
import PageHeader from "../custom_ui/page_header";
import { ErrorState, TableSkeleton } from "../custom_ui/states";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { useApi } from "@/hooks/use-api";
import { useToast } from "@/context/toast-context";
import { exportToCsv, fileStamp } from "@/lib/export";
import {
  formatDate,
  formatDateTime,
  formatNumber,
  toDate,
  toSqlTimestamp,
} from "@/lib/format";

const PAGE_SIZE = 12;
const ALL_PORTS = "all_ports";
const REFRESH_MS = 15000;

function defaultRange() {
  const from = new Date();
  from.setDate(from.getDate() - 1);
  from.setHours(0, 0, 0, 0);
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

function History_page() {
  const toast = useToast();

  const [port, setPort] = useState(ALL_PORTS);
  const [dateRange, setDateRange] = useState(defaultRange);
  const [search, setSearch] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: "entryTime", direction: "desc" });

  const { data: portsData } = useApi("/ports", { fallback: [] });
  const { data: operatorsData } = useApi("/operators", { fallback: [] });

  // `operatorId` on a log row is the integer FK into `operator(id)`, so the
  // roster is needed to show a name instead of a bare number.
  const operatorNames = useMemo(() => {
    const map = new Map();
    (Array.isArray(operatorsData) ? operatorsData : []).forEach((operator) => {
      if (operator?.id !== undefined) map.set(String(operator.id), operator.name);
    });
    return map;
  }, [operatorsData]);

  const portOptions = useMemo(() => {
    const names = (Array.isArray(portsData) ? portsData : [])
      .map((entry) => (typeof entry === "string" ? entry : entry.name))
      .filter(Boolean);
    return [{ value: ALL_PORTS, label: "كل المنافذ" }, ...names];
  }, [portsData]);

  // Only a complete range produces a request; `useApi` re-fetches when this
  // object's serialized form changes, so it never loops on its own result.
  // Bounds are local wall-clock strings, not UTC — the column is a
  // `timestamp without time zone`. See `toSqlTimestamp`.
  const rangeReady = Boolean(dateRange?.from && dateRange?.to);
  const params = useMemo(
    () =>
      rangeReady
        ? {
            port,
            from: toSqlTimestamp(dateRange.from),
            to: toSqlTimestamp(dateRange.to),
          }
        : undefined,
    [port, dateRange, rangeReady]
  );

  const { data, loading, error, refetch } = useApi("/history", {
    params,
    enabled: rangeReady,
    fallback: [],
  });

  const logs = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(refetch, REFRESH_MS);
    return () => clearInterval(timer);
  }, [autoRefresh, refetch]);

  // Any filter change invalidates the current page number. Adjusting during
  // render (rather than in an effect) avoids a throwaway paint on the old page.
  const filterKey = `${port}|${search}|${dateRange?.from}|${dateRange?.to}`;
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (lastFilterKey !== filterKey) {
    setLastFilterKey(filterKey);
    setPage(1);
  }

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return logs;
    return logs.filter((record) =>
      [
        record.truckNum,
        record.receiptNum,
        record.operatorId,
        operatorNames.get(String(record.operatorId)),
        record.portNum,
      ]
        .filter((value) => value !== null && value !== undefined)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [logs, search, operatorNames]);

  const sorted = useMemo(() => {
    const { key, direction } = sort;
    const factor = direction === "asc" ? 1 : -1;

    return [...filtered].sort((a, b) => {
      if (key === "entryTime" || key === "exitTime") {
        return factor * ((toDate(a[key])?.getTime() ?? 0) - (toDate(b[key])?.getTime() ?? 0));
      }
      if (key === "variance") {
        const va = (Number(a.actualQuantity) || 0) - (Number(a.requiredQuantity) || 0);
        const vb = (Number(b.actualQuantity) || 0) - (Number(b.requiredQuantity) || 0);
        return factor * (va - vb);
      }

      const av = a[key];
      const bv = b[key];
      const bothNumeric = !Number.isNaN(Number(av)) && !Number.isNaN(Number(bv));
      if (bothNumeric) return factor * (Number(av) - Number(bv));
      return factor * String(av ?? "").localeCompare(String(bv ?? ""), "ar");
    });
  }, [filtered, sort]);

  const paged = useMemo(
    () => sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [sorted, page]
  );

  const totals = useMemo(
    () =>
      sorted.reduce(
        (acc, record) => ({
          required: acc.required + (Number(record.requiredQuantity) || 0),
          actual: acc.actual + (Number(record.actualQuantity) || 0),
        }),
        { required: 0, actual: 0 }
      ),
    [sorted]
  );

  const handleSortChange = (key) =>
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "desc" }
    );

  const handleExport = () => {
    if (!sorted.length) {
      toast.warning("لا توجد سجلات لتصديرها.");
      return;
    }
    exportToCsv(
      `سجل_العمليات_${fileStamp()}`,
      [
        { header: "المنفذ", value: (r) => r.portNum },
        { header: "معرّف المشغل", value: (r) => r.operatorId },
        {
          header: "اسم المشغل",
          value: (r) => operatorNames.get(String(r.operatorId)) ?? "",
        },
        { header: "رقم السيارة", value: (r) => r.truckNum },
        { header: "رقم الإيصال", value: (r) => r.receiptNum },
        { header: "الكمية المطلوبة", value: (r) => r.requiredQuantity },
        { header: "الكمية الفعلية", value: (r) => r.actualQuantity },
        { header: "وقت الدخول", value: (r) => formatDateTime(r.entryTime) },
        { header: "وقت الخروج", value: (r) => formatDateTime(r.exitTime) },
      ],
      sorted
    );
    toast.success(`تم تصدير ${formatNumber(sorted.length)} سجل.`);
  };

  const rangeLabel = rangeReady
    ? `${formatDate(dateRange.from)} — ${formatDate(dateRange.to)}`
    : "—";

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ClipboardClock}
        title="سجل العمليات"
        description="كل عمليات التعبئة المسجلة خلال الفترة المحددة."
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
              طباعة السجل
            </Button>
          </>
        }
      />

      {/* printed header — replaces the on-screen controls on paper */}
      <div className="print-only mb-4 text-center">
        <h2 className="text-lg font-bold">سجل عمليات التعبئة</h2>
        <p className="text-sm">
          الفترة: {rangeLabel} — المنفذ: {port === ALL_PORTS ? "كل المنافذ" : port}
        </p>
      </div>

      {/* filters */}
      <div
        dir="rtl"
        className="flex flex-wrap items-end gap-4 rounded-xl border bg-card p-4 elevate no-print"
      >
        <div className="space-y-1.5">
          <Label htmlFor="history-port">المنفذ</Label>
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

        <div className="min-w-56 flex-1 space-y-1.5">
          <Label htmlFor="history-search">بحث</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="history-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="رقم السيارة أو الإيصال أو كود المشغل…"
              className="h-9 px-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="مسح البحث"
                className="absolute top-1/2 end-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 pb-1.5">
          <Switch
            id="auto-refresh"
            checked={autoRefresh}
            onCheckedChange={setAutoRefresh}
          />
          <Label htmlFor="auto-refresh" className="cursor-pointer">
            تحديث تلقائي
          </Label>
        </div>
      </div>

      {/* summary strip */}
      {!loading && !error && sorted.length > 0 && (
        <div
          dir="rtl"
          className="flex flex-wrap gap-x-8 gap-y-2 rounded-xl border bg-muted/40 px-4 py-3 text-sm"
        >
          <span>
            عدد العمليات:{" "}
            <strong className="tabular-nums">{formatNumber(sorted.length)}</strong>
          </span>
          <span>
            إجمالي المطلوب:{" "}
            <strong className="tabular-nums">{formatNumber(totals.required, 2)}</strong>
          </span>
          <span>
            إجمالي المنصرف:{" "}
            <strong className="tabular-nums">{formatNumber(totals.actual, 2)}</strong>
          </span>
          <span className="text-muted-foreground">الفترة: {rangeLabel}</span>
        </div>
      )}

      {loading && <TableSkeleton rows={8} columns={8} />}

      {!loading && error && <ErrorState message={error} onRetry={refetch} />}

      {!loading && !error && (
        <History_Table
          logs={paged}
          operatorNames={operatorNames}
          page={page}
          pageSize={PAGE_SIZE}
          totalItems={sorted.length}
          onPageChange={setPage}
          sort={sort}
          onSortChange={handleSortChange}
        />
      )}
    </div>
  );
}

export default History_page;
