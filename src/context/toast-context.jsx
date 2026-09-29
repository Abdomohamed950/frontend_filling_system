import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const ToastContext = createContext(null);

const VARIANTS = {
  success: {
    icon: CheckCircle2,
    bar: "bg-success",
    iconClass: "text-success",
  },
  error: {
    icon: XCircle,
    bar: "bg-destructive",
    iconClass: "text-destructive",
  },
  warning: {
    icon: AlertTriangle,
    bar: "bg-warning",
    iconClass: "text-warning",
  },
  info: {
    icon: Info,
    bar: "bg-info",
    iconClass: "text-info",
  },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());
  const nextId = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (variant, message, { title, duration = 5000 } = {}) => {
      const id = ++nextId.current;
      setToasts((current) => [...current.slice(-3), { id, variant, message, title }]);
      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration)
        );
      }
      return id;
    },
    [dismiss]
  );

  const toast = useMemo(
    () => ({
      success: (message, opts) => push("success", message, opts),
      error: (message, opts) => push("error", message, { duration: 7000, ...opts }),
      warning: (message, opts) => push("warning", message, opts),
      info: (message, opts) => push("info", message, opts),
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}

      <div
        className="pointer-events-none fixed bottom-4 left-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 no-print"
        role="region"
        aria-live="polite"
        aria-label="الإشعارات"
      >
        {toasts.map((t) => {
          const { icon: Icon, bar, iconClass } = VARIANTS[t.variant] ?? VARIANTS.info;
          return (
            <div
              key={t.id}
              dir="rtl"
              className="animate-in-up pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-xl border bg-popover p-3.5 pe-10 text-popover-foreground elevate-lg"
            >
              <span className={cn("absolute inset-y-0 end-0 w-1", bar)} />
              <Icon className={cn("mt-0.5 size-5 shrink-0", iconClass)} />
              <div className="min-w-0 flex-1">
                {t.title && <p className="text-sm font-semibold">{t.title}</p>}
                <p className="text-sm text-muted-foreground [&:first-child]:text-foreground">
                  {t.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="إغلاق الإشعار"
                className="absolute start-2 top-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
