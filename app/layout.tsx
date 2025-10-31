import type { Metadata } from "next";
import "./globals.css";
import { loadSettings } from "@/lib/settings";
import { verifyMemberSession } from "@/lib/member-auth";
import { isAdminAuthenticated } from "@/lib/auth";
import ConditionalNavbar from "./ConditionalNavbar";

export async function generateMetadata(): Promise<Metadata> {
  const settings = loadSettings();

  return {
    title: settings.siteName,
    description: settings.pageSubtitle,
    icons: {
      icon: settings.faviconPath || "/favicon.ico",
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = loadSettings();
  const memberSession = await verifyMemberSession();
  const isAdmin = await isAdminAuthenticated();

  return (
    <html lang="ja">
      <head>
        {settings.faviconPath && (
          <link rel="icon" href={settings.faviconPath} />
        )}
      </head>
      <body className="bg-gradient-to-br from-primary-50 to-green-50 min-h-screen">
        <ConditionalNavbar
          settings={settings}
          hasMemberSession={!!memberSession}
          hasAdminSession={isAdmin}
        />
        <main>{children}</main>
      </body>
    </html>
  );
}
