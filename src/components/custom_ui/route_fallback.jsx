/** Shown while a lazily-loaded console chunk is being fetched. */
export default function RouteFallback() {
  return (
    <div
      dir="rtl"
      className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-muted-foreground"
    >
      <span className="size-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      <p className="text-sm">جارٍ التحميل…</p>
    </div>
  );
}
