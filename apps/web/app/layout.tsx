import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dharma Automations",
  description: "Turn scheduling requests into ready-to-send replies.",
  icons: { icon: "/logo.jpg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
