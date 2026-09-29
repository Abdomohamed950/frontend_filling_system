import { AlertTriangle } from "lucide-react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

/**
 * Replaces the `window.confirm`/`alert` calls that used to guard deletions.
 * Destructive actions in a control panel deserve a deliberate, styled stop.
 */
export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "تأكيد",
  cancelLabel = "إلغاء",
  variant = "destructive",
  loading = false,
  onConfirm,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span
              className={
                variant === "destructive"
                  ? "rounded-full bg-destructive/12 p-2.5 text-destructive"
                  : "rounded-full bg-warning/15 p-2.5 text-warning"
              }
            >
              <AlertTriangle className="size-5" />
            </span>
            <div className="space-y-1.5">
              <DialogTitle>{title}</DialogTitle>
              {description && <DialogDescription>{description}</DialogDescription>}
            </div>
          </div>
        </DialogHeader>

        <DialogFooter className="sm:justify-start">
          <Button
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "جارٍ التنفيذ…" : confirmLabel}
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
