import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Play, ScanBarcode, Square } from "lucide-react";
import Tank from "./tank.jsx";
import Port_data from "./port_data.jsx";
import ConfirmDialog from "./confirm_dialog.jsx";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { socket, samePort } from "@/lib/socket";
import { useSocketEvent } from "@/hooks/use-socket";
import { BLOCK_REASONS, PHASE_LABELS, cycleActive, useDevModeStatus } from "@/lib/dev-mode";
import { useToast } from "@/context/toast-context";
import { useAuth } from "@/context/auth-context";
import { formatDuration, toOperatorId } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The gateway silently drops `start_filling` unless `0 < q < 100`, and the
 * firmware enforces the same window. The bound is exclusive on both ends —
 * sending exactly 100 looks accepted here but nothing happens on the valve.
 */
const MAX_QUANTITY = 100;

/** `state` values the device publishes on `<port>/state`. */
const FILLING_STATES = new Set(["filling"]);
const STOPPED_STATES = new Set(["stop", "emergency_stop"]);

const STATUS = {
  waiting: { label: "بانتظار البيانات", variant: "muted" },
  offline: { label: "غير متصل", variant: "destructive" },
  idle: { label: "جاهز", variant: "success" },
  checking: { label: "جارٍ التحقق من الإيصال", variant: "info" },
  filling: { label: "جارٍ التعبئة", variant: "info" },
  opening: { label: "فتح الصمام", variant: "warning" },
  closing: { label: "غلق الصمام", variant: "warning" },
  stopping: { label: "جارٍ الإيقاف", variant: "warning" },
  emergency: { label: "إيقاف طارئ", variant: "destructive" },
};

/** Server-reported outcomes of a `check_receipt` scan (see `receipt_check_result`). */
const RECEIPT_MESSAGES = {
  already_used: "الإيصال مستخدم بالفعل.",
  not_found: "الإيصال غير موجود.",
  trips_exhausted: "الشاحنة وصلت للحد الأقصى من النقلات.",
  crisis_blocked: "تم ملء هذه السيارة مرة في وضع الأزمات اليوم.",
  error: "حدث خطأ غير متوقع أثناء التحقق من الإيصال.",
};

/**
 * The device reports the close sequence in three stages
 * (`closing_first` / `closing_second` / `closing_final`); the UI only needs
 * to know the valve is on its way shut.
 */
function normalizeValveState(raw) {
  const value = String(raw ?? "");
  if (value.startsWith("closing")) return "closing";
  return value;
}

/** Name of the port card the operator last focused — see `dev_plate` below. */
let lastTouchedPort = null;

