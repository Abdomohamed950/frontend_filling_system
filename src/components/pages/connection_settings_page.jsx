import { useState } from "react";
import axios from "axios";
import {
  CheckCircle2,
  Globe,
  Loader2,
  PlugZap,
  RotateCcw,
  Save,
  Server,
  XCircle,
} from "lucide-react";
import PageHeader from "../custom_ui/page_header";
import ConfirmDialog from "../custom_ui/confirm_dialog";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { API_URL, API_URL_KEY } from "@/lib/api";
import { SOCKET_URL, SOCKET_URL_KEY } from "@/lib/socket";
import { useSocketStatus } from "@/hooks/use-socket";
import { useToast } from "@/context/toast-context";
import { cn } from "@/lib/utils";

/** Rejects anything that isn't a usable http(s) origin. */
function validateUrl(value) {
  if (!value.trim()) return "العنوان مطلوب.";
  try {
    const url = new URL(value.trim());
    if (!/^https?:$/.test(url.protocol)) return "يجب أن يبدأ العنوان بـ http:// أو https://";
    return null;
  } catch {
    return "صيغة العنوان غير صحيحة.";
  }
}

/** Strips a trailing slash so `${base}/api` never doubles up. */
function normalize(value) {
  return value.trim().replace(/\/+$/, "");
}

