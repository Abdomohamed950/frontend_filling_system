import { useState } from "react";
import { Pencil, Plus, RotateCcw, Trash2, Truck } from "lucide-react";
import PageHeader from "../custom_ui/page_header";
import ConfirmDialog from "../custom_ui/confirm_dialog";
import { EmptyState, ErrorState, TableSkeleton } from "../custom_ui/states";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { api, apiErrorMessage } from "@/lib/api";
import { useApi } from "@/hooks/use-api";
import { useSocketEvent } from "@/hooks/use-socket";
import { useToast } from "@/context/toast-context";

const EMPTY_FORM = { plate: "", quantity: "", limitEnabled: false, maxTrips: "0" };

/** Mirrors the server's limits (TRUCKS.md) so bad input never leaves the form. */
function validate(form) {
  const plate = form.plate.trim();
  if (!plate || plate.length > 30) return "رقم الشاحنة مطلوب (حتى 30 حرف).";
  if (form.quantity !== "") {
    const q = Number(form.quantity);
    if (!(q > 0 && q < 100)) return "الكمية لازم تكون أكبر من 0 وأقل من 100، أو اتركها فاضية.";
  }
  const trips = Number(form.maxTrips);
  if (!Number.isInteger(trips) || trips < 0 || trips > 9999) {
    return "أقصى عدد نقلات لازم يكون رقم صحيح بين 0 و 9999.";
  }
  return "";
}