function Op_Port({ name, mode = "barcode", onStatsChange }) {
  const toast = useToast();
  const { user } = useAuth();

  // Tri-state on purpose. `null` means the gateway has not told us anything
  // about this port yet, which is NOT the same as being told it is offline —
  // conflating the two made every freshly-loaded page claim its ports were
  // disconnected.
  const [reportedOnline, setReportedOnline] = useState(null);
  // Set by any port-scoped frame. A port that is streaming telemetry is
  // demonstrably alive even if the gateway only announces `availability` on
  // transitions and we joined after the last one.
  const [hasTelemetry, setHasTelemetry] = useState(false);
  const [valveState, setValveState] = useState("close");
  const [filling, setFilling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flowMeter, setFlowMeter] = useState(0);
  const [actualQuantity, setActualQuantity] = useState(0);
  const [startedAt, setStartedAt] = useState(null);
  const [stopping, setStopping] = useState(false);
  const [emergency, setEmergency] = useState(false);
  const [elapsed, setElapsed] = useState("—");
  const [confirmStop, setConfirmStop] = useState(false);
  const [checkingReceipt, setCheckingReceipt] = useState(false);
  // The gateway's `receipt_check_result` carries no `port` field, so on the
  // single shared socket every Op_Port instance receives it. This flag lets
  // whichever port is actually waiting on a scan claim the result; it is a
  // best-effort match that assumes one barcode check in flight at a time.
  const awaitingCheckRef = useRef(false);

  // Dev mode swaps the start control for the automatic cycle (car moves under
  // the port, plate is read, quantity is filled in, fill starts).
  const devEnabled = useDevModeStatus() === true;
  const [cycle, setCycle] = useState(null);
  const cycleRunning = devEnabled && cycleActive(cycle);

  const [fields, setFields] = useState({
    truckNumber: "",
    receiptNumber: "",
    requiredQuantity: "",
  });

  // The meter reading captured when this fill started; every telemetry frame
  // is measured against it. Kept in a ref so the socket handler never needs
  // to be re-registered.
  const startValueRef = useRef(0);

  const progress = useMemo(() => {
    const required = Number(fields.requiredQuantity);
    if (!required) return 0;
    return Math.round((actualQuantity / required) * 100);
  }, [actualQuantity, fields.requiredQuantity]);

  const canManualStart = useMemo(() => {
    if (!fields.truckNumber) return false;
    const quantity = Number(fields.requiredQuantity);
    return Number.isFinite(quantity) && quantity > 0 && quantity < MAX_QUANTITY;
  }, [fields.truckNumber, fields.requiredQuantity]);

  // An explicit announcement always wins; telemetry is only a fallback.
  const available = reportedOnline ?? hasTelemetry;

  const status = !available
    ? reportedOnline === false
      ? "offline"
      : "waiting"
    : emergency
      ? "emergency"
      : stopping
        ? "stopping"
        : valveState === "opening" || valveState === "closing"
          ? valveState
          : filling
            ? "filling"
            : checkingReceipt
              ? "checking"
              : "idle";

  // Join this port's room so the gateway streams telemetry for it.
  useEffect(() => {
    socket.emit("join_port", name);
    return () => socket.emit("leave_port", name);
  }, [name]);

  useSocketEvent("availability", (data) => {
    if (!samePort(data.port, name)) return;
    setReportedOnline(data.data === "online");
  });

  useSocketEvent("state", (data) => {
    if (!samePort(data.port, name)) return;
    setHasTelemetry(true);
    const next = String(data.data ?? "");

    if (FILLING_STATES.has(next)) {
      setBusy(true);
      setStopping(false);
      setEmergency(false);
      setStartedAt((current) => current ?? Date.now());
      return;
    }

    if (next === "stoping") {
      // Device spelling. The valve is mid-close; the fill is not over yet.
      setStopping(true);
      return;
    }

    if (STOPPED_STATES.has(next)) {
      setBusy(false);
      setStopping(false);
      setStartedAt(null);

      if (next === "emergency_stop") {
        setEmergency(true);
        toast.error(`إيقاف طارئ على ${name}.`, { duration: 0 });
      }
    }
  });

  /**
   * `fields` and `startValueRef` are pure client state — a refresh mid-fill
   * loses both, even though the socket replay brings `status`/`flowMeter`
   * right back. The truck/receipt/quantity typed in did survive though: the
   * server attached them to the open `history` row when the fill started.
   * The gateway pushes that row back on `join_port` (see `transport/socket.js`)
   * whenever one is already open for this port, so a refresh mid-fill
   * restores the form instead of leaving it blank. It also fires for a
   * genuinely new fill — harmless, since it just re-confirms what the scan
   * already set locally.
   */
  useSocketEvent("history_open", (data) => {
    if (!samePort(data.port, name)) return;
    const record = data.record;
    if (!record) return;
    setFields({
      truckNumber: record.truckNum ?? "",
      receiptNumber: record.receiptNum ?? "",
      requiredQuantity:
        record.requiredQuantity === null || record.requiredQuantity === undefined
          ? ""
          : String(record.requiredQuantity),
    });
    if (Number.isFinite(record.startMeter)) {
      startValueRef.current = record.startMeter;
    }
  });

  useSocketEvent("valve_state", (data) => {
    if (!samePort(data.port, name)) return;
    setHasTelemetry(true);
    const next = normalizeValveState(data.data);
    setValveState(next);
    setFilling(next !== "close");
  });

  useSocketEvent("flowmeter", (data) => {
    if (!samePort(data.port, name)) return;
    setHasTelemetry(true);
    // `data` is always a string; the gateway adds a parsed `value` alongside.
    const reading = Number(data.value ?? data.data);
    if (Number.isNaN(reading)) return;
    setFlowMeter(reading);
    setActualQuantity(Math.max(0, reading - startValueRef.current));
  });

  // Another station editing the same port mirrors its input here.
  useSocketEvent("update_field", (data) => {
    if (!samePort(data.port, name)) return;
    setFields((prev) => ({ ...prev, [data.field]: data.value }));
  });

  /**
   * Reply to `check_receipt`. On `valid`/`crisis_ok` the server has already
   * called `start_filling` itself — this console must not call it again, it
   * only needs to surface the outcome; the usual `history_open`/`state`
   * events drive the rest of the UI exactly as for a manually started fill.
   */
  useSocketEvent("receipt_check_result", (data) => {
    if (!awaitingCheckRef.current) return;
    awaitingCheckRef.current = false;
    setCheckingReceipt(false);

    const status = data?.status;
    if (status === "valid" || status === "crisis_ok") {
      toast.success(
        status === "crisis_ok"
          ? `تم قبول تعبئة الأزمات على ${name} — جارٍ البدء.`
          : `تم قبول الإيصال ${data?.receiptNum ?? ""} على ${name} — جارٍ البدء.`
      );
      return;
    }

    const detail =
      status === "trips_exhausted" && data?.message
        ? data.message
        : (RECEIPT_MESSAGES[status] ?? "تعذر التحقق من الإيصال.");
    toast.error(`${detail} (${name})`);
  });

  useSocketEvent("dev_cycle", (data) => {
    if (samePort(data?.port, name)) setCycle(data);
  });

  // A registered truck that used up its trips is refused by `start_filling`:
  // `{ port, reason, plate, tripsDone, maxTrips }`, sent to the sender only.
  useSocketEvent("start_blocked", (data) => {
    if (!samePort(data?.port, name)) return;
    const counts = data.maxTrips != null ? ` (${data.tripsDone}/${data.maxTrips})` : "";
    toast.error(
      `${RECEIPT_MESSAGES[data.reason] ?? "تم رفض بدء التعبئة."}${data.plate ? ` — ${data.plate}` : ""}${counts} (${name})`
    );
  });

  // The read-out is only shown while a fill is running, so there is nothing
  // to reset when `startedAt` clears.
  useEffect(() => {
    if (!startedAt) return;
    const tick = () => setElapsed(formatDuration(startedAt, Date.now()));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  useEffect(() => {
    onStatsChange?.(name, { status, actualQuantity, available });
  }, [name, status, actualQuantity, available, onStatsChange]);

  const handleFieldChange = useCallback(
    (field, value) => {
      setFields((prev) => ({ ...prev, [field]: value }));
      socket.emit("update_field", { port: name, field, value });
    },
    [name]
  );

  // `dev_plate` (dev mode camera) carries no port — the camera is shared — so
  // the card the operator last touched claims it. The field is only filled,
  // never submitted: the operator reviews the number before starting.
  useSocketEvent("dev_plate", (data) => {
    if (lastTouchedPort !== name || busy || checkingReceipt) return;
    if (!data?.number) {
      toast.warning("ما اتقرأش رقم السيارة، حاول تاني أو أدخله يدويًا.");
      return;
    }
    handleFieldChange("truckNumber", String(data.number));
  });

  /**
   * Triggered by pressing Enter in the receipt field — a scanner does this
   * itself the instant it finishes reading. Every port starts a fill through
   * a barcode scan; there is no manual "ابدأ" button. Whether
   * `required_quantity` is needed depends on what was scanned: an operator
   * scanning/typing their own operator id is the "crisis" fill path, which
   * the server accepts at most once per truck per day and which requires a
   * manually entered quantity — a real receipt number carries its own
   * quantity server-side and must not send one.
   */
  const submitCheckReceipt = () => {
    const { truckNumber, receiptNumber, requiredQuantity } = fields;

    // Dev mode: a scan kicks off the automatic cycle instead of a receipt
    // check — the truck number comes from the camera, not the field.
    if (devEnabled) {
      if (busy || cycleRunning) return;
      if (!String(receiptNumber).trim()) {
        toast.warning("امسح الباركود لبدء الدورة.");
        return;
      }
      handleFieldChange("receiptNumber", "");
      startCycle();
      return;
    }

    if (reportedOnline === false) {
      toast.error(`المنفذ ${name} معطّل حاليًا حسب بوابة التشغيل.`);
      return;
    }
    const operatorId = toOperatorId(user);
    if (operatorId === null) {
      toast.error("لا يوجد معرّف مشغل صالح لهذه الجلسة. سجّل الدخول بحساب مشغل.");
      return;
    }
    if (!truckNumber || !receiptNumber) {
      toast.warning("يرجى إدخال رقم الشاحنة ومسح الباركود قبل المتابعة.");
      return;
    }

    const isCrisisAttempt = String(receiptNumber).trim() === String(operatorId);
    let quantity;
    if (isCrisisAttempt) {
      quantity = Number(requiredQuantity);
      if (!requiredQuantity || !Number.isFinite(quantity) || quantity <= 0 || quantity >= MAX_QUANTITY) {
        toast.warning(
          `هذا رقمك الشخصي — أدخل الكمية المطلوبة يدويًا (أكبر من صفر وأقل من ${MAX_QUANTITY}) ثم امسح الباركود مرة أخرى لتأكيد تعبئة الأزمات.`
        );
        return;
      }
    }

    awaitingCheckRef.current = true;
    setCheckingReceipt(true);

    socket.emit("check_receipt", {
      port: name,
      receipt_number: receiptNumber,
      truck_number: truckNumber,
      operator_id: operatorId,
      ...(isCrisisAttempt ? { required_quantity: quantity } : {}),
    });
  };

  /**
   * Manual mode's "ابدأ" button. No receipt is involved, so this calls
   * `start_filling` directly instead of going through `check_receipt` — the
   * gateway accepts it the same way it accepts the AI process's own calls,
   * gated by the same auth token and `0 < required_quantity < MAX_QUANTITY`
   * window (see API.md §8.1).
   */
  const submitManualStart = () => {
    const { truckNumber, requiredQuantity } = fields;

    if (reportedOnline === false) {
      toast.error(`المنفذ ${name} معطّل حاليًا حسب بوابة التشغيل.`);
      return;
    }
    const operatorId = toOperatorId(user);
    if (operatorId === null) {
      toast.error("لا يوجد معرّف مشغل صالح لهذه الجلسة. سجّل الدخول بحساب مشغل.");
      return;
    }
    if (!truckNumber) {
      toast.warning("يرجى إدخال رقم الشاحنة قبل البدء.");
      return;
    }
    const quantity = Number(requiredQuantity);
    if (!requiredQuantity || !Number.isFinite(quantity) || quantity <= 0 || quantity >= MAX_QUANTITY) {
      toast.warning(`أدخل كمية صحيحة أكبر من صفر وأقل من ${MAX_QUANTITY}.`);
      return;
    }

    socket.emit("start_filling", {
      port: name,
      required_quantity: quantity,
      truck_number: truckNumber,
      operator_id: operatorId,
    });
    toast.success(`تم إرسال أمر البدء اليدوي إلى ${name}.`);
  };

  const startCycle = () => {
    if (reportedOnline === false) {
      toast.error(`المنفذ ${name} معطّل حاليًا حسب بوابة التشغيل.`);
      return;
    }
    setCycle(null);
    socket.emit("dev_start_cycle", { port: name });
  };

  const stopFilling = () => {
    if (cycleRunning && !filling) {
      socket.emit("dev_cancel_cycle", { port: name });
      setConfirmStop(false);
      return;
    }
    socket.emit("stop_filling", { port: name });
    setConfirmStop(false);
    toast.info(`تم إرسال أمر الإيقاف إلى ${name}.`);
  };

  const meta = STATUS[status];

  return (
    <div
      className={cn(
        // Fixed to the height its grid cell hands down; `min-h-0` lets the
        // tank below shrink instead of pushing the buttons off-screen.
        "flex h-full min-h-0 flex-col gap-2 overflow-hidden rounded-2xl border bg-card p-3 text-card-foreground transition-shadow elevate",
        filling && "border-primary/40 ring-1 ring-primary/20"
      )}
    >
      {/* header */}
      <div className="flex shrink-0 items-center justify-between gap-2" dir="rtl">
        <div className="flex min-w-0 items-center gap-2">
          {/* Connection only — the badge beside it carries the port's state. */}
          <span
            role="img"
            aria-label={available ? "متصل" : reportedOnline === false ? "غير متصل" : "بانتظار البيانات"}
            title={available ? "متصل" : reportedOnline === false ? "غير متصل" : "بانتظار البيانات"}
            className={cn(
              "size-2.5 shrink-0 rounded-full",
              available ? "bg-success" : reportedOnline === false ? "bg-destructive" : "bg-muted-foreground"
            )}
          />
          <h2 className="truncate text-base font-bold uppercase">{name}</h2>
        </div>
        <Badge variant={meta.variant}>{meta.label}</Badge>
      </div>

      <div className="shrink-0" onFocusCapture={() => (lastTouchedPort = name)}>
        <Port_data
          portName={name}
          truckNumber={fields.truckNumber}
          receiptNumber={fields.receiptNumber}
          requiredQuantity={fields.requiredQuantity}
          onFieldChange={handleFieldChange}
          disableFields={busy || checkingReceipt || cycleRunning}
          actualQuantity={actualQuantity}
          flowMeter={flowMeter}
          maxQuantity={MAX_QUANTITY}
          onScanSubmit={submitCheckReceipt}
          mode={mode}
        />
      </div>

      {/* The only elastic row — it soaks up whatever height is left, and the
          tank letterboxes itself inside it. */}
      <div className="min-h-0 min-w-0 flex-1">
        <Tank valveState={valveState} filling={filling} progress={progress} />
      </div>

      {/* progress */}
      <div dir="rtl" className="shrink-0 space-y-1">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>نسبة الإنجاز</span>
          <span className="tabular-nums">{busy ? elapsed : "—"}</span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={Math.min(100, progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`نسبة تعبئة ${name}`}
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500 ease-out",
              progress > 100 ? "bg-destructive" : "bg-primary"
            )}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      </div>

      {/* actions */}
      <div className="flex shrink-0 gap-2" dir="rtl">
        {devEnabled && !busy && !checkingReceipt && !cycleRunning ? (
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Button type="button" className="w-full" onClick={startCycle}>
              <Play className="size-4" />
              ابدأ الدورة
            </Button>
            {cycle?.phase === "blocked" && (
              <p role="alert" className="truncate text-center text-[11px] text-destructive">
                {BLOCK_REASONS[cycle.reason] ?? PHASE_LABELS.blocked}
              </p>
            )}
          </div>
        ) : cycleRunning && !busy ? (
          <div
            role="status"
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground"
          >
            <Loader2 className="size-4 animate-spin" />
            {PHASE_LABELS[cycle.phase] ?? cycle.phase}
          </div>
        ) : mode === "manual" && !busy && !checkingReceipt ? (
          <Button
            type="button"
            variant="default"
            className="flex-1"
            onClick={submitManualStart}
            disabled={!canManualStart}
          >
            <Play className="size-4" />
            ابدأ
          </Button>
        ) : (
          // Barcode/AI modes never show a start button — a scan (or the AI
          // process itself) calls `start_filling` on its own.
          <div className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
            {checkingReceipt ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                جارٍ التحقق من الإيصال…
              </>
            ) : busy ? (
              "قيد التعبئة"
            ) : (
              <>
                <ScanBarcode className="size-4" />
                امسح الباركود للبدء
              </>
            )}
          </div>
        )}
        <Button
          type="button"
          variant="destructive"
          className="flex-1"
          onClick={() => setConfirmStop(true)}
          disabled={!busy && !filling && !cycleRunning}
        >
          <Square className="size-4" />
          توقف
        </Button>
      </div>

      <ConfirmDialog
        open={confirmStop}
        onOpenChange={setConfirmStop}
        title={`إيقاف التعبئة على ${name}؟`}
        description="سيتم إغلاق الصمام فورًا وتسجيل الكمية المنصرفة حتى هذه اللحظة."
        confirmLabel="إيقاف التعبئة"
        onConfirm={stopFilling}
      />
    </div>
  );
}

export default Op_Port;
