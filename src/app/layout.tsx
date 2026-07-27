import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { TopBar } from "./components/TopBar";
// Ignore TS error for side-effect CSS import in Next.js app directory
// @ts-ignore
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

// Title-only for now
// In a real app this is where description, OG/Twitter
// image tags, etc. would go.
export const metadata: Metadata = {
  title: `Air's Gallery Challenge`,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="flex size-full h-screen flex-col overflow-hidden bg-gray-200">
          <div className="flex min-h-0 grow gap-2 overflow-hidden px-2 py-2">
            <div className="relative flex min-h-0 grow flex-col overflow-hidden bg-gray-1 rounded-lg bg-white">
              <TopBar />
              <div className="min-h-0 grow overflow-y-auto px-4 py-4">
              {children}
              </div>
            </div>
          </div>
        </div>
        </body>
    </html>
  );
}
