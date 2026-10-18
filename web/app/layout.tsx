import type { Metadata } from "next";
import "./style.css";

export const metadata: Metadata = {
  title: "LocalProof — Des preuves, pas des promesses",
  description:
    "Banc d’essai open source pour systèmes IA locaux. Comparez les résultats, inspectez les échecs, gardez vos données.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
