/** Correctable fields — shared by the form, the API route and the PR workflow. */
export const CORRECTION_FIELDS = [
  "Anuidade",
  "Pontuação / cashback",
  "Lounge",
  "Elegibilidade",
  "Renda mínima",
  "Investimento mínimo",
  "IOF / spread",
  "Imagem ou nome",
  "Outro",
] as const;

export type CorrectionField = (typeof CORRECTION_FIELDS)[number];
