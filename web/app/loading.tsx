export default function Loading() {
  return (
    <div
      role="status"
      className="mx-auto flex min-h-[40vh] w-full max-w-xl items-center gap-2 px-4 text-sm text-muted-foreground"
    >
      <span aria-hidden className="h-2 w-2 animate-pulse bg-foreground" />
      Carregando…
    </div>
  );
}
