"use client";

import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/api";

export default function MemberLogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch(apiUrl("/api/member/logout"), {
        method: "POST",
      });
      router.push("/member/login");
      router.refresh();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <button
      onClick={handleLogout}
      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
    >
      ログアウト
    </button>
  );
}
