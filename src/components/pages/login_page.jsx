import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Droplets, Eye, EyeOff, Loader2, Lock, ShieldAlert, User } from "lucide-react";
import logo from "../img/logo.png";
import station from "../img/Bulk Water Fill Station.jpeg";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/context/toast-context";
import { useSocketStatus } from "@/hooks/use-socket";
import ThemeToggle from "../custom_ui/theme_toggle";
import { isDevMode, setDevMode } from "@/lib/dev-mode";

const LOGO_TAPS_REQUIRED = 5;
const LOGO_TAP_GAP_MS = 1500;

function Login_page() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, user, homeFor } = useAuth();
  const toast = useToast();
  const gatewayOnline = useSocketStatus();

  const [form, setForm] = useState({ username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Already signed in? Skip the form entirely.
  useEffect(() => {
    if (isAuthenticated) navigate(homeFor(user.role), { replace: true });
  }, [isAuthenticated, user, homeFor, navigate]);

  // Tapping the logo 5 times in a row (each tap within 1.5s of the last) toggles dev mode.
  const logoTaps = useRef({ count: 0, last: 0 });
  const handleLogoClick = () => {
    const now = Date.now();
    const taps = logoTaps.current;
    taps.count = now - taps.last > LOGO_TAP_GAP_MS ? 1 : taps.count + 1;
    taps.last = now;

    if (taps.count >= LOGO_TAPS_REQUIRED) {
      taps.count = 0;
      if (isDevMode()) {
        toast.info("وضع المطور مفعّل بالفعل.");
        return;
      }
      setDevMode(true);
      toast.success("أنت الآن في وضع المطور (Dev Mode).");
    }
  };

  const update = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
    if (error) setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError("");

    const result = await login(form.username, form.password);

    if (!result.ok) {
      setError(result.message);
      setSubmitting(false);
      return;
    }

    if (result.offline) {
      toast.info("تعذر الوصول إلى خادم المصادقة — تم الدخول بحساب محلي.");
    }

    const target = location.state?.from ?? homeFor(result.user.role);
    navigate(target, { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* ---------------- form pane ---------------- */}
      <section className="flex w-full flex-col justify-center px-6 py-10 sm:px-12 lg:w-[46%] xl:px-20">
        <div className="absolute top-5 start-5">
          <ThemeToggle />
        </div>

        <div className="mx-auto w-full max-w-md animate-in-up" dir="rtl">
          <img
            src={logo}
            alt="شعار المحطة"
            onClick={handleLogoClick}
            draggable={false}
            className="mb-8 h-16 w-auto select-none object-contain"
          />

          <h1 className="text-3xl font-bold tracking-tight">تسجيل الدخول</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            لوحة التحكم في محطة التعبئة — أدخل بيانات حسابك للمتابعة.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="username">اسم المستخدم</Label>
              <div className="relative">
                <User className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="username"
                  name="username"
                  autoComplete="username"
                  autoFocus
                  required
                  value={form.username}
                  onChange={update("username")}
                  aria-invalid={Boolean(error) || undefined}
                  placeholder="أدخل اسم المستخدم"
                  className="h-11 ps-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={form.password}
                  onChange={update("password")}
                  aria-invalid={Boolean(error) || undefined}
                  placeholder="••••••••"
                  className="h-11 px-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  className="absolute top-1/2 end-2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-destructive/25 bg-destructive/8 p-3 text-sm text-destructive"
              >
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" size="lg" className="h-11 w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  جارٍ التحقق…
                </>
              ) : (
                "دخول"
              )}
            </Button>
          </form>

          <div className="mt-8 flex items-center justify-between border-t pt-5 text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <span
                className={`size-2 rounded-full ${
                  gatewayOnline ? "bg-success" : "bg-destructive"
                }`}
              />
              {gatewayOnline ? "بوابة التشغيل متصلة" : "بوابة التشغيل غير متصلة"}
            </span>
            <span>الإصدار 1.0</span>
          </div>
        </div>
      </section>

      {/* ---------------- brand pane ---------------- */}
      <section className="relative hidden lg:block lg:w-[54%]">
        <img
          src={station}
          alt="محطة التعبئة"
          className="absolute inset-0 size-full object-cover"
        />
        {/* Two stacked washes keep the caption legible over any photo. */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-slate-950/20" />
        <div className="absolute inset-0 bg-primary/15 mix-blend-multiply" />

        <div className="absolute inset-x-0 bottom-0 p-12 text-white" dir="rtl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-semibold backdrop-blur-sm">
            <Droplets className="size-3.5" />
            مراقبة لحظية
          </span>
          <h2 className="mt-5 max-w-lg text-4xl font-bold leading-snug">
            تحكم كامل في منافذ التعبئة من شاشة واحدة
          </h2>
          <p className="mt-3 max-w-md text-white/75">
            متابعة حالة الصمامات وقراءات العدادات والكميات المنصرفة لحظة بلحظة، مع سجل
            كامل للعمليات وتقارير جاهزة للطباعة.
          </p>
        </div>
      </section>
    </div>
  );
}

export default Login_page;
