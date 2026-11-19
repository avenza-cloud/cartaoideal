import { BrandMark } from "@/components/BrandMark";

export default function Loading() {
  return (
    <div
      role="status"
      className="mx-auto flex min-h-[40vh] w-full max-w-xl items-center justify-center gap-3 px-4 text-sm text-fg-2"
    >
      <BrandMark animated className="h-5 w-6" />
      <span>Carregando…</span>
    </div>
  );
}
