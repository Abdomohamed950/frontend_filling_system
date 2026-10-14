import { useState } from "react";
import { Fan, Wifi, WifiOff } from "lucide-react";
import { useSocketEvent } from "@/hooks/use-socket";
import { cn } from "@/lib/utils";

const PUMPS = [
  { key: "pump1", label: "الطلمبة 1" },
  { key: "pump2", label: "الطلمبة 2" },
];

/**
 * Pump Broker panel. The gateway relays the retained MQTT topics
 * (`bumpbroker/availability`, `pump1/running`, `pump2/running`) as a single
 * `pumps_status` socket event: `{ availability, pump1, pump2 }`.
 * Partial payloads are merged. Only render this while a port is filling.
 */
export default function PumpsStatus({ className }) {
  const [state, setState] = useState({ availability: null, pump1: null, pump2: null });

  useSocketEvent("pumps_status", (payload) => {
    if (!payload || typeof payload !== "object") return;
    setState((current) => ({ ...current, ...payload }));
  });

  const online = String(state.availability).toLowerCase() === "online";

  return (
    <div dir="rtl" className={cn("flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2.5 elevate", className)}>
      <span
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium",
          online ? "bg-success/12 text-success" : "bg-destructive/12 text-destructive"
        )}
      >
        {online ? <Wifi className="size-4" /> : <WifiOff className="size-4" />}
        Pump Broker: {online ? "متصل" : "غير متصل"}
      </span>

      {PUMPS.map(({ key, label }) => {
        const raw = state[key];
        // Retained values are stale while the broker is offline.
        const known = online && (raw === 1 || raw === 0 || raw === "1" || raw === "0");
        const running = known && Number(raw) === 1;
        return (
          <span
            key={key}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium",
              !known && "bg-muted text-muted-foreground opacity-60",
              known && running && "bg-info/12 text-info",
              known && !running && "bg-muted text-muted-foreground"
            )}
          >
            <Fan className={cn("size-4", running && "animate-spin")} />
            {label}: {!known ? "غير معروف" : running ? "شغالة" : "واقفة"}
          </span>
        );
      })}
    </div>
  );
}
