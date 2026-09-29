import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeftRight,
  Brain,
  CircleUser,
  CircleX,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  RefreshCw,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "../ui/sidebar";
import logo from "../img/logo.png";
import ConfirmDialog from "./confirm_dialog";
import { socket } from "@/lib/socket";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/context/toast-context";

/**
 * Operator-side controls. Every entry here used to be an inert `<a href="#">`;
 * they now drive real behaviour.
 */
export default function AppSidebar({ rtl, setRtl, ports = [], onRefresh, aiMode }) {
  const { user, logout, homeFor } = useAuth();
  const toast = useToast();
  const [confirmCloseAll, setConfirmCloseAll] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const closeAllPorts = () => {
    ports.forEach((port) => socket.emit("stop_filling", { port }));
    socket.emit("stop_all_ports", {});
    setConfirmCloseAll(false);
    toast.warning("تم إرسال أمر الإغلاق إلى جميع المنافذ.");
  };

  return (
    <Sidebar side="right" collapsible="icon" dir="rtl">
      <SidebarHeader>
        <img
          src={logo}
          alt="شعار المحطة"
          className="h-10 w-auto object-contain transition-all group-data-[collapsible=icon]:h-7"
        />
        <SidebarSeparator />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>أدوات التشغيل</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setRtl(!rtl)}
                  tooltip="عكس ترتيب المنافذ"
                  className="text-right"
                >
                  <ArrowLeftRight />
                  <span>{rtl ? "الترتيب من اليسار" : "الترتيب من اليمين"}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={onRefresh}
                  tooltip="تحديث قائمة المنافذ"
                  className="text-right"
                >
                  <RefreshCw />
                  <span>تحديث المنافذ</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={aiMode}
                  onClick={() => socket.emit("toggle_ai_mode", {})}
                  tooltip="التشغيل عبر الذكاء الاصطناعي"
                  className="text-right"
                >
                  <Brain />
                  <span>التشغيل عبر الذكاء الاصطناعي</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {user?.role === "admin" && (
          <SidebarGroup>
            <SidebarGroupLabel>الإدارة</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="لوحة التحكم" className="text-right">
                    <Link to={homeFor("admin")}>
                      <LayoutDashboard />
                      <span>لوحة التحكم</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>إجراءات طارئة</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setConfirmCloseAll(true)}
                  tooltip="إغلاق جميع المنافذ"
                  className="text-right text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <CircleX />
                  <span>إغلاق جميع المنافذ</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>المنافذ النشطة</SidebarGroupLabel>
          <SidebarGroupContent className="px-2 group-data-[collapsible=icon]:hidden">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <LayoutGrid className="size-4" />
              {ports.length} منفذ
            </p>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="pointer-events-none text-right" tooltip={user?.name}>
              <CircleUser />
              <span className="truncate">{user?.name ?? "مشغل"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => setConfirmLogout(true)}
              tooltip="تسجيل الخروج"
              className="text-right text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut />
              <span>تسجيل الخروج</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <ConfirmDialog
        open={confirmCloseAll}
        onOpenChange={setConfirmCloseAll}
        title="إغلاق جميع المنافذ؟"
        description="سيتم إيقاف التعبئة وإغلاق الصمامات على كل المنافذ فورًا. استخدم هذا الإجراء في حالات الطوارئ فقط."
        confirmLabel="إغلاق الكل"
        onConfirm={closeAllPorts}
      />

      <ConfirmDialog
        open={confirmLogout}
        onOpenChange={setConfirmLogout}
        title="تسجيل الخروج؟"
        description="سيتم إنهاء الجلسة الحالية والعودة إلى شاشة الدخول."
        confirmLabel="تسجيل الخروج"
        onConfirm={logout}
      />
    </Sidebar>
  );
}
