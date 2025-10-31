"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Html5Qrcode } from "html5-qrcode";
import { apiUrl } from "@/lib/api";

interface CheckIn {
  id: number;
  member_id: number;
  member_name: string;
  check_in_time: string;
  affiliation: string;
  affiliation_detail: string | null;
}

interface HourlyData {
  hour: number;
  affiliations: Record<string, number>;
  total: number;
}

export default function ScanPage() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [html5QrCode, setHtml5QrCode] = useState<Html5Qrcode | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [lastScannedTime, setLastScannedTime] = useState<number>(0);
  const [messageOpacity, setMessageOpacity] = useState(1);
  const [mirrorCamera, setMirrorCamera] = useState(false);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const processingRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const router = useRouter();

  // チェックイン一覧取得
  const fetchTodayCheckIns = async () => {
    try {
      const response = await fetch(apiUrl("/api/checkins/today"));
      if (response.ok) {
        const data = await response.json();
        setCheckIns(data);
      }
    } catch (err) {
      console.error("Failed to fetch check-ins:", err);
    }
  };

  // 認証チェックとカメラ自動起動
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
        // 認証完了後、自動的にカメラを起動
        setTimeout(() => {
          startScanning();
        }, 100);
        // チェックイン一覧を取得
        fetchTodayCheckIns();
      } catch (error) {
        console.error("Auth check error:", error);
        router.push("/admin/login");
      }
    };

    checkAuth();

    // 30秒ごとにチェックイン一覧を更新
    const interval = setInterval(fetchTodayCheckIns, 30000);
    return () => clearInterval(interval);
  }, [router]);

  useEffect(() => {
    return () => {
      if (html5QrCode?.isScanning) {
        html5QrCode.stop().catch((err) => {
          // Ignore cleanup errors - component is unmounting
          console.debug("QR scanner cleanup:", err);
        });
      }
      // Audio要素のクリーンアップ
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.src = "";
        } catch (e) {
          // クリーンアップエラーは無視
        }
        audioRef.current = null;
      }
    };
  }, [html5QrCode]);

  const startScanning = async () => {
    try {
      const qrCode = new Html5Qrcode("qr-reader");
      setHtml5QrCode(qrCode);

      await qrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        async (decodedText) => {
          // メッセージ処理中はスキャンを無視（refを使って同期的にチェック）
          if (processingRef.current) {
            return;
          }

          // 同じQRコードを3秒以内に連続スキャンしないようにする
          const now = Date.now();
          if (decodedText === lastScannedCode && now - lastScannedTime < 3000) {
            return;
          }

          // 最後にスキャンしたQRコードと時刻を記録
          setLastScannedCode(decodedText);
          setLastScannedTime(now);

          // チェックイン処理（カメラは停止しない）
          await handleCheckIn(decodedText);
        },
        () => {
          // スキャンエラーは無視（継続的にスキャン中）
        }
      );

      setScanning(true);
      setError(null);
    } catch (err: any) {
      // カメラアクセス許可が拒否された場合の詳細なエラーメッセージ
      let errorMessage = "カメラの起動に失敗しました";

      if (
        err?.name === "NotAllowedError" ||
        err?.message?.includes("Permission")
      ) {
        errorMessage =
          "カメラへのアクセスが拒否されました。ブラウザの設定でカメラの使用を許可してください。";
      } else if (err?.name === "NotFoundError") {
        errorMessage =
          "カメラが見つかりません。デバイスにカメラが接続されているか確認してください。";
      } else if (err?.name === "NotReadableError") {
        errorMessage =
          "カメラが他のアプリケーションで使用中です。他のアプリを閉じてから再試行してください。";
      }

      setError(errorMessage);
      console.warn("Camera access error:", err?.name || err?.message || err);
    }
  };

  const stopScanning = async () => {
    if (html5QrCode?.isScanning) {
      try {
        await html5QrCode.stop();
        setScanning(false);
      } catch (err) {
        console.error("Failed to stop scanner:", err);
        // Still update state even if stop fails
        setScanning(false);
      }
    }
  };

  const playSuccessSound = async () => {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
    const cacheBuster = `?t=${Date.now()}`; // キャッシュ回避

    // 既存のAudio要素をクリーンアップ
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.src = "";
      } catch (e) {
        // クリーンアップエラーは無視
      }
      audioRef.current = null;
    }

    // APIエンドポイント経由で音声を取得（カスタム音声またはデフォルト音声）
    try {
      const audio = new Audio();
      audioRef.current = audio;
      audio.src = `${basePath}/api/sounds/success${cacheBuster}`;

      // 音声の読み込みを待ってから再生
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("Load timeout")),
          5000
        );
        audio.addEventListener(
          "canplaythrough",
          () => {
            clearTimeout(timeout);
            resolve(true);
          },
          { once: true }
        );
        audio.addEventListener(
          "error",
          (e) => {
            clearTimeout(timeout);
            reject(e);
          },
          { once: true }
        );
        audio.load();
      });

      // 再生前にaudioRefがまだ有効かチェック
      if (audioRef.current === audio) {
        try {
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise.catch((e) => {
              // AbortError等の再生エラーは無視
              if (e.name !== "AbortError") {
                console.debug("Play interrupted:", e.name);
              }
            });
          }
        } catch (e) {
          // play()の同期的なエラーも無視
          console.debug("Play error:", e);
        }
      }
      return; // 再生成功したら終了
    } catch (e) {
      console.error("Failed to play success sound:", e);
      // エラー時はaudioRefをクリア
      audioRef.current = null;
    }

    // APIが失敗した場合のフォールバック: Web Audio APIで音を生成
    const audioContext = new AudioContext();
    const playTone = (
      frequency: number,
      startTime: number,
      duration: number,
      volume: number = 0.3
    ) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(volume, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };

    const now = audioContext.currentTime;
    // 「ピン」（E6 + G6）
    playTone(1318.51, now, 0.3, 0.2); // E6
    playTone(1567.98, now, 0.3, 0.2); // G6

    // 「ポーン」（C6 + E6）
    playTone(1046.5, now + 0.3, 0.5, 0.25); // C6
    playTone(1318.51, now + 0.3, 0.5, 0.25); // E6
  };

  const playErrorSound = async () => {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
    const cacheBuster = `?t=${Date.now()}`; // キャッシュ回避

    // 既存のAudio要素をクリーンアップ
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.src = "";
      } catch (e) {
        // クリーンアップエラーは無視
      }
      audioRef.current = null;
    }

    // APIエンドポイント経由で音声を取得（カスタム音声またはデフォルト音声）
    try {
      const audio = new Audio();
      audioRef.current = audio;
      audio.src = `${basePath}/api/sounds/error${cacheBuster}`;

      // 音声の読み込みを待ってから再生
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("Load timeout")),
          5000
        );
        audio.addEventListener(
          "canplaythrough",
          () => {
            clearTimeout(timeout);
            resolve(true);
          },
          { once: true }
        );
        audio.addEventListener(
          "error",
          (e) => {
            clearTimeout(timeout);
            reject(e);
          },
          { once: true }
        );
        audio.load();
      });

      // 再生前にaudioRefがまだ有効かチェック
      if (audioRef.current === audio) {
        try {
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise.catch((e) => {
              // AbortError等の再生エラーは無視
              if (e.name !== "AbortError") {
                console.debug("Play interrupted:", e.name);
              }
            });
          }
        } catch (e) {
          // play()の同期的なエラーも無視
          console.debug("Play error:", e);
        }
      }
      return; // 再生成功したら終了
    } catch (e) {
      console.error("Failed to play error sound:", e);
      // エラー時はaudioRefをクリア
      audioRef.current = null;
    }

    // APIが失敗した場合のフォールバック: Web Audio APIで音を生成
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 400;
    oscillator.type = "sine";

    const now = audioContext.currentTime;
    gainNode.gain.setValueAtTime(0.3, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    oscillator.start(now);
    oscillator.stop(now + 0.3);
  };

  const handleSearch = async (query: string) => {
    if (!query || query.trim().length === 0) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        apiUrl(`/api/admin/members/search?q=${encodeURIComponent(query)}`)
      );
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.members || []);
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      console.error("Search error:", err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleMemberSelect = (member: any) => {
    setSelectedMember(member);
    setShowConfirmDialog(true);
  };

  const handleCancelCheckIn = () => {
    setSelectedMember(null);
    setShowConfirmDialog(false);
  };

  const handleConfirmCheckIn = async () => {
    if (!selectedMember) return;

    // ダイアログを閉じる
    setShowConfirmDialog(false);

    // メッセージ処理開始
    processingRef.current = true;
    setSearchQuery("");
    setSearchResults([]);
    setSelectedMember(null);

    try {
      const response = await fetch(apiUrl("/api/checkin"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ memberId: selectedMember.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        playErrorSound();
        setError(data.error || "チェックインに失敗しました");
        setResult(null);
        setMessageOpacity(1);

        const fadeStart = Date.now();
        const fadeDuration = 3000;
        const fadeInterval = setInterval(() => {
          const elapsed = Date.now() - fadeStart;
          const opacity = Math.max(0, 1 - elapsed / fadeDuration);
          setMessageOpacity(opacity);

          if (opacity === 0) {
            clearInterval(fadeInterval);
            setError(null);
            setMessageOpacity(1);
            processingRef.current = false;
          }
        }, 50);

        return;
      }

      playSuccessSound();
      setResult(data.checkIn);
      setError(null);
      setMessageOpacity(1);
      fetchTodayCheckIns();

      const fadeStart = Date.now();
      const fadeDuration = 3000;
      const fadeInterval = setInterval(() => {
        const elapsed = Date.now() - fadeStart;
        const opacity = Math.max(0, 1 - elapsed / fadeDuration);
        setMessageOpacity(opacity);

        if (opacity === 0) {
          clearInterval(fadeInterval);
          setResult(null);
          setMessageOpacity(1);
          processingRef.current = false;
        }
      }, 50);
    } catch (err) {
      playErrorSound();
      setError(
        err instanceof Error ? err.message : "チェックインに失敗しました"
      );
      setResult(null);
      setMessageOpacity(1);

      const fadeStart = Date.now();
      const fadeDuration = 2000;
      const fadeInterval = setInterval(() => {
        const elapsed = Date.now() - fadeStart;
        const opacity = Math.max(0, 1 - elapsed / fadeDuration);
        setMessageOpacity(opacity);

        if (opacity === 0) {
          clearInterval(fadeInterval);
          setError(null);
          setMessageOpacity(1);
          processingRef.current = false;
        }
      }, 50);
    }
  };

  const handleCheckIn = async (qrCode: string) => {
    // メッセージ処理開始（refを使って即座に反映）
    processingRef.current = true;

    try {
      const response = await fetch(apiUrl("/api/checkin"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ qrCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        // エラー音を鳴らす
        playErrorSound();

        // エラーメッセージを設定（サーバーからのメッセージを優先）
        let errorMessage = data.error || "チェックインに失敗しました";

        // ステータスコード別のフォールバックメッセージ
        if (!data.error) {
          if (response.status === 404) {
            errorMessage = "登録されていないQRコードです";
          } else if (response.status === 429) {
            errorMessage = "既にチェックイン済みです";
          } else if (response.status === 400) {
            errorMessage = "QRコードが読み取れませんでした";
          } else if (response.status >= 500) {
            errorMessage = "サーバーエラーが発生しました";
          }
        }

        setError(errorMessage);
        setResult(null);
        setMessageOpacity(1);

        // フェードアウトアニメーション（3秒かけて透明に）
        const fadeStart = Date.now();
        const fadeDuration = 3000;
        const fadeInterval = setInterval(() => {
          const elapsed = Date.now() - fadeStart;
          const opacity = Math.max(0, 1 - elapsed / fadeDuration);
          setMessageOpacity(opacity);

          if (opacity === 0) {
            clearInterval(fadeInterval);
            setError(null);
            setMessageOpacity(1);
            processingRef.current = false;
          }
        }, 50);

        return;
      }

      // 成功音を鳴らす
      playSuccessSound();

      setResult(data.checkIn);
      setError(null);
      setMessageOpacity(1);

      // チェックイン一覧を即座に更新
      fetchTodayCheckIns();

      // フェードアウトアニメーション（3秒かけて透明に）
      const fadeStart = Date.now();
      const fadeDuration = 3000;
      const fadeInterval = setInterval(() => {
        const elapsed = Date.now() - fadeStart;
        const opacity = Math.max(0, 1 - elapsed / fadeDuration);
        setMessageOpacity(opacity);

        if (opacity === 0) {
          clearInterval(fadeInterval);
          setResult(null);
          setMessageOpacity(1);
          processingRef.current = false;
        }
      }, 50);
    } catch (err) {
      // エラー音を鳴らす
      playErrorSound();

      setError(
        err instanceof Error ? err.message : "チェックインに失敗しました"
      );
      setResult(null);
      setMessageOpacity(1);

      // フェードアウトアニメーション（2秒かけて透明に）
      const fadeStart = Date.now();
      const fadeDuration = 2000;
      const fadeInterval = setInterval(() => {
        const elapsed = Date.now() - fadeStart;
        const opacity = Math.max(0, 1 - elapsed / fadeDuration);
        setMessageOpacity(opacity);

        if (opacity === 0) {
          clearInterval(fadeInterval);
          setError(null);
          setMessageOpacity(1);
          processingRef.current = false;
        }
      }, 50);
    }
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-green-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">認証確認中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-green-50 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-primary-100">
          <div className="flex items-center justify-center gap-3 mb-6">
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
                  d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">
              QRコードスキャン
            </h1>
          </div>

          {/* カメラエリア */}
          <div className="mb-8 relative">
            <div
              id="qr-reader"
              className="w-full rounded-xl overflow-hidden"
              style={{ transform: mirrorCamera ? "scaleX(-1)" : "none" }}
            ></div>

            {/* 鏡像切り替えスイッチ */}
            <button
              onClick={() => setMirrorCamera(!mirrorCamera)}
              className="absolute top-2 right-2 p-2 bg-black/30 hover:bg-black/50 rounded-lg transition-colors"
              title="カメラを反転"
            >
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                />
              </svg>
            </button>

            {/* メッセージオーバーレイ */}
            {(result || error) && (
              <div
                className="absolute inset-0 flex items-center justify-center p-4 bg-black/50 rounded-xl"
                style={{
                  opacity: messageOpacity,
                  transition: "opacity 0.05s linear",
                }}
              >
                {/* チェックイン成功メッセージ */}
                {result && (
                  <div className="p-6 bg-white rounded-xl shadow-2xl max-w-md w-full">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center">
                        <svg
                          className="w-7 h-7 text-white"
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
                      <h2 className="text-2xl font-bold text-green-800">
                        チェックイン完了
                      </h2>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xl font-bold text-gray-900">
                        {result.memberName}
                      </p>
                      {result.company && (
                        <p className="text-base text-gray-700">
                          {result.company}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* エラーメッセージ */}
                {error && (
                  <div className="p-6 bg-white rounded-xl shadow-2xl max-w-md w-full">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg
                          className="w-7 h-7 text-white"
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
                      <p className="text-lg font-bold text-red-600">{error}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-3">
            {!scanning ? (
              <button
                onClick={startScanning}
                className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-primary-500 to-primary-600 text-white py-3 px-4 rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all shadow-md hover:shadow-lg font-medium"
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
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                スキャン開始
              </button>
            ) : (
              <button
                onClick={stopScanning}
                className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-red-500 to-red-600 text-white py-3 px-4 rounded-xl hover:from-red-600 hover:to-red-700 transition-all shadow-md hover:shadow-lg font-medium"
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
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
                  />
                </svg>
                スキャン停止
              </button>
            )}
          </div>

          {/* カメラエラーメッセージの常時表示エリア */}
          {error && !scanning && (
            <div className="mt-4 p-4 bg-red-50 rounded-xl border border-red-200">
              <div className="flex items-start gap-3">
                <svg
                  className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-800 mb-1">
                    カメラエラー
                  </p>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 p-4 bg-gradient-to-r from-primary-50 to-green-50 rounded-xl border border-primary-200">
            <div className="flex items-center gap-2 text-primary-700">
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
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm font-medium">
                QRコードをカメラに向けてください
              </p>
            </div>
          </div>

          {/* 検索でチェックイン */}
          <div className="mt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                名前・IDで検索
              </h2>
            </div>

            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  handleSearch(e.target.value);
                }}
                placeholder="名前またはIDを入力..."
                className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <svg
                className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>

            {/* 検索結果 */}
            {isSearching && (
              <div className="mt-4 p-4 text-center text-gray-500">
                検索中...
              </div>
            )}

            {!isSearching && searchResults.length > 0 && (
              <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
                {searchResults.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => handleMemberSelect(member)}
                    className="w-full p-4 bg-white border border-gray-200 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-all text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {member.name}
                        </p>
                        <p className="text-sm text-gray-600">
                          ID: {member.member_id}
                        </p>
                        {member.affiliation && (
                          <p className="text-sm text-gray-500">
                            {member.affiliation}
                          </p>
                        )}
                      </div>
                      <svg
                        className="w-6 h-6 text-primary-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!isSearching &&
              searchQuery.trim().length > 0 &&
              searchResults.length === 0 && (
                <div className="mt-4 p-4 bg-gray-50 rounded-xl text-center text-gray-500">
                  該当する会員が見つかりませんでした
                </div>
              )}
          </div>
        </div>

        {/* 確認ダイアログ */}
        {showConfirmDialog && selectedMember && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
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
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">
                  チェックイン確認
                </h2>
              </div>

              <div className="space-y-3 mb-6">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-600 mb-1">氏名</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {selectedMember.name}
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-600 mb-1">会員ID</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {selectedMember.member_id}
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-600 mb-1">所属</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {selectedMember.affiliation || "未設定"}
                  </p>
                </div>

                {selectedMember.affiliation_detail && (
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-sm text-gray-600 mb-1">所属詳細</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {selectedMember.affiliation_detail}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCancelCheckIn}
                  className="flex-1 py-3 px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-xl transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleConfirmCheckIn}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-medium rounded-xl transition-all shadow-md hover:shadow-lg"
                >
                  チェックイン
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
