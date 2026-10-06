import { useEffect, useMemo, useState } from "react";
import { Camera, Loader2, Move, RefreshCw, Save, Terminal } from "lucide-react";
import PageHeader from "../custom_ui/page_header";
import { EmptyState } from "../custom_ui/states";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { useApi } from "@/hooks/use-api";
import { useSocketEvent, useSocketStatus } from "@/hooks/use-socket";
import { useToast } from "@/context/toast-context";
import { useDevModeStatus } from "@/lib/dev-mode";
import { socket } from "@/lib/socket";

const MAX_TURNS = 6.6;

const TURN_FIELDS = [
  { name: "readyTurns", label: "الجاهزية (Ready)" },
  { name: "stopTurns", label: "انتهاء التعبئة (Stop)" },
  { name: "homeTurns", label: "وسيط (Home)" },
];

const DEFAULT_SETTINGS = {
  camId: "cam1",
  camIndex: 0,
  plateDigits: 4,
  plateFrames: 5,
  roi: null,
  debugDir: "",
  arriveWaitMs: 5000,
  defaultQuantity: 10,
};

const ROI_KEYS = ["x", "y", "w", "h"];

const validTurns = (v) => v !== "" && Number.isFinite(Number(v)) && v >= 0 && v <= MAX_TURNS;

function toForm(settings) {
  return {
    camId: settings.camId,
    camIndex: String(settings.camIndex),
    plateDigits: String(settings.plateDigits),
    plateFrames: String(settings.plateFrames),
    debugDir: settings.debugDir ?? "",
    arriveWaitMs: String(settings.arriveWaitMs),
    defaultQuantity: String(settings.defaultQuantity),
    useRoi: Boolean(settings.roi),
    roi: ROI_KEYS.reduce((acc, k) => ({ ...acc, [k]: String(settings.roi?.[k] ?? "") }), {}),
  };
}

