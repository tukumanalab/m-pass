"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiUrl } from "@/lib/api";

function VerifyContent() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [memberName, setMemberName] = useState<string | null>(null);
  const [cardSvg, setCardSvg] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setError("無効なリンクです");
      setLoading(false);
      return;
    }

    verifyToken(token);
  }, [searchParams]);

  const verifyToken = async (token: string) => {
    try {
      const response = await fetch(apiUrl("/api/members/verify"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "登録に失敗しました");
      }

      setQrCodeUrl(data.member.qrCodeUrl);
      setQrCode(data.member.memberId);
      setMemberName(data.member.name);

      // カードを生成
      await generateCard(
        data.member.name,
        data.member.memberId,
        data.member.qrCodeUrl
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const generateCard = async (
    name: string,
    qrCodeId: string,
    qrImageUrl: string
  ) => {
    try {
      const response = await fetch(apiUrl("/api/settings/template"));
      const data = await response.json();

      if (!response.ok) {
        console.error("テンプレートの取得に失敗しました");
        return;
      }

      const qrImageResponse = await fetch(qrImageUrl);
      const qrImageBlob = await qrImageResponse.blob();
      const qrImageBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(qrImageBlob);
      });

      let svg = data.template;
      svg = svg.replace(/NAME/g, name);
      svg = svg.replace(/XXXX/g, qrCodeId);

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

      setCardSvg(svg);
    } catch (error) {
      console.error("Card generation error:", error);
    }
  };

  const handlePrint = async () => {
    if (!cardSvg || !memberName) return;

    try {
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        alert(
          "ポップアップがブロックされました。ポップアップを許可してください。"
        );
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>カード印刷 - ${memberName}</title>
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
            ${cardSvg}
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
      alert("印刷に失敗しました");
    }
  };

  const handleDownloadCard = () => {
    if (!cardSvg || !memberName || !qrCode) return;

    try {
      const blob = new Blob([cardSvg], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `card-${qrCode}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
      alert("ダウンロードに失敗しました");
    }
  };

  const handleGoToLogin = () => {
    router.push("/member/login");
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 text-center border border-primary-100">
          <div className="animate-spin w-16 h-16 mx-auto mb-6 border-4 border-primary-500 border-t-transparent rounded-full"></div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            登録を確認しています...
          </h1>
          <p className="text-gray-600">しばらくお待ちください</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 text-center border border-red-200">
          <div className="w-20 h-20 mx-auto mb-6 bg-red-100 rounded-2xl flex items-center justify-center">
            <svg
              className="w-12 h-12 text-red-500"
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
          <h1 className="text-3xl font-bold text-red-600 mb-4">
            登録に失敗しました
          </h1>
          <p className="text-gray-600 mb-8">{error}</p>
          <button
            onClick={() => router.push("/register")}
            className="bg-gradient-to-r from-primary-500 to-primary-600 text-white py-3 px-6 rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all shadow-md hover:shadow-lg"
          >
            登録ページに戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 text-center border border-primary-100">
        <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center">
          <svg
            className="w-12 h-12 text-white"
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
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-primary-700 bg-clip-text text-transparent mb-4">
          登録完了
        </h1>
        <p className="text-gray-600 mb-2">メンバー登録が完了しました!</p>
        <p className="text-sm text-gray-500 mb-8">
          登録完了メールをお送りしましたのでご確認ください
        </p>

        <div className="mb-8 p-6 bg-gradient-to-br from-primary-50 to-green-50 rounded-xl">
          {cardSvg ? (
            <div
              className="mx-auto border-4 border-white rounded-xl shadow-lg overflow-hidden bg-white"
              style={{ maxWidth: "400px" }}
              dangerouslySetInnerHTML={{ __html: cardSvg }}
            />
          ) : (
            <div
              className="animate-pulse bg-gray-200 rounded-xl"
              style={{ height: "240px", maxWidth: "400px", margin: "0 auto" }}
            >
              <p className="text-gray-500 pt-24">カード生成中...</p>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <button
            onClick={handlePrint}
            disabled={!cardSvg}
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
            disabled={!cardSvg}
            className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-primary-500 to-primary-600 text-white py-3 px-4 rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
            onClick={handleGoToLogin}
            className="block w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-3 px-4 rounded-xl hover:from-green-600 hover:to-green-700 transition-all shadow-md hover:shadow-lg"
          >
            ログインページへ
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 text-center border border-primary-100">
            <div className="animate-spin w-16 h-16 mx-auto mb-6 border-4 border-primary-500 border-t-transparent rounded-full"></div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              読み込み中...
            </h1>
          </div>
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
