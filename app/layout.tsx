import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Parley — peer-to-peer video calling",
    template: "%s · Parley",
  },
  description:
    "Private, low-latency video calls that connect browser to browser. No accounts, no downloads, no server in the middle of your conversation.",
  applicationName: "Parley",
  openGraph: {
    title: "Parley — peer-to-peer video calling",
    description:
      "Private, low-latency video calls that connect browser to browser.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0b12",
  // Video calls are full-bleed on mobile; the UI must reach under the notch.
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // Font variables live on <html>: globals.css applies `font-sans` there,
    // and CSS custom properties only inherit downward.
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
