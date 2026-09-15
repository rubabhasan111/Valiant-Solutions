import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Halfshaft | Repayment plans for car service centres",
    template: "%s | Halfshaft",
  },
  description:
    "Australian car service centres offer customers BECS Direct Debit repayment plans, paid out through Stripe Connect.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-AU" data-scroll-behavior="smooth" className={`${manrope.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
      </body>
    </html>
  );
}
