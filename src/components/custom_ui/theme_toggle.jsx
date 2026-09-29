import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/theme-context";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", icon: Sun, label: "فاتح" },
  { value: "dark", icon: Moon, label: "داكن" },
  { value: "system", icon: Monitor, label: "تلقائي" },
];

export default function ThemeToggle({ className }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="مظهر الواجهة"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border bg-muted/60 p-0.5 no-print",
        className
      )}
    >
      {OPTIONS.map(({ value, icon: Icon, label }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "rounded-full p-1.5 transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
              active
                ? "bg-background text-foreground elevate"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
            <span className="sr-only">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
