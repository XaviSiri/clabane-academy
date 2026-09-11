import type { Metadata } from "next";
import { Poppins, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Footer } from "@/components/Footer";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

// Used only for the decorative "We Love African Skin" nav-bar watermark.
const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["500"],
  style: ["italic"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Clabane Academy",
  description: "Clabane Academy employee onboarding platform",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${poppins.variable} ${playfairDisplay.variable} flex min-h-screen flex-col font-sans antialiased bg-slate-50 text-slate-900`}
      >
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
