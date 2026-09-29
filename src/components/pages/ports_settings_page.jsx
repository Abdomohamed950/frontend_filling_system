import { useMemo, useState } from "react";
import {
  Cable,
  Gauge,
  Pencil,
  Plus,
  SatelliteDish,
  Settings,
  Timer,
  Trash2,
  Waypoints,
} from "lucide-react";
import PageHeader from "../custom_ui/page_header";
import ConfirmDialog from "../custom_ui/confirm_dialog";
import { CardsSkeleton, EmptyState, ErrorState } from "../custom_ui/states";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { api, apiErrorMessage } from "@/lib/api";
import { useApi } from "@/hooks/use-api";
import { useToast } from "@/context/toast-context";
import { cn } from "@/lib/utils";

const BAUD_RATES = [4800, 9600, 19200, 38400, 57600, 115200];

/**
 * The only valve types the firmware accepts. These strings are sent through
 * verbatim — they are firmware tokens, not display text, so they are shown
 * as-is rather than translated (a mistranslated token here would be a
 * commissioning error).
 */
const VALVE_TYPES = ["valve", "bump", "valve and bump"];

/** `mode` is guarded by a CHECK constraint; only `modbus` gets a conf today. */
const MODES = [
  { value: "modbus", label: "modbus" },
  { value: "pulse", label: "pulse" },
  { value: "milli ampere", label: "milli ampere" },
];

/**
 * Serial framing passed straight to the firmware. Confirm the middle two
 * against the device before relying on them — the service documents the
 * range by its endpoints only.
 */
const SERIAL_FRAMES = ["SERIAL_8N1", "SERIAL_8N2", "SERIAL_8E1", "SERIAL_8E2"];

/**
 * Three distinct byte orders reach the firmware. The stored value is
 * normalised server-side, so the canonical spelling is used here and the
 * firmware word is shown beside it.
 */
const ENDIAN_OPTIONS = [
  { value: "big", label: "Big — AABBCCDD" },
  { value: "ddccbbaa", label: "Reversed — DDCCBBAA" },
  { value: "little", label: "Little — CDAB" },
];

/** Numeric fields, grouped the way an engineer commissions a port. */
const CONNECTION_FIELDS = [
  { name: "slaveId", label: "معرّف الوحدة (Slave ID)", min: 1, max: 247 },
  { name: "registerAddress", label: "عنوان السجل (Register Address)", min: 0 },
  { name: "flowRateAddress", label: "عنوان معدل التدفق (Flow Rate)", min: 0 },
];

/**
 * Close-sequence durations. These are **milliseconds**, not seconds — the
 * form previously labelled them "ث", so an engineer entering 2 for a
 * two-second stage was actually configuring 2ms.
 */
const CLOSE_TIME_FIELDS = [
  { name: "firstCloseTime", label: "مدة الغلق الأول" },
  { name: "secondCloseTime", label: "مدة الغلق الثاني" },
  { name: "pidTime", label: "مدة الغلق الأخير" },
  { name: "addedTime", label: "وقت إضافي على الغلق الأخير" },
];

/**
 * Not delays at all: the remaining quantity at which each close stage
 * begins, in litres. The old "تأخير الإغلاق … (ث)" labelling described the
 * wrong quantity in the wrong unit.
 */
const CLOSE_LAG_FIELDS = [
  { name: "firstCloseLag", label: "كمية بدء الغلق الأول" },
  { name: "SecondCloseLag", label: "كمية بدء الغلق الثاني" },
];

/** One SCADA channel number per field a port fill can report or receive. */
const CHANNEL_FIELDS = [
  { name: "truckCh", label: "رقم الشاحنة" },
  { name: "operatorCh", label: "رقم المشغل" },
  { name: "requiredCh", label: "الكمية المطلوبة" },
  { name: "receiptCh", label: "رقم الإيصال" },
  { name: "inTimeCh", label: "وقت البدء" },
  { name: "flowmeterCh", label: "قراءة العداد" },
  { name: "flowTimeCh", label: "وقت قراءة العداد" },
  { name: "actualCh", label: "الكمية الفعلية" },
  { name: "outTimeCh", label: "وقت الانتهاء" },
];

