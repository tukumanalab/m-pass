import { NextRequest, NextResponse } from 'next/server';
import { findMemberByMemberId, createCheckInWithTime, checkDuplicateCheckIn } from '@/lib/database';

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

    // ヘッダー行を検証（大文字小文字・空白無視でインデックス特定）
    const headerFields = parseCSVLine(cleanedLines[0]);
    const normalizedHeaders = headerFields.map(h => h.toLowerCase().replace(/\s+/g, ''));

    const timestampIndex = normalizedHeaders.findIndex(h => h === 'timestamp' || h === 'check_in_time' || h === 'checkin_time');
    const memberIdIndex = normalizedHeaders.findIndex(h => h === 'member_id' || h === 'memberid');
    const checkoutTimeIndex = normalizedHeaders.findIndex(h => h === 'checkout_time' || h === 'check_out_time' || h === 'checkouttime');
    const affiliationIndex = normalizedHeaders.findIndex(h => h === 'affiliation');

    if (timestampIndex === -1 || memberIdIndex === -1) {
      return NextResponse.json({
        error: `Invalid CSV header. Expected 'timestamp' and 'member_id' columns. Got: ${headerFields.join(',')}`
      }, { status: 400 });
    }

    // 日時パース用ヘルパー
    const parseDateTime = (str: string): string | null => {
      if (!str) return null;
      const normalized = str.replace(/-/g, '/').trim();
      if (normalized.includes(':')) {
        const match = normalized.match(/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
        if (match) {
          return `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}:${match[6]}`;
        }
      } else {
        const match = normalized.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
        if (match) {
          return `${match[1]}-${match[2]}-${match[3]} 00:00:00`;
        }
      }
      return null;
    };

    const successRows: Array<{
      dateTime: string;
      memberId: string;
    }> = [];

    const failedRows: Array<{
      row: number;
      data: string;
      error: string;
    }> = [];

    const duplicateRows: Array<{
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

        if (fields.length <= Math.max(timestampIndex, memberIdIndex)) {
          failedRows.push({
            row: i + 1,
            data: line,
            error: '列数が不足しています',
          });
          continue;
        }

        const dateTimeStr = fields[timestampIndex];
        const memberId = fields[memberIdIndex];
        const checkoutTimeStr = checkoutTimeIndex !== -1 && checkoutTimeIndex < fields.length ? fields[checkoutTimeIndex] : '';
        const affiliationStr = affiliationIndex !== -1 && affiliationIndex < fields.length ? fields[affiliationIndex] : '';

        // 必須フィールドのチェック
        if (!dateTimeStr || !memberId) {
          failedRows.push({
            row: i + 1,
            data: line,
            error: 'timestamp、member_idは必須です',
          });
          continue;
        }

        const checkInTime = parseDateTime(dateTimeStr);
        if (!checkInTime) {
          failedRows.push({
            row: i + 1,
            data: line,
            error: `timestamp形式が不正です（入力: ${dateTimeStr}）`,
          });
          continue;
        }

        let checkOutTime: string | undefined = undefined;
        if (checkoutTimeStr) {
          const parsed = parseDateTime(checkoutTimeStr);
          if (parsed) {
            checkOutTime = parsed;
          }
        }

        // メンバーをmember_idで検索
        const member = findMemberByMemberId(memberId) as { id: number } | undefined;

        if (!member) {
          failedRows.push({
            row: i + 1,
            data: line,
            error: `メンバーID「${memberId}」のメンバーが見つかりません`,
          });
          continue;
        }

        // 重複チェック
        if (checkDuplicateCheckIn(member.id, checkInTime)) {
          duplicateRows.push({
            row: i + 1,
            data: line,
            error: `重複: このメンバーは既に同じ日時にチェックイン済みです`,
          });
          continue;
        }

        // チェックインを登録
        createCheckInWithTime(member.id, checkInTime, checkOutTime, affiliationStr || undefined);

        successRows.push({
          dateTime: dateTimeStr,
          memberId,
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
      duplicateCount: duplicateRows.length,
      successRows,
      failedRows,
      duplicateRows,
    });
  } catch (error) {
    console.error('Error bulk uploading check-ins:', error);
    return NextResponse.json({
      error: 'Failed to bulk upload check-ins',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
