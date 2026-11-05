import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"], weight: ["300", "400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: { default: "Matilha Pet Intelligence", template: "%s · Matilha Pet Intelligence" },
  description: "Inteligência gerencial para a distribuidora — dados do PedidoOK.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${outfit.variable} antialiased`}>{children}</body>
    </html>
  );
}