const EMPTY_CHANNELS = Object.fromEntries(CHANNEL_FIELDS.map((field) => [field.name, ""]));

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

const EMPTY_FORM = {
  name: "",
  mode: "modbus",
  serialFrame: "SERIAL_8N1",
  baudrate: "",
  endian: "",
  registerType: "",
  valveType: "",
  slaveId: "",
  registerAddress: "",
  flowRateAddress: "",
  firstCloseTime: "",
  secondCloseTime: "",
  firstCloseLag: "",
  SecondCloseLag: "",
  pidTime: "",
  addedTime: "",
};

function Ports_settings_page() {
  const toast = useToast();
  const { data, loading, error, refetch } = useApi("/ports", { fallback: [] });
  const { data: channelsData, refetch: refetchChannels } = useApi("/scada-channels", {
    fallback: [],
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [scadaTarget, setScadaTarget] = useState(null);

  const ports = useMemo(
    () => (Array.isArray(data) ? data.filter((p) => typeof p === "object") : []),
    [data]
  );

  // Keyed by `portNum` so each card can look up its own map (or lack of one)
  // in O(1) without a per-card request.
  const channelsByPort = useMemo(() => {
    const map = {};
    (Array.isArray(channelsData) ? channelsData : []).forEach((row) => {
      if (row?.portNum) map[row.portNum] = row;
    });
    return map;
  }, [channelsData]);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (port) => {
    setEditing(port);
    setDialogOpen(true);
  };

  const handleSubmit = async (formData) => {
    try {
      if (editing) {
        await api.put(`/ports/${editing.id}`, formData);
        toast.success(`تم حفظ إعدادات ${formData.name}.`);
      } else {
        await api.post("/ports", formData);
        toast.success(`تم إنشاء المنفذ ${formData.name}.`);
      }
      setDialogOpen(false);
      // Re-read from the server rather than guessing the new list locally.
      refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/ports/${pendingDelete.id}`);
      toast.success(`تم حذف المنفذ ${pendingDelete.name}.`);
      setPendingDelete(null);
      refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Settings}
        title="إعدادات المنافذ"
        description="تهيئة اتصال Modbus وأزمنة الصمامات لكل منفذ تعبئة."
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" />
            إضافة منفذ
          </Button>
        }
      />

      {loading && <CardsSkeleton count={4} className="h-72" />}

      {!loading && error && <ErrorState message={error} onRetry={refetch} />}

      {!loading && !error && ports.length === 0 && (
        <EmptyState
          icon={Waypoints}
          title="لم يتم تعريف أي منفذ بعد"
          description="ابدأ بإضافة أول منفذ تعبئة ليظهر في شاشة المشغل."
          action={
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              إضافة منفذ
            </Button>
          }
        />
      )}

      {!loading && !error && ports.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {ports.map((port) => (
            <PortCard
              key={port.id}
              port={port}
              hasScadaMap={Boolean(channelsByPort[port.name])}
              onEdit={() => openEdit(port)}
              onDelete={() => setPendingDelete(port)}
              onScada={() => setScadaTarget(port)}
            />
          ))}

          <button
            type="button"
            onClick={openCreate}
            className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent/40 hover:text-primary"
          >
            <Plus className="size-10" />
            <span className="font-medium">إضافة منفذ جديد</span>
          </button>
        </div>
      )}

      <PortDialog
        key={editing?.id ?? "new"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        port={editing}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={`حذف المنفذ ${pendingDelete?.name ?? ""}؟`}
        description="سيتم حذف إعدادات هذا المنفذ نهائيًا ولن يظهر في شاشة المشغل. لا يمكن التراجع عن هذا الإجراء."
        confirmLabel="حذف نهائي"
        loading={deleting}
        onConfirm={handleDelete}
      />

      <ScadaChannelsDialog
        key={scadaTarget?.name ?? "none"}
        open={Boolean(scadaTarget)}
        onOpenChange={(open) => !open && setScadaTarget(null)}
        port={scadaTarget}
        channelMap={scadaTarget ? channelsByPort[scadaTarget.name] : null}
        onSaved={refetchChannels}
        onDeleted={refetchChannels}
      />
    </div>
  );
}

function SummaryRow({ label, value, warn = false }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "truncate font-medium tabular-nums",
          // A value the firmware will reject must not look like valid config.
          warn && "text-warning"
        )}
        title={warn ? "قيمة غير مدعومة في الفيرموير" : undefined}
      >
        {value ?? "—"}
        {warn && " ⚠"}
      </span>
    </div>
  );
}

function PortCard({ port, hasScadaMap, onEdit, onDelete, onScada }) {
  return (
    <div className="flex flex-col rounded-xl border bg-card p-5 elevate transition-shadow hover:elevate-lg">
      <div className="mb-4 flex items-center justify-between gap-2" dir="rtl">
        <h3 className="truncate text-lg font-bold uppercase">{port.name}</h3>
        <div className="flex items-center gap-1.5">
          <Badge variant={hasScadaMap ? "success" : "secondary"} className="gap-1">
            <SatelliteDish className="size-3" />
            {hasScadaMap ? "SCADA" : "بدون SCADA"}
          </Badge>
          <Badge variant="secondary" className="font-mono">
            ID {port.id}
          </Badge>
        </div>
      </div>

      <div className="space-y-4" dir="rtl">
        <section className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Cable className="size-3.5" />
            الاتصال
          </p>
          {/* Raw, not `formatNumber` — a baud rate is an identifier, and a
              thousands separator turned 9600 into "9,600". */}
          <SummaryRow label="النمط" value={port.mode} warn={port.mode !== "modbus"} />
          <SummaryRow label="Baudrate" value={port.baudrate} />
          <SummaryRow label="الإطار" value={port.serialFrame} />
          <SummaryRow label="Slave ID" value={port.slaveId} />
          <SummaryRow
            label="Endian"
            value={port.endian === "little" ? "Little" : port.endian === "big" ? "Big" : "—"}
          />
        </section>

        <section className="space-y-1.5 border-t pt-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Gauge className="size-3.5" />
            السجلات
          </p>
          <SummaryRow label="نوع السجل" value={port.registerType} />
          <SummaryRow label="عنوان السجل" value={port.registerAddress} />
          <SummaryRow label="عنوان التدفق" value={port.flowRateAddress} />
        </section>

        <section className="space-y-1.5 border-t pt-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Timer className="size-3.5" />
            الصمام
          </p>
          <SummaryRow
            label="النوع"
            value={port.valveType}
            warn={Boolean(port.valveType) && !VALVE_TYPES.includes(port.valveType)}
          />
          <SummaryRow label="زمن الإغلاق الأول" value={port.firstCloseTime} />
          <SummaryRow label="زمن PID" value={port.pidTime} />
        </section>
      </div>

      <div className="mt-5 flex gap-2 border-t pt-4" dir="rtl">
        <Button variant="outline" size="sm" className="flex-1" onClick={onEdit}>
          <Pencil className="size-4" />
          تعديل
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onScada}
          title="خريطة قنوات SCADA"
          aria-label="خريطة قنوات SCADA"
        >
          <SatelliteDish className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-4" />
          حذف
        </Button>
      </div>
    </div>
  );
}

function PortDialog({ open, onOpenChange, port, onSubmit }) {
  const isEdit = Boolean(port);
  const [formData, setFormData] = useState(() => ({ ...EMPTY_FORM, ...(port ?? {}) }));
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value, type } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "number" && value !== "" ? Number(value) : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    // Baudrate arrives from a <select>, so it is a string until coerced here.
    await onSubmit({ ...formData, baudrate: Number(formData.baudrate) || "" });
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? `تعديل المنفذ ${port.name}` : "إنشاء منفذ جديد"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "عدّل إعدادات الاتصال والتوقيت ثم احفظ التغييرات."
              : "أدخل إعدادات المنفذ الجديد ليظهر في شاشة المشغل."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="port-name">اسم المنفذ</Label>
            <Input
              id="port-name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="port1"
              required
            />
          </div>

          <fieldset className="space-y-3 rounded-lg border p-4">
            <legend className="flex items-center gap-1.5 px-1 text-sm font-semibold">
              <Cable className="size-4" />
              إعدادات الاتصال
            </legend>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="port-baudrate">معدل البيانات</Label>
                <select
                  id="port-baudrate"
                  name="baudrate"
                  value={formData.baudrate}
                  onChange={handleChange}
                  className={SELECT_CLASS}
                  required
                >
                  <option value="" disabled>
                    اختر
                  </option>
                  {BAUD_RATES.map((rate) => (
                    <option key={rate} value={rate}>
                      {rate}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="port-mode">نمط القراءة</Label>
                <select
                  id="port-mode"
                  name="mode"
                  value={formData.mode}
                  onChange={handleChange}
                  className={SELECT_CLASS}
                  required
                >
                  {MODES.map((mode) => (
                    <option key={mode.value} value={mode.value}>
                      {mode.label}
                    </option>
                  ))}
                </select>
                {formData.mode !== "modbus" && (
                  <p className="text-xs text-warning">
                    الخادم لا يرسل إعدادات (conf) إلا لمنافذ modbus.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="port-serialFrame">إطار البيانات</Label>
                <select
                  id="port-serialFrame"
                  name="serialFrame"
                  value={formData.serialFrame}
                  onChange={handleChange}
                  className={SELECT_CLASS}
                  required
                >
                  {SERIAL_FRAMES.map((frame) => (
                    <option key={frame} value={frame}>
                      {frame}
                    </option>
                  ))}
                  {formData.serialFrame &&
                    !SERIAL_FRAMES.includes(formData.serialFrame) && (
                      <option value={formData.serialFrame}>
                        {formData.serialFrame}
                      </option>
                    )}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="port-endian">ترتيب البايت</Label>
                <select
                  id="port-endian"
                  name="endian"
                  value={formData.endian}
                  onChange={handleChange}
                  className={SELECT_CLASS}
                  required
                >
                  <option value="" disabled>
                    اختر
                  </option>
                  {ENDIAN_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                  {formData.endian &&
                    !ENDIAN_OPTIONS.some((o) => o.value === formData.endian) && (
                      <option value={formData.endian}>{formData.endian}</option>
                    )}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="port-registerType">نوع السجل</Label>
                <select
                  id="port-registerType"
                  name="registerType"
                  value={formData.registerType}
                  onChange={handleChange}
                  className={SELECT_CLASS}
                  required
                >
                  <option value="" disabled>
                    اختر
                  </option>
                  <option value="input">Input</option>
                  <option value="holding">Holding</option>
                </select>
              </div>

              {CONNECTION_FIELDS.map((field) => (
                <div key={field.name} className="space-y-2">
                  <Label htmlFor={`port-${field.name}`}>{field.label}</Label>
                  <Input
                    id={`port-${field.name}`}
                    type="number"
                    name={field.name}
                    min={field.min}
                    max={field.max}
                    value={formData[field.name]}
                    onChange={handleChange}
                    required
                  />
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-3 rounded-lg border p-4">
            <legend className="flex items-center gap-1.5 px-1 text-sm font-semibold">
              <Timer className="size-4" />
              الصمام والتوقيت
            </legend>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="port-valveType">نوع الصمام</Label>
                <select
                  id="port-valveType"
                  name="valveType"
                  value={formData.valveType}
                  onChange={handleChange}
                  className={SELECT_CLASS}
                  required
                >
                  <option value="" disabled>
                    اختر
                  </option>
                  {VALVE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                  {/* Surface a stored value the firmware no longer accepts
                      instead of silently blanking the field. */}
                  {formData.valveType && !VALVE_TYPES.includes(formData.valveType) && (
                    <option value={formData.valveType}>
                      {formData.valveType} — قيمة غير مدعومة
                    </option>
                  )}
                </select>
                {formData.valveType && !VALVE_TYPES.includes(formData.valveType) && (
                  <p className="text-xs text-warning">
                    الفيرموير لا يقبل هذه القيمة. اختر نوعًا صالحًا قبل الحفظ.
                  </p>
                )}
              </div>

              {CLOSE_TIME_FIELDS.map((field) => (
                <div key={field.name} className="space-y-2">
                  <Label htmlFor={`port-${field.name}`}>
                    {field.label}
                    <span className="text-muted-foreground"> (مللي ثانية)</span>
                  </Label>
                  <Input
                    id={`port-${field.name}`}
                    type="number"
                    name={field.name}
                    min={0}
                    step="1"
                    value={formData[field.name]}
                    onChange={handleChange}
                    required
                  />
                </div>
              ))}

              {CLOSE_LAG_FIELDS.map((field) => (
                <div key={field.name} className="space-y-2">
                  <Label htmlFor={`port-${field.name}`}>
                    {field.label}
                    <span className="text-muted-foreground"> (لتر)</span>
                  </Label>
                  <Input
                    id={`port-${field.name}`}
                    type="number"
                    name={field.name}
                    min={0}
                    step="0.1"
                    value={formData[field.name]}
                    onChange={handleChange}
                    required
                  />
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              مراحل الغلق تُقاس بالمللي ثانية، أما «كمية بدء الغلق» فهي الكمية
              المتبقية باللتر التي تبدأ عندها المرحلة.
            </p>
          </fieldset>

          <DialogFooter className="sm:justify-start">
            <Button type="submit" disabled={submitting}>
              {submitting ? "جارٍ الحفظ…" : isEdit ? "حفظ التعديلات" : "إنشاء المنفذ"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              إلغاء
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * SCADA channel numbers are firmware/PLC addresses, not quantities — they
 * can legitimately contain letters depending on how the SCADA server is
 * configured, so every field is plain text rather than `type="number"`.
 * An empty field means that channel is simply never sent for this port.
 */
function ScadaChannelsDialog({ open, onOpenChange, port, channelMap, onSaved, onDeleted }) {
  const toast = useToast();
  const [formData, setFormData] = useState(() => ({ ...EMPTY_CHANNELS, ...(channelMap ?? {}) }));
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const exists = Boolean(channelMap);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await api.put(`/scada-channels/${port.name}`, formData);
      toast.success(`تم حفظ خريطة قنوات ${port.name}.`);
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/scada-channels/${port.name}`);
      toast.success(`تم حذف خريطة قنوات ${port.name}.`);
      setConfirmDelete(false);
      onOpenChange(false);
      onDeleted();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>خريطة قنوات SCADA — {port?.name}</DialogTitle>
          <DialogDescription>
            رقم القناة على سيرفر SCADA لكل حقل. اترك الحقل فارغًا لو هذه القناة مش هتتبعت لهذا
            المنفذ. منفذ من غير خريطة يتم تخطّيه بصمت أثناء مزامنة SCADA.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {CHANNEL_FIELDS.map((field) => (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={`scada-${field.name}`}>{field.label}</Label>
                <Input
                  id={`scada-${field.name}`}
                  type="text"
                  name={field.name}
                  value={formData[field.name]}
                  onChange={handleChange}
                  className="font-mono"
                  placeholder="—"
                />
              </div>
            ))}
          </div>

          <DialogFooter className="sm:justify-between">
            {exists ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setConfirmDelete(true)}
                disabled={submitting}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-4" />
                حذف الخريطة
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "جارٍ الحفظ…" : "حفظ الخريطة"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                إلغاء
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`حذف خريطة قنوات ${port?.name}؟`}
        description="سيعود هذا المنفذ إلى حالة (بدون مزامنة SCADA) حتى يتم ربطه بخريطة جديدة."
        confirmLabel="حذف"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </Dialog>
  );
}

export default Ports_settings_page;
