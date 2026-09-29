import axios from "axios";
import { STORAGE_KEY, TOKEN_KEY } from "@/lib/auth-storage";

export const API_URL_KEY = "fs-api-url";

/**
 * A build-time env var can't be edited on a commissioned machine, so an
 * override saved from the connection-settings screen wins over it. Below
 * that, same pattern as the socket URL (lib/socket.js): default to whatever
 * host the page was loaded from, so the panel works from a phone or tablet
 * on the network with zero per-device setup — the API always ships on the
 * same box as the page, just on a different port.
 */
function resolveApiUrl() {
  const stored = localStorage.getItem(API_URL_KEY)?.trim();
  if (stored) return stored;

  const explicit = import.meta.env.VITE_API_URL?.trim();
  if (explicit) return explicit;

  const port = import.meta.env.VITE_API_PORT?.trim() || "3000";
  return `${window.location.protocol}//${window.location.hostname}:${port}`;
}

export const API_URL = resolveApiUrl();

/**
 * Single axios instance for the whole app. Every screen used to hardcode
 * its own base URL, which is how the reports page ended up pointing at a
 * different port than the rest of the system.
 */
export const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 12000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/*
 * السيرفر بيرفض التوكن بـ 401 لو مستخدمه اتحذف، حتى لو توقيعه لسه صالح
 * (middleware/auth.js على الباك‌إند بيتحقق من القاعدة في كل طلب). من غير
 * هذا الاعتراض، الجلسة كانت هتفضل "مسجّلة دخول" محليًا للأبد — الـ user في
 * localStorage ما بيتحدّثش لوحده لمجرد إن طلب واحد فشل. إعادة تحميل كاملة
 * للصفحة (مش SPA navigate) عشان تُبنى AuthProvider من جديد بـ user = null
 * بضمان، مهما كان مكانها بالنسبة للـ Router.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const isLoginAttempt = error?.config?.url?.includes("/auth/login");

    if (status === 401 && !isLoginAttempt) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(TOKEN_KEY);
      if (!window.location.pathname.startsWith("/login")) {
        window.location.assign("/login");
      }
    }

    return Promise.reject(error);
  }
);

/** Turns any axios failure into a short Arabic message fit for a toast. */
export function apiErrorMessage(error) {
  if (axios.isCancel?.(error) || error?.code === "ERR_CANCELED") return null;

  if (error?.code === "ECONNABORTED") {
    return "انتهت مهلة الاتصال بالخادم. حاول مرة أخرى.";
  }
  if (error?.code === "ERR_NETWORK" || !error?.response) {
    return `تعذر الوصول إلى الخادم (${API_URL}). تأكد من تشغيله ومن إعدادات الاتصال.`;
  }

  const { status, data } = error.response;
  // The service reports failures as `{ "error": "..." }`. Reading only
  // `message` threw every server-supplied reason away and replaced it with a
  // generic line — "Name are required" became "بيانات غير صالحة".
  if (typeof data?.error === "string") return data.error;
  if (typeof data?.message === "string") return data.message;

  // A UNIQUE clash surfaces as a bare 500; say something actionable.
  if (status === 500) {
    return "فشل الحفظ. تأكد أن الاسم أو الكود غير مستخدم من قبل.";
  }

  const byStatus = {
    400: "بيانات غير صالحة.",
    401: "انتهت الجلسة. يرجى تسجيل الدخول من جديد.",
    403: "لا تملك صلاحية تنفيذ هذا الإجراء.",
    404: "العنصر المطلوب غير موجود.",
    409: "يوجد تعارض مع بيانات محفوظة مسبقًا.",
    500: "خطأ داخلي في الخادم.",
  };
  return byStatus[status] || `فشل الطلب (رمز ${status}).`;
}

export default api;
