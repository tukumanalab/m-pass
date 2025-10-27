"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiUrl } from "@/lib/api";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

interface Member {
  id: number;
  qr_code: string;
  name: string;
  affiliation: string;
  affiliation_detail: string;
  email: string;
  created_at: string;
}

export default function AdminMembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    affiliation: "",
    affiliation_detail: "",
    email: "",
    password: "",
  });
  const [showCsvUpload, setShowCsvUpload] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [cardData, setCardData] = useState<{
    name: string;
    qrCode: string;
    qrCodeUrl: string;
    cardSvg: string | null;
  } | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const [failedRows, setFailedRows] = useState<
    Array<{
      lineNumber: number;
      data: {
        email: string;
        name: string;
        affiliation: string;
        affiliation_detail: string;
        qr_code: string;
        created_at: string;
      };
      reason: string;
    }>
  >([]);
  const [showFailedData, setShowFailedData] = useState(false);
  const router = useRouter();

  // メンバー一覧取得
  const fetchMembers = async (query: string = "") => {
    try {
      setLoading(true);
      const response = await fetch(
        apiUrl(`/api/admin/members/search?q=${encodeURIComponent(query)}`)
      );
      const data = await response.json();

      if (data.success) {
        setMembers(data.members);
      } else {
        toast.error(data.message || "メンバーの取得に失敗しました");
      }
    } catch (error) {
      console.error("Fetch members error:", error);
      toast.error("メンバーの取得中にエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

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

        fetchMembers();
      } catch (error) {
        console.error("Auth check error:", error);
        router.push("/admin/login");
      }
    };

    checkAuth();
  }, [router]);

  // 検索実行
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchMembers(searchQuery);
  };

  // 編集開始
  const handleEdit = (member: Member) => {
    setEditingId(member.id);
    setEditForm({
      name: member.name,
      affiliation: member.affiliation,
      affiliation_detail: member.affiliation_detail || "",
      email: member.email || "",
      password: "",
    });
  };

  // 編集キャンセル
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({
      name: "",
      affiliation: "",
      affiliation_detail: "",
      email: "",
      password: "",
    });
  };

  // 更新実行
  const handleUpdate = async (id: number) => {
    if (!editForm.name || !editForm.affiliation || !editForm.email) {
      toast.error("名前、所属、メールアドレスは必須です");
      return;
    }

    try {
      const response = await fetch(apiUrl(`/api/admin/members/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("更新しました");
        setEditingId(null);
        fetchMembers(searchQuery);
      } else {
        toast.error(data.message || "更新に失敗しました");
      }
    } catch (error) {
      console.error("Update error:", error);
      toast.error("更新エラーが発生しました");
    }
  };

  // 削除実行
  const handleDelete = async (id: number, name: string) => {
    if (
      !confirm(
        `${name} さんを削除してもよろしいですか？\nチェックイン履歴も削除されます。`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(apiUrl(`/api/admin/members/${id}`), {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        toast.success("削除しました");
        fetchMembers(searchQuery);
      } else {
        toast.error(data.message || "削除に失敗しました");
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("削除エラーが発生しました");
    }
  };

  // カード表示
  const handleShowCard = async (member: Member) => {
    try {
      // QRコードを取得
      const response = await fetch(
        apiUrl(`/api/admin/members/${member.id}/qrcode`)
      );
      const data = await response.json();

      if (!data.success) {
        toast.error("QRコードの取得に失敗しました");
        return;
      }

      // カードを生成
      await generateCard(
        data.member.name,
        data.member.qr_code,
        data.member.qrCodeUrl
      );
    } catch (error) {
      console.error("Show card error:", error);
      toast.error("カードの表示に失敗しました");
    }
  };

  const generateCard = async (
    name: string,
    qrCodeId: string,
    qrImageUrl: string
  ) => {
    try {
      // テンプレートを取得
      const response = await fetch(apiUrl("/api/settings/template"));
      const data = await response.json();

      if (!response.ok) {
        toast.error("テンプレートの取得に失敗しました");
        return;
      }

      // QRコード画像をBase64に変換
      const qrImageResponse = await fetch(qrImageUrl);
      const qrImageBlob = await qrImageResponse.blob();
      const qrImageBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(qrImageBlob);
      });

      // NAMEとXXXXを置き換え
      let svg = data.template;
      svg = svg.replace(/NAME/g, name);
      svg = svg.replace(/XXXX/g, qrCodeId);

      // id="QR"の要素を探してQR画像に置き換え
      const qrElementRegex = /<(\w+)([^>]*?)id=["']QR["']([^>]*?)\/>/g;
      const qrElementMatch = svg.match(qrElementRegex);

      if (qrElementMatch) {
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svg, "image/svg+xml");
        const qrElement = svgDoc.getElementById("QR");

        if (qrElement) {
          const x = qrElement.getAttribute("x") || "0";
          const y = qrElement.getAttribute("y") || "0";
          const width = qrElement.getAttribute("width") || "100";
          const height = qrElement.getAttribute("height") || "100";

          const imageElement = `<image id="QR" x="${x}" y="${y}" width="${width}" height="${height}" href="${qrImageBase64}" preserveAspectRatio="xMidYMid meet"/>`;
          svg = svg.replace(qrElementRegex, imageElement);
        }
      }

      setCardData({
        name,
        qrCode: qrCodeId,
        qrCodeUrl: qrImageUrl,
        cardSvg: svg,
      });
      setShowCard(true);
    } catch (error) {
      console.error("Card generation error:", error);
      toast.error("カードの生成に失敗しました");
    }
  };

  const handlePrint = async () => {
    if (!cardData?.cardSvg || !cardData?.name) return;

    try {
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        toast.error(
          "ポップアップがブロックされました。ポップアップを許可してください。"
        );
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>カード印刷 - ${cardData.name}</title>
            <style>
              body {
                margin: 0;
                padding: 20px;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
              }
              @media print {
                body {
                  padding: 0;
                }
              }
            </style>
          </head>
          <body>
            ${cardData.cardSvg}
            <script>
              window.onload = function() {
                window.print();
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } catch (error) {
      console.error("Print error:", error);
      toast.error("印刷に失敗しました");
    }
  };

  const handleDownloadCard = () => {
    if (!cardData?.cardSvg || !cardData?.qrCode) return;

    try {
      const blob = new Blob([cardData.cardSvg], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `card-${cardData.qrCode}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
      toast.error("ダウンロードに失敗しました");
    }
  };

  const handleCloseCard = () => {
    setShowCard(false);
    setCardData(null);
  };

  // CSVファイル選択
  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFile(file);
    }
  };

  // CSVアップロード
  const handleCsvUpload = async () => {
    if (!csvFile) {
      toast.error("CSVファイルを選択してください");
      return;
    }

    try {
      setCsvUploading(true);

      // ファイルを読み込み
      const csvText = await csvFile.text();

      // APIに送信
      const response = await fetch(apiUrl("/api/admin/members/bulk"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvData: csvText }),
      });

      // レスポンスのContent-Typeを確認
      const contentType = response.headers.get("content-type");

      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response:", text);
        toast.error(
          `サーバーエラー: ${response.status} ${
            response.statusText
          }\n\n${text.substring(0, 200)}`
        );
        return;
      }

      const data = await response.json();

      if (data.success) {
        // 失敗データを保存（重複以外）
        if (data.results.failedRows && data.results.failedRows.length > 0) {
          setFailedRows(data.results.failedRows);
          setShowFailedData(true);
        }

        let message = data.message;
        if (data.results.errors.length > 0) {
          message +=
            "\n\n" +
            (data.results.failedRows.length > 0
              ? "失敗したデータは別ウィンドウで確認できます。"
              : "エラー:\n" + data.results.errors.join("\n"));
        }
        toast.success(message);

        setShowCsvUpload(false);
        setCsvFile(null);
        fetchMembers(searchQuery);
      } else {
        if (data.errors && data.errors.length > 0) {
          toast.error("エラー:\n" + data.errors.join("\n"));
        } else {
          toast.error(data.message || "CSV一括登録に失敗しました");
        }
      }
    } catch (error) {
      console.error("CSV upload error:", error);
      toast.error(
        `CSV一括登録エラーが発生しました:\n${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      setCsvUploading(false);
    }
  };

  // CSVアップロードモーダルを閉じる
  const handleCloseCsvUpload = () => {
    setShowCsvUpload(false);
    setCsvFile(null);
  };

  // 失敗データをCSV形式でコピー
  const handleCopyFailedData = () => {
    if (failedRows.length === 0) return;

    // CSVヘッダー
    let csv = "email,name,affiliation,affiliation_detail,qr_code,created_at\n";

    // 失敗したデータ行を追加
    for (const row of failedRows) {
      const fields = [
        row.data.email || "",
        row.data.name,
        row.data.affiliation,
        row.data.affiliation_detail || "",
        row.data.qr_code,
        row.data.created_at,
      ];

      // カンマや改行を含む場合はダブルクォートで囲む
      const csvFields = fields.map((field) => {
        if (
          field.includes(",") ||
          field.includes('"') ||
          field.includes("\n")
        ) {
          return `"${field.replace(/"/g, '""')}"`;
        }
        return field;
      });

      csv += csvFields.join(",") + "\n";
    }

    // クリップボードにコピー
    navigator.clipboard
      .writeText(csv)
      .then(() => {
        toast.success("失敗したデータをコピーしました");
      })
      .catch((err) => {
        console.error("Copy failed:", err);
        toast.error("コピーに失敗しました");
      });
  };

  // CSVダウンロード
  const handleCsvDownload = async () => {
    try {
      const response = await fetch(apiUrl("/api/admin/members/export"));

      if (!response.ok) {
        toast.error("ダウンロードに失敗しました");
        return;
      }

      // Blobとしてレスポンスを取得
      const blob = await response.blob();

      // ダウンロード用のURLを作成
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `members_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("CSV download error:", error);
      toast.error("ダウンロードエラーが発生しました");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* ヘッダー */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  メンバー管理
                </h1>
                <p className="mt-2 text-sm text-gray-600">
                  メンバーの検索・編集・削除
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCsvDownload}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  CSV一括ダウンロード
                </button>
                <button
                  onClick={() => setShowCsvUpload(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  CSV一括登録
                </button>
              </div>
            </div>
          </div>

          {/* 検索フォーム */}
          <form onSubmit={handleSearch} className="mb-6">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="名前、所属、メールアドレス、QRコードで検索"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                検索
              </button>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    fetchMembers("");
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                  クリア
                </button>
              )}
            </div>
          </form>

          {/* メンバー一覧 */}
          {loading ? (
            <div className="text-center py-8">読み込み中...</div>
          ) : members.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchQuery
                ? "検索結果がありません"
                : "登録されたメンバーがいません"}
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {members.map((member) => (
                  <li key={member.id} className="p-4">
                    {editingId === member.id ? (
                      // 編集フォーム
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            名前 *
                          </label>
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) =>
                              setEditForm({ ...editForm, name: e.target.value })
                            }
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            所属 *
                          </label>
                          <input
                            type="text"
                            value={editForm.affiliation}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                affiliation: e.target.value,
                              })
                            }
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            所属詳細
                          </label>
                          <input
                            type="text"
                            value={editForm.affiliation_detail}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                affiliation_detail: e.target.value,
                              })
                            }
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            メールアドレス *
                          </label>
                          <input
                            type="email"
                            value={editForm.email}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                email: e.target.value,
                              })
                            }
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="example@example.com"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            パスワード（変更する場合のみ入力）
                          </label>
                          <input
                            type="password"
                            value={editForm.password}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                password: e.target.value,
                              })
                            }
                            placeholder="英数記号8文字以上"
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdate(member.id)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                          >
                            保存
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                          >
                            キャンセル
                          </button>
                        </div>
                      </div>
                    ) : (
                      // 表示モード
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-4">
                            <div>
                              <p className="text-lg font-medium text-gray-900">
                                {member.name}
                              </p>
                              <p className="text-sm text-gray-600">
                                {member.affiliation}
                                {member.affiliation_detail &&
                                  ` - ${member.affiliation_detail}`}
                              </p>
                              <p className="text-sm text-blue-600 mt-1">
                                {member.email}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                QRコード: {member.qr_code} | 登録日:{" "}
                                {new Date(member.created_at).toLocaleDateString(
                                  "ja-JP"
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => handleShowCard(member)}
                            className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                          >
                            カード表示
                          </button>
                          <button
                            onClick={() => handleEdit(member)}
                            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDelete(member.id, member.name)}
                            className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 戻るボタン */}
          <div className="mt-6">
            <Link
              href="/admin/dashboard"
              className="text-blue-600 hover:text-blue-500"
            >
              ← ダッシュボードに戻る
            </Link>
          </div>
        </div>
      </div>

      {/* CSVアップロードモーダル */}
      {showCsvUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* ヘッダー */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  CSV一括登録
                </h2>
                <button
                  onClick={handleCloseCsvUpload}
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

              {/* 説明 */}
              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">
                  CSV形式について
                </h3>
                <p className="text-sm text-blue-800 mb-2">
                  以下の形式のCSVファイルをアップロードしてください：
                </p>
                <code className="block text-xs bg-white p-2 rounded border border-blue-200 text-gray-800">
                  email,name,affiliation,affiliation_detail,qr_code,created_at
                </code>
                <ul className="mt-3 text-sm text-blue-800 space-y-1">
                  <li>
                    • <strong>email</strong>:
                    メールアドレス（任意、空の場合は自動生成）
                  </li>
                  <li>
                    • <strong>name</strong>:
                    メンバー名（必須、カンマを含む場合は"で囲む）
                  </li>
                  <li>
                    • <strong>affiliation</strong>: 所属（必須）
                  </li>
                  <li>
                    • <strong>affiliation_detail</strong>: 所属詳細（任意）
                  </li>
                  <li>
                    • <strong>qr_code</strong>: 4桁のQRコードID（必須）
                  </li>
                  <li>
                    • <strong>created_at</strong>: 登録日時（必須）
                  </li>
                  <li className="ml-6 text-xs">
                    - YYYY/MM/DD 形式（時刻なし、00:00:00として登録）
                  </li>
                  <li className="ml-6 text-xs">
                    - YYYY/MM/DD HH:mm:ss 形式（時刻あり）
                  </li>
                </ul>
                <p className="mt-3 text-sm text-blue-800">
                  ※
                  パスワードはメールアドレスと同じに設定されます（英数記号8文字以上必須）
                  <br />※
                  メールアドレスが空の場合、tukumanalabmember+ID_&lt;qr_code&gt;@gmail.com
                  が使用されます
                </p>
              </div>

              {/* ファイル選択 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CSVファイルを選択
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCsvFileChange}
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100"
                />
                {csvFile && (
                  <p className="mt-2 text-sm text-gray-600">
                    選択されたファイル: {csvFile.name}
                  </p>
                )}
              </div>

              {/* アクションボタン */}
              <div className="flex gap-3">
                <button
                  onClick={handleCsvUpload}
                  disabled={!csvFile || csvUploading}
                  className="flex-1 bg-green-600 text-white py-3 px-4 rounded-xl hover:bg-green-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {csvUploading ? "アップロード中..." : "アップロード"}
                </button>
                <button
                  onClick={handleCloseCsvUpload}
                  disabled={csvUploading}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* カード表示モーダル */}
      {showCard && cardData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* ヘッダー */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">カード表示</h2>
                <button
                  onClick={handleCloseCard}
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

              {/* カードプレビュー */}
              <div className="mb-6 p-6 bg-gradient-to-br from-blue-50 to-green-50 rounded-xl">
                {cardData.cardSvg ? (
                  <div
                    className="mx-auto border-4 border-white rounded-xl shadow-lg overflow-hidden bg-white"
                    style={{ maxWidth: "400px" }}
                    dangerouslySetInnerHTML={{ __html: cardData.cardSvg }}
                  />
                ) : (
                  <div
                    className="animate-pulse bg-gray-200 rounded-xl"
                    style={{
                      height: "240px",
                      maxWidth: "400px",
                      margin: "0 auto",
                    }}
                  >
                    <p className="text-gray-500 pt-24">カード生成中...</p>
                  </div>
                )}
              </div>

              {/* アクションボタン */}
              <div className="space-y-3">
                <button
                  onClick={handlePrint}
                  disabled={!cardData.cardSvg}
                  className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white py-3 px-4 rounded-xl hover:from-purple-600 hover:to-purple-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
                      d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                    />
                  </svg>
                  カードを印刷
                </button>
                <button
                  onClick={handleDownloadCard}
                  disabled={!cardData.cardSvg}
                  className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 px-4 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  カードをダウンロード
                </button>
                <button
                  onClick={handleCloseCard}
                  className="block w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 失敗データ表示モーダル */}
      {showFailedData && failedRows.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* ヘッダー */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  登録失敗データ
                </h2>
                <button
                  onClick={() => setShowFailedData(false)}
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

              {/* 説明 */}
              <div className="mb-4 p-4 bg-yellow-50 rounded-lg">
                <p className="text-sm text-yellow-800">
                  以下のデータは登録に失敗しました。修正して再度アップロードしてください。
                  <br />※ 重複エラーは含まれていません
                </p>
              </div>

              {/* 失敗データ一覧 */}
              <div className="mb-4 max-h-96 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        行
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        名前
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        所属
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        QRコード
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        エラー理由
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {failedRows.map((row, index) => (
                      <tr key={index}>
                        <td className="px-3 py-2 text-sm text-gray-900">
                          {row.lineNumber}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-900">
                          {row.data.name}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-900">
                          {row.data.affiliation}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-900">
                          {row.data.qr_code}
                        </td>
                        <td className="px-3 py-2 text-sm text-red-600">
                          {row.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* アクションボタン */}
              <div className="flex gap-3">
                <button
                  onClick={handleCopyFailedData}
                  className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-xl hover:bg-blue-700 transition-all shadow-md hover:shadow-lg"
                >
                  CSV形式でコピー
                </button>
                <button
                  onClick={() => setShowFailedData(false)}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors"
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
