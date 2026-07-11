"use client";

import { useState, useEffect } from "react";
import { apiUrl } from "@/lib/api";

interface CheckIn {
  id: number;
  member_id: number;
  member_id_str: string | null;
  check_in_time: string;
  affiliation: string | null;
  check_out_time: string | null;
}

interface HourlyData {
  hour: number;
  affiliations: Record<string, number>;
  total: number;
}

export default function DashboardPage() {
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTodayCheckIns();
    // 30秒ごとに更新
    const interval = setInterval(fetchTodayCheckIns, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchTodayCheckIns = async () => {
    try {
      const response = await fetch(apiUrl("/api/checkins/today"));
      if (!response.ok) {
        throw new Error("データの取得に失敗しました");
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

  // 1時間毎の所属別データを集計
  const getHourlyData = (): HourlyData[] => {
    const hourlyMap = new Map<number, Record<string, number>>();

    checkIns.forEach((checkIn) => {
      // UTCで保存されたタイムスタンプをJSTに変換
      const date = new Date(checkIn.check_in_time + "Z");
      // JSTの時間を取得
      const hour = new Date(
        date.toLocaleString("en-US", { timeZone: "Asia/Tokyo" })
      ).getHours();
      const affiliation = checkIn.affiliation || "未設定";

      if (!hourlyMap.has(hour)) {
        hourlyMap.set(hour, {});
      }

      const affiliations = hourlyMap.get(hour)!;
      affiliations[affiliation] = (affiliations[affiliation] || 0) + 1;
    });

    // 0時から23時までのデータを生成
    const result: HourlyData[] = [];
    for (let hour = 0; hour < 24; hour++) {
      const affiliations = hourlyMap.get(hour) || {};
      const total = Object.values(affiliations).reduce(
        (sum, count) => sum + count,
        0
      );
      result.push({ hour, affiliations, total });
    }

    return result;
  };

  const hourlyData = getHourlyData();
  const allAffiliations = Array.from(
    new Set(checkIns.map((c) => c.affiliation || "未設定"))
  );
  const actualMaxCount = Math.max(...hourlyData.map((d) => d.total), 0);
  // デフォルト10人、それ以上なら実際の最大値を使用
  const maxCount = actualMaxCount > 10 ? actualMaxCount : 10;

  // 所属ごとの色を生成
  const getColor = (index: number) => {
    const colors = [
      "bg-blue-500",
      "bg-green-500",
      "bg-yellow-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-indigo-500",
      "bg-red-500",
      "bg-orange-500",
      "bg-teal-500",
      "bg-cyan-500",
    ];
    return colors[index % colors.length];
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="text-center">
          <p className="text-gray-600">読み込み中...</p>
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
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">
              本日のチェックイン
            </h1>
          </div>
          <button
            onClick={fetchTodayCheckIns}
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

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl p-6 text-center shadow-lg">
            <p className="text-sm text-primary-100 mb-2 font-medium">
              本日の延べ利用者数
            </p>
            <p className="text-5xl font-bold text-white">{checkIns.length}人</p>
          </div>
          <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-2xl p-6 text-center shadow-lg">
            <p className="text-sm text-teal-100 mb-2 font-medium">
              現在の在室者数
            </p>
            <p className="text-5xl font-bold text-white">
              {checkIns.filter(c => !c.check_out_time).length}人
            </p>
          </div>
        </div>

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
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
            </div>
            <p className="text-gray-500">本日のチェックインはまだありません</p>
          </div>
        ) : (
          <div>
            {/* 凡例 */}
            <div className="mb-6 flex flex-wrap gap-3">
              {allAffiliations.map((affiliation, index) => (
                <div key={affiliation} className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded ${getColor(index)}`}></div>
                  <span className="text-sm text-gray-700">{affiliation}</span>
                </div>
              ))}
            </div>

            {/* ヒストグラム */}
            <div className="bg-white/50 rounded-xl border border-primary-100 p-6">
              <div className="flex gap-4">
                {/* Y軸スケール */}
                <div className="flex flex-col justify-between h-80 text-xs text-gray-600 font-medium pr-2 border-r border-gray-300">
                  <div>{maxCount}人</div>
                  <div>{Math.floor(maxCount * 0.75)}人</div>
                  <div>{Math.floor(maxCount * 0.5)}人</div>
                  <div>{Math.floor(maxCount * 0.25)}人</div>
                  <div>0人</div>
                </div>
                {/* グラフ本体 */}
                <div className="flex-1 flex items-end gap-1 h-80">
                  {hourlyData.map((data) => (
                    <div
                      key={data.hour}
                      className="flex-1 flex flex-col items-center gap-2"
                    >
                      <div
                        className="w-full relative"
                        style={{ height: "320px" }}
                      >
                        <div className="absolute bottom-0 left-0 right-0 flex flex-col gap-0.5">
                          {allAffiliations.map((affiliation, index) => {
                            const count = data.affiliations[affiliation] || 0;
                            if (count === 0) return null; // count が 0 の場合は何も表示しない
                            const heightPx =
                              maxCount > 0 ? (count / maxCount) * 320 : 0;
                            return (
                              <div
                                key={affiliation}
                                className={`w-full ${getColor(
                                  index
                                )} transition-all hover:opacity-80 relative group`}
                                style={{ height: `${heightPx}px` }}
                                title={`${data.hour}時: ${affiliation} ${count}人`}
                              >
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <span className="text-xs text-white font-bold bg-black/50 px-1 rounded">
                                    {count}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="text-xs text-gray-600 font-medium">
                        {data.hour}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
