import { useMemo, useState } from "react";
import {
  AtSign,
  Eye,
  EyeOff,
  KeyRound,
  Pencil,
  Phone,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react";
import PageHeader from "../custom_ui/page_header";
import ConfirmDialog from "../custom_ui/confirm_dialog";
import { CardsSkeleton, EmptyState, ErrorState } from "../custom_ui/states";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { api, apiErrorMessage } from "@/lib/api";
import { useApi } from "@/hooks/use-api";
import { useToast } from "@/context/toast-context";

/**
 * Administrators are ordinary rows carrying `role: "admin"` — there is no
 * synthetic account. This page used to render a hardcoded "مدير النظام"
 * card that matched nothing in the database while the real admin rows were
 * listed beside it.
 */
const ROLES = [
  { value: "operator", label: "مشغل" },
  { value: "admin", label: "مدير" },
];

function Manage_operators_page() {
  const toast = useToast();
  const { data, loading, error, refetch } = useApi("/operators", { fallback: [] });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const operators = useMemo(
    () => (Array.isArray(data) ? data.filter((o) => typeof o === "object") : []),
    [data]
  );

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (operator) => {
    setEditing(operator);
    setDialogOpen(true);
  };

  const handleSubmit = async (formData) => {
    try {
      if (editing) {
        await api.put(`/operators/${editing.id}`, formData);
        toast.success(`تم حفظ بيانات ${formData.name}.`);
      } else {
        await api.post("/operators", formData);
        toast.success(`تمت إضافة المشغل ${formData.name}.`);
      }
      setDialogOpen(false);
      refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/operators/${pendingDelete.id}`);
      toast.success(`تم حذف المشغل ${pendingDelete.name}.`);
      setPendingDelete(null);
      refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={UsersRound}
        title="إدارة المشغلين"
        description="حسابات المشغلين المصرح لهم بتشغيل منافذ التعبئة."
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" />
            إضافة مشغل
          </Button>
        }
      />

      {loading && <CardsSkeleton count={4} className="h-64" />}

      {!loading && error && <ErrorState message={error} onRetry={refetch} />}

      {!loading && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {operators.map((operator) => (
            <OperatorCard
              key={operator.id}
              operator={operator}
              onEdit={() => openEdit(operator)}
              onDelete={() => setPendingDelete(operator)}
            />
          ))}

          <button
            type="button"
            onClick={openCreate}
            className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent/40 hover:text-primary"
          >
            <Plus className="size-10" />
            <span className="font-medium">إضافة مشغل جديد</span>
          </button>
        </div>
      )}

      {!loading && !error && operators.length === 0 && (
        <EmptyState
          icon={UsersRound}
          title="لا يوجد مشغلون مسجلون"
          description="أضف أول حساب لتتمكن من نسب عمليات التعبئة إلى مشغل."
        />
      )}

      <OperatorDialog
        key={editing?.id ?? "new"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        operator={editing}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={`حذف المشغل ${pendingDelete?.name ?? ""}؟`}
        description="سيفقد هذا المشغل صلاحية الدخول فورًا. لا يمكن التراجع عن هذا الإجراء."
        confirmLabel="حذف نهائي"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function OperatorCard({ operator, onEdit, onDelete }) {
  const isAdmin = operator.role === "admin";

  return (
    <div
      dir="rtl"
      className="flex min-h-64 flex-col rounded-xl border bg-card p-5 elevate transition-shadow hover:elevate-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={
            isAdmin
              ? "grid size-12 place-items-center rounded-xl bg-primary/12 text-primary"
              : "grid size-12 place-items-center rounded-xl bg-info/12 text-info"
          }
        >
          {isAdmin ? <ShieldCheck className="size-6" /> : <UserRound className="size-6" />}
        </span>

        <Badge variant={isAdmin ? "default" : "secondary"}>
          {isAdmin ? "مدير" : "مشغل"}
        </Badge>
      </div>

      <h3 className="mt-4 truncate text-lg font-bold" title={operator.name}>
        {operator.name}
      </h3>

      <dl className="mt-3 space-y-2.5 text-sm">
        <div className="flex items-center justify-between gap-2">
          <dt className="flex items-center gap-1.5 text-muted-foreground">
            <AtSign className="size-3.5" />
            اسم الدخول
          </dt>
          <dd className="truncate font-mono text-sm" dir="ltr">
            {operator.username || "—"}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="flex items-center gap-1.5 text-muted-foreground">
            <KeyRound className="size-3.5" />
            كود الدخول
          </dt>
          <dd className="rounded-md bg-muted px-2 py-0.5 font-mono text-sm">
            {operator.code ?? "—"}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="flex items-center gap-1.5 text-muted-foreground">
            <Phone className="size-3.5" />
            الهاتف
          </dt>
          <dd className="font-mono tabular-nums" dir="ltr">
            {operator.phone ?? "—"}
          </dd>
        </div>
      </dl>

      <div className="mt-auto flex gap-2 border-t pt-4">
        <Button variant="outline" size="sm" className="flex-1" onClick={onEdit}>
          <Pencil className="size-4" />
          تعديل
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-4" />
          حذف
        </Button>
      </div>
    </div>
  );
}

function OperatorDialog({ open, onOpenChange, operator, onSubmit }) {
  const isEdit = Boolean(operator);

  const [formData, setFormData] = useState({
    name: operator?.name ?? "",
    username: operator?.username ?? "",
    role: operator?.role ?? "operator",
    code: operator?.code ?? "",
    pass: "",
    phone: operator?.phone ?? "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    // An empty password on edit means "leave the stored one alone".
    const payload = { ...formData };
    if (isEdit && !payload.pass) delete payload.pass;
    // `username` is UNIQUE; sending "" from several rows would collide.
    if (!payload.username) delete payload.username;
    await onSubmit(payload);
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `تعديل ${operator.name}` : "إضافة مشغل جديد"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "اترك حقل كلمة المرور فارغًا للإبقاء على الكلمة الحالية."
              : "أدخل بيانات المشغل الجديد وكود الدخول الخاص به."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="operator-name">اسم المشغل</Label>
            <Input
              id="operator-name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="operator-username">
                اسم الدخول
                <span className="text-muted-foreground"> (اختياري)</span>
              </Label>
              <Input
                id="operator-username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                dir="ltr"
                autoComplete="off"
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="operator-role">الصلاحية</Label>
              <select
                id="operator-role"
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
              >
                {ROLES.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="operator-code">كود الدخول</Label>
            <Input
              id="operator-code"
              name="code"
              value={formData.code}
              onChange={handleChange}
              required
              className="font-mono"
              // Stored as text on purpose — leading zeros are significant.
              inputMode="numeric"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="operator-pass">كلمة المرور</Label>
            <div className="relative">
              <Input
                id="operator-pass"
                name="pass"
                type={showPassword ? "text" : "password"}
                value={formData.pass}
                onChange={handleChange}
                required={!isEdit}
                minLength={4}
                autoComplete="new-password"
                placeholder={isEdit ? "بدون تغيير" : "٤ أحرف على الأقل"}
                className="pe-10"
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

          <div className="space-y-2">
            <Label htmlFor="operator-phone">رقم الهاتف</Label>
            <Input
              id="operator-phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              value={formData.phone}
              onChange={handleChange}
              required
              pattern="[0-9]{11}"
              title="يجب أن يتكون رقم الهاتف من ١١ رقمًا"
              dir="ltr"
              className="font-mono"
            />
          </div>

          <DialogFooter className="sm:justify-start">
            <Button type="submit" disabled={submitting}>
              {submitting ? "جارٍ الحفظ…" : isEdit ? "حفظ التعديلات" : "إضافة المشغل"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              إلغاء
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default Manage_operators_page;
