import type { Metadata } from "next";
import { loadSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const settings = loadSettings();

  return {
    title: `チェックイン - ${settings.siteName}`,
    description: "QRコードをスキャンしてチェックインします",
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
