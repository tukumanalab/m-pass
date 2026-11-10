// メールアドレスをログや画面に出すときのマスク処理

/**
 * メールアドレスをマスクする（例: koji@example.com → ko***@example.com）
 * ローカル部の先頭2文字（2文字以下なら先頭1文字）だけを残す
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '';
  const at = email.lastIndexOf('@');
  if (at <= 0) return '***';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const keep = local.length > 2 ? 2 : 1;
  return `${local.slice(0, keep)}***@${domain}`;
}

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/**
 * 文字列に含まれるメールアドレスをすべてマスクする
 */
export function maskEmailsInText(text: string): string {
  return text.replace(EMAIL_PATTERN, (m) => maskEmail(m));
}
