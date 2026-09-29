import { Link } from "react-router-dom";
import { ArrowRight, Compass } from "lucide-react";
import { Button } from "../ui/button";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";

/** `inline` renders inside the admin shell; otherwise it is a full page. */
export default function Not_found_page({ inline = false }) {
  const { isAuthenticated, user, homeFor } = useAuth();
  const target = isAuthenticated ? homeFor(user.role) : "/login";

  return (
    <div
      dir="rtl"
      className={cn(
        "flex flex-col items-center justify-center gap-4 text-center",
        inline ? "py-24" : "min-h-screen bg-background p-6"
      )}
    >
      <span className="grid size-16 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <Compass className="size-8" />
      </span>

      <p className="text-5xl font-bold tracking-tight">404</p>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">الصفحة غير موجودة</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          الرابط الذي حاولت فتحه غير صحيح أو تم نقله.
        </p>
      </div>

      <Button asChild className="mt-2">
        <Link to={target}>
          <ArrowRight className="size-4" />
          العودة إلى الصفحة الرئيسية
        </Link>
      </Button>
    </div>
  );
}
