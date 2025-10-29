"use client";

import { apiUrl, getBasePath } from "@/lib/api";

export default function LogoutButton() {
  const handleLogout = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(apiUrl("/api/admin/logout"), { method: "POST" });
    window.location.href = `${getBasePath()}/admin/login`;
  };

  return (
    <form onSubmit={handleLogout}>
      <button
        type="submit"
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
      >
        ログアウト
      </button>
    </form>
  );
}
