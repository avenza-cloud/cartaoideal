import { BrandMark } from "@/components/BrandMark";
import { AvenzaParentLink } from "@/components/BrandWordmark";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-page px-4 py-6 pb-24 sm:px-6 md:pb-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
        <div className="inline-flex items-center gap-2 text-xs text-fg-3">
          <BrandMark className="h-3.5 w-4" />
          <span className="font-medium text-fg-2">Cartão Ideal</span>
          <span aria-hidden="true">·</span>
          <AvenzaParentLink className="text-xs" />
        </div>
        <p className="max-w-xl text-xs leading-relaxed text-fg-3">
          Conteúdo informativo. Não é recomendação financeira. Dados podem conter imprecisões;
          confirme as condições no site do emissor antes de contratar.
        </p>
      </div>
    </footer>
  );
}
