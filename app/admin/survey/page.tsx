'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { apiUrl } from '@/lib/api';
import { SURVEY_QUESTION, SURVEY_OTHER_OPTION } from '@/lib/survey-config';

interface ChartItem {
  label: string;
  count: number;
}

interface SurveyStats {
  total: number;
  noAnswerCount: number;
  chartData: ChartItem[];
  otherTexts: string[];
}

export default function SurveyPage() {
  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [stats, setStats] = useState<SurveyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const res = await fetch(apiUrl(`/api/admin/survey?${params.toString()}`));
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setStats(data);
    } catch {
      setError('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleDownload = () => {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    // BASE_PATH を考慮した URL を直接構築
    const base = apiUrl('/api/admin/survey/export');
    const url = params.toString() ? `${base}?${params.toString()}` : base;
    window.location.href = url;
  };

  const maxCount = stats ? Math.max(...stats.chartData.map((d) => d.count), 1) : 1;
  const answeredCount = stats ? stats.total - stats.noAnswerCount : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">

        {/* ヘッダー */}
        <div className="mb-6">
          <Link href="/admin/dashboard" className="text-sm text-blue-600 hover:text-blue-500">
            ← 管理者ダッシュボードに戻る
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">アンケート集計</h1>
          <p className="mt-1 text-sm text-gray-600">{SURVEY_QUESTION}</p>
        </div>

        {/* 期間フィルタ */}
        <div className="bg-white shadow rounded-lg p-5 mb-6">
          <h2 className="text-sm font-medium text-gray-700 mb-3">期間を指定</h2>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">開始日</label>
              <input
                type="date"
                value={startDate}
                max={endDate || today}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">終了日</label>
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                max={today}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              クリア
            </button>
            <button
              onClick={handleDownload}
              className="ml-auto px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              CSVダウンロード
            </button>
          </div>
        </div>

        {/* 集計結果 */}
        <div className="bg-white shadow rounded-lg p-5">
          {loading && (
            <p className="text-center text-gray-500 py-8">読み込み中...</p>
          )}
          {error && (
            <p className="text-center text-red-500 py-8">{error}</p>
          )}
          {!loading && !error && stats && (
            <>
              {/* サマリ */}
              <div className="flex gap-6 mb-6">
                <div>
                  <p className="text-xs text-gray-500">総回答数（登録者数）</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">アンケート回答あり</p>
                  <p className="text-2xl font-bold text-gray-900">{answeredCount}</p>
                </div>
                {stats.noAnswerCount > 0 && (
                  <div>
                    <p className="text-xs text-gray-500">未回答</p>
                    <p className="text-2xl font-bold text-gray-400">{stats.noAnswerCount}</p>
                  </div>
                )}
              </div>

              {/* 棒グラフ */}
              {answeredCount === 0 ? (
                <p className="text-center text-gray-400 py-8">
                  {stats.total === 0 ? 'データがありません' : 'アンケート回答がありません'}
                </p>
              ) : (
                <div className="space-y-3">
                  {stats.chartData.map((item) => {
                    const pct = Math.round((item.count / maxCount) * 100);
                    const answerPct = answeredCount > 0
                      ? Math.round((item.count / answeredCount) * 100)
                      : 0;
                    const isOther = item.label === SURVEY_OTHER_OPTION;
                    return (
                      <div key={item.label}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-700 w-36 shrink-0">{item.label}</span>
                          <span className="text-sm font-medium text-gray-900 ml-2">
                            {item.count}件
                            <span className="text-xs text-gray-400 ml-1">({answerPct}%)</span>
                          </span>
                        </div>
                        <div className="h-5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {isOther && stats.otherTexts.length > 0 && (
                          <ul className="mt-2 ml-2 space-y-1">
                            {stats.otherTexts.map((text, i) => (
                              <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                                <span className="text-gray-400 shrink-0">・</span>
                                <span>{text}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
