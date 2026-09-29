import { useEffect, useState } from "react";
import { Loader2, RadioTower, Receipt, Save, Satellite } from "lucide-react";
import PageHeader from "../custom_ui/page_header";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { CardsSkeleton, ErrorState } from "../custom_ui/states";
import { api, apiErrorMessage } from "@/lib/api";
import { useApi } from "@/hooks/use-api";
import { useToast } from "@/context/toast-context";
import { formatDateTime } from "@/lib/format";

const EMPTY_FORM = {
  scadaEnabled: false,
  scadaHost: "",
  scadaPort: "",
  receiptApiEnabled: false,
  receiptApiBaseUrl: "",
  receiptRefreshMinutes: "",
};

/** Converts the row's 0/1 ints into real booleans for the switches. */
function toForm(settings) {
  if (!settings) return EMPTY_FORM;
  return {
    scadaEnabled: Boolean(settings.scadaEnabled),
    scadaHost: settings.scadaHost ?? "",
    scadaPort: settings.scadaPort ?? "",
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

    if ("scadaEnabled" in changed) changed.scadaEnabled = changed.scadaEnabled ? 1 : 0;
    if ("receiptApiEnabled" in changed) changed.receiptApiEnabled = changed.receiptApiEnabled ? 1 : 0;
    if ("scadaPort" in changed) changed.scadaPort = Number(changed.scadaPort) || null;
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
        description="عناوين سيرفري SCADA وReceipt API."
        actions={
          <Button size="sm" onClick={save} disabled={!dirty || saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            حفظ التعديلات
          </Button>
        }
      />

      <div dir="rtl" className="grid gap-5 lg:grid-cols-2">
        <section className="space-y-4 rounded-xl border bg-card p-5 elevate">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                <Satellite className="size-5" />
              </span>
              <div>
                <h2 className="font-semibold">مزامنة SCADA</h2>
                <p className="text-sm text-muted-foreground">
                  إرسال قراءات المنافذ إلى قنوات سيرفر SCADA الخارجي.
                </p>
              </div>
            </div>
            <Switch
              checked={form.scadaEnabled}
              onCheckedChange={update("scadaEnabled")}
              aria-label="تفعيل مزامنة SCADA"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="scada-host">عنوان السيرفر (IP)</Label>
            <Input
              id="scada-host"
              value={form.scadaHost}
              onChange={(event) => update("scadaHost")(event.target.value)}
              dir="ltr"
              className="font-mono"
              placeholder="197.134.251.84"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="scada-port">البورت</Label>
            <Input
              id="scada-port"
              type="number"
              value={form.scadaPort}
              onChange={(event) => update("scadaPort")(event.target.value)}
              dir="ltr"
              className="font-mono"
              placeholder="11001"
            />
          </div>

          <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            تغيير العنوان/البورت يُطبَّق فورًا على أول تعبئة تالية — لا حاجة لإعادة تشغيل أي شيء.
          </p>
        </section>

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

export default Sync_settings_page;
