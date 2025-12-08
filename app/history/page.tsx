"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/api";

interface CheckIn {
  id: number;
  member_id: number; // 外部キー（members.id）
  member_id_str: string | null; // メンバーID文字列（チェックイン時に保存）
  affiliation: string | null; // 所属（チェックイン時に保存）
  check_in_time: string;
}

interface Member {
  id: number;
  member_id: string;
  name: string;
  affiliation: string;
  affiliation_detail: string;
  email: string;
  created_at: string;
}

export default function HistoryPage() {
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [showDateRangeDelete, setShowDateRangeDelete] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showCsvUpload, setShowCsvUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    successCount: number;
    failedCount: number;
    duplicateCount: number;
    failedRows: Array<{ row: number; data: string; error: string }>;
    duplicateRows: Array<{ row: number; data: string; error: string }>;
  } | null>(null);
  
  // Member Detail Modal State
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [memberHistory, setMemberHistory] = useState<CheckIn[]>([]);
  const [memberLoading, setMemberLoading] = useState(false);

  const router = useRouter();

  // 認証チェック
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(apiUrl("/api/admin/check"));
        const data = await response.json();

        if (!data.authenticated) {
          router.push("/admin/login");
          return;
        }

        setAuthChecked(true);
        fetchHistory();
      } catch (error) {
        console.error("Auth check error:", error);
        router.push("/admin/login");
      }
    };

    checkAuth();
  }, [router]);

  const fetchHistory = async () => {
    try {
      const response = await fetch(apiUrl("/api/checkins/history?limit=100"));
      if (!response.ok) {
        throw new Error("履歴の取得に失敗しました");
      }
      const data = await response.json();
      setCheckIns(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    // SQLiteのタイムスタンプ文字列（UTC）をJSTで表示
    // CURRENT_TIMESTAMPで保存されているため、UTCとして解釈してJSTに変換
    const date = new Date(dateString + "Z"); // 'Z'を付けてUTCとして明示
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Tokyo",
    }).format(date);
  };

  const calculateDaysSincePrevious = (currentIndex: number) => {
    // 履歴は降順（新しい順）で表示されていると仮定
    // 次のインデックスが「前回のチェックイン」になる
    const prevIndex = currentIndex + 1;
    
    if (prevIndex >= memberHistory.length) {
      return "-";
    }

    const currentStr = memberHistory[currentIndex].check_in_time;
    const prevStr = memberHistory[prevIndex].check_in_time;

    // Convert UTC strings to Date objects
    const current = new Date(currentStr);
    const prev = new Date(prevStr);

    // Calculate difference in milliseconds
    const diffTime = current.getTime() - prev.getTime();
    
    // Convert to days (rounding down to ensure full days)
    // using Math.floor might be misleading if checkins are on same day but few hours apart.
    // User asked for "days". Usually "0 days" or "1 day".
    // Let's use simple difference in days.
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    return `${diffDays}日`;
  };

  const toggleSelection = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === checkIns.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(checkIns.map((c) => c.id)));
    }
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;

    if (!confirm(`選択した${selectedIds.size}件の履歴を削除しますか？`)) {
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(apiUrl("/api/checkins"), {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });

      if (!response.ok) {
        throw new Error("削除に失敗しました");
      }

      setSelectedIds(new Set());
      await fetchHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除エラーが発生しました");
    } finally {
      setDeleting(false);
    }
  };

  const handleExportCSV = () => {
    window.location.href = apiUrl("/api/checkins/export");
  };

  const handleDeleteByDateRange = async () => {
    if (!startDate || !endDate) {
      setError("開始日と終了日を指定してください");
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setError("開始日は終了日より前である必要があります");
      return;
    }

    if (!confirm(`${startDate} から ${endDate} までの履歴を削除しますか？`)) {
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(apiUrl("/api/checkins"), {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ startDate, endDate }),
      });

      if (!response.ok) {
        throw new Error("削除に失敗しました");
      }

      const result = await response.json();
      setShowDateRangeDelete(false);
      setStartDate("");
      setEndDate("");
      setError(null);
      await fetchHistory();
      alert(`${result.deletedCount}件の履歴を削除しました`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除エラーが発生しました");
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAll = async () => {
    const totalCount = checkIns.length;
    
    if (!confirm(`全ての履歴（${totalCount}件）を削除しますか？\n\nこの操作は取り消せません。`)) {
      return;
    }

    // 二重確認
    if (!confirm(`本当に全削除してもよろしいですか？`)) {
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(apiUrl("/api/checkins"), {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ deleteAll: true }),
      });

      if (!response.ok) {
        throw new Error("削除に失敗しました");
      }

      const result = await response.json();
      setSelectedIds(new Set());
      setError(null);
      await fetchHistory();
      alert(`${result.deletedCount}件の履歴を削除しました`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除エラーが発生しました");
    } finally {
      setDeleting(false);
    }
  };

  const handleCsvUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setUploadResult(null);

    try {
      const text = await file.text();

      const response = await fetch(apiUrl("/api/checkins/bulk"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ csvData: text }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "アップロードに失敗しました");
      }

      const result = await response.json();
      setUploadResult({
        successCount: result.successCount,
        failedCount: result.failedCount,
        duplicateCount: result.duplicateCount || 0,
        failedRows: result.failedRows || [],
        duplicateRows: result.duplicateRows || [],
      });

      // 履歴を更新
      await fetchHistory();

      if (result.failedCount === 0 && result.duplicateCount === 0) {
        alert(`${result.successCount}件のチェックイン履歴を登録しました`);
        setShowCsvUpload(false);
      } else if (result.duplicateCount > 0) {
        alert(`${result.successCount}件を登録しました。${result.duplicateCount}件の重複をスキップしました。`);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "アップロードエラーが発生しました"
      );
    } finally {
      setUploading(false);
      // ファイル入力をリセット
      event.target.value = "";
    }
  };

  const copyFailedRowsToClipboard = () => {
    if (!uploadResult?.failedRows) return;

    const csvHeader = "timestamp,member_id";
    const csvContent = [
      csvHeader,
      ...uploadResult.failedRows.map((r) => r.data),
    ].join("\n");

    navigator.clipboard.writeText(csvContent).then(() => {
      alert("失敗したデータをクリップボードにコピーしました");
    });
  };

  const copyDuplicateRowsToClipboard = () => {
    if (!uploadResult?.duplicateRows) return;

    const csvHeader = "timestamp,member_id";
    const csvContent = [
      csvHeader,
      ...uploadResult.duplicateRows.map((r) => r.data),
    ].join("\n");

    navigator.clipboard.writeText(csvContent).then(() => {
      alert("重複データをクリップボードにコピーしました");
    });
  };

  // メンバー詳細と履歴を取得
  const handleMemberClick = async (memberId: number) => {
    if (!memberId) return;

    setMemberLoading(true);
    setShowMemberModal(true);
    setSelectedMember(null);
    setMemberHistory([]);

    try {
      // メンバー詳細取得
      const memberRes = await fetch(apiUrl(`/api/admin/members/${memberId}`));
      const memberData = await memberRes.json();

      if (memberData.success) {
        setSelectedMember(memberData.member);
      } else {
        alert("メンバー情報の取得に失敗しました");
      }

      // チェックイン履歴取得
      // check_in_timeの降順で取得するためlimitを大きめに設定
      const historyRes = await fetch(
        apiUrl(`/api/admin/members/${memberId}/checkins?limit=100`)
      );
      const historyData = await historyRes.json();

      if (historyData.success) {
        setMemberHistory(historyData.history);
      } else {
        console.error("History fetch failed:", historyData.message);
      }
    } catch (error) {
      console.error("Error fetching member details:", error);
      alert("情報の取得中にエラーが発生しました");
    } finally {
      setMemberLoading(false);
    }
  };

  const handleCloseMemberModal = () => {
    setShowMemberModal(false);
    setSelectedMember(null);
    setMemberHistory([]);
  };

  if (!authChecked || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">
            {!authChecked ? "認証確認中..." : "読み込み中..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-primary-100">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">利用履歴</h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            {selectedIds.size > 0 && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 bg-gradient-to-r from-red-500 to-red-600 text-white py-2 px-4 rounded-xl hover:from-red-600 hover:to-red-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                {deleting ? "削除中..." : `削除 (${selectedIds.size})`}
              </button>
            )}
            <button
              onClick={() => setShowDateRangeDelete(!showDateRangeDelete)}
              className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white py-2 px-4 rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all shadow-md hover:shadow-lg"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              日付指定削除
            </button>
            <button
              onClick={handleDeleteAll}
              disabled={deleting || checkIns.length === 0}
              className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-red-700 text-white py-2 px-4 rounded-xl hover:from-red-700 hover:to-red-800 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              全削除
            </button>
            <button
              onClick={() => setShowCsvUpload(!showCsvUpload)}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white py-2 px-4 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all shadow-md hover:shadow-lg"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              CSVアップロード
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-green-600 text-white py-2 px-4 rounded-xl hover:from-green-600 hover:to-green-700 transition-all shadow-md hover:shadow-lg"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              CSVダウンロード
            </button>
            <button
              onClick={fetchHistory}
              className="flex items-center gap-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white py-2 px-4 rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all shadow-md hover:shadow-lg"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              更新
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {showCsvUpload && (
          <div className="mb-6 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                CSVファイルから一括登録
              </h3>
              <button
                onClick={() => {
                  setShowCsvUpload(false);
                  setUploadResult(null);
                  setError(null);
                }}
                className="text-gray-500 hover:text-gray-700"
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="mb-4 p-4 bg-white rounded-lg border border-blue-200">
              <p className="text-sm text-gray-700 mb-2 font-medium">CSV形式:</p>
              <pre className="text-xs bg-gray-50 p-2 rounded border border-gray-200 overflow-x-auto">
                timestamp,member_id{"\n"}
                2025/01/15 10:30:00,5a1b{"\n"}
                2025/01/15,1q9s
              </pre>
              <p className="text-xs text-gray-600 mt-2">
                ※ timestampは「YYYY/MM/DD HH:mm:ss」または「YYYY/MM/DD」形式
                <br />※ メンバーIDは登録済みのメンバーのものを指定してください
              </p>
            </div>

            <div className="mb-4">
              <label className="block w-full">
                <div className="flex items-center justify-center w-full h-32 px-4 transition bg-white border-2 border-blue-300 border-dashed rounded-xl appearance-none cursor-pointer hover:border-blue-400 focus:outline-none">
                  <div className="flex flex-col items-center space-y-2">
                    <svg
                      className="w-8 h-8 text-blue-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    <span className="font-medium text-blue-600">
                      {uploading
                        ? "アップロード中..."
                        : "クリックしてCSVファイルを選択"}
                    </span>
                    <span className="text-xs text-gray-500">
                      CSV形式のファイルをアップロード
                    </span>
                  </div>
                </div>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCsvUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            </div>

            {uploadResult && (
              <div className="mt-4 p-4 bg-white rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-gray-900">
                    アップロード結果
                  </h4>
                </div>
                <div className="space-y-2">
                  <p className="text-sm">
                    <span className="text-green-600 font-semibold">
                      成功: {uploadResult.successCount}件
                    </span>
                    {uploadResult.duplicateCount > 0 && (
                      <span className="ml-4 text-yellow-600 font-semibold">
                        重複スキップ: {uploadResult.duplicateCount}件
                      </span>
                    )}
                    {uploadResult.failedCount > 0 && (
                      <span className="ml-4 text-red-600 font-semibold">
                        失敗: {uploadResult.failedCount}件
                      </span>
                    )}
                  </p>

                  {uploadResult.duplicateRows.length > 0 && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-sm font-semibold text-yellow-600">
                          重複データ（スキップ済み）:
                        </h5>
                        <button
                          onClick={copyDuplicateRowsToClipboard}
                          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 py-1 px-3 rounded transition-colors"
                        >
                          CSVをコピー
                        </button>
                      </div>
                      <div className="max-h-40 overflow-y-auto bg-yellow-50 rounded p-2">
                        {uploadResult.duplicateRows.map((row, index) => (
                          <div
                            key={index}
                            className="text-xs mb-2 pb-2 border-b border-yellow-200 last:border-0"
                          >
                            <p className="text-yellow-700 font-semibold">
                              行{row.row}: {row.error}
                            </p>
                            <p className="text-gray-600 mt-1 font-mono truncate">
                              {row.data}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {uploadResult.failedRows.length > 0 && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-sm font-semibold text-red-600">
                          失敗したデータ:
                        </h5>
                        <button
                          onClick={copyFailedRowsToClipboard}
                          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 py-1 px-3 rounded transition-colors"
                        >
                          CSVをコピー
                        </button>
                      </div>
                      <div className="max-h-40 overflow-y-auto bg-red-50 rounded p-2">
                        {uploadResult.failedRows.map((row, index) => (
                          <div
                            key={index}
                            className="text-xs mb-2 pb-2 border-b border-red-200 last:border-0"
                          >
                            <p className="text-red-700 font-semibold">
                              行{row.row}: {row.error}
                            </p>
                            <p className="text-gray-600 mt-1 font-mono truncate">
                              {row.data}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {showDateRangeDelete && (
          <div className="mb-6 p-6 bg-gradient-to-br from-orange-50 to-red-50 border border-orange-200 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                日付範囲指定で削除
              </h3>
              <button
                onClick={() => {
                  setShowDateRangeDelete(false);
                  setStartDate("");
                  setEndDate("");
                  setError(null);
                }}
                className="text-gray-500 hover:text-gray-700"
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  開始日
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  終了日
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
            <button
              onClick={handleDeleteByDateRange}
              disabled={deleting || !startDate || !endDate}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-red-500 to-red-600 text-white py-3 px-4 rounded-xl hover:from-red-600 hover:to-red-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              {deleting ? "削除中..." : "指定範囲を削除"}
            </button>
          </div>
        )}

        {checkIns.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <svg
                className="w-10 h-10 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <p className="text-gray-500">チェックイン履歴がありません</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-primary-100">
            <table className="min-w-full divide-y divide-primary-100">
              <thead className="bg-gradient-to-r from-primary-50 to-green-50">
                <tr>
                  <th className="px-6 py-4 text-left">
                    <input
                      type="checkbox"
                      checked={
                        selectedIds.size === checkIns.length &&
                        checkIns.length > 0
                      }
                      onChange={toggleSelectAll}
                      className="w-4 h-4 text-primary-600 bg-white border-gray-300 rounded focus:ring-primary-500"
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-primary-700 uppercase tracking-wider">
                    日時
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-primary-700 uppercase tracking-wider">
                    メンバーID
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-primary-700 uppercase tracking-wider">
                    所属
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white/50 divide-y divide-primary-100">
                {checkIns.map((checkIn) => (
                  <tr
                    key={checkIn.id}
                    className={`hover:bg-primary-50 transition-colors ${
                      selectedIds.has(checkIn.id) ? "bg-primary-100" : ""
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(checkIn.id)}
                        onChange={() => toggleSelection(checkIn.id)}
                        className="w-4 h-4 text-primary-600 bg-white border-gray-300 rounded focus:ring-primary-500"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                      {formatDateTime(checkIn.check_in_time)}
                    </td>
                    <td 
                      className="px-6 py-4 whitespace-nowrap text-sm text-primary-600 font-mono font-bold cursor-pointer hover:underline hover:text-primary-800"
                      onClick={() => handleMemberClick(checkIn.member_id)}
                    >
                      {checkIn.member_id_str || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {checkIn.affiliation || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* メンバー詳細モーダル */}
      {showMemberModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* ヘッダー */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  メンバー詳細 & 履歴
                </h2>
                <button
                  onClick={handleCloseMemberModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg
                    className="w-6 h-6"
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
                </button>
              </div>

              {memberLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">読み込み中...</p>
                </div>
              ) : selectedMember ? (
                <>
                  {/* メンバー情報 */}
                  <div className="bg-gray-50 rounded-xl p-6 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">名前</p>
                        <p className="font-semibold text-lg text-gray-900">{selectedMember.name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">メンバーID</p>
                        <p className="font-mono font-bold text-primary-600">{selectedMember.member_id}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">所属</p>
                        <p className="text-gray-900">{selectedMember.affiliation}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">所属詳細</p>
                        <p className="text-gray-900">{selectedMember.affiliation_detail || "-"}</p>
                      </div>
                      <div className="col-span-1 md:col-span-2">
                        <p className="text-sm text-gray-500">メールアドレス</p>
                        <p className="text-gray-900">{selectedMember.email}</p>
                      </div>
                    </div>
                  </div>

                  {/* チェックイン履歴 */}
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3">チェックイン履歴 (直近100件)</h3>
                    {memberHistory.length > 0 ? (
                      <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg max-h-60 overflow-y-auto">
                        <table className="min-w-full divide-y divide-gray-300">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">
                                日時
                              </th>
                              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                所属
                              </th>
                              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                間隔
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 bg-white">
                            {memberHistory.map((history) => (
                              <tr key={history.id}>
                                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-900">
                                  {formatDateTime(history.check_in_time)}
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                  {history.affiliation || "-"}
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                  {calculateDaysSincePrevious(memberHistory.indexOf(history))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                        履歴はありません
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-red-500">
                  情報の取得に失敗しました
                </div>
              )}

              {/* フッターアクション */}
              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleCloseMemberModal}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