function Dev_mode_page() {
  const toast = useToast();
  const connected = useSocketStatus();
  const enabled = useDevModeStatus();
  const { data: portsData } = useApi("/ports", { fallback: [] });

  const portNames = useMemo(
    () =>
      (Array.isArray(portsData) ? portsData : [])
        .map((p) => (typeof p === "string" ? p : p?.name))
        .filter(Boolean),
    [portsData]
  );

  useSocketEvent("dev_error", ({ event, message } = {}) => {
    toast.error(message || "حدث خطأ في وضع المطور.", { title: event });
  });

  const toggle = (next) => socket.emit("dev_mode", { enabled: next });

  return (
    <div dir="rtl" className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        icon={Terminal}
        title="وضع المطور"
        description="التحكم في المؤشر (Stepper) وقراءة رقم السيارة بالكاميرا."
        actions={
          <div className="flex items-center gap-3">
            {enabled === null ? (
              <Badge variant="destructive">{connected ? "جارٍ التحقق…" : "البوابة منقطعة"}</Badge>
            ) : (
              <Badge variant={enabled ? "success" : "secondary"}>{enabled ? "مفعّل" : "مقفول"}</Badge>
            )}
            <Switch
              checked={Boolean(enabled)}
              disabled={enabled === null}
              onCheckedChange={toggle}
              aria-label="تفعيل وضع المطور"
            />
          </div>
        }
      />

      {!enabled ? (
        <EmptyState
          icon={Terminal}
          title="وضع المطور مقفول"
          description="فعّل المفتاح بالأعلى لتشغيل التراففيك وكاميرا قراءة الرقم. الحالة بتتحفظ في ذاكرة الخادم فقط."
        />
      ) : (
        <>
          <TurnsSection portNames={portNames} />
          <CameraSection />
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ turns */

function TurnsSection({ portNames }) {
  const [turns, setTurns] = useState({});

  useEffect(() => {
    if (portNames.length) portNames.forEach((port) => socket.emit("dev_get_turns", { port }));
    else socket.emit("dev_get_turns");
  }, [portNames]);

  useSocketEvent("dev_turns", (row) => {
    if (row?.port) setTurns((prev) => ({ ...prev, [row.port]: row }));
  });

  const ports = portNames.length ? portNames : Object.keys(turns);

  return (
    <section className="space-y-3 rounded-xl border bg-card p-5">
      <h2 className="text-lg font-bold">لفّات المؤشر لكل منفذ</h2>
      <p className="text-sm text-muted-foreground">
        القيم بين 0 و {MAX_TURNS}. زرار «تحريك» بيبعت حركة يدوية للمعايرة.
      </p>
      {ports.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">لا توجد منافذ.</p>
      ) : (
        <div className="space-y-3">
          {ports.map((port) => (
            <PortTurnsRow key={port} port={port} remote={turns[port]} />
          ))}
        </div>
      )}
    </section>
  );
}

function PortTurnsRow({ port, remote }) {
  const toast = useToast();
  const [form, setForm] = useState({ readyTurns: "", stopTurns: "", homeTurns: "" });
  const [moveTo, setMoveTo] = useState("");

  // Server pushes (including other clients' edits) overwrite the form. Synced
  // during render (not in an effect) so there is no extra stale-form render.
  const [syncedRemote, setSyncedRemote] = useState(null);
  if (remote && remote !== syncedRemote) {
    setSyncedRemote(remote);
    setForm({
      readyTurns: String(remote.readyTurns ?? ""),
      stopTurns: String(remote.stopTurns ?? ""),
      homeTurns: String(remote.homeTurns ?? ""),
    });
  }

  const save = () => {
    if (!TURN_FIELDS.every(({ name }) => validTurns(form[name]))) {
      toast.error(`كل القيم لازم تكون بين 0 و ${MAX_TURNS}.`);
      return;
    }
    socket.emit("dev_set_turns", {
      port,
      readyTurns: Number(form.readyTurns),
      stopTurns: Number(form.stopTurns),
      homeTurns: Number(form.homeTurns),
    });
    toast.success(`تم إرسال لفّات ${port}.`);
  };

  const move = () => {
    if (!validTurns(moveTo)) {
      toast.error(`قيمة الحركة لازم تكون بين 0 و ${MAX_TURNS}.`);
      return;
    }
    socket.emit("dev_move", { port, turns: Number(moveTo) });
  };

  return (
    <div className="grid gap-3 rounded-lg border p-3 md:grid-cols-[6rem_1fr_auto] md:items-end">
      <h3 className="text-base font-bold uppercase md:pb-2">{port}</h3>

      <div className="grid grid-cols-3 gap-2">
        {TURN_FIELDS.map(({ name, label }) => (
          <div key={name} className="space-y-1">
            <Label htmlFor={`${port}-${name}`} className="text-xs">
              {label}
            </Label>
            <Input
              id={`${port}-${name}`}
              type="number"
              step="0.1"
              min={0}
              max={MAX_TURNS}
              dir="ltr"
              value={form[name]}
              onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
            />
          </div>
        ))}
      </div>

      <div className="flex items-end gap-2">
        <Button onClick={save}>
          <Save className="size-4" />
          حفظ
        </Button>
        <Input
          type="number"
          step="0.1"
          min={0}
          max={MAX_TURNS}
          dir="ltr"
          placeholder="لفّات"
          className="w-20"
          value={moveTo}
          onChange={(e) => setMoveTo(e.target.value)}
          aria-label={`لفّات تحريك ${port}`}
        />
        <Button variant="outline" onClick={move}>
          <Move className="size-4" />
          تحريك
        </Button>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- camera */

function CameraSection() {
  const toast = useToast();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [form, setForm] = useState(() => toForm(DEFAULT_SETTINGS));
  const [syncedSettings, setSyncedSettings] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [reading, setReading] = useState(false);
  const [plate, setPlate] = useState(null);

  useEffect(() => {
    socket.emit("dev_get_settings");
    socket.emit("dev_list_cameras");
  }, []);

  useSocketEvent("dev_settings", (next) => {
    if (next) setSettings({ ...DEFAULT_SETTINGS, ...next });
  });
  useSocketEvent("dev_cameras", (payload) => setCameras(payload?.cameras ?? []));
  useSocketEvent("dev_plate", (payload) => {
    setReading(false);
    setPlate(payload ?? null);
  });

  // `settings` is the server's truth; the form re-syncs whenever it changes.
  if (settings !== syncedSettings) {
    setSyncedSettings(settings);
    setForm(toForm(settings));
  }

  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  const save = () => {
    let roi = null;
    if (form.useRoi) {
      roi = ROI_KEYS.reduce((acc, k) => ({ ...acc, [k]: Number(form.roi[k]) }), {});
      const ok =
        ROI_KEYS.every((k) => form.roi[k] !== "" && roi[k] >= 0 && roi[k] <= 1) &&
        roi.x + roi.w <= 1 &&
        roi.y + roi.h <= 1;
      if (!ok) {
        toast.error("الـ ROI نسب بين 0 و 1 ولازم x+w ≤ 1 و y+h ≤ 1.");
        return;
      }
    }
    const arriveWaitMs = Number(form.arriveWaitMs);
    const defaultQuantity = Number(form.defaultQuantity);
    if (!(arriveWaitMs >= 0 && arriveWaitMs <= 60000) || form.arriveWaitMs === "") {
      toast.error("زمن الانتظار لازم يكون بين 0 و 60000 مللي ثانية.");
      return;
    }
    if (!(defaultQuantity > 0 && defaultQuantity < 100)) {
      toast.error("الكمية الافتراضية لازم تكون أكبر من 0 وأقل من 100.");
      return;
    }
    socket.emit("dev_set_settings", {
      arriveWaitMs,
      defaultQuantity,
      camId: form.camId.trim(),
      camIndex: Number(form.camIndex),
      plateDigits: Number(form.plateDigits),
      plateFrames: Number(form.plateFrames),
      debugDir: form.debugDir.trim(),
      roi,
    });
    toast.success("تم إرسال إعدادات الكاميرا.");
  };

  const capture = () => {
    setPlate(null);
    setReading(true);
    socket.emit("dev_capture_plate");
    // The reader may be down (python missing, camera busy); don't spin forever.
    setTimeout(() => setReading(false), 20000);
  };

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">كاميرا قراءة رقم السيارة</h2>
        <Button variant="outline" size="sm" onClick={() => socket.emit("dev_list_cameras")}>
          <RefreshCw className="size-4" />
          تحديث الكاميرات
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="camIndex">الكاميرا</Label>
          <select
            id="camIndex"
            value={form.camIndex}
            onChange={set("camIndex")}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            {!cameras.some((c) => String(c.index) === form.camIndex) && (
              <option value={form.camIndex}>/dev/video{form.camIndex}</option>
            )}
            {cameras.map((c) => (
              <option key={c.index} value={c.index}>
                {c.device}
              </option>
            ))}
          </select>
        </div>
        <Field id="camId" label="اسم الكاميرا (camId)" value={form.camId} onChange={set("camId")} />
        <Field
          id="plateDigits"
          label="عدد الخانات (1–12)"
          type="number"
          value={form.plateDigits}
          onChange={set("plateDigits")}
        />
        <Field
          id="plateFrames"
          label="عدد الفريمات (1–20)"
          type="number"
          value={form.plateFrames}
          onChange={set("plateFrames")}
        />
        <Field
          id="arriveWaitMs"
          label="انتظار وصول العربية (ms)"
          type="number"
          value={form.arriveWaitMs}
          onChange={set("arriveWaitMs")}
        />
        <Field
          id="defaultQuantity"
          label="الكمية الافتراضية للدورة"
          type="number"
          step="any"
          value={form.defaultQuantity}
          onChange={set("defaultQuantity")}
        />
        <Field
          id="debugDir"
          label="مجلد الـ debug (اختياري)"
          value={form.debugDir}
          onChange={set("debugDir")}
        />
      </div>

      <div className="space-y-2 rounded-lg border p-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <Switch
            checked={form.useRoi}
            onCheckedChange={(v) => setForm((f) => ({ ...f, useRoi: v }))}
          />
          تحديد منطقة القراءة (ROI) — نسب من 0 إلى 1
        </label>
        {form.useRoi && (
          <div className="grid grid-cols-4 gap-2">
            {ROI_KEYS.map((k) => (
              <Field
                key={k}
                id={`roi-${k}`}
                label={k}
                type="number"
                step="0.01"
                value={form.roi[k]}
                onChange={(e) =>
                  setForm((f) => ({ ...f, roi: { ...f.roi, [k]: e.target.value } }))
                }
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save}>
          <Save className="size-4" />
          حفظ الإعدادات
        </Button>
        <Button variant="outline" onClick={capture} disabled={reading}>
          {reading ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
          جرّب القراءة
        </Button>

        {plate && (
          <span
            className="rounded-md border px-3 py-1.5 text-sm"
            role="status"
          >
            {plate.number ? (
              <>
                الرقم المقروء: <b dir="ltr" className="font-mono text-base">{plate.number}</b>
              </>
            ) : (
              "ما اتقرأش، حاول تاني"
            )}
          </span>
        )}
      </div>
    </section>
  );
}

function Field({ id, label, ...props }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input id={id} dir="ltr" {...props} />
    </div>
  );
}

export default Dev_mode_page;
