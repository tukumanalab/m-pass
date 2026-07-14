"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiUrl } from "@/lib/api";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useWebUSBFeliCa } from "@/app/hooks/useWebUSBFeliCa";

const affiliationOptions = [
  "幼稚園",
  "初等部",
  "中等部",
  "高等部",
  "大学",
  "大学院",
  "教職員",
  "その他",
];

interface NfcCard {
  id: number;
  member_id: number;
  nfc_id: string;
  card_name: string;
  created_at: string;
}

interface Member {
  id: number;
  member_id: string;
  name: string;
  affiliation: string;
  affiliation_detail: string;
  organization_member_id: string | null;
  email: string;
  created_at: string;
  mypage_notification_sent_at: string | null;
  card_printed_at: string | null;
  nfc_cards?: NfcCard[];
}

interface CheckIn {
  id: number;
  check_in_time: string;
  check_out_time?: string | null;
  affiliation: string;
}

export default function AdminMembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const editingMember = members.find((m) => m.id === editingId);
  const [editForm, setEditForm] = useState({
    name: "",
    affiliation: "",
    affiliation_detail: "",
    organization_member_id: "",
    email: "",
    password: "",
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    affiliation: "",
    affiliation_detail: "",
    organization_member_id: "",
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
        organization_member_id?: string;
        member_id: string;
        created_at: string;
        mypage_notification_sent_at?: string;
      };
      reason: string;
    }>
  >([]);
  const [showFailedData, setShowFailedData] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [checkInHistory, setCheckInHistory] = useState<CheckIn[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const router = useRouter();

  // WebUSB FeliCa フック
  const { status: nfcStatus, connect: connectNfc, readIdm: readNfcIdm, disconnect: disconnectNfc, errorMessage: nfcError, isPolling: nfcIsPolling } = useWebUSBFeliCa();
  const [nfcInput, setNfcInput] = useState("");
  const [nfcCardNameInput, setNfcCardNameInput] = useState("NFCカード");

  // 編集状態が終了した（editingId が null になった）ら自動で PaSori を切断して解放する
  useEffect(() => {
    if (editingId === null) {
      disconnectNfc();
      setNfcInput("");
      setNfcCardNameInput("NFCカード");
    }
  }, [editingId, disconnectNfc]);

  // アンマウント時に確実にカードリーダーを解放する
  useEffect(() => {
    return () => {
      disconnectNfc();
    };
  }, [disconnectNfc]);

  // NFCカード追加
  const handleAddNfcCard = async (memberId: number) => {
    if (!nfcInput || !nfcInput.trim()) {
      toast.error("NFC IDを入力してください");
      return;
    }
    if (!nfcCardNameInput || !nfcCardNameInput.trim()) {
      toast.error("カード名を入力してください");
      return;
    }

    try {
      const response = await fetch(apiUrl(`/api/admin/members/${memberId}/nfc-cards`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nfcId: nfcInput,
          cardName: nfcCardNameInput
        })
      });

      const data = await response.json();
      if (data.success) {
        toast.success("NFCカードを登録しました");
        setNfcInput("");
        setNfcCardNameInput("NFCカード");
        fetchMembers(searchQuery); // 再取得して反映
      } else {
        toast.error(data.message || "登録に失敗しました");
      }
    } catch (e) {
      console.error(e);
      toast.error("登録中にエラーが発生しました");
    }
  };

  // NFCカード削除
  const handleRemoveNfcCard = async (memberId: number, cardId: number) => {
    if (!confirm("このNFCカードを削除してもよろしいですか？")) {
      return;
    }

    try {
      const response = await fetch(apiUrl(`/api/admin/members/${memberId}/nfc-cards?cardId=${cardId}`), {
        method: "DELETE"
      });

      const data = await response.json();
      if (data.success) {
        toast.success("NFCカードを削除しました");
        fetchMembers(searchQuery); // 再取得して反映
      } else {
        toast.error(data.message || "削除に失敗しました");
      }
    } catch (e) {
      console.error(e);
      toast.error("削除中にエラーが発生しました");
    }
  };

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
      organization_member_id: member.organization_member_id || "",
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
      organization_member_id: "",
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

  // 新規追加キャンセル
  const handleCancelAdd = () => {
    setShowAddModal(false);
    setAddForm({
      name: "",
      affiliation: "",
      affiliation_detail: "",
      organization_member_id: "",
      email: "",
      password: "",
    });
  };

  // 新規追加実行
  const handleAddMember = async () => {
    if (!addForm.name || !addForm.affiliation || !addForm.email || !addForm.password) {
      toast.error("名前、所属、メールアドレス、パスワードは必須です");
      return;
    }

    try {
      const response = await fetch(apiUrl("/api/admin/members"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("メンバーを登録しました");
        setShowAddModal(false);
        setAddForm({
          name: "",
          affiliation: "",
          affiliation_detail: "",
          organization_member_id: "",
          email: "",
          password: "",
        });
        fetchMembers(searchQuery);
      } else {
        toast.error(data.message || "登録に失敗しました");
      }
    } catch (error) {
      console.error("Add member error:", error);
      toast.error("登録エラーが発生しました");
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

      // 選択されたメンバーを保存
      setSelectedMember(member);

      // カードを生成
      await generateCard(
        data.member.name,
        data.member.member_id,
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
            <meta charset="UTF-8">
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              @page {
                size: 91mm 55mm;
                margin: 0;
              }
              html, body {
                width: 91mm;
                height: 55mm;
                margin: 0;
                padding: 0;
                overflow: hidden;
              }
              body {
                display: flex;
                justify-content: center;
                align-items: center;
              }
              svg {
                width: 91mm;
                height: 55mm;
                display: block;
              }
              @media print {
                html, body {
                  width: 91mm;
                  height: 55mm;
                }
              }
            </style>
          </head>
          <body>
            ${cardData.cardSvg}
            <script>
              window.onload = function() {
                var hasPrinted = false;
                var targetOrigin = '*';

                try {
                  if (window.opener && !window.opener.closed) {
                    targetOrigin = window.opener.location.origin;
                  }
                } catch (error) {
                  targetOrigin = '*';
                }

                window.addEventListener('afterprint', function() {
                  hasPrinted = true;
                  if (window.opener && !window.opener.closed) {
                    window.opener.postMessage({ type: 'print-completed' }, targetOrigin);
                  }
                  setTimeout(function() {
                    window.close();
                  }, 0);
                });

                window.addEventListener('beforeunload', function() {
                  if (!hasPrinted && window.opener && !window.opener.closed) {
                    window.opener.postMessage({ type: 'print-cancelled' }, targetOrigin);
                  }
                });

                window.print();
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();

      // 印刷完了のメッセージを受け取るリスナーを設定
      const messageHandler = async (event: MessageEvent) => {
        if (event.source !== printWindow) {
          return;
        }

        if (event.origin !== window.location.origin) {
          return;
        }

        const messageType = typeof event.data === 'string' ? event.data : event.data?.type;

        if (messageType === 'print-completed') {
          if (!selectedMember) {
            window.removeEventListener('message', messageHandler);
            return;
          }

          try {
            const response = await fetch(
              apiUrl(`/api/admin/members/${selectedMember.id}/mark-printed`),
              { method: "POST" }
            );
            const data = await response.json();

            if (!data.success) {
              toast.error(data.message || "印刷済みフラグの更新に失敗しました");
              return;
            }

            const printedAt: string = data.cardPrintedAt || new Date().toISOString();

            setMembers((prevMembers) =>
              prevMembers.map((member) =>
                member.id === selectedMember.id
                  ? { ...member, card_printed_at: printedAt }
                  : member
              )
            );

            toast.success("印刷済みの印を付けました");
            handleCloseCard();
          } catch (error) {
            console.error("Mark printed error:", error);
            toast.error("印刷済みフラグの更新中にエラーが発生しました");
          } finally {
            window.removeEventListener('message', messageHandler);
          }

          return;
        }

        if (messageType === 'print-cancelled') {
          window.removeEventListener('message', messageHandler);
        }
      };

      window.addEventListener('message', messageHandler);
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
    setSelectedMember(null);
  };

  // チェックイン履歴表示
  const handleShowHistory = async (member: Member) => {
    setSelectedMember(member);
    setShowHistory(true);
    setHistoryLoading(true);
    setCheckInHistory([]);

    try {
      const response = await fetch(
        apiUrl(`/api/admin/members/${member.id}/checkins?limit=100`)
      );
      const data = await response.json();

      if (data.success) {
        setCheckInHistory(data.history);
      } else {
        toast.error(data.message || "履歴の取得に失敗しました");
      }
    } catch (error) {
      console.error("Fetch history error:", error);
      toast.error("履歴の取得中にエラーが発生しました");
    } finally {
      setHistoryLoading(false);
    }
  };

  const calculateStayDuration = (checkInStr: string, checkOutStr: string | null | undefined): string => {
    if (!checkOutStr) return "-";
    const start = new Date(checkInStr ? checkInStr.replace(" ", "T") + "Z" : "").getTime();
    const end = new Date(checkOutStr ? checkOutStr.replace(" ", "T") + "Z" : "").getTime();
    const mins = Math.round((end - start) / (60 * 1000));
    if (mins < 60) return `${mins}分`;
    const hrs = Math.floor(mins / 60);
    const rMins = mins % 60;
    return rMins > 0 ? `${hrs}時間${rMins}分` : `${hrs}時間`;
  };

  const calculateDaysSincePrevious = (currentIndex: number) => {
    // 履歴は降順（新しい順）で表示されていると仮定
    // 次のインデックスが「前回のチェックイン」になる
    const prevIndex = currentIndex + 1;
    
    if (prevIndex >= checkInHistory.length) {
      return "-";
    }

    const currentStr = checkInHistory[currentIndex].check_in_time;
    const prevStr = checkInHistory[prevIndex].check_in_time;

    // Convert UTC strings to Date objects
    const current = new Date(currentStr ? currentStr.replace(" ", "T") + "Z" : "");
    const prev = new Date(prevStr ? prevStr.replace(" ", "T") + "Z" : "");

    // Calculate difference in milliseconds
    const diffTime = current.getTime() - prev.getTime();
    
    const oneDayMs = 24 * 60 * 60 * 1000;
    if (diffTime >= oneDayMs) {
      // Convert to days (rounding up to ensure full days)
      const diffDays = Math.ceil(diffTime / oneDayMs);
      return `${diffDays}日`;
    } else {
      const diffMins = Math.floor(diffTime / (1000 * 60));
      const hrs = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
    }
  };

  const handleCloseHistory = () => {
    setShowHistory(false);
    setSelectedMember(null);
    setCheckInHistory([]);
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
    let csv =
      "email,name,affiliation,affiliation_detail,organization_member_id,member_id,created_at,mypage_notification_sent_at\n";

    // 失敗したデータ行を追加
    for (const row of failedRows) {
      const fields = [
        row.data.email || "",
        row.data.name,
        row.data.affiliation,
        row.data.affiliation_detail || "",
        row.data.organization_member_id || "",
        row.data.member_id,
        row.data.created_at,
        (row.data as any).mypage_notification_sent_at || "",
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

  // 全メンバー一括削除
  const handleBulkDelete = async () => {
    // 二段階確認
    if (
      !confirm(
        `⚠️ 警告 ⚠️\n\n全てのメンバーを削除します。\n（チェックイン履歴は保持されます）\n\nこの操作は取り消せません。\n\n本当に削除してもよろしいですか？`
      )
    ) {
      return;
    }

    // 最終確認
    const confirmation = prompt(
      '全メンバーを削除するには「削除」と入力してください:'
    );

    if (confirmation !== "削除") {
      toast.info("削除をキャンセルしました");
      return;
    }

    try {
      const response = await fetch(apiUrl("/api/admin/members/bulk"), {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
        fetchMembers(searchQuery);
      } else {
        toast.error(data.message || "一括削除に失敗しました");
      }
    } catch (error) {
      console.error("Bulk delete error:", error);
      toast.error("一括削除エラーが発生しました");
    }
  };

  // マイページ通知フラグをリセット（単一メンバー）
  const handleResetNotification = async (id: number, name: string) => {
    if (!confirm(`${name} さんのマイページ通知フラグをリセットしますか？\n次回のマイページ案内メール一括送信の対象になります。`)) {
      return;
    }

    try {
      const response = await fetch(apiUrl(`/api/admin/members/${id}/reset-notification`), {
        method: "POST",
      });

      const data = await response.json();

      if (data.success) {
        toast.success("通知フラグをリセットしました");
        fetchMembers(searchQuery);
      } else {
        toast.error(data.message || "リセットに失敗しました");
      }
    } catch (error) {
      console.error("Reset notification error:", error);
      toast.error("リセットエラーが発生しました");
    }
  };

  // 全メンバーの通知フラグをリセット
  const handleResetAllNotifications = async () => {
    if (
      !confirm(
        `全メンバーのマイページ通知フラグをリセットしますか？\n\n次回のマイページ案内メール一括送信で、全メンバーが送信対象になります。`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(apiUrl("/api/admin/members/reset-all-notifications"), {
        method: "POST",
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
        fetchMembers(searchQuery);
      } else {
        toast.error(data.message || "リセットに失敗しました");
      }
    } catch (error) {
      console.error("Reset all notifications error:", error);
      toast.error("リセットエラーが発生しました");
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
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  メンバー追加
                </button>
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
                <button
                  onClick={handleResetAllNotifications}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  title="全メンバーの「マイページのご案内」メール送信済みフラグをリセット"
                >
                  通知フラグ一括リセット
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  全メンバー削除
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
                placeholder="名前、所属、メールアドレス、メンバーIDで検索"
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
                    {/* 表示モード */}
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
                              メンバーID: {member.member_id}
                              {member.organization_member_id && ` | 組織内ID: ${member.organization_member_id}`}
                              {` | 登録日: `}
                              {new Date(member.created_at).toLocaleDateString(
                                "ja-JP",
                                { timeZone: "Asia/Tokyo" }
                              )}
                            </p>
                            {/* NFCカード一覧表示 */}
                            {member.nfc_cards && member.nfc_cards.length > 0 && (
                              <div className="text-xs text-gray-600 mt-1 flex flex-wrap gap-1.5 items-center">
                                <span className="font-semibold text-gray-700">💳 NFCカード:</span>
                                {member.nfc_cards.map(card => (
                                  <span key={card.id} className="bg-blue-50 border border-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-mono text-[10px]" title={card.nfc_id}>
                                    {card.card_name} ({card.nfc_id})
                                  </span>
                                ))}
                              </div>
                            )}
                            {member.mypage_notification_sent_at && (
                              <p className="text-xs text-green-600 mt-1">
                                📧 マイページ案内メール送信済み:{" "}
                                {new Date(member.mypage_notification_sent_at).toLocaleString(
                                  "ja-JP",
                                  { 
                                    timeZone: "Asia/Tokyo",
                                    year: "numeric",
                                    month: "numeric",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit"
                                  }
                                )}
                              </p>
                            )}
                            {member.card_printed_at && (
                              <p className="text-xs text-purple-600 mt-1">
                                🖨️ カード印刷済み:{" "}
                                {new Date(member.card_printed_at).toLocaleString(
                                  "ja-JP",
                                  { 
                                    timeZone: "Asia/Tokyo",
                                    year: "numeric",
                                    month: "numeric",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit"
                                  }
                                )}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4 flex-wrap">
                        <button
                          onClick={() => handleShowCard(member)}
                          className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                        >
                          {member.card_printed_at ? "カード表示 ✓" : "カード表示"}
                        </button>
                        <button
                          onClick={() => handleEdit(member)}
                          className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => handleShowHistory(member)}
                          className="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                        >
                          履歴
                        </button>
                        {member.mypage_notification_sent_at && (
                          <button
                            onClick={() => handleResetNotification(member.id, member.name)}
                            className="px-3 py-1 text-sm bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                            title="マイページ通知フラグをリセット"
                          >
                            通知リセット
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(member.id, member.name)}
                          className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >
                          削除
                        </button>
                      </div>
                    </div>
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
                  email,name,affiliation,affiliation_detail,organization_member_id,member_id,created_at,mypage_notification_sent_at
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
                    • <strong>organization_member_id</strong>: 組織内ID（任意）
                  </li>
                  <li>
                    • <strong>member_id</strong>: 4桁のメンバーID（必須）
                  </li>
                  <li>
                    • <strong>created_at</strong>: 登録日時（必須、ISO 8601形式）
                  </li>
                  <li className="ml-6 text-xs">
                    - 推奨: YYYY-MM-DDTHH:mm:ss.sssZ（例: 2025-11-06T12:00:00.000Z）
                  </li>
                  <li className="ml-6 text-xs">
                    - レガシー対応: YYYY/MM/DD HH:mm:ss（UTC時刻として解釈）
                  </li>
                  <li>
                    • <strong>mypage_notification_sent_at</strong>: マイページ案内メール送信日時（任意、ISO 8601形式）
                  </li>
                  <li className="ml-6 text-xs">
                    - 推奨: YYYY-MM-DDTHH:mm:ss.sssZ（例: 2025-11-06T12:00:00.000Z）
                  </li>
                  <li className="ml-6 text-xs">
                    - レガシー対応: YYYY/MM/DD HH:mm:ss（UTC時刻として解釈）
                  </li>
                  <li className="ml-6 text-xs">
                    - 空欄の場合は未送信として扱われます
                  </li>
                </ul>
                <p className="mt-3 text-sm text-blue-800">
                  ※
                  パスワードはメールアドレスと同じに設定されます（英数字または記号を含む8文字以上必須）
                  <br />※
                  メールアドレスが空の場合、tukumanalabmember+id_&lt;member_id&gt;@gmail.com
                  が使用されます
                  <br />※
                  mypage_notification_sent_at カラムが無い場合は、全て未送信として扱われます
                  <br />※
                  日時は全てISO 8601形式（UTC）で保存されます（画面表示時は日本時間に自動変換）
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
                        組織内ID
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
                          {row.data.organization_member_id || ""}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-900">
                          {row.data.member_id}
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

      {/* チェックイン履歴モーダル */}
      {showHistory && selectedMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* ヘッダー */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    チェックイン履歴
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedMember.name} ({selectedMember.member_id})
                  </p>
                </div>
                <button
                  onClick={handleCloseHistory}
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

              {/* 履歴リスト */}
              <div className="mb-6">
                {historyLoading ? (
                  <div className="text-center py-8 text-gray-500">
                    読み込み中...
                  </div>
                ) : checkInHistory.length > 0 ? (
                  <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-300">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">
                            日時
                          </th>
                          <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                            滞在時間
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
                        {checkInHistory.map((checkin) => (
                          <tr key={checkin.id}>
                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-900">
                              {checkin.check_in_time ? (
                                new Date(checkin.check_in_time.replace(" ", "T") + "Z").toLocaleString(
                                  "ja-JP",
                                  {
                                    year: "numeric",
                                    month: "2-digit",
                                    day: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                              {checkin.check_out_time ? (
                                calculateStayDuration(checkin.check_in_time, checkin.check_out_time)
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                              {checkin.affiliation || "-"}
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                              {calculateDaysSincePrevious(checkInHistory.indexOf(checkin))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                    チェックイン履歴はありません
                  </div>
                )}
              </div>

              {/* アクションボタン */}
              <div className="flex justify-end">
                <button
                  onClick={handleCloseHistory}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* メンバー追加モーダル */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* ヘッダー */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b">
                <h2 className="text-2xl font-bold text-gray-900">
                  メンバー追加
                </h2>
                <button
                  onClick={handleCancelAdd}
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

              {/* フォーム */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    名前 *
                  </label>
                  <input
                    type="text"
                    value={addForm.name}
                    onChange={(e) =>
                      setAddForm({ ...addForm, name: e.target.value })
                    }
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="山田 太郎"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    所属 *
                  </label>
                  <select
                    value={addForm.affiliation}
                    onChange={(e) =>
                      setAddForm({
                        ...addForm,
                        affiliation: e.target.value,
                      })
                    }
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">選択してください</option>
                    {affiliationOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    所属詳細
                  </label>
                  <input
                    type="text"
                    value={addForm.affiliation_detail}
                    onChange={(e) =>
                      setAddForm({
                        ...addForm,
                        affiliation_detail: e.target.value,
                      })
                    }
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="〇〇学部 〇〇学科"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    組織内ID
                  </label>
                  <input
                    type="text"
                    value={addForm.organization_member_id}
                    onChange={(e) =>
                      setAddForm({
                        ...addForm,
                        organization_member_id: e.target.value,
                      })
                    }
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="12345678"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    メールアドレス *
                  </label>
                  <input
                    type="email"
                    value={addForm.email}
                    onChange={(e) =>
                      setAddForm({
                        ...addForm,
                        email: e.target.value,
                      })
                    }
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="example@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    パスワード *
                  </label>
                  <input
                    type="password"
                    value={addForm.password}
                    onChange={(e) =>
                      setAddForm({
                        ...addForm,
                        password: e.target.value,
                      })
                    }
                    placeholder="英数字または記号を含む8文字以上"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* フッター */}
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button
                  type="button"
                  onClick={handleCancelAdd}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleAddMember}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  登録
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* メンバー編集モーダル */}
      {editingId !== null && editingMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* ヘッダー */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b">
                <h2 className="text-2xl font-bold text-gray-900">
                  メンバー編集
                </h2>
                <button
                  onClick={handleCancelEdit}
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

              {/* フォーム */}
              <div className="space-y-4">
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
                  <select
                    value={editForm.affiliation}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        affiliation: e.target.value,
                      })
                    }
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">選択してください</option>
                    {affiliationOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                    {editForm.affiliation &&
                      !affiliationOptions.includes(editForm.affiliation) && (
                        <option value={editForm.affiliation}>
                          {editForm.affiliation} (カスタム)
                        </option>
                      )}
                  </select>
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
                    組織内ID
                  </label>
                  <input
                    type="text"
                    value={editForm.organization_member_id}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        organization_member_id: e.target.value,
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
                    placeholder="英数字または記号を含む8文字以上"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* NFCカード管理セクション */}
                <div className="border-t pt-3 mt-3 bg-gray-50/50 p-3 rounded-lg border">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    NFCカード管理（最大5枚）
                  </label>
                  
                  {/* 登録済みカードリスト */}
                  {editingMember.nfc_cards && editingMember.nfc_cards.length > 0 ? (
                    <ul className="space-y-2 mb-3">
                      {editingMember.nfc_cards.map((card) => (
                        <li key={card.id} className="flex justify-between items-center bg-white p-2 rounded-md border text-sm shadow-sm">
                          <div>
                            <span className="font-medium text-gray-800">{card.card_name}</span>
                            <span className="text-gray-500 ml-2 font-mono text-xs">({card.nfc_id})</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveNfcCard(editingMember.id, card.id)}
                            className="text-red-600 hover:text-red-800 text-xs px-2 py-1 bg-red-50 hover:bg-red-100 rounded transition-colors"
                          >
                            削除
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500 mb-3">登録されたNFCカードはありません</p>
                  )}

                  {/* 新規追加フォーム */}
                  <div className="bg-blue-50/30 p-3 rounded-lg border border-blue-100 space-y-2">
                    <span className="block text-xs font-semibold text-blue-800">新規NFCカード追加</span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="NFC ID (IDm/UID)"
                        value={nfcInput}
                        onChange={(e) => setNfcInput(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-mono"
                      />
                      <input
                        type="text"
                        placeholder="カード名"
                        value={nfcCardNameInput}
                        onChange={(e) => setNfcCardNameInput(e.target.value)}
                        className="w-28 px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddNfcCard(editingMember.id)}
                        className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 font-medium"
                      >
                        追加
                      </button>
                    </div>

                    {/* PaSoriスキャンボタン（1つのボタンに統合） */}
                    <div className="flex items-center gap-2 pt-1">
                      {nfcIsPolling ? (
                        /* スキャン中（ポーリング中）は「スキャナー解除」ボタンを表示 */
                        <button
                          type="button"
                          onClick={async () => {
                            await disconnectNfc();
                          }}
                          className="px-3 py-1.5 bg-red-600 text-white rounded text-xs hover:bg-red-700 font-medium transition-colors"
                        >
                          スキャナー解除
                        </button>
                      ) : (
                        /* スキャン前、または切断状態は「スキャン開始」ボタンを表示 */
                        <button
                          type="button"
                          disabled={nfcStatus === 'connecting'}
                          onClick={async () => {
                            try {
                              let connected = nfcStatus === 'connected' || nfcStatus === 'reading' || nfcStatus === 'success';
                              if (!connected) {
                                connected = await connectNfc();
                              }
                              if (connected) {
                                const id = await readNfcIdm();
                                if (id) {
                                  setNfcInput(id);
                                }
                              }
                            } catch (e) {
                              console.error(e);
                            }
                          }}
                          className={`px-3 py-1.5 text-white rounded text-xs font-medium transition-colors ${
                            nfcStatus === 'connecting'
                              ? 'bg-gray-400 cursor-not-allowed'
                              : 'bg-green-600 hover:bg-green-700'
                          }`}
                        >
                          {nfcStatus === 'connecting' ? 'スキャナー接続中' : 'スキャン開始'}
                        </button>
                      )}

                      <span className="text-xs text-gray-500">
                        {nfcStatus === 'error' && `接続エラーが発生しました。${nfcError ? `(${nfcError})` : ''}`}
                        {nfcStatus === 'connected' && !nfcIsPolling && 'PaSori接続完了。「スキャン開始」を押してカードをかざしてください。'}
                        {nfcStatus === 'connected' && nfcIsPolling && 'カードをかざしてください...'}
                        {nfcStatus === 'success' && '読み取り成功。'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* フッター */}
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdate(editingMember.id)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
