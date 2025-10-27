import { NextRequest, NextResponse } from 'next/server';
import { findMemberByQRCode, createCheckInWithTime } from '@/lib/database';

// CSV形式でチェックイン履歴を一括登録
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { csvData } = body;

    if (!csvData || typeof csvData !== 'string') {
      return NextResponse.json({ error: 'CSV data is required' }, { status: 400 });
    }

    // RFC 4180準拠のCSVパーサー
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            // エスケープされたダブルクォート
            current += '"';
            i++; // 次の文字をスキップ
          } else {
            // クォートの開始/終了
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          // フィールドの区切り（全角・半角スペース、タブ、改行などを削除）
          result.push(current.replace(/^[\s\u3000]+|[\s\u3000]+$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }

      // 最後のフィールドを追加（全角・半角スペース、タブ、改行などを削除）
      result.push(current.replace(/^[\s\u3000]+|[\s\u3000]+$/g, ''));

      return result;
    };

    // BOMを削除し、改行コードを統一（\r\n と \n の両方に対応）
    const cleanCSV = csvData.replace(/^\uFEFF/, '');
    const cleanedLines = cleanCSV.trim().split(/\r?\n/);

    if (cleanedLines.length < 2) {
      return NextResponse.json({ error: 'CSV must contain header and at least one data row' }, { status: 400 });
    }

    // ヘッダー行を検証（スペースを除去して比較）
    const expectedHeaders = ['timestamp', 'qr_code'];
    const headerFields = parseCSVLine(cleanedLines[0]);

    // ヘッダーの空白文字を全て削除して正規化
    const normalizedHeaders = headerFields.map(h => h.replace(/\s+/g, ''));
    const isValidHeader = expectedHeaders.every((h, i) => normalizedHeaders[i] === h.replace(/\s+/g, ''));

    if (!isValidHeader) {
      return NextResponse.json({
        error: `Invalid CSV header. Expected: ${expectedHeaders.join(',')}. Got: ${headerFields.join(',')}`
      }, { status: 400 });
    }

    const successRows: Array<{
      dateTime: string;
      qrCode: string;
    }> = [];

    const failedRows: Array<{
      row: number;
      data: string;
      error: string;
    }> = [];

    // データ行を処理
    for (let i = 1; i < cleanedLines.length; i++) {
      const line = cleanedLines[i].trim();
      if (!line) continue; // 空行をスキップ

      try {
        const fields = parseCSVLine(line);

        if (fields.length < 2) {
          failedRows.push({
            row: i + 1,
            data: line,
            error: '列数が不足しています',
          });
          continue;
        }

        const [dateTimeStr, qrCode] = fields;

        // 必須フィールドのチェック
        if (!dateTimeStr || !qrCode) {
          failedRows.push({
            row: i + 1,
            data: line,
            error: 'timestamp、qr_codeは必須です',
          });
          continue;
        }

        // メンバーをQRコードで検索
        const member = findMemberByQRCode(qrCode) as { id: number } | undefined;

        if (!member) {
          failedRows.push({
            row: i + 1,
            data: line,
            error: `QRコード「${qrCode}」のメンバーが見つかりません`,
          });
          continue;
        }

        // 日時をパース（YYYY/MM/DD HH:mm:ss または YYYY/MM/DD 形式）
        let checkInTime: string;

        if (dateTimeStr.includes(':')) {
          // 時刻あり: YYYY/MM/DD HH:mm:ss
          const match = dateTimeStr.match(/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
          if (!match) {
            failedRows.push({
              row: i + 1,
              data: line,
              error: `timestamp形式が不正です（期待: YYYY/MM/DD HH:mm:ss または YYYY/MM/DD）`,
            });
            continue;
          }
          checkInTime = `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}:${match[6]}`;
        } else {
          // 時刻なし: YYYY/MM/DD
          const match = dateTimeStr.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
          if (!match) {
            failedRows.push({
              row: i + 1,
              data: line,
              error: `timestamp形式が不正です（期待: YYYY/MM/DD HH:mm:ss または YYYY/MM/DD）`,
            });
            continue;
          }
          checkInTime = `${match[1]}-${match[2]}-${match[3]} 00:00:00`;
        }

        // チェックインを登録
        createCheckInWithTime(member.id, checkInTime);

        successRows.push({
          dateTime: dateTimeStr,
          qrCode,
        });
      } catch (error) {
        failedRows.push({
          row: i + 1,
          data: line,
          error: error instanceof Error ? error.message : '不明なエラー',
        });
      }
    }

    return NextResponse.json({
      success: true,
      successCount: successRows.length,
      failedCount: failedRows.length,
      successRows,
      failedRows,
    });
  } catch (error) {
    console.error('Error bulk uploading check-ins:', error);
    return NextResponse.json({
      error: 'Failed to bulk upload check-ins',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
