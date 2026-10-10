import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Wifi, WifiOff } from "lucide-react";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "../ui/sidebar";
import Admin_sidebar from "../custom_ui/admin-sidebar";
import ThemeToggle from "../custom_ui/theme_toggle";
import { Badge } from "../ui/badge";
import History_page from "./history_page";
import Reports_page from "./reports_page";
import Receipts_page from "./receipts_page";
import Ports_settings_page from "./ports_settings_page";
import Manage_operators_page from "./manage_operators_page";
import Connection_settings_page from "./connection_settings_page";
import Sync_settings_page from "./sync_settings_page";
import Trucks_page from "./trucks_page";
import Dev_mode_page from "./dev_mode_page";
import Not_found_page from "./not_found_page";
import { useSocketStatus } from "@/hooks/use-socket";

const TITLES = {
  history: "السجل",
  reports: "التقارير",
  receipts: "الإيصالات",
  ports_settings: "إعدادات المنافذ",
  operators: "المشغلون",
  connection_settings: "إعدادات الاتصال",
  sync_settings: "إعدادات المزامنة",
  trucks: "الشاحنات",
  dev_mode: "وضع المطور",
};

function Topbar() {
  const location = useLocation();
  const connected = useSocketStatus();
  const section = location.pathname.split("/")[2] || "history";

  return (
    <header
      dir="rtl"
      className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-card/85 px-3 backdrop-blur-md sm:px-5 no-print"
    >
      <SidebarTrigger className="size-9" />

      <nav aria-label="مسار التنقل" className="flex items-center gap-1.5 text-sm">
        <span className="text-muted-foreground">لوحة الإدارة</span>
        <span className="text-muted-foreground/60">/</span>
        <span className="font-semibold">{TITLES[section] ?? "—"}</span>
      </nav>

      <div className="ms-auto flex items-center gap-2">
        <Badge
          variant={connected ? "success" : "destructive"}
          className="hidden gap-1.5 sm:inline-flex"
        >
          {connected ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
          {connected ? "البوابة متصلة" : "البوابة منقطعة"}
        </Badge>
        <ThemeToggle />
      </div>
    </header>
  );
}

function Admin_page() {
  return (
    <SidebarProvider>
      <Admin_sidebar />

      <SidebarInset className="min-w-0 bg-background">
        <Topbar />

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 print-area">
          <Routes>
            <Route index element={<Navigate to="history" replace />} />
            <Route path="history" element={<History_page />} />
            <Route path="reports" element={<Reports_page />} />
            <Route path="receipts" element={<Receipts_page />} />
            <Route path="ports_settings" element={<Ports_settings_page />} />
            <Route path="operators" element={<Manage_operators_page />} />
            <Route path="connection_settings" element={<Connection_settings_page />} />
            <Route path="sync_settings" element={<Sync_settings_page />} />
            <Route path="trucks" element={<Trucks_page />} />
            <Route path="dev_mode" element={<Dev_mode_page />} />
            <Route path="*" element={<Not_found_page inline />} />
          </Routes>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default Admin_page;
