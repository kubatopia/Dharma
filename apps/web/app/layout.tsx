import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MailMeet",
  description: "Turn scheduling requests into ready-to-send replies.",
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
