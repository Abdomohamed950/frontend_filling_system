import { Gauge, Hash, ScanBarcode, Target, Truck } from "lucide-react";
import { Input } from "../ui/input";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Entry fields + live read-outs for a single port.
 *
 * The three inputs are mirrored to the gateway so a second station showing
 * the same port stays in sync. That emit previously referenced a `socket`
 * binding that was never imported here, which threw on the first keystroke;
 * the owning component now passes an `onFieldChange` callback instead.
 */

function Field({ id, icon: Icon, label, value, onChange, disabled, invalid, ...rest }) {
  return (
    <div className="flex items-center gap-2">
      {/* Fixed label width keeps the three rows aligned; the input takes all
          the remaining space — meter figures need room to stay readable. */}
      <label
        htmlFor={id}
        className="flex w-24 shrink-0 items-center gap-1 text-[11px] font-medium text-muted-foreground"
      >
        <Icon className="size-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={invalid || undefined}
        className="h-8 min-w-0 flex-1 rounded-lg text-center text-base font-semibold"
        {...rest}
      />
    </div>
  );
}

/** Side by side — two stacked rows cost height the tank needs. */
function Readout({ icon: Icon, label, value, tone }) {
  return (
    <div
      className={cn(
        "min-w-0 flex-1 rounded-lg bg-muted/70 px-2 py-1 text-center",
        tone === "primary" && "bg-primary/10 text-primary"
      )}
    >
      <span className="flex items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground">
        <Icon className="size-3 shrink-0" />
        <span className="truncate">{label}</span>
      </span>
      <p className="truncate text-sm font-bold tabular-nums">{value}</p>
    </div>
  );
}

export default function Port_data(props) {
  const {
    portName,
    truckNumber,
    receiptNumber,
    requiredQuantity,
    onFieldChange,
    disableFields,
    actualQuantity,
    flowMeter,
    maxQuantity,
    onScanSubmit,
    mode = "barcode",
  } = props;

  const overRequested = Number(requiredQuantity) > maxQuantity;

  return (
    <div className="w-full space-y-1.5" dir="rtl">
      <Field
        id={`${portName}-truck`}
        icon={Truck}
        label="رقم الشاحنة"
        value={truckNumber}
        onChange={(value) => onFieldChange("truckNumber", value)}
        disabled={disableFields}
        placeholder="—"
      />
      {/* Manual mode starts a fill straight from the required-quantity field
          below plus a start button — no barcode involved, so the scan field
          would just sit there unused. */}
      {mode !== "manual" && (
        <Field
          id={`${portName}-receipt`}
          icon={ScanBarcode}
          label="امسح الباركود"
          value={receiptNumber}
          onChange={(value) => onFieldChange("receiptNumber", value)}
          disabled={disableFields}
          placeholder="امسح ثم Enter"
          // Receipt numbers (and the crisis path's operator id) aren't
          // always purely numeric, unlike the other two fields — this one
          // needs to accept letters too.
          type="text"
          inputMode="text"
          // A barcode scanner types the digits and sends Enter itself, so this
          // is what actually triggers `check_receipt`.
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            onScanSubmit?.();
          }}
        />
      )}
      <Field
        id={`${portName}-required`}
        icon={Target}
        label="الكمية المطلوبة"
        value={requiredQuantity}
        onChange={(value) => onFieldChange("requiredQuantity", value)}
        disabled={disableFields}
        invalid={overRequested}
        min={1}
        max={maxQuantity}
        placeholder="—"
      />

      {overRequested && (
        <p className="text-[11px] font-medium text-destructive">
          الحد الأقصى المسموح به {formatNumber(maxQuantity)}.
        </p>
      )}

      <div className="flex gap-1.5 border-t pt-1.5">
        <Readout
          icon={Hash}
          label="الكمية الفعلية"
          value={formatNumber(actualQuantity, 2)}
          tone="primary"
        />
        <Readout icon={Gauge} label="قراءة العداد" value={formatNumber(flowMeter, 2)} />
      </div>
    </div>
  );
}
