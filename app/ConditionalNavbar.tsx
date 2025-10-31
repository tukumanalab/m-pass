"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

interface Settings {
  siteName: string;
  logoPath?: string;
}

interface NavbarProps {
  settings: Settings;
  hasMemberSession: boolean;
}

export default function ConditionalNavbar({
  settings,
  hasMemberSession,
}: NavbarProps) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // スキャンページではナビゲーションバーを表示しない
  if (!mounted || pathname === "/scan") {
    return null;
  }

  return (
    <nav className="bg-white/80 backdrop-blur-md shadow-sm border-b border-primary-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              {settings.logoPath ? (
                <img
                  src={settings.logoPath}
                  alt="Logo"
                  className="h-8 w-auto object-contain"
                />
              ) : (
                <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                    />
                  </svg>
                </div>
              )}
              <span className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-primary-700 bg-clip-text text-transparent">
                {settings.siteName}
              </span>
            </Link>
          </div>
          <div className="flex items-center space-x-2">
            {hasMemberSession && (
              <Link
                href="/member/dashboard"
                className="text-gray-700 hover:text-primary-600 hover:bg-primary-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                マイページ
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
