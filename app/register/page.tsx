"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/api";
import { SURVEY_QUESTION, SURVEY_OPTIONS, SURVEY_OTHER_OPTION } from "@/lib/survey-config";

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: "",
    affiliation: "",
    affiliationDetail: "",
    organizationMemberId: "",
    email: "",
    password: "",
    passwordConfirm: "",
    howDidYouKnow: "",
    howDidYouKnowOther: "",
  });
  const [emailSent, setEmailSent] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string>("");
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [memberName, setMemberName] = useState<string | null>(null);
  const [cardSvg, setCardSvg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // パスワード確認
    if (formData.password !== formData.passwordConfirm) {
      setError("パスワードが一致しません");
      setLoading(false);
      return;
    }

    try {
      const { passwordConfirm, howDidYouKnowOther, ...submitData } = formData;
      if (submitData.howDidYouKnow === SURVEY_OTHER_OPTION && howDidYouKnowOther) {
        submitData.howDidYouKnow = `${SURVEY_OTHER_OPTION}: ${howDidYouKnowOther}`;
      }
      const response = await fetch(apiUrl("/api/members/register"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submitData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "登録に失敗しました");
      }

      // 即時ログイン状態のため、マイページへダイレクトに遷移
      if (data.redirectUrl) {
        router.push(data.redirectUrl);
      } else {
        router.push("/member/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({
      name: "",
      affiliation: "",
      affiliationDetail: "",
      organizationMemberId: "",
      email: "",
      password: "",
      passwordConfirm: "",
      howDidYouKnow: "",
      howDidYouKnowOther: "",
    });
    setEmailSent(false);
    setRegisteredEmail("");
    setQrCodeUrl(null);
    setQrCode(null);
    setMemberName(null);
    setCardSvg(null);
    setError(null);
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
        console.error("テンプレートの取得に失敗しました");
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

      setCardSvg(svg);
    } catch (error) {
      console.error("Card generation error:", error);
    }
  };

  const handlePrint = async () => {
    if (!cardSvg || !memberName) return;

    try {
      // 新しいウィンドウで印刷
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
      // SVGをBlobに変換
      const blob = new Blob([cardSvg], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);

      // ダウンロードリンクを作成
      const link = document.createElement("a");
      link.href = url;
      link.download = `card-${qrCode}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // URLを解放
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
      alert("ダウンロードに失敗しました");
    }
  };

  if (emailSent) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 text-center border border-primary-100">
          <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center">
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
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent mb-4">
            確認メールを送信しました
          </h1>
          <p className="text-gray-600 mb-2">
            {registeredEmail} 宛に確認メールを送信しました。
          </p>
          <p className="text-gray-600 mb-8">
            メール内のリンクをクリックして、登録を完了してください。
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
            <div className="flex items-start gap-3">
              <svg
                className="w-6 h-6 text-blue-500 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="text-left">
                <h3 className="font-semibold text-blue-900 mb-2">
                  メールが届かない場合
                </h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• 迷惑メールフォルダをご確認ください</li>
                  <li>• メールアドレスが正しいかご確認ください</li>
                  <li>• リンクの有効期限は24時間です</li>
                </ul>
              </div>
            </div>
          </div>

          <button
            onClick={handleReset}
            className="block w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-xl hover:bg-gray-200 transition-colors"
          >
            別のメールアドレスで登録
          </button>
        </div>
      </div>
    );
  }

  if (qrCodeUrl) {
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
          <p className="text-gray-600 mb-8">カードを印刷してください</p>

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
              onClick={handleReset}
              className="block w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-xl hover:bg-gray-200 transition-colors"
            >
              新しいメンバーを登録
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-primary-100">
        <div className="flex items-center gap-3 mb-6">
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
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">メンバー登録</h1>
        </div>

        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
          <p className="font-semibold flex items-center gap-1.5 mb-1">
            <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            【ご注意】初回チェックインについて
          </p>
          <p>新規登録後、24時間以内に一度もチェックインが行われない場合、不要アカウント防止のため登録アカウントは自動削除されます。</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              氏名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              required
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              placeholder="山田 太郎"
            />
          </div>

          <div>
            <label
              htmlFor="affiliation"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              所属 <span className="text-red-500">*</span>
            </label>
            <select
              id="affiliation"
              required
              value={formData.affiliation}
              onChange={(e) =>
                setFormData({ ...formData, affiliation: e.target.value })
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
            >
              <option value="">選択してください</option>
              <option value="幼稚園">幼稚園</option>
              <option value="初等部">初等部</option>
              <option value="中等部">中等部</option>
              <option value="高等部">高等部</option>
              <option value="大学">大学</option>
              <option value="大学院">大学院</option>
              <option value="教職員">教職員</option>
              <option value="その他">その他</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="affiliationDetail"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              所属詳細
            </label>
            <input
              type="text"
              id="affiliationDetail"
              value={formData.affiliationDetail}
              onChange={(e) =>
                setFormData({ ...formData, affiliationDetail: e.target.value })
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              placeholder="3年1組、○○学部、○○課など"
            />
          </div>

          <div>
            <label
              htmlFor="organizationMemberId"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              組織内ID
            </label>
            <input
              type="text"
              id="organizationMemberId"
              value={formData.organizationMemberId}
              onChange={(e) =>
                setFormData({ ...formData, organizationMemberId: e.target.value })
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              placeholder="学生番号、職員番号など"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              メールアドレス <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              id="email"
              required
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              placeholder="example@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              パスワード <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              id="password"
              required
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              placeholder="英数記号を含む8文字以上"
            />
            <p className="mt-1 text-xs text-gray-500">
              英数字または記号を使用した8文字以上で入力してください
            </p>
          </div>

          <div>
            <label
              htmlFor="passwordConfirm"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              パスワード確認 <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              id="passwordConfirm"
              required
              value={formData.passwordConfirm}
              onChange={(e) =>
                setFormData({ ...formData, passwordConfirm: e.target.value })
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              placeholder="パスワードを再入力"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {SURVEY_QUESTION}
            </label>
            <div className="space-y-2">
              {SURVEY_OPTIONS.map((option) => (
                <label key={option.label} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="howDidYouKnow"
                    value={option.label}
                    checked={formData.howDidYouKnow === option.label}
                    onChange={(e) =>
                      setFormData({ ...formData, howDidYouKnow: e.target.value, howDidYouKnowOther: "" })
                    }
                    className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">{option.label}</span>
                  {option.url && (
                    <a
                      href={option.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary-600 hover:text-primary-700 underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      ↗
                    </a>
                  )}
                </label>
              ))}
            </div>
            {formData.howDidYouKnow === SURVEY_OTHER_OPTION && (
              <input
                type="text"
                value={formData.howDidYouKnowOther}
                onChange={(e) =>
                  setFormData({ ...formData, howDidYouKnowOther: e.target.value })
                }
                className="mt-2 w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                placeholder="詳しく教えてください"
              />
            )}
          </div>

          <div className="mb-4 p-4 bg-gray-50 rounded-xl text-sm text-gray-600">
            <p className="mb-2">
              登録をすることで、当サイトの
              <a href="/terms-of-service" target="_blank" className="text-primary-600 hover:text-primary-700 underline mx-1">
                利用規約
              </a>
              および
              <a href="/privacy-policy" target="_blank" className="text-primary-600 hover:text-primary-700 underline mx-1">
                プライバシーポリシー
              </a>
              に同意したものとみなします。
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-primary-500 to-primary-600 text-white py-3 px-4 rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? "登録中..." : "登録"}
          </button>
        </form>
      </div>
    </div>
  );
}
