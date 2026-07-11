"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Html5Qrcode } from "html5-qrcode";
import { apiUrl } from "@/lib/api";
import { useWebUSBFeliCa } from "@/app/hooks/useWebUSBFeliCa";

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
  minute: number;
  timeLabel: string;
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
  const [mirrorCamera, setMirrorCamera] = useState(true);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const processingRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const router = useRouter();

  // WebUSB FeliCa フック
  const { status: nfcStatus, connect: connectNfc, readIdm: readNfcIdm, disconnect: disconnectNfc, errorMessage: nfcError, isPolling: nfcIsPolling } = useWebUSBFeliCa();
  const nfcLoopActiveRef = useRef(false);
  const [unregisteredNfcId, setUnregisteredNfcId] = useState<string | null>(null);
  const [showNfcRegisterModal, setShowNfcRegisterModal] = useState(false);
  const [nfcMemberSearchQuery, setNfcMemberSearchQuery] = useState("");
  const [nfcMemberSearchResults, setNfcMemberSearchResults] = useState<any[]>([]);
  const [isNfcMemberSearching, setIsNfcMemberSearching] = useState(false);
  const [successDisplaySeconds, setSuccessDisplaySeconds] = useState(10);

  // 設定情報（チェックイン表示時間など）を取得
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch(apiUrl("/api/settings"));
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.settings && typeof data.settings.successDisplaySeconds === "number") {
            setSuccessDisplaySeconds(data.settings.successDisplaySeconds);
          }
        }
      } catch (err) {
        console.error("Failed to fetch settings:", err);
      }
    };
    fetchSettings();
  }, []);

  // 時間帯別の所属別データを集計（13:00以前、13:00-18:00、18:00以降）
  const getHourlyData = (): HourlyData[] => {
    const before13Map: Record<string, number> = {};
    const hourlyMap = new Map<number, Record<string, number>>();
    const after18Map: Record<string, number> = {};

    checkIns.forEach((checkIn) => {
      // UTCで保存されたタイムスタンプをJSTに変換
      const date = new Date(checkIn.check_in_time + "Z");
      const jstDate = new Date(
        date.toLocaleString("en-US", { timeZone: "Asia/Tokyo" })
      );
      const hour = jstDate.getHours();
      const affiliation = checkIn.affiliation || "未設定";

      if (hour < 13) {
        // 13:00以前
        before13Map[affiliation] = (before13Map[affiliation] || 0) + 1;
      } else if (hour <= 18) {
        // 13:00-18:00
        if (!hourlyMap.has(hour)) {
          hourlyMap.set(hour, {});
        }
        const affiliations = hourlyMap.get(hour)!;
        affiliations[affiliation] = (affiliations[affiliation] || 0) + 1;
      } else {
        // 18:00以降
        after18Map[affiliation] = (after18Map[affiliation] || 0) + 1;
      }
    });

    const result: HourlyData[] = [];

    // 13:00以前のデータ
    const before13Total = Object.values(before13Map).reduce(
      (sum, count) => sum + count,
      0
    );
    result.push({
      hour: 0,
      minute: 0,
      timeLabel: "~",
      affiliations: before13Map,
      total: before13Total,
    });

    // 13時から18時までのデータを生成
    for (let hour = 13; hour <= 18; hour++) {
      const affiliations = hourlyMap.get(hour) || {};
      const total = Object.values(affiliations).reduce(
        (sum, count) => sum + count,
        0
      );
      result.push({
        hour,
        minute: 0,
        timeLabel: `${hour}:00`,
        affiliations,
        total,
      });
    }

    // 18:00以降のデータ
    const after18Total = Object.values(after18Map).reduce(
      (sum, count) => sum + count,
      0
    );
    result.push({
      hour: 19,
      minute: 0,
      timeLabel: "~",
      affiliations: after18Map,
      total: after18Total,
    });

    return result;
  };

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

  // NFC読み取りループ
  // nfcStatus が 'connected' になったときだけ起動。ループ中は nfcStatus が変わらないため cleanup も発火しない。
  useEffect(() => {
    if (nfcStatus !== 'connected') {
      // connected 以外になった場合はループを止める
      nfcLoopActiveRef.current = false;
      return;
    }
    if (nfcLoopActiveRef.current) {
      // すでにループが走っていれば二重起動しない
      return;
    }

    nfcLoopActiveRef.current = true;

    const startNfcReadLoop = async () => {
      try {
        while (nfcLoopActiveRef.current) {
          // 他のモーダルやダイアログが表示中の場合は待機
          if (processingRef.current || showNfcRegisterModalRef.current || showConfirmDialogRef.current) {
            await new Promise(resolve => setTimeout(resolve, 300));
            continue;
          }

          const idm = await readNfcIdm();

          // ループが止まっていたら処理しない
          if (!nfcLoopActiveRef.current) break;

          if (idm) {
            const now = Date.now();
            // 設定された秒数以内の連続読み取り防止
            if (idm === lastScannedCode && now - lastScannedTime < successDisplaySeconds * 1000) {
              await new Promise(resolve => setTimeout(resolve, 500));
              continue;
            }

            setLastScannedCode(idm);
            setLastScannedTime(now);

            // チェックイン処理を実行
            await handleCheckIn(undefined, idm);
          } else {
            // idm が null（エラー or カードなし）の場合は少し待って再試行
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      } catch (e) {
        console.error("NFC read loop error:", e);
      } finally {
        nfcLoopActiveRef.current = false;
      }
    };

    startNfcReadLoop();

    // cleanup: connected から外れたときはループを止める
    return () => {
      nfcLoopActiveRef.current = false;
    };
  }, [nfcStatus]); // nfcStatus だけを依存配列に入れる（ポーリング中に変化しないため cleanup が不要に発火しない）

  // showNfcRegisterModal / showConfirmDialog はループ内で参照するため ref で追跡
  const showNfcRegisterModalRef = useRef(showNfcRegisterModal);
  useEffect(() => { showNfcRegisterModalRef.current = showNfcRegisterModal; }, [showNfcRegisterModal]);
  const showConfirmDialogRef = useRef(showConfirmDialog);
  useEffect(() => { showConfirmDialogRef.current = showConfirmDialog; }, [showConfirmDialog]);


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

  const handleNfcMemberSearch = async (query: string) => {
    if (!query || query.trim().length === 0) {
      setNfcMemberSearchResults([]);
      return;
    }

    setIsNfcMemberSearching(true);
    try {
      const response = await fetch(
        apiUrl(`/api/admin/members/search?q=${encodeURIComponent(query)}`)
      );
      if (response.ok) {
        const data = await response.json();
        setNfcMemberSearchResults(data.members || []);
      }
    } catch (e) {
      console.error("NFC Member search error:", e);
    } finally {
      setIsNfcMemberSearching(false);
    }
  };

  const handleAssociateNfcCard = async (member: any) => {
    if (!unregisteredNfcId) return;

    try {
      // 1. NFCカードをメンバーに登録
      const response = await fetch(apiUrl(`/api/admin/members/${member.id}/nfc-cards`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nfcId: unregisteredNfcId,
          cardName: "NFCカード"
        })
      });

      const data = await response.json();
      if (!response.ok) {
        alert(data.message || "カードの登録に失敗しました");
        return;
      }

      // モーダルを閉じる
      setShowNfcRegisterModal(false);
      setUnregisteredNfcId(null);
      setNfcMemberSearchQuery("");
      setNfcMemberSearchResults([]);

      // 2. そのままチェックインを実行
      await handleCheckIn(undefined, data.card.nfc_id);
    } catch (e) {
      console.error(e);
      alert("通信エラーが発生しました");
    }
  };

  const handleCheckIn = async (qrCode?: string, nfcId?: string) => {
    // メッセージ処理開始（refを使って即座に反映）
    processingRef.current = true;

    try {
      const response = await fetch(apiUrl("/api/checkin"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ qrCode, nfcId }),
      });

      const data = await response.json();

      if (!response.ok) {
        // エラー音を鳴らす
        playErrorSound();

        // 未登録のNFCカードの場合は、メンバー紐付けモーダルを表示する
        if (response.status === 404 && data.unregisteredNfcId) {
          setUnregisteredNfcId(data.unregisteredNfcId);
          setShowNfcRegisterModal(true);
          processingRef.current = false;
          return;
        }

        // エラーメッセージを設定（サーバーからのメッセージを優先）
        let errorMessage = data.error || "チェックインに失敗しました";

        // ステータスコード別のフォールバックメッセージ
        if (!data.error) {
          if (response.status === 404) {
            errorMessage = "登録されていないQRコードまたはNFCカードです";
          } else if (response.status === 429) {
            errorMessage = "既にチェックイン済みです";
          } else if (response.status === 400) {
            errorMessage = "IDが読み取れませんでした";
          } else if (response.status >= 500) {
            errorMessage = "サーバーエラーが発生しました";
          }
        }

        setError(errorMessage);
        setResult(null);
        setMessageOpacity(1);

        // フェードアウトアニメーション
        const fadeStart = Date.now();
        const fadeDuration = successDisplaySeconds * 1000;
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

      setResult({ ...data.checkIn, action: data.action });
      setError(null);
      setMessageOpacity(1);

      // チェックイン一覧を即座に更新
      fetchTodayCheckIns();

      // フェードアウトアニメーション
      const fadeStart = Date.now();
      const fadeDuration = successDisplaySeconds * 1000;
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

  const hourlyData = getHourlyData();
  const allAffiliations = Array.from(
    new Set(checkIns.map((c) => c.affiliation || "未設定"))
  );
  const actualMaxCount = Math.max(...hourlyData.map((d) => d.total), 0);
  // デフォルト10人、それ以上なら実際の最大値を使用
  const maxCount = actualMaxCount > 10 ? actualMaxCount : 10;

  // 現在時刻を取得
  const currentHour = new Date().getHours();

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
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左側: QRスキャンエリア */}
          <div className="lg:col-span-2 bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-primary-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center">
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
                    d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                チェックインスキャン
              </h2>
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

              {/* カメラエリア内オーバーレイは削除（ページルートに移動） */}
            </div>

            {!scanning && (
              <div className="space-y-3">
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
              </div>
            )}

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

            {/* NFCリーダー接続状態 */}
            <div className="mt-6 p-4 rounded-xl border flex items-center justify-between bg-gray-50/50 border-gray-200">
              <div className="flex items-center gap-2.5">
                <div className={`w-3.5 h-3.5 rounded-full ${
                  nfcIsPolling ? 'bg-blue-500 animate-ping' :
                  nfcStatus === 'connected' ? 'bg-green-500 animate-pulse' :
                  nfcStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                  'bg-gray-400'
                }`} />
                <div>
                  <h3 className="text-sm font-bold text-gray-800">NFCカードリーダー</h3>
                  <p className="text-xs text-gray-500 font-medium">
                    {nfcStatus === 'idle' && '未接続（タッチチェックインには接続が必要です）'}
                    {nfcStatus === 'connecting' && 'リーダーに接続しています...'}
                    {nfcStatus === 'connected' && !nfcIsPolling && '接続完了（自動読み取り中：カードをかざしてください）'}
                    {nfcIsPolling && 'カード読み取り中...'}
                    {nfcStatus === 'error' && `接続エラーが発生しました。${nfcError ? `(${nfcError})` : '再度お試しください。'}`}
                  </p>
                </div>
              </div>
              
              {nfcStatus !== 'connected' ? (
                <button
                  onClick={connectNfc}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all whitespace-nowrap"
                >
                  PaSoriを接続
                </button>
              ) : (
                <button
                  onClick={disconnectNfc}
                  className="px-3.5 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-xs font-semibold transition-all whitespace-nowrap"
                >
                  接続解除
                </button>
              )}
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

          {/* 右側: 本日のチェックイングラフ */}
          <div className="lg:col-span-1 bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-primary-100">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-white"
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
              <h2 className="text-lg font-bold text-gray-900">
                本日のチェックイン
              </h2>
              <span className="ml-auto text-xl font-bold text-primary-600">
                {checkIns.length}人
              </span>
            </div>

            {checkIns.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <svg
                  className="w-12 h-12 mx-auto mb-2 text-gray-300"
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
                <p className="text-xs">まだチェックインはありません</p>
              </div>
            ) : (
              <div>
                {/* 凡例 */}
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {allAffiliations.map((affiliation, index) => (
                    <div key={affiliation} className="flex items-center gap-1">
                      <div
                        className={`w-2.5 h-2.5 rounded ${getColor(index)}`}
                      ></div>
                      <span className="text-xs text-gray-700">
                        {affiliation}
                      </span>
                    </div>
                  ))}
                </div>

                {/* ヒストグラム */}
                <div className="bg-white/50 rounded-xl border border-primary-100 p-3">
                  <div className="flex gap-2">
                    {/* Y軸スケール */}
                    <div className="flex flex-col justify-between h-48 text-xs text-gray-600 font-medium pr-1.5 border-r border-gray-300">
                      <div>{maxCount}</div>
                      <div>{Math.floor(maxCount * 0.75)}</div>
                      <div>{Math.floor(maxCount * 0.5)}</div>
                      <div>{Math.floor(maxCount * 0.25)}</div>
                      <div>0</div>
                    </div>
                    {/* グラフ本体 */}
                    <div className="flex-1 flex items-end gap-0.5 h-48">
                      {hourlyData.map((data, idx) => {
                        // 現在時刻かどうかを判定
                        const isCurrentHour = data.hour === currentHour;
                        
                        return (
                          <div
                            key={`${data.hour}-${data.minute}`}
                            className={`flex-1 flex flex-col items-center gap-0.5 ${
                              isCurrentHour ? "relative" : ""
                            }`}
                          >
                            {/* 現在時刻のバックグラウンド強調 */}
                            {isCurrentHour && (
                              <div className="absolute inset-x-0 top-0 bottom-0 bg-yellow-100/50 rounded-lg -z-10"></div>
                            )}
                            <div
                              className="w-full relative"
                              style={{ height: "192px" }}
                            >
                              <div className="absolute bottom-0 left-0 right-0 flex flex-col">
                                {allAffiliations.map((affiliation, index) => {
                                  const count =
                                    data.affiliations[affiliation] || 0;
                                  if (count === 0) return null;
                                  const heightPx =
                                    maxCount > 0 ? (count / maxCount) * 192 : 0;
                                  return (
                                    <div
                                      key={affiliation}
                                      className={`w-full ${getColor(
                                        index
                                      )} transition-all hover:opacity-80 relative group ${
                                        isCurrentHour ? "ring-2 ring-yellow-400" : ""
                                      }`}
                                      style={{ height: `${heightPx}px` }}
                                      title={`${data.timeLabel}: ${affiliation} ${count}人`}
                                    >
                                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="text-xs text-white font-bold bg-black/50 px-0.5 rounded">
                                          {count}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            <div
                              className={`text-xs font-medium ${
                                isCurrentHour
                                  ? "text-yellow-700 font-bold"
                                  : "text-gray-600"
                              }`}
                            >
                              {data.timeLabel}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
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

        {/* 未登録NFCカード登録・紐付けモーダル */}
        {showNfcRegisterModal && unregisteredNfcId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                未登録のNFCカード検出
              </h2>
              <p className="text-sm text-gray-500 mb-4 font-mono">
                NFC ID: {unregisteredNfcId}
              </p>
              <p className="text-sm text-gray-600 mb-4">
                このカードを登録するメンバーを検索して選択してください。
              </p>

              {/* 検索入力 */}
              <div className="mb-4">
                <input
                  type="text"
                  value={nfcMemberSearchQuery}
                  onChange={(e) => {
                    setNfcMemberSearchQuery(e.target.value);
                    handleNfcMemberSearch(e.target.value);
                  }}
                  placeholder="名前、所属、メンバーIDで検索"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              {/* 検索結果 */}
              <div className="max-h-48 overflow-y-auto mb-4 border rounded-lg divide-y bg-gray-50/50">
                {isNfcMemberSearching ? (
                  <div className="text-center py-4 text-sm text-gray-500">検索中...</div>
                ) : nfcMemberSearchResults.length === 0 ? (
                  <div className="text-center py-4 text-sm text-gray-500">
                    {nfcMemberSearchQuery ? "見つかりませんでした" : "キーワードを入力してください"}
                  </div>
                ) : (
                  nfcMemberSearchResults.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => handleAssociateNfcCard(m)}
                      className="w-full text-left p-3 hover:bg-blue-50 flex flex-col transition-colors text-sm"
                    >
                      <span className="font-semibold text-gray-900">{m.name}</span>
                      <span className="text-xs text-gray-500">
                        ID: {m.member_id} | {m.affiliation} {m.affiliation_detail}
                      </span>
                    </button>
                  ))
                )}
              </div>

              {/* アクションボタン */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowNfcRegisterModal(false);
                    setUnregisteredNfcId(null);
                    setNfcMemberSearchQuery("");
                    setNfcMemberSearchResults([]);
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 管理者ダッシュボードへのリンク */}
        <div className="mt-6 text-center">
          <a
            href="/admin/dashboard"
            className="text-sm text-gray-500 hover:text-gray-700 underline transition-colors"
          >
            管理
          </a>
        </div>
      </div>
      {/* チェックイン結果オーバーレイ（全画面・transform親要素の外に配置） */}
      {(result || error) && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          style={{
            opacity: messageOpacity,
            transition: "opacity 0.05s linear",
          }}
        >
          {/* チェックイン/チェックアウト成功メッセージ */}
          {result && (
            <div className={`p-8 bg-white rounded-2xl shadow-2xl max-w-md w-full border ${
              result.action === 'checkin' ? 'border-green-100' : 'border-blue-100'
            }`}>
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-14 h-14 bg-gradient-to-br ${
                  result.action === 'checkin' 
                    ? 'from-green-500 to-green-600 shadow-green-100' 
                    : 'from-blue-500 to-blue-600 shadow-blue-100'
                } rounded-full flex items-center justify-center shadow-lg`}>
                  {result.action === 'checkin' ? (
                    <svg
                      className="w-8 h-8 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-8 h-8 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                  )}
                </div>
                <div>
                  <span className={`text-sm font-semibold tracking-wider uppercase block ${
                    result.action === 'checkin' ? 'text-green-600' : 'text-blue-600'
                  }`}>
                    {result.action === 'checkin' 
                      ? 'Checkin Success' 
                      : result.action === 'checkout_extension' 
                        ? 'Checkout Updated' 
                        : 'Checkout Success'}
                  </span>
                  <h2 className="text-2xl font-black text-gray-900 leading-tight">
                    {result.action === 'checkin' 
                      ? 'チェックイン完了' 
                      : result.action === 'checkout_extension' 
                        ? 'チェックアウト更新' 
                        : 'チェックアウト完了'}
                  </h2>
                </div>
              </div>
              <div className="space-y-2 border-t pt-4 mt-2">
                <p className="text-2xl font-black text-gray-900">
                  {result.memberName}
                </p>
                {result.affiliation && (
                  <p className="text-lg font-bold text-gray-700">
                    {result.affiliation}
                  </p>
                )}
                {result.action !== 'checkin' && result.stayDurationMinutes !== undefined && result.stayDurationMinutes !== null && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-xl border border-blue-100 flex justify-between items-center">
                    <span className="text-sm font-bold text-blue-700">滞在時間</span>
                    <span className="text-lg font-black text-blue-900">
                      {(() => {
                        const mins = result.stayDurationMinutes;
                        if (mins < 60) return `${mins}分`;
                        const hrs = Math.floor(mins / 60);
                        const rMins = mins % 60;
                        return rMins > 0 ? `${hrs}時間${rMins}分` : `${hrs}時間`;
                      })()}
                    </span>
                  </div>
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
  );
}
