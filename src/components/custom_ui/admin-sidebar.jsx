import { useState } from "react";
import {
  CircleUser,
  ClipboardClock,
  ClipboardMinus,
  Globe,
  LogOut,
  MonitorCog,
  RadioTower,
  ReceiptText,
  Settings,
  Terminal,
  Truck,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
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
import { useAuth } from "@/context/auth-context";
import { useDevUnlocked } from "@/lib/dev-mode";

const SECTIONS = [
  {
    label: "المتابعة",
    items: [
      { to: "/admin/history", icon: ClipboardClock, label: "السجل" },
      { to: "/admin/reports", icon: ClipboardMinus, label: "التقارير" },
      { to: "/admin/receipts", icon: ReceiptText, label: "الإيصالات" },
    ],
  },
  {
    label: "الإعدادات",
    items: [
      { to: "/admin/ports_settings", icon: Settings, label: "إعدادات المنافذ" },
      { to: "/admin/trucks", icon: Truck, label: "الشاحنات" },
      { to: "/admin/operators", icon: CircleUser, label: "المشغلون" },
      {
        to: "/admin/connection_settings",
        icon: Globe,
        label: "إعدادات الاتصال",
      },
      {
        to: "/admin/sync_settings",
        icon: RadioTower,
        label: "إعدادات المزامنة",
      },
    ],
  },
];

const DEV_SECTION = {
  label: "المطور",
  items: [{ to: "/admin/dev_mode", icon: Terminal, label: "وضع المطور" }],
};

/**
 * Active state comes from the router via `NavLink`, replacing the
 * `activeLink`/`setActiveLink` pair every page had to remember to call —
 * one of which ran during render and warned on every mount.
 */
export default function Admin_sidebar() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const devUnlocked = useDevUnlocked();
  const sections = devUnlocked ? [...SECTIONS, DEV_SECTION] : SECTIONS;

  return (
    <Sidebar side="right" collapsible="icon" dir="rtl" className="no-print">
      <SidebarHeader>
        <img
          src={logo}
          alt="شعار المحطة"
          className="mx-auto h-35 w-auto max-w-full object-contain transition-all group-data-[collapsible=icon]:h-7"
        />
        <SidebarSeparator />
      </SidebarHeader>

      <SidebarContent>
        {sections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {section.items.map(({ to, icon: Icon, label }) => (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname.startsWith(to)}
                      tooltip={label}
                      className="text-right"
                    >
                      <NavLink to={to}>
                        <Icon />
                        <span>{label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        <SidebarGroup>
          <SidebarGroupLabel>التشغيل</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="شاشة المشغل"
                  className="text-right"
                >
                  <NavLink to="/operator">
                    <MonitorCog />
                    <span>شاشة المشغل</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="pointer-events-none text-right"
              tooltip={user?.name}
            >
              <CircleUser />
              <span className="truncate">{user?.name ?? "مدير النظام"}</span>
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
