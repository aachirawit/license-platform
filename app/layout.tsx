import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { Toaster } from "sonner";

import "./globals.css";

export const metadata: Metadata = {
  title: "License Platform",
  description: "Multi-app license management",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Dark by default; the CSS applies the dark palette on :root:not(.light).
  return (
    <html lang="en" className={`dark ${GeistSans.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        {children}
        <Toaster
          position="bottom-right"
          theme="dark"
          toastOptions={{
            classNames: {
              toast: "bg-card border border-border text-card-foreground",
            },
          }}
        />
      </body>
    </html>
  );
}
