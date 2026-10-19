import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Droplets, PlugZap, User } from "lucide-react";
import { SidebarInset, SidebarProvider } from "../ui/sidebar";
import Header from "../custom_ui/header.jsx";
import Op_Port from "../custom_ui/op_port.jsx";
import AppSidebar from "../custom_ui/app-sidebar.jsx";
import StatCard from "../custom_ui/stat_card.jsx";
import PumpsStatus from "../custom_ui/pumps_status.jsx";
import { CardsSkeleton, EmptyState, ErrorState } from "../custom_ui/states.jsx";
import { useApi } from "@/hooks/use-api";
import { useSocketEvent } from "@/hooks/use-socket";
import { socket } from "@/lib/socket";
import { formatNumber, toOperatorId, toSqlTimestamp } from "@/lib/format";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";

/** Used until the backend answers, so the panel is never a blank screen. */
const FALLBACK_PORTS = ["port1", "port2", "port3", "port4", "port5"];

/**
 * Narrowest a port card may get before the strip scrolls sideways instead of
 * squeezing further. The page itself still never scrolls vertically.
 */
const PORT_MIN_WIDTH = "13rem";

function Operator_page() {
  const [rtl, setRtl] = useState(() => localStorage.getItem("fs-port-rtl") !== "0");
  const [portStats, setPortStats] = useState({});
  const [aiMode, setAiMode] = useState(false);
  // Whether "barcode" or "manual" was last picked while AI mode was off —
  // only meaningful when `aiMode` is false, but kept around so flipping AI
  // off restores whichever of the two the operator was actually using.
  const [manualPreference, setManualPreference] = useState(
    () => localStorage.getItem("fs-op-mode") === "manual"
  );
  const { user } = useAuth();
  const operatorId = toOperatorId(user);

  // Today's closed fills from the gateway — the source for both the
  // all-users total and the current operator's own total. Bounds are local
  // wall-clock strings (see `toSqlTimestamp`).
  const [dayKey, setDayKey] = useState(() => new Date().toDateString());
  const todayParams = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 0);
    return { port: "all_ports", from: toSqlTimestamp(start), to: toSqlTimestamp(end) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayKey]);
  const { data: todayLogs, refetch: refetchToday } = useApi("/history", {
    params: todayParams,
    fallback: [],
  });

  // Roll the range over at midnight.
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().toDateString();
      setDayKey((current) => (current === now ? current : now));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const { data, loading, error, refetch } = useApi("/ports", { fallback: [] });

  useSocketEvent("ai_mode_status", (payload) => setAiMode(Boolean(payload?.running)));

  useEffect(() => {
    localStorage.setItem("fs-op-mode", manualPreference ? "manual" : "barcode");
  }, [manualPreference]);

  // Single source of truth for the three-way operation mode. `aiMode` is
  // shared across every client (the gateway broadcasts `ai_mode_status`);
  // "barcode" vs. "manual" is a per-browser preference with no backend
  // equivalent, so it only applies while AI mode is off.
  const mode = aiMode ? "ai" : manualPreference ? "manual" : "barcode";

  const handleModeChange = useCallback(
    (next) => {
      if (next === "ai") {
        if (!aiMode) socket.emit("toggle_ai_mode", {});
        return;
      }
      if (aiMode) socket.emit("toggle_ai_mode", {});
      setManualPreference(next === "manual");
    },
    [aiMode]
  );

  // A finished fill (online `history_closed`, or `history_offline` recovered
  // after an outage) changes today's totals — re-read them from the server.
  useSocketEvent("history_closed", refetchToday);
  useSocketEvent("history_offline", refetchToday);

  useEffect(() => {
    localStorage.setItem("fs-port-rtl", rtl ? "1" : "0");
  }, [rtl]);

  const ports = useMemo(() => {
    const names = Array.isArray(data)
      ? data
          .map((port) => (typeof port === "string" ? port : port.name))
          .filter(Boolean)
          .sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" }))
      : [];
    // The gateway is the source of truth for telemetry; if the REST list is
    // unavailable we still render the default bank rather than nothing.
    return names.length ? names : FALLBACK_PORTS;
  }, [data]);

  // The pump panel only matters when some port is configured as
  // "valve and bump" (the server also accepts the "pump" spelling).
  const hasPumpPort = useMemo(
    () =>
      Array.isArray(data) &&
      data.some((port) => {
        const type = String(port?.valveType ?? "").trim().toLowerCase();
        return type === "valve and bump" || type === "valve and pump";
      }),
    [data]
  );

  const handleStatsChange = useCallback((name, stats) => {
    setPortStats((current) => {
      const previous = current[name];
      if (
        previous &&
        previous.status === stats.status &&
        previous.actualQuantity === stats.actualQuantity &&
        previous.available === stats.available
      ) {
        return current; // nothing changed — avoid a needless re-render
      }
      return { ...current, [name]: stats };
    });
  }, []);

  const dispensedToday = useMemo(() => {
    const rows = Array.isArray(todayLogs) ? todayLogs : [];
    let all = 0;
    let mine = 0;
    for (const row of rows) {
      const qty = Number(row?.actualQuantity) || 0;
      all += qty;
      if (operatorId !== null && Number(row?.operatorId) === operatorId) mine += qty;
    }
    return { all, mine };
  }, [todayLogs, operatorId]);

  const summary = useMemo(() => {
    const entries = ports.map((name) => portStats[name]).filter(Boolean);
    // Only a port still actively "filling" adds its live count; once it
    // closes, `history_closed` triggers a refetch that includes the final
    // amount, so nothing is counted twice.
    const liveDispensing = entries
      .filter((entry) => entry.status === "filling")
      .reduce((total, entry) => total + (entry.actualQuantity || 0), 0);
    return {
      online: entries.filter((entry) => entry.available).length,
      filling: entries.filter((entry) => entry.status === "filling").length,
      dispensed: dispensedToday.all + liveDispensing,
    };
  }, [ports, portStats, dispensedToday]);

  return (
    // `min-h-svh` on the provider's wrapper would still let the page grow;
    // pinning it closes the last path to a scrollbar.
    <SidebarProvider className="h-svh overflow-hidden">
      <AppSidebar
        rtl={rtl}
        setRtl={setRtl}
        ports={ports}
        onRefresh={refetch}
        aiMode={aiMode}
      />

      {/* The console is a fixed-height dashboard: it fills the viewport
          exactly and never scrolls vertically. Everything below sizes off
          this box. */}
      <SidebarInset className="h-svh min-h-0 overflow-hidden bg-background">
        <Header mode={mode} onModeChange={handleModeChange} />

        <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4" dir="rtl">
          {/* live summary */}
          <div className="grid shrink-0 grid-cols-2 gap-2 lg:grid-cols-4">
            <StatCard
              icon={PlugZap}
              label="منافذ متصلة"
              value={`${summary.online} / ${ports.length}`}
              tone={summary.online === ports.length ? "success" : "warning"}
              compact
              loading={loading}
            />
            <StatCard
              icon={Activity}
              label="قيد التعبئة الآن"
              value={formatNumber(summary.filling)}
              tone={summary.filling ? "info" : "muted"}
              compact
              loading={loading}
            />
            <StatCard
              icon={Droplets}
              label="المنصرف اليوم (كل المستخدمين)"
              value={formatNumber(summary.dispensed, 2)}
              unit="وحدة"
              compact
              loading={loading}
            />
            <StatCard
              icon={User}
              label="منصرف اليوم (أنا)"
              value={formatNumber(dispensedToday.mine, 2)}
              unit="وحدة"
              compact
              loading={loading}
            />
          </div>

          {hasPumpPort && <PumpsStatus className="shrink-0" />}

          <div className="min-h-0 flex-1">
            {loading && (
              <CardsSkeleton count={ports.length} columns={ports.length} className="h-full" />
            )}

            {!loading && error && ports.length === 0 && (
              <ErrorState message={error} onRetry={refetch} />
            )}

            {!loading && !error && ports.length === 0 && (
              <EmptyState
                icon={PlugZap}
                title="لا توجد منافذ معرّفة"
                description="أضف المنافذ من صفحة إعدادات المنافذ في لوحة الإدارة لتظهر هنا."
              />
            )}

            {!loading && ports.length > 0 && (
              <div
                className={cn(
                  // One row, equal columns, full height — the whole bank is
                  // visible at a glance with no scrolling.
                  "grid h-full min-h-0 gap-3 overflow-x-auto overflow-y-hidden",
                  rtl ? "[direction:rtl]" : "[direction:ltr]"
                )}
                style={{
                  gridTemplateColumns: `repeat(${ports.length}, minmax(${PORT_MIN_WIDTH}, 1fr))`,
                }}
              >
                {ports.map((port, index) => (
                  <div
                    key={port}
                    className="animate-in-up min-h-0"
                    style={{ animationDelay: `${index * 45}ms` }}
                  >
                    <Op_Port name={port} mode={mode} onStatsChange={handleStatsChange} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && ports.length > 0 && (
            <p className="shrink-0 text-center text-xs text-muted-foreground">
              تعذر تحديث قائمة المنافذ من الخادم — يتم عرض المنافذ الافتراضية. ({error})
            </p>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default Operator_page;
