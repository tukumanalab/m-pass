import { NextResponse } from 'next/server';
import { getClientIP } from './auth';

// 公開APIの簡易レート制限（メモリ上で管理）
// PM2 は fork モード・1インスタンスで動かしているため、プロセス内のカウンタで足りる。
// 再起動するとカウンタはリセットされる。

const buckets = new Map<string, number[]>();
let lastSweep = Date.now();

/**
 * key に対する直近 windowMs 内の試行回数が limit 未満なら記録して true を返す。
 * 上限に達していれば記録せず false を返す。
 */
export function consumeRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now);
  const recent = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    buckets.set(key, recent);
    return false;
  }
  recent.push(now);
  buckets.set(key, recent);
  return true;
}

// 古いキーを定期的に掃除してメモリを増やし続けないようにする
function sweep(now: number) {
  const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
  const MAX_WINDOW_MS = 24 * 60 * 60 * 1000;
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, times] of buckets) {
    if (times.length === 0 || now - times[times.length - 1] > MAX_WINDOW_MS) {
      buckets.delete(key);
    }
  }
}

interface RateLimitRule {
  /** カウンタの名前空間（API名など） */
  scope: string;
  limit: number;
  windowMs: number;
  /** 指定するとIPではなくこの値（メールアドレス・会員IDなど）単位で数える */
  subject?: string;
}

/**
 * ルールを順に評価し、どれか1つでも上限に達していれば 429 レスポンスを返す。
 * 問題なければ null を返す。
 */
export async function checkRateLimits(rules: RateLimitRule[]): Promise<NextResponse | null> {
  const ip = await getClientIP({ log: false });
  for (const rule of rules) {
    const id = rule.subject !== undefined ? `s:${rule.subject.trim().toLowerCase()}` : `ip:${ip}`;
    if (!consumeRateLimit(`${rule.scope}:${id}`, rule.limit, rule.windowMs)) {
      return NextResponse.json(
        { error: '短時間にリクエストが集中しています。しばらく時間をおいて再度お試しください。' },
        { status: 429 }
      );
    }
  }
  return null;
}

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
