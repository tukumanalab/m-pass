"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/api";

interface MemberInfo {
  id: number;
  name: string;
  email: string;
  affiliation: string;
  affiliationDetail: string | null;
  memberId: string;
  createdAt: string;
}

interface QRCodeData {
  memberId: string;
  qrCodeUrl: string;
}

interface CheckInRecord {
  id: number;
  member_id: number;
  check_in_time: string;
}

export default function MemberDashboardPage() {
  const [memberInfo, setMemberInfo] = useState<MemberInfo | null>(null);
  const [qrCodeData, setQrCodeData] = useState<QRCodeData | null>(null);
  const [checkInHistory, setCheckInHistory] = useState<CheckInRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showQRCode, setShowQRCode] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchMemberData();
  }, []);

  const fetchMemberData = async () => {
    try {
      setLoading(true);
      setError(null);

      // メンバー情報を取得
      const infoResponse = await fetch(apiUrl("/api/member/info"));
      if (!infoResponse.ok) {
        if (infoResponse.status === 401) {
          router.push("/member/login");
          return;
        }
        // レスポンスのContent-Typeを確認
        const contentType = infoResponse.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errorData = await infoResponse.json();
          throw new Error(
            errorData.error || "メンバー情報の取得に失敗しました"
          );
        } else {
          throw new Error("メンバー情報の取得に失敗しました");
        }
      }
      const infoData = await infoResponse.json();
      setMemberInfo(infoData);

      // チェックイン履歴を取得
      const historyResponse = await fetch(
        apiUrl("/api/member/history?limit=20")
      );
      if (historyResponse.ok) {
        const contentType = historyResponse.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const historyData = await historyResponse.json();
          setCheckInHistory(historyData.history);
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "データの取得に失敗しました"
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchQRCode = async () => {
    try {
      const response = await fetch(apiUrl("/api/member/qrcode"));
      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errorData = await response.json();
          throw new Error(errorData.error || "QRコードの取得に失敗しました");
        } else {
          throw new Error("QRコードの取得に失敗しました");
        }
      }
      const data = await response.json();
      setQrCodeData(data);
      setShowQRCode(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "QRコードの取得に失敗しました"
      );
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(apiUrl("/api/member/logout"), {
        method: "POST",
      });
      router.push("/member/login");
      router.refresh();
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    // UTCから日本時間に変換（+9時間）
    const jstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    return jstDate.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Tokyo",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error && !memberInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-red-50 border border-red-200 rounded-xl p-6">
          <p className="text-red-600 text-center">{error}</p>
          <button
            onClick={() => router.push("/member/login")}
            className="mt-4 w-full bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700 transition-colors"
          >
            ログインページへ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-green-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* ヘッダー */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-6 border border-primary-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {memberInfo?.name}
                </h1>
                <p className="text-gray-600">
                  {memberInfo?.affiliation}
                  {memberInfo?.affiliationDetail &&
                    ` - ${memberInfo.affiliationDetail}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push("/member/edit")}
                className="px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg shadow-md hover:from-primary-600 hover:to-primary-700 transition-all"
              >
                プロフィール編集
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                ログアウト
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* メンバー情報 */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-6 border border-primary-100">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <svg
              className="w-6 h-6 text-primary-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"
              />
            </svg>
            メンバー情報
          </h2>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-600">メンバーID</span>
              <span className="font-mono font-bold text-lg text-primary-600">
                {memberInfo?.memberId}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-600">メールアドレス</span>
              <span className="font-medium text-gray-900">
                {memberInfo?.email}
              </span>
            </div>
          </div>

          {!showQRCode ? (
            <button
              onClick={fetchQRCode}
              className="mt-4 w-full bg-gradient-to-r from-primary-500 to-primary-600 text-white py-3 px-4 rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all shadow-md hover:shadow-lg font-medium flex items-center justify-center gap-2"
            >
              <svg
                className="w-5 h-5"
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
              QRコードを表示
            </button>
          ) : (
            <div className="mt-4 p-6 bg-gradient-to-br from-primary-50 to-green-50 rounded-xl text-center">
              {qrCodeData && (
                <img
                  src={qrCodeData.qrCodeUrl}
                  alt="QR Code"
                  className="mx-auto w-64 h-64 border-4 border-white rounded-xl shadow-lg"
                />
              )}
              <button
                onClick={() => setShowQRCode(false)}
                className="mt-4 text-sm text-gray-600 hover:text-gray-800"
              >
                QRコードを隠す
              </button>
            </div>
          )}
        </div>

        {/* チェックイン履歴 */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-primary-100">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <svg
              className="w-6 h-6 text-primary-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
            チェックイン履歴
            <span className="text-sm font-normal text-gray-500">
              (最新20件)
            </span>
          </h2>

          {checkInHistory.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="w-16 h-16 text-gray-300 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <p className="text-gray-500">チェックイン履歴がありません</p>
            </div>
          ) : (
            <div className="space-y-2">
              {checkInHistory.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-primary-600"
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
                    <span className="text-gray-900 font-medium">
                      チェックイン
                    </span>
                  </div>
                  <span className="text-gray-600">
                    {formatDateTime(record.check_in_time)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
