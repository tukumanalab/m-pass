"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/api";

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

const passwordRegex = /^[A-Za-z\d@$!%*?&_.\-+=^#~,;:/<>{}[\]|()`'"\\]{8,}$/;
interface MemberResponse {
  name: string;
  email: string;
  affiliation: string;
  affiliationDetail: string | null;
  emailChangeRequested?: boolean;
  pendingEmail?: string;
}

type MemberFormValues = MemberResponse & {
  password: string;
  passwordConfirm: string;
};

export default function MemberEditPage() {
  const router = useRouter();
  const [formValues, setFormValues] = useState<MemberFormValues>({
    name: "",
    email: "",
    affiliation: "",
    affiliationDetail: "",
    password: "",
    passwordConfirm: "",
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchMemberInfo = async () => {
      try {
        const response = await fetch(apiUrl("/api/member/info"));

        if (!response.ok) {
          if (response.status === 401) {
            router.push("/member/login");
            return;
          }

          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errorData = await response.json();
            throw new Error(
              errorData.error || "メンバー情報の取得に失敗しました"
            );
          }

          throw new Error("メンバー情報の取得に失敗しました");
        }

        const data = (await response.json()) as MemberResponse;
        setFormValues({
          name: data.name,
          email: data.email,
          affiliation: data.affiliation,
          affiliationDetail: data.affiliationDetail ?? "",
          password: "",
          passwordConfirm: "",
        });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "メンバー情報の取得に失敗しました"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchMemberInfo();
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      if (
        (formValues.password && !formValues.passwordConfirm) ||
        (!formValues.password && formValues.passwordConfirm)
      ) {
        throw new Error(
          "新しいパスワードと確認用パスワードを両方入力してください"
        );
      }

      if (formValues.password && formValues.passwordConfirm) {
        if (formValues.password !== formValues.passwordConfirm) {
          throw new Error("パスワードが一致しません");
        }

        if (!passwordRegex.test(formValues.password)) {
          throw new Error(
            "パスワードは英数字または記号を使用した8文字以上で入力してください"
          );
        }
      }

      const payload: Record<string, unknown> = {
        name: formValues.name.trim(),
        email: formValues.email.trim(),
        affiliation: formValues.affiliation.trim(),
      };

      if (formValues.affiliationDetail?.trim()) {
        payload.affiliationDetail = formValues.affiliationDetail.trim();
      }

      if (formValues.password) {
        payload.password = formValues.password;
      }

      const response = await fetch(apiUrl("/api/member/info"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || "メンバー情報の更新に失敗しました"
          );
        }

        throw new Error("メンバー情報の更新に失敗しました");
      }

      const updated = (await response.json()) as MemberResponse;
      
      if (updated.emailChangeRequested && updated.pendingEmail) {
        // メールアドレス変更確認が必要な場合
        setSuccess(
          `メンバー情報を更新しました。\n新しいメールアドレス（${updated.pendingEmail}）に確認メールを送信しました。メールを確認して変更を完了してください。`
        );
        // フォームは元のメールアドレスのままにする
        setFormValues({
          name: updated.name,
          email: updated.email,
          affiliation: updated.affiliation,
          affiliationDetail: updated.affiliationDetail ?? "",
          password: "",
          passwordConfirm: "",
        });
      } else {
        // メールアドレス変更がない場合は通常の更新
        setFormValues({
          name: updated.name,
          email: updated.email,
          affiliation: updated.affiliation,
          affiliationDetail: updated.affiliationDetail ?? "",
          password: "",
          passwordConfirm: "",
        });
        setSuccess("メンバー情報を更新しました");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "メンバー情報の更新に失敗しました"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange =
    (field: keyof MemberFormValues) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setFormValues((current) => ({
        ...current,
        [field]: event.target.value,
      }));
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-green-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.push("/member/dashboard")}
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            マイページに戻る
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            メンバー情報を編集
          </h1>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-primary-100">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 whitespace-pre-line">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                名前
              </label>
              <input
                type="text"
                value={formValues.name}
                onChange={handleChange("name")}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                メールアドレス
              </label>
              <input
                type="email"
                value={formValues.email}
                onChange={handleChange("email")}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                所属
              </label>
              <select
                value={formValues.affiliation}
                onChange={handleChange("affiliation")}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              >
                <option value="">選択してください</option>
                {affiliationOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
                {formValues.affiliation &&
                  !affiliationOptions.includes(formValues.affiliation) && (
                    <option value={formValues.affiliation}>
                      {formValues.affiliation}
                    </option>
                  )}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                所属詳細
              </label>
              <input
                type="text"
                value={formValues.affiliationDetail ?? ""}
                onChange={handleChange("affiliationDetail")}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="任意"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                新しいパスワード
              </label>
              <input
                type="password"
                value={formValues.password}
                onChange={handleChange("password")}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="変更しない場合は空欄のまま"
              />
              <p className="mt-1 text-xs text-gray-500">
                英数字または記号を使用した8文字以上で入力してください
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                新しいパスワード（確認）
              </label>
              <input
                type="password"
                value={formValues.passwordConfirm}
                onChange={handleChange("passwordConfirm")}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="変更しない場合は空欄のまま"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => router.push("/member/dashboard")}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
                disabled={submitting}
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="px-6 py-2 rounded-lg bg-gradient-to-r from-primary-500 to-primary-600 text-white font-medium shadow-md hover:from-primary-600 hover:to-primary-700 transition-all disabled:opacity-60"
                disabled={submitting}
              >
                {submitting ? "更新中..." : "更新する"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