function Trucks_page() {
  const toast = useToast();
  const { data, loading, error, refetch } = useApi("/trucks", { fallback: [] });
  const trucks = Array.isArray(data) ? data : [];

  // `truck_updated` also fires after every counted trip, so the table stays
  // live while fills finish on the operator screens.
  useSocketEvent("truck_updated", refetch);
  useSocketEvent("truck_deleted", refetch);
  useSocketEvent("trucks_reset", refetch);

  const [dialog, setDialog] = useState(null); // { truck | null }
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingResetAll, setPendingResetAll] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (fn, okMessage, close) => {
    setBusy(true);
    try {
      await fn();
      toast.success(okMessage);
      close?.();
      refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const resetOne = (truck) =>
    run(() => api.post(`/trucks/${truck.id}/reset-trips`), `تم تصفير نقلات ${truck.plate}.`);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Truck}
        title="الشاحنات"
        description="الشاحنات المسجّلة: كمية تلقائية وحد أقصى للنقلات. الشاحنة غير المسجّلة تعدي من غير أي قيد."
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPendingResetAll(true)}
              disabled={trucks.length === 0}
            >
              <RotateCcw className="size-4" />
              تصفير كل النقلات
            </Button>
            <Button size="sm" onClick={() => setDialog({ truck: null })}>
              <Plus className="size-4" />
              إضافة شاحنة
            </Button>
          </>
        }
      />

      {loading && <TableSkeleton rows={6} columns={6} />}
      {!loading && error && <ErrorState message={error} onRetry={refetch} />}

      {!loading && !error && trucks.length === 0 && (
        <EmptyState
          icon={Truck}
          title="لا توجد شاحنات مسجّلة"
          description="سجّل شاحنة لتحديد كمية تلقائية أو حد نقلات لها."
        />
      )}

      {!loading && !error && trucks.length > 0 && (
        <div dir="rtl" className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">رقم الشاحنة</TableHead>
                <TableHead className="text-right">الكمية</TableHead>
                <TableHead className="text-right">حد النقلات</TableHead>
                <TableHead className="text-right">أقصى نقلات</TableHead>
                <TableHead className="text-right">النقلات المتعدّة</TableHead>
                <TableHead className="text-right">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trucks.map((truck) => {
                const exhausted = truck.limitEnabled && truck.tripsDone >= truck.maxTrips;
                return (
                  <TableRow key={truck.id}>
                    <TableCell className="font-mono font-semibold" dir="ltr">
                      {truck.plate}
                    </TableCell>
                    <TableCell>{truck.quantity ?? "افتراضي"}</TableCell>
                    <TableCell>
                      <Badge variant={truck.limitEnabled ? "success" : "secondary"}>
                        {truck.limitEnabled ? "مفعّل" : "مقفول"}
                      </Badge>
                    </TableCell>
                    <TableCell>{truck.maxTrips}</TableCell>
                    <TableCell>
                      <Badge variant={exhausted ? "destructive" : "secondary"}>
                        {truck.tripsDone}
                        {truck.limitEnabled && ` / ${truck.maxTrips}`}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDialog({ truck })}
                          aria-label={`تعديل ${truck.plate}`}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => resetOne(truck)}
                          disabled={busy || truck.tripsDone === 0}
                          title="تصفير النقلات"
                          aria-label={`تصفير نقلات ${truck.plate}`}
                        >
                          <RotateCcw className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPendingDelete(truck)}
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`حذف ${truck.plate}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {dialog && (
        <TruckDialog
          key={dialog.truck?.id ?? "new"}
          truck={dialog.truck}
          onClose={() => setDialog(null)}
          onSubmit={(body) =>
            run(
              () =>
                dialog.truck
                  ? api.put(`/trucks/${dialog.truck.id}`, body)
                  : api.post("/trucks", body),
              dialog.truck ? `تم حفظ ${body.plate}.` : `تم تسجيل ${body.plate}.`,
              () => setDialog(null)
            )
          }
        />
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={`حذف الشاحنة ${pendingDelete?.plate ?? ""}؟`}
        description="هتتحذف من المسجّلات، وبعدها هتعدي من غير كمية خاصة أو حد نقلات."
        confirmLabel="حذف"
        loading={busy}
        onConfirm={() =>
          run(
            () => api.delete(`/trucks/${pendingDelete.id}`),
            `تم حذف ${pendingDelete.plate}.`,
            () => setPendingDelete(null)
          )
        }
      />

      <ConfirmDialog
        open={pendingResetAll}
        onOpenChange={setPendingResetAll}
        title="تصفير نقلات كل الشاحنات؟"
        description="عدّاد النقلات لكل الشاحنات المسجّلة هيرجع صفر."
        confirmLabel="تصفير الكل"
        variant="warning"
        loading={busy}
        onConfirm={() =>
          run(() => api.post("/trucks/reset-trips"), "تم تصفير كل النقلات.", () =>
            setPendingResetAll(false)
          )
        }
      />
    </div>
  );
}

function TruckDialog({ truck, onClose, onSubmit }) {
  const isEdit = Boolean(truck);
  const [form, setForm] = useState(() =>
    truck
      ? {
          plate: truck.plate,
          quantity: truck.quantity == null ? "" : String(truck.quantity),
          limitEnabled: Boolean(truck.limitEnabled),
          maxTrips: String(truck.maxTrips ?? 0),
        }
      : EMPTY_FORM
  );
  const [problem, setProblem] = useState("");

  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  const submit = (event) => {
    event.preventDefault();
    const message = validate(form);
    setProblem(message);
    if (message) return;
    onSubmit({
      plate: form.plate.trim(),
      // `null` clears a custom quantity on PUT; on POST it just means "default".
      quantity: form.quantity === "" ? null : Number(form.quantity),
      limitEnabled: form.limitEnabled,
      maxTrips: Number(form.maxTrips),
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? `تعديل الشاحنة ${truck.plate}` : "تسجيل شاحنة"}</DialogTitle>
          <DialogDescription>
            الرقم لازم يطابق بالظبط الرقم اللي بيتكتب في خانة رقم الشاحنة (نفس المسافات والحروف).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="truck-plate">رقم الشاحنة</Label>
            <Input
              id="truck-plate"
              dir="ltr"
              value={form.plate}
              onChange={set("plate")}
              maxLength={30}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="truck-quantity">الكمية التلقائية (اختياري)</Label>
            <Input
              id="truck-quantity"
              type="number"
              step="any"
              min={0}
              max={100}
              dir="ltr"
              placeholder="الكمية الافتراضية"
              value={form.quantity}
              onChange={set("quantity")}
            />
            <p className="text-xs text-muted-foreground">
              بتتستخدم في دورة وضع المطور فقط. التعبئة العادية بتاخد الكمية من الإيصال.
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <Label htmlFor="truck-limit">تفعيل حد النقلات</Label>
            <Switch
              id="truck-limit"
              checked={form.limitEnabled}
              onCheckedChange={(v) => setForm((f) => ({ ...f, limitEnabled: v }))}
            />
          </div>

          {form.limitEnabled && (
            <div className="space-y-2">
              <Label htmlFor="truck-trips">أقصى عدد نقلات</Label>
              <Input
                id="truck-trips"
                type="number"
                min={0}
                max={9999}
                step={1}
                dir="ltr"
                value={form.maxTrips}
                onChange={set("maxTrips")}
              />
            </div>
          )}

          {problem && (
            <p role="alert" className="text-sm text-destructive">
              {problem}
            </p>
          )}

          <DialogFooter className="sm:justify-start">
            <Button type="submit">{isEdit ? "حفظ التعديلات" : "تسجيل"}</Button>
            <Button type="button" variant="outline" onClick={onClose}>
              إلغاء
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default Trucks_page;
