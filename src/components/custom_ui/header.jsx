import { useEffect, useState } from "react";
import { Brain, LogOut, PenLine, ScanBarcode, Wifi, WifiOff } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { SidebarTrigger } from "../ui/sidebar";
import ThemeToggle from "./theme_toggle";
import ConfirmDialog from "./confirm_dialog";
import { useSocketStatus } from "@/hooks/use-socket";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";

const MODES = [
  { key: "ai", label: "التشغيل الذكي", icon: Brain },
  { key: "barcode", label: "الباركود", icon: ScanBarcode },
  { key: "manual", label: "التشغيل اليدوي", icon: PenLine },
];

/** Ticking wall clock — control-room screens are read at a glance. */
function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="hidden text-center leading-tight md:block">
      <p className="text-base font-bold tabular-nums">
        {now.toLocaleTimeString("ar-EG", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })}
      </p>
      <p className="text-[11px] text-muted-foreground">
        {now.toLocaleDateString("ar-EG", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </p>
    </div>
  );
}

export default function Header({ showAiMode = true, mode = "barcode", onModeChange }) {
  const { user, logout } = useAuth();
  const connected = useSocketStatus();
  const [confirmLogout, setConfirmLogout] = useState(false);

  return (
    <header
      dir="rtl"
      className="z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-card/85 px-3 backdrop-blur-md sm:px-5 no-print"
    >
      <div className="flex items-center gap-3">
        <SidebarTrigger className="size-9" />
        <Badge
          variant={connected ? "success" : "destructive"}
          className="hidden gap-1.5 sm:inline-flex"
        >
          {connected ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
          {connected ? "متصل" : "منقطع"}
        </Badge>
      </div>

      <Clock />

      <div className="flex items-center gap-2">
        {showAiMode && (
          <Select value={mode} onValueChange={(next) => onModeChange?.(next)}>
            <SelectTrigger
              size="sm"
              className={cn(
                "w-auto min-w-34 gap-1.5",
                mode === "ai" && "border-destructive/50 text-destructive"
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {MODES.map(({ key, label, icon: Icon }) => (
                <SelectItem key={key} value={key}>
                  <Icon className="size-4" />
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <ThemeToggle />

        <div className="hidden items-center gap-2 border-s ps-2 lg:flex">
          <div className="text-end leading-tight">
            <p className="text-sm font-semibold">{user?.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {user?.role === "admin" ? "مدير النظام" : "مشغل"}
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          aria-label="تسجيل الخروج"
          title="تسجيل الخروج"
          onClick={() => setConfirmLogout(true)}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="size-4" />
        </Button>
      </div>

      <ConfirmDialog
        open={confirmLogout}
        onOpenChange={setConfirmLogout}
        title="تسجيل الخروج؟"
        description="سيتم إنهاء الجلسة الحالية والعودة إلى شاشة الدخول."
        confirmLabel="تسجيل الخروج"
        onConfirm={logout}
      />
    </header>
  );
}
