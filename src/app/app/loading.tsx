export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-4 w-40 rounded bg-paper-2" />
      <div className="h-9 w-80 rounded bg-paper-2" />
      <div className="h-[2px] w-full bg-brand/40" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="h-36 rounded-xl bg-paper-2" />
        <div className="h-36 rounded-xl bg-paper-2" />
        <div className="h-36 rounded-xl bg-paper-2" />
      </div>
    </div>
  );
}
