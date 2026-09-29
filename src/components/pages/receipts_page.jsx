import { useEffect, useMemo, useState } from "react";
import { CloudOff, Download, ReceiptText, RefreshCw, Search, X } from "lucide-react";
import FromToCalendar from "../custom_ui/FromToCalendar";
import SelectBox from "../custom_ui/SelectBox";
import Receipts_Table from "../custom_ui/Receipts_Table";
import PageHeader from "../custom_ui/page_header";
import { ErrorState, TableSkeleton } from "../custom_ui/states";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { useApi } from "@/hooks/use-api";
import { useToast } from "@/context/toast-context";
import { exportToCsv, fileStamp } from "@/lib/export";
import { formatDate, formatDateTime, formatNumber, toDate, toInputDate } from "@/lib/format";

const PAGE_SIZE = 15;
const REFRESH_MS = 30000;

const STATUS_OPTIONS = [
  { value: "all", label: "كل الحالات" },
  { value: "0", label: "متاح" },
  { value: "1", label: "مُستخدم" },
];

/** Debounces `value` — avoids a request per keystroke against `?search=`. */
function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function Receipts_page() {
  const toast = useToast();

  const [status, setStatus] = useState("all");
  const [dateRange, setDateRange] = useState();
  const [searchInput, setSearchInput] = useState("");
  const [pendingOnly, setPendingOnly] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: "fetchedAt", direction: "desc" });

  const search = useDebounced(searchInput);

  // The service filters `checked`/`search`/`from`/`to` itself — everything
  // here is optional, unlike `/api/history` which needs a mandatory range.
  const params = useMemo(() => {
    const query = {};
    if (status !== "all") query.checked = status;
    if (search) query.search = search;
    if (dateRange?.from) query.from = toInputDate(dateRange.from);
    if (dateRange?.to) query.to = toInputDate(dateRange.to);
    return query;
  }, [status, search, dateRange]);

  const { data, loading, error, refetch } = useApi("/receipts", { params, fallback: [] });

  const receipts = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(refetch, REFRESH_MS);
    return () => clearInterval(timer);
  }, [autoRefresh, refetch]);

  // Any filter change invalidates the current page number. Adjusting during
  // render (rather than in an effect) avoids a throwaway paint on the old page.
  const filterKey = `${status}|${search}|${dateRange?.from}|${dateRange?.to}|${pendingOnly}`;
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (lastFilterKey !== filterKey) {
    setLastFilterKey(filterKey);
    setPage(1);
  }

  // `syncPending` has no server-side filter (see backend doc), so it is
  // applied on the already-fetched page instead.
  const filtered = useMemo(
    () => (pendingOnly ? receipts.filter((r) => Number(r.syncPending) === 1) : receipts),
    [receipts, pendingOnly]
  );

  const sorted = useMemo(() => {
    const { key, direction } = sort;
    const factor = direction === "asc" ? 1 : -1;

    return [...filtered].sort((a, b) => {
      if (key === "fetchedAt") {
        return factor * ((toDate(a[key])?.getTime() ?? 0) - (toDate(b[key])?.getTime() ?? 0));
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

  const summary = useMemo(
    () =>
      sorted.reduce(
        (acc, r) => ({
          available: acc.available + (Number(r.checked) === 0 ? 1 : 0),
          used: acc.used + (Number(r.checked) === 1 ? 1 : 0),
          pending: acc.pending + (Number(r.syncPending) === 1 ? 1 : 0),
        }),
        { available: 0, used: 0, pending: 0 }
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
      toast.warning("لا توجد إيصالات لتصديرها.");
      return;
    }
    exportToCsv(
      `الإيصالات_${fileStamp()}`,
      [
        { header: "رقم الإيصال", value: (r) => r.receiptNum },
        { header: "الكمية", value: (r) => r.waterQuantity },
        { header: "الحالة", value: (r) => (Number(r.checked) === 1 ? "مُستخدم" : "متاح") },
        {
          header: "المزامنة",
          value: (r) => (Number(r.syncPending) === 1 ? "لسه بتتزامن" : "تمت المزامنة"),
        },
        { header: "تاريخ الجلب", value: (r) => formatDateTime(r.fetchedAt) },
      ],
      sorted
    );
    toast.success(`تم تصدير ${formatNumber(sorted.length)} إيصال.`);
  };

  const rangeLabel = dateRange?.from
    ? `${formatDate(dateRange.from)} — ${dateRange.to ? formatDate(dateRange.to) : "الآن"}`
    : "كل الفترات";

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ReceiptText}
        title="الإيصالات"
        description="الإيصالات المتزامنة من Receipt API الخارجي وحالتها الحالية."
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
          </>
        }
      />

      {/* filters */}
      <div
        dir="rtl"
        className="flex flex-wrap items-end gap-4 rounded-xl border bg-card p-4 elevate"
      >
        <div className="space-y-1.5">
          <Label htmlFor="receipts-status">الحالة</Label>
          <SelectBox
            label="الحالة"
            items={STATUS_OPTIONS}
            value={status}
            onChange={setStatus}
            className="w-40"
          />
        </div>

        <div className="space-y-1.5">
          <Label>تاريخ الجلب</Label>
          <FromToCalendar dateRange={dateRange} setDateRange={setDateRange} />
        </div>

        <div className="min-w-56 flex-1 space-y-1.5">
          <Label htmlFor="receipts-search">بحث</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="receipts-search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="جزء من رقم الإيصال…"
              className="h-9 px-9"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                aria-label="مسح البحث"
                className="absolute top-1/2 end-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 pb-1.5">
          <Switch id="pending-only" checked={pendingOnly} onCheckedChange={setPendingOnly} />
          <Label htmlFor="pending-only" className="cursor-pointer">
            المعلّقة فقط
          </Label>
        </div>

        <div className="flex items-center gap-2.5 pb-1.5">
          <Switch id="receipts-auto-refresh" checked={autoRefresh} onCheckedChange={setAutoRefresh} />
          <Label htmlFor="receipts-auto-refresh" className="cursor-pointer">
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
            الإجمالي: <strong className="tabular-nums">{formatNumber(sorted.length)}</strong>
          </span>
          <span>
            متاح: <strong className="tabular-nums text-success">{formatNumber(summary.available)}</strong>
          </span>
          <span>
            مُستخدم: <strong className="tabular-nums">{formatNumber(summary.used)}</strong>
          </span>
          {summary.pending > 0 && (
            <span className="flex items-center gap-1 text-warning">
              <CloudOff className="size-3.5" />
              لسه بتتزامن:{" "}
              <strong className="tabular-nums">{formatNumber(summary.pending)}</strong>
            </span>
          )}
          <span className="text-muted-foreground">الفترة: {rangeLabel}</span>
        </div>
      )}

      {loading && <TableSkeleton rows={8} columns={6} />}

      {!loading && error && <ErrorState message={error} onRetry={refetch} />}

      {!loading && !error && (
        <Receipts_Table
          receipts={paged}
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

export default Receipts_page;
