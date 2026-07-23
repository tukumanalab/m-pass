"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiUrl } from "@/lib/api";

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setStatus("error");
        setMessage("無効なリンクです");
        return;
      }

      try {
        const response = await fetch(apiUrl("/api/member/verify-email"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "メールアドレスの確認に失敗しました");
        }

        setStatus("success");
        setMessage("メールアドレスが正常に更新されました");

        // 3秒後にマイページにリダイレクト
        setTimeout(() => {
          router.push("/member/dashboard");
        }, 3000);
      } catch (error) {
        setStatus("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "メールアドレスの確認に失敗しました"
        );
      }
    };

    verifyEmail();
  }, [token, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-green-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 text-center border border-primary-100">
          {status === "loading" && (
            <>
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 mx-auto mb-4"></div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                確認中...
              </h2>
              <p className="text-gray-600">
                メールアドレスを確認しています
              </p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                確認完了
              </h2>
              <p className="text-gray-600 mb-4">{message}</p>
              <p className="text-sm text-gray-500">
                自動的にマイページに移動します...
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                確認失敗
              </h2>
              <p className="text-gray-600 mb-6">{message}</p>
              <button
                onClick={() => router.push("/member/dashboard")}
                className="px-6 py-2 rounded-lg bg-gradient-to-r from-primary-500 to-primary-600 text-white font-medium shadow-md hover:from-primary-600 hover:to-primary-700 transition-all"
              >
                マイページに戻る
              </button>
            </>
          )}
        </div>

        {/* フッター */}
        <div className="mt-8 text-center text-sm text-gray-500 space-x-4">
          <Link
            href="/privacy-policy"
            className="hover:text-gray-700 underline"
          >
            プライバシーポリシー
          </Link>
          <span>|</span>
          <Link
            href="/terms-of-service"
            className="hover:text-gray-700 underline"
          >
            利用規約
          </Link>
        </div>
      </div>
    </div>
  );
}
