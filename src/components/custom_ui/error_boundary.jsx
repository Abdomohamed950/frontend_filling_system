import { Component } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";

/**
 * Last line of defence. A crash on an unattended control-room screen must
 * still show something actionable rather than a blank white page.
 */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Unhandled UI error:", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        dir="rtl"
        className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center text-foreground"
      >
        <span className="grid size-16 place-items-center rounded-2xl bg-destructive/12 text-destructive">
          <TriangleAlert className="size-8" />
        </span>

        <div className="space-y-1">
          <h1 className="text-xl font-bold">حدث خطأ غير متوقع</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            تعذر عرض هذه الشاشة. أعد تحميل التطبيق، وإذا تكرر الخطأ أبلغ الدعم الفني
            بالرسالة التالية.
          </p>
        </div>

        <pre
          dir="ltr"
          className="max-w-xl overflow-x-auto rounded-lg border bg-muted p-3 text-start text-xs"
        >
          {this.state.error?.message ?? String(this.state.error)}
        </pre>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <RotateCcw className="size-4" />
          إعادة تحميل التطبيق
        </button>
      </div>
    );
  }
}
