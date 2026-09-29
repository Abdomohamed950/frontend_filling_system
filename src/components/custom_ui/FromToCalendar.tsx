import * as React from "react";
import { CalendarDays } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "../ui/button";
import { Calendar } from "../ui/calendar";
import { Separator } from "../ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Start of `date` shifted back `days` days. */
function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfToday() {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
}

const PRESETS: { label: string; range: () => DateRange }[] = [
  { label: "اليوم", range: () => ({ from: daysAgo(0), to: endOfToday() }) },
  { label: "أمس", range: () => ({ from: daysAgo(1), to: daysAgo(0) }) },
  { label: "آخر ٧ أيام", range: () => ({ from: daysAgo(6), to: endOfToday() }) },
  { label: "آخر ٣٠ يومًا", range: () => ({ from: daysAgo(29), to: endOfToday() }) },
  {
    label: "هذا الشهر",
    range: () => {
      const now = new Date();
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfToday() };
    },
  },
];

export default function FromToCalendar({
  dateRange,
  setDateRange,
  className,
}: {
  dateRange?: DateRange;
  setDateRange: (range: DateRange | undefined) => void;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);

  const summary = dateRange?.from
    ? dateRange.to
      ? `${formatDate(dateRange.from)} — ${formatDate(dateRange.to)}`
      : formatDate(dateRange.from)
    : "اختر الفترة";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          id="date-range"
          className={cn("w-60 justify-between gap-2 font-normal", className)}
        >
          <span className="truncate">{summary}</span>
          <CalendarDays className="size-4 shrink-0 opacity-70" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto overflow-hidden p-0" align="start" dir="rtl">
        <div className="flex flex-col sm:flex-row-reverse">
          <Calendar
            mode="range"
            defaultMonth={dateRange?.from}
            selected={dateRange}
            numberOfMonths={2}
            captionLayout="dropdown"
            dir="rtl"
            className="p-3"
            onSelect={(range) => setDateRange(range)}
          />

          <Separator orientation="vertical" className="hidden h-auto sm:block" />

          {/* Presets cover the ranges a shift supervisor actually asks for. */}
          <div className="flex flex-row flex-wrap gap-1 border-t p-2 sm:w-40 sm:flex-col sm:border-t-0">
            {PRESETS.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => {
                  setDateRange(preset.range());
                  setOpen(false);
                }}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
