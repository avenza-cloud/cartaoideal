import { ProfilePageClient } from "@/components/ProfilePageClient";
import { CARD_OPTIONS, CURATED_CARD_OPTIONS } from "@/lib/card-options.server";

export const metadata = {
  title: "Seu perfil",
  description: "Configure renda, gastos e preferências para personalizar o ranking de cartões.",
};

export default function PerfilPage() {
  return <ProfilePageClient cardOptions={CARD_OPTIONS} curatedOptions={CURATED_CARD_OPTIONS} />;
}
