import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Plus, PlugZap, RadioTower, Receipt, RefreshCw, Save, Satellite, Trash2, XCircle } from "lucide-react";
import PageHeader from "../custom_ui/page_header";
import FromToCalendar from "../custom_ui/FromToCalendar";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { CardsSkeleton, ErrorState } from "../custom_ui/states";
import { api, apiErrorMessage } from "@/lib/api";
import { useApi } from "@/hooks/use-api";
import { useSocketEvent } from "@/hooks/use-socket";
import { useToast } from "@/context/toast-context";
import { formatDateTime, toSqlTimestamp } from "@/lib/format";

const EMPTY_FORM = {
  receiptApiEnabled: false,
  receiptApiBaseUrl: "",
  receiptRefreshMinutes: "",
};

/** Converts the row's 0/1 ints into real booleans for the switches. */
function toForm(settings) {
  if (!settings) return EMPTY_FORM;
  return {
    receiptApiEnabled: Boolean(settings.receiptApiEnabled),
    receiptApiBaseUrl: settings.receiptApiBaseUrl ?? "",
    receiptRefreshMinutes: settings.receiptRefreshMinutes ?? "",
  };
}

function Sync_settings_page() {
  const toast = useToast();
  const { data, loading, error, refetch } = useApi("/sync-settings", { fallback: null });

  const [form, setForm] = useState(EMPTY_FORM);
  const [baseline, setBaseline] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // The row is a singleton fetched once; re-sync the form whenever a fresh
  // copy arrives (initial load, or after a save triggers a refetch).
  useEffect(() => {
    if (!data) return;
    const next = toForm(data);
    setForm(next);
    setBaseline(next);
  }, [data]);

  const update = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }));

  const dirty = JSON.stringify(form) !== JSON.stringify(baseline);

  const save = async () => {
    // PUT applies a partial patch, so only send fields that actually
    // changed — re-sending an untouched numeric field as "" would blank it.
    const changed = {};
    for (const key of Object.keys(form)) {
      if (form[key] !== baseline[key]) changed[key] = form[key];
    }
    if (Object.keys(changed).length === 0) return;

    if ("receiptApiEnabled" in changed) changed.receiptApiEnabled = changed.receiptApiEnabled ? 1 : 0;
    if ("receiptRefreshMinutes" in changed) {
      changed.receiptRefreshMinutes = Number(changed.receiptRefreshMinutes) || null;
    }

    setSaving(true);
    try {
      await api.put("/sync-settings", changed);
      toast.success("تم حفظ إعدادات المزامنة.");
      refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader icon={RadioTower} title="إعدادات المزامنة" description="جارٍ التحميل…" />
        <CardsSkeleton count={2} className="h-72" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader icon={RadioTower} title="إعدادات المزامنة" />
        <ErrorState message={error} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={RadioTower}
        title="إعدادات المزامنة"
        description="سيرفرات SCADA وعنوان Receipt API."
        actions={
          <Button size="sm" onClick={save} disabled={!dirty || saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            حفظ التعديلات
          </Button>
        }
      />

      <div dir="rtl" className="grid gap-5 lg:grid-cols-2">
        <ScadaServersSection />

        <section className="space-y-4 rounded-xl border bg-card p-5 elevate">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-info/12 text-info">
                <Receipt className="size-5" />
              </span>
              <div>
                <h2 className="font-semibold">مزامنة الإيصالات</h2>
                <p className="text-sm text-muted-foreground">
                  جلب الإيصالات دوريًا من Receipt API الخارجي.
                </p>
              </div>
            </div>
            <Switch
              checked={form.receiptApiEnabled}
              onCheckedChange={update("receiptApiEnabled")}
              aria-label="تفعيل مزامنة الإيصالات"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="receipt-url">العنوان الأساسي</Label>
            <Input
              id="receipt-url"
              value={form.receiptApiBaseUrl}
              onChange={(event) => update("receiptApiBaseUrl")(event.target.value)}
              dir="ltr"
              className="font-mono"
              placeholder="http://172.16.0.99:8090/KorapTmp"
            />
            <p className="text-xs text-muted-foreground">
              بدون <code className="rounded bg-muted px-1 py-0.5 font-mono">/today</code> أو{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono">/Consume</code>.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="receipt-refresh">التحديث كل (دقيقة)</Label>
            <Input
              id="receipt-refresh"
              type="number"
              min={1}
              value={form.receiptRefreshMinutes}
              onChange={(event) => update("receiptRefreshMinutes")(event.target.value)}
              dir="ltr"
              className="font-mono"
              placeholder="60"
            />
            <p className="text-xs text-warning">يحتاج إعادة تشغيل السيرفر ليُطبَّق على دورة التحديث.</p>
          </div>
        </section>
      </div>

      {data?.updatedAt && (
        <p dir="rtl" className="text-xs text-muted-foreground">
          آخر تحديث: {formatDateTime(data.updatedAt)}
        </p>
      )}
    </div>
  );
}

const EMPTY_SERVER = { name: "", host: "", port: "", enabled: true };

/** Plain-language reason for a failed connection test. */
function testErrorText(error) {
  if (error === "ECONNREFUSED") return "الاتصال مرفوض (السيرفر مقفول أو البورت غلط)";
  if (/^timeout/i.test(error ?? "")) return "مفيش رد خلال 3 ثواني";
  return error || "تعذر الاتصال";
}

/** Keeps every row editable locally; one save replaces the whole list. */
function ScadaServersSection() {
  const toast = useToast();
  const { data, loading, error, refetch } = useApi("/scada-servers", { fallback: [] });
  const [servers, setServers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [resyncTarget, setResyncTarget] = useState(null);
  // Connection-test state, keyed by server id. Only ever set by pressing the button.
  const [testing, setTesting] = useState(null);
  const [results, setResults] = useState({});

  // The test probes the *saved* address, so edits to host/port disable it.
  const saved = useMemo(() => {
    const map = new Map();
    if (Array.isArray(data)) data.forEach((s) => map.set(s.id, { host: s.host, port: Number(s.port) }));
    return map;
  }, [data]);

  useEffect(() => {
    if (Array.isArray(data)) {
      setServers(
        data.map((s) => ({ ...s, name: s.name ?? "", port: String(s.port ?? ""), enabled: Boolean(s.enabled) }))
      );
    }
  }, [data]);

  const patch = (index, field, value) => {
    if (field === "host" || field === "port") {
      const id = servers[index]?.id;
      if (id != null) setResults((prev) => ({ ...prev, [id]: undefined }));
    }
    setServers((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const addressChanged = (server) => {
    const base = saved.get(server.id);
    return !base || server.host.trim() !== base.host || Number(server.port) !== base.port;
  };

  const testConnection = async (server) => {
    setTesting(server.id);
    setResults((prev) => ({ ...prev, [server.id]: undefined }));
    try {
      const { data: result } = await api.post(`/scada-servers/${server.id}/test`);
      setResults((prev) => ({ ...prev, [server.id]: result }));
    } catch (err) {
      if (err?.response?.status === 404) {
        toast.error("السيرفر غير موجود — جارٍ تحديث القايمة.");
        refetch();
      } else {
        toast.error(apiErrorMessage(err));
      }
    } finally {
      setTesting(null);
    }
  };

  const save = async () => {
    for (const [i, s] of servers.entries()) {
      const port = Number(s.port);
      if (!s.host.trim() || !Number.isInteger(port) || port < 1 || port > 65535) {
        toast.error(`السيرفر رقم ${i + 1}: أدخل عنوانًا وبورت صحيحًا (1–65535).`);
        return;
      }
    }
    setSaving(true);
    try {
      await api.put("/scada-servers", {
        servers: servers.map((s) => ({
          ...(s.id != null ? { id: s.id } : {}),
          name: (s.name ?? "").trim(),
          host: s.host.trim(),
          port: Number(s.port),
          enabled: s.enabled ? 1 : 0,
        })),
      });
      toast.success("تم حفظ سيرفرات SCADA.");
      setResults({});
      refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5 elevate">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
            <Satellite className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold">مزامنة SCADA</h2>
            <p className="text-sm text-muted-foreground">
              إرسال قراءات المنافذ إلى سيرفر SCADA واحد أو أكتر في نفس الوقت.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={save} disabled={saving || loading}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          حفظ
        </Button>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <div className="space-y-3">
          {servers.length === 0 && !loading && (
            <p className="py-4 text-center text-sm text-muted-foreground">لا توجد سيرفرات SCADA.</p>
          )}
          {servers.map((server, index) => (
            <div key={server.id ?? `new-${index}`} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <Input
                  value={server.name}
                  onChange={(e) => patch(index, "name", e.target.value)}
                  placeholder="اسم السيرفر (اختياري)"
                  aria-label={`اسم السيرفر ${index + 1}`}
                />
                <Switch
                  checked={server.enabled}
                  onCheckedChange={(v) => patch(index, "enabled", v)}
                  aria-label={`تفعيل السيرفر ${index + 1}`}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={server.id == null}
                  title={server.id == null ? "احفظ السيرفر أولًا" : "إعادة مزامنة فترة"}
                  onClick={() => setResyncTarget(server)}
                  aria-label={`إعادة مزامنة السيرفر ${index + 1}`}
                >
                  <RefreshCw className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setServers((prev) => prev.filter((_, i) => i !== index))}
                  aria-label={`حذف السيرفر ${index + 1}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <div className="grid grid-cols-[1fr_7rem] gap-2">
                <Input
                  value={server.host}
                  onChange={(e) => patch(index, "host", e.target.value)}
                  dir="ltr"
                  className="font-mono"
                  placeholder="197.134.251.84"
                  aria-label={`عنوان السيرفر ${index + 1}`}
                />
                <Input
                  type="number"
                  value={server.port}
                  onChange={(e) => patch(index, "port", e.target.value)}
                  dir="ltr"
                  className="font-mono"
                  placeholder="11001"
                  aria-label={`بورت السيرفر ${index + 1}`}
                />
              </div>
              {server.id != null && (
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testConnection(server)}
                    disabled={testing === server.id || addressChanged(server)}
                    title={addressChanged(server) ? "احفظ التعديلات أولًا — الاختبار بيجرّب العنوان المحفوظ" : undefined}
                  >
                    {testing === server.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <PlugZap className="size-4" />
                    )}
                    اختبر الاتصال
                  </Button>
                  {results[server.id] &&
                    (results[server.id].reachable ? (
                      <span className="flex items-center gap-1.5 text-sm text-success" role="status">
                        <CheckCircle2 className="size-4" />
                        متصل
                        {results[server.id].latencyMs != null && (
                          <span dir="ltr" className="font-mono text-xs">
                            {results[server.id].latencyMs}ms
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-sm text-destructive" role="status">
                        <XCircle className="size-4" />
                        غير متصل — {testErrorText(results[server.id].error)}
                      </span>
                    ))}
                </div>
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setServers((prev) => [...prev, { ...EMPTY_SERVER }])}>
            <Plus className="size-4" />
            إضافة سيرفر
          </Button>
        </div>
      )}

      <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
        نفس خريطة القنوات لكل منفذ بتتبعت لكل السيرفرات المفعّلة. التغيير يُطبَّق على أول تعبئة تالية.
      </p>

      <ResyncDialog
        key={resyncTarget?.id ?? "none"}
        server={resyncTarget}
        onOpenChange={(open) => !open && setResyncTarget(null)}
      />
    </section>
  );
}

function defaultResyncRange() {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

const RESYNC_RUNNING = "running";

/**
 * Re-sends the fills recorded in a period to one SCADA server only. The job
 * runs on the gateway; this dialog just mirrors `scada_resync_progress`, so
 * closing it (or reloading the page) never stops the job — reopening asks the
 * gateway for the current state.
 */
function ResyncDialog({ server, onOpenChange }) {
  const toast = useToast();
  const [range, setRange] = useState(defaultResyncRange);
  const [job, setJob] = useState(null);
  const [starting, setStarting] = useState(false);
  const serverId = server?.id;
  const ready = Boolean(range?.from && range?.to);
  const running = job?.status === RESYNC_RUNNING;

  // A job may already be running for this server (started earlier, or by
  // another client) — pick it up instead of offering to start a second one.
  useEffect(() => {
    if (serverId == null) return;
    let cancelled = false;
    api
      .get(`/scada-servers/${serverId}/resync`)
      .then((res) => !cancelled && res.data?.status && setJob(res.data))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [serverId]);

  useSocketEvent("scada_resync_progress", (payload) => {
    if (payload?.serverId !== serverId) return;
    setJob((prev) => {
      if (prev?.status === RESYNC_RUNNING && payload.status !== RESYNC_RUNNING) {
        if (payload.status === "done") toast.success("انتهت إعادة المزامنة.");
        else if (payload.status === "cancelled") toast.info("تم إلغاء إعادة المزامنة.");
        else toast.error(payload.message || "فشلت إعادة المزامنة.");
      }
      return payload;
    });
  });

  const start = async () => {
    setStarting(true);
    try {
      const { data } = await api.post(`/scada-servers/${serverId}/resync`, {
        from: toSqlTimestamp(range.from),
        to: toSqlTimestamp(range.to),
      });
      setJob({ status: RESYNC_RUNNING, total: data?.total ?? 0, done: 0, sent: 0, failed: 0, skipped: 0 });
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setStarting(false);
    }
  };

  const cancel = () =>
    api.post(`/scada-servers/${serverId}/resync/cancel`).catch((err) => toast.error(apiErrorMessage(err)));

  const percent = job?.total ? Math.min(100, Math.round((job.done / job.total) * 100)) : job?.status === "done" ? 100 : 0;

  return (
    <Dialog open={Boolean(server)} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle>إعادة مزامنة SCADA — {server?.name || server?.host}</DialogTitle>
          <DialogDescription>
            هيتم إرسال تعبئات الفترة المحددة لهذا السيرفر فقط، من غير ما باقي السيرفرات تتأثر. تقدر تقفل النافذة والعملية
            تكمل.
          </DialogDescription>
        </DialogHeader>

        <FromToCalendar dateRange={range} setDateRange={setRange} />

        {job && (
          <div className="space-y-2" role="status">
            <div
              className="h-2.5 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${percent}%` }}
              />
            </div>
            {running && (
              <p className="text-xs font-medium">
                {job.phase === "deleting" ? "جارٍ حذف قراءات الفترة من السيرفر…" : "جارٍ الإرسال…"}
              </p>
            )}
            <p className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
              <span>
                {job.done ?? 0} / {job.total ?? 0} ({percent}%)
              </span>
              <span>
                تم: {job.sent ?? 0} · فشل: {job.failed ?? 0} · تخطّي: {job.skipped ?? 0}
              </span>
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إغلاق
          </Button>
          {running ? (
            <Button variant="destructive" onClick={cancel}>
              إلغاء العملية
            </Button>
          ) : (
            <Button onClick={start} disabled={!ready || starting}>
              {starting ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              ابدأ إعادة المزامنة
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default Sync_settings_page;
