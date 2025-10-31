import type { Metadata } from "next";
import { loadSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const settings = loadSettings();

  return {
    title: `QRコードスキャン - ${settings.siteName}`,
    description: "キオスク端末用QRコードスキャン画面",
    icons: {
      icon: settings.faviconPath || "/favicon.ico",
    },
  };
}

export default function ScanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
