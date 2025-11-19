import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bureaucracy Decoder",
  description: "Turn zoning text spaghetti into pre-approval packets. AI-powered zoning code analysis with citations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
