import { createLog, deleteOldLogs } from './database';
import { maskEmailsInText } from './mask';

type LogLevel = 'INFO' | 'WARN' | 'ERROR';

class Logger {
  private log(level: LogLevel, message: string, meta?: any) {
    // コンソールに出力
    const timestamp = new Date().toISOString();
    // メールアドレスはコンソール・DBのどちらにも平文で残さない
    message = maskEmailsInText(message);
    const metaStr = meta ? maskEmailsInText(JSON.stringify(meta)) : '';
    const consoleMsg = `[${timestamp}] [${level}] ${message} ${metaStr}`;

    switch (level) {
      case 'INFO':
        console.log(consoleMsg);
        break;
      case 'WARN':
        console.warn(consoleMsg);
        break;
      case 'ERROR':
        console.error(consoleMsg);
        break;
    }

    // データベースに保存
    try {
      createLog(level, message, metaStr ? JSON.parse(metaStr) : undefined);

      // 1%の確率で古いログを削除（30日以上前）
      if (Math.random() < 0.01) {
        // 非同期で実行（結果を待たない）
        setTimeout(() => {
          try {
            const deleted = deleteOldLogs(30);
            if (deleted > 0) {
              console.log(`[CLEANUP] Deleted ${deleted} old logs`);
            }
          } catch (e) {
            console.error('Failed to clean up old logs:', e);
          }
        }, 0);
      }
    } catch (e) {
      console.error('Failed to save log to database:', e);
    }
  }

  info(message: string, meta?: any) {
    this.log('INFO', message, meta);
  }

  warn(message: string, meta?: any) {
    this.log('WARN', message, meta);
  }

  error(message: string, meta?: any) {
    this.log('ERROR', message, meta);
  }
}

export const logger = new Logger();