function TestResultBadge({ result }) {
  if (!result) return null;
  return (
    <Badge variant={result.ok ? "success" : "destructive"} className="gap-1.5">
      {result.ok ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
      {result.message}
    </Badge>
  );
}

function Connection_settings_page() {
  const toast = useToast();
  const gatewayConnected = useSocketStatus();

  const [apiUrl, setApiUrl] = useState(API_URL);
  const [socketUrl, setSocketUrl] = useState(SOCKET_URL);
  const [errors, setErrors] = useState({});
  const [testing, setTesting] = useState(null);
  const [results, setResults] = useState({});
  const [confirmReset, setConfirmReset] = useState(false);

  const dirty = normalize(apiUrl) !== API_URL || normalize(socketUrl) !== SOCKET_URL;

  const testApi = async () => {
    const problem = validateUrl(apiUrl);
    if (problem) {
      setErrors((prev) => ({ ...prev, apiUrl: problem }));
      return;
    }

    setTesting("api");
    setResults((prev) => ({ ...prev, api: null }));

    const started = performance.now();
    try {
      // `/ports` is the lightest endpoint that proves the API is really up.
      await axios.get(`${normalize(apiUrl)}/api/ports`, { timeout: 6000 });
      const ms = Math.round(performance.now() - started);
      setResults((prev) => ({ ...prev, api: { ok: true, message: `متصل (${ms} مللي ثانية)` } }));
    } catch (error) {
      // A 4xx still proves something is listening and speaking HTTP.
      if (error.response) {
        setResults((prev) => ({
          ...prev,
          api: { ok: true, message: `الخادم يستجيب (رمز ${error.response.status})` },
        }));
      } else {
        setResults((prev) => ({
          ...prev,
          api: { ok: false, message: "تعذر الوصول إلى الخادم" },
        }));
      }
    } finally {
      setTesting(null);
    }
  };

  const save = () => {
    const nextErrors = {
      apiUrl: validateUrl(apiUrl),
      socketUrl: validateUrl(socketUrl),
    };
    setErrors(nextErrors);
    if (nextErrors.apiUrl || nextErrors.socketUrl) {
      toast.error("راجع العناوين المدخلة قبل الحفظ.");
      return;
    }

    localStorage.setItem(API_URL_KEY, normalize(apiUrl));
    localStorage.setItem(SOCKET_URL_KEY, normalize(socketUrl));

    toast.success("تم حفظ الإعدادات — جارٍ إعادة تحميل التطبيق…");
    // The axios instance and the socket are created once at startup, so the
    // new endpoints only take effect after a reload.
    setTimeout(() => window.location.reload(), 900);
  };

  const reset = () => {
    localStorage.removeItem(API_URL_KEY);
    localStorage.removeItem(SOCKET_URL_KEY);
    toast.info("تمت العودة إلى الإعدادات الافتراضية — جارٍ إعادة التحميل…");
    setTimeout(() => window.location.reload(), 900);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Globe}
        title="إعدادات الاتصال"
        description="عناوين خادم البيانات وبوابة التشغيل اللحظي المستخدمة من هذا الجهاز."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setConfirmReset(true)}>
              <RotateCcw className="size-4" />
              استعادة الافتراضي
            </Button>
            <Button size="sm" onClick={save} disabled={!dirty}>
              <Save className="size-4" />
              حفظ وإعادة التحميل
            </Button>
          </>
        }
      />

      <div dir="rtl" className="grid gap-5 lg:grid-cols-2">
        {/* REST API */}
        <section className="space-y-4 rounded-xl border bg-card p-5 elevate">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                <Server className="size-5" />
              </span>
              <div>
                <h2 className="font-semibold">خادم البيانات (REST API)</h2>
                <p className="text-sm text-muted-foreground">
                  السجلات والتقارير وإعدادات المنافذ والمشغلين.
                </p>
              </div>
            </div>
            <TestResultBadge result={results.api} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="api-url">العنوان</Label>
            <Input
              id="api-url"
              value={apiUrl}
              onChange={(event) => {
                setApiUrl(event.target.value);
                setErrors((prev) => ({ ...prev, apiUrl: null }));
              }}
              dir="ltr"
              placeholder="http://localhost:3000"
              aria-invalid={Boolean(errors.apiUrl) || undefined}
              className="font-mono"
            />
            {errors.apiUrl ? (
              <p className="text-xs text-destructive">{errors.apiUrl}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                يتم استدعاء المسارات تحت{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono">
                  {normalize(apiUrl) || "…"}/api
                </code>
              </p>
            )}
          </div>

          <Button variant="outline" size="sm" onClick={testApi} disabled={testing === "api"}>
            {testing === "api" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <PlugZap className="size-4" />
            )}
            اختبار الاتصال
          </Button>
        </section>

        {/* Realtime gateway */}
        <section className="space-y-4 rounded-xl border bg-card p-5 elevate">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-info/12 text-info">
                <PlugZap className="size-5" />
              </span>
              <div>
                <h2 className="font-semibold">بوابة التشغيل اللحظي</h2>
                <p className="text-sm text-muted-foreground">
                  قراءات العدادات وحالة الصمامات وأوامر التعبئة.
                </p>
              </div>
            </div>
            <Badge variant={gatewayConnected ? "success" : "destructive"} className="gap-1.5">
              <span
                className={cn(
                  "size-2 rounded-full",
                  gatewayConnected ? "bg-success" : "bg-destructive"
                )}
              />
              {gatewayConnected ? "متصلة" : "منقطعة"}
            </Badge>
          </div>

          <div className="space-y-2">
            <Label htmlFor="socket-url">العنوان</Label>
            <Input
              id="socket-url"
              value={socketUrl}
              onChange={(event) => {
                setSocketUrl(event.target.value);
                setErrors((prev) => ({ ...prev, socketUrl: null }));
              }}
              dir="ltr"
              placeholder="http://localhost:5000"
              aria-invalid={Boolean(errors.socketUrl) || undefined}
              className="font-mono"
            />
            {errors.socketUrl ? (
              <p className="text-xs text-destructive">{errors.socketUrl}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                اتصال socket.io دائم — تظهر حالته لحظيًا في الشارة أعلاه.
              </p>
            )}
          </div>

          <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            يتم إنشاء الاتصال مرة واحدة عند بدء التطبيق، لذلك يلزم إعادة التحميل بعد تغيير
            العنوان.
          </p>
        </section>
      </div>

      {dirty && (
        <p
          dir="rtl"
          className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning"
        >
          توجد تغييرات غير محفوظة. اضغط «حفظ وإعادة التحميل» لتطبيقها.
        </p>
      )}

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="استعادة الإعدادات الافتراضية؟"
        description="سيتم حذف العناوين المخصصة على هذا الجهاز والرجوع إلى الإعدادات المضمّنة في التطبيق، ثم إعادة التحميل."
        confirmLabel="استعادة"
        variant="warning"
        onConfirm={reset}
      />
    </div>
  );
}

export default Connection_settings_page;
