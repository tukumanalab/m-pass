import { Resend } from 'resend';

// Resend設定を環境変数から取得
const RESEND_API_KEY = process.env.RESEND_API_KEY;
// 送信元アドレス（Resendで認証済みのドメインのアドレスを指定する）
const MAIL_FROM = process.env.MAIL_FROM;
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const APP_NAME = process.env.APP_NAME || 'メンバー登録システム';
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || MAIL_FROM;

// メール用共通フッター（HTML版）
function getEmailFooter(): string {
    const contactInfo = CONTACT_EMAIL ? `
        <p style="color: #999; font-size: 12px; margin: 8px 0 0 0;">
          お問い合わせ: <a href="mailto:${CONTACT_EMAIL}" style="color: #666; text-decoration: underline;">${CONTACT_EMAIL}</a>
        </p>
    ` : '';

    return `
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <div style="text-align: center; margin: 15px 0;">
          <a href="${APP_URL}/privacy-policy" style="color: #666; font-size: 12px; text-decoration: none; margin: 0 8px;">プライバシーポリシー</a>
          <span style="color: #ccc; font-size: 12px;">|</span>
          <a href="${APP_URL}/terms-of-service" style="color: #666; font-size: 12px; text-decoration: none; margin: 0 8px;">利用規約</a>
        </div>
        <p style="color: #999; font-size: 12px; margin: 5px 0;">
          このメールはシステムから自動送信されています。<br>
          直接返信しないでください。
        </p>
        ${contactInfo}
    `;
}

// メール用共通フッター（プレーンテキスト版）
function getTextEmailFooter(): string {
    const lines = [
        '--------------------------------------------------',
        `プライバシーポリシー: ${APP_URL}/privacy-policy`,
        `利用規約: ${APP_URL}/terms-of-service`,
    ];
    if (CONTACT_EMAIL) {
        lines.push(`お問い合わせ: ${CONTACT_EMAIL}`);
    }
    lines.push(
        '',
        'このメールはシステムから自動送信されています。',
        '直接返信しないでください。',
        '--------------------------------------------------'
    );
    return lines.join('\n');
}

function isMailConfigured(): boolean {
    return Boolean(RESEND_API_KEY && MAIL_FROM);
}

if (!isMailConfigured()) {
    console.warn('Warning: Resend credentials are not configured. Email sending will fail.');
    console.warn('Required: RESEND_API_KEY, MAIL_FROM');
}

// Resendクライアント（遅延生成）
let resendClient: Resend | null = null;
function getResend(): Resend {
    if (!RESEND_API_KEY || !MAIL_FROM) {
        console.error('Resend configuration check:');
        console.error('- RESEND_API_KEY:', RESEND_API_KEY ? 'Set' : 'NOT SET');
        console.error('- MAIL_FROM:', MAIL_FROM ? 'Set' : 'NOT SET');
        throw new Error('Resend is not configured');
    }
    if (!resendClient) {
        resendClient = new Resend(RESEND_API_KEY);
    }
    return resendClient;
}

interface MailOptions {
    to: string;
    subject: string;
    text: string;
    html: string;
}

// Resend経由でメールを送信する（失敗時は例外を投げる）
async function sendMail(options: MailOptions): Promise<void> {
    const resend = getResend();
    const { error } = await resend.emails.send({
        from: `${APP_NAME} <${MAIL_FROM}>`,
        replyTo: CONTACT_EMAIL || MAIL_FROM!,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
    });
    if (error) {
        throw new Error(`Resend error: ${error.name}: ${error.message}`);
    }
}

/**
 * メール確認用のメールを送信
 */
export async function sendVerificationEmail(
    to: string,
    name: string,
    token: string
): Promise<void> {
    const verificationUrl = `${APP_URL}/register/verify?token=${token}`;

    const text = [
        `${name} 様`,
        '',
        'メンバー登録のお申し込みありがとうございます。',
        '以下のリンクをクリックして、登録を完了してください。',
        '',
        verificationUrl,
        '',
        '※このリンクは24時間有効です。',
        '※もしこのメールに心当たりがない場合は、無視してください。',
        '',
        getTextEmailFooter(),
    ].join('\n');

    const mailOptions: MailOptions = {
        to,
        subject: 'メンバー登録の確認',
        text,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">メンバー登録の確認</h2>
        <p>${name} 様</p>
        <p>メンバー登録のお申し込みありがとうございます。</p>
        <p>以下のリンクをクリックして、登録を完了してください。</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
            登録を確認する
          </a>
        </div>
        <p style="color: #666; font-size: 12px; word-break: break-all; margin: 15px 0;">
          ボタンをクリックできない場合は、以下のURLをブラウザのアドレスバーに貼り付けてアクセスしてください：<br>
          <a href="${verificationUrl}" style="color: #4F46E5;">${verificationUrl}</a>
        </p>
        <p style="color: #666; font-size: 14px;">
          このリンクは24時間有効です。<br>
          もしこのメールに心当たりがない場合は、無視してください。
        </p>
        ${getEmailFooter()}
      </div>
    `,
    };

    try {
        await sendMail(mailOptions);
        console.log(`Verification email sent to ${to}`);
    } catch (error) {
        console.error('Error sending verification email:', error);
        throw new Error('メールの送信に失敗しました');
    }
}

/**
 * パスワードリセット用のメールを送信（単一メンバー）
 */
export async function sendPasswordResetEmail(
    to: string,
    name: string,
    token: string
): Promise<void> {
    const resetUrl = `${APP_URL}/member/reset-password?token=${token}`;

    const text = [
        `${name} 様`,
        '',
        'パスワードリセットのリクエストを受け付けました。',
        '以下のリンクをクリックして、新しいパスワードを設定してください。',
        '',
        resetUrl,
        '',
        '※このリンクは1時間有効です。',
        '※もしこのメールに心当たりがない場合は、無視してください。',
        '',
        getTextEmailFooter(),
    ].join('\n');

    const mailOptions: MailOptions = {
        to,
        subject: 'パスワードリセットのお知らせ',
        text,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">パスワードリセット</h2>
        <p>${name} 様</p>
        <p>パスワードリセットのリクエストを受け付けました。</p>
        <p>以下のリンクをクリックして、新しいパスワードを設定してください。</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
            パスワードをリセットする
          </a>
        </div>
        <p style="color: #666; font-size: 12px; word-break: break-all; margin: 15px 0;">
          ボタンをクリックできない場合は、以下のURLをブラウザのアドレスバーに貼り付けてアクセスしてください：<br>
          <a href="${resetUrl}" style="color: #4F46E5;">${resetUrl}</a>
        </p>
        <p style="color: #666; font-size: 14px;">
          このリンクは1時間有効です。<br>
          もしこのメールに心当たりがない場合は、無視してください。
        </p>
        ${getEmailFooter()}
      </div>
    `,
    };

    try {
        await sendMail(mailOptions);
        console.log(`Password reset email sent to ${to}`);
    } catch (error) {
        console.error('Error sending password reset email:', error);
        throw new Error('メールの送信に失敗しました');
    }
}

/**
 * パスワードリセット用のメールを送信（複数メンバー対応）
 */
export async function sendPasswordResetEmailMultiple(
    to: string,
    members: Array<{ name: string; memberId: string; affiliation: string; affiliationDetail: string | null; token: string }>
): Promise<void> {
    const memberLinks = members.map((member) => {
        const resetUrl = `${APP_URL}/member/reset-password?token=${member.token}`;
        return `
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #4F46E5;">
          <div style="font-weight: bold; color: #333; margin-bottom: 8px;">${member.name}</div>
          <div style="font-size: 14px; color: #666; margin-bottom: 4px;">メンバーID: ${member.memberId}</div>
          <div style="font-size: 14px; color: #666; margin-bottom: 12px;">
            所属: ${member.affiliation}${member.affiliationDetail ? ` (${member.affiliationDetail})` : ''}
          </div>
          <div style="text-align: center; margin-bottom: 10px;">
            <a href="${resetUrl}" 
               style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 14px;">
              このアカウントのパスワードをリセット
            </a>
          </div>
          <p style="color: #888; font-size: 11px; word-break: break-all; margin: 0;">
            URL: <a href="${resetUrl}" style="color: #4F46E5;">${resetUrl}</a>
          </p>
        </div>
      `;
    }).join('');

    const memberTextList = members.map((member) => {
        const resetUrl = `${APP_URL}/member/reset-password?token=${member.token}`;
        return [
            `・${member.name} (メンバーID: ${member.memberId})`,
            `  所属: ${member.affiliation}${member.affiliationDetail ? ` (${member.affiliationDetail})` : ''}`,
            `  再設定URL: ${resetUrl}`,
        ].join('\n');
    }).join('\n\n');

    const text = [
        'パスワードリセットのリクエストを受け付けました。',
        '',
        '【重要】このメールアドレスには複数のアカウントが登録されています。',
        'パスワードをリセットするアカウントのリンクを選択してください。',
        '',
        memberTextList,
        '',
        '※各リンクは1時間有効です。',
        '※注意: 1つのリンクを使用すると、そのアカウントのパスワードのみがリセットされます。',
        '※もしこのメールに心当たりがない場合は、無視してください。',
        '',
        getTextEmailFooter(),
    ].join('\n');

    const mailOptions: MailOptions = {
        to,
        subject: 'パスワードリセットのお知らせ',
        text,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">パスワードリセット</h2>
        <p>パスワードリセットのリクエストを受け付けました。</p>
        <p style="color: #d97706; background-color: #fef3c7; padding: 12px; border-radius: 8px; font-size: 14px;">
          <strong>ℹ️ このメールアドレスには複数のアカウントが登録されています</strong><br>
          パスワードをリセットするアカウントを選択してください。
        </p>
        ${memberLinks}
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          各リンクは1時間有効です。<br>
          <strong>注意:</strong> 1つのリンクを使用すると、そのアカウントのパスワードのみがリセットされます。<br>
          もしこのメールに心当たりがない場合は、無視してください。
        </p>
        ${getEmailFooter()}
      </div>
    `,
    };

    try {
        await sendMail(mailOptions);
        console.log(`Password reset email (multiple members) sent to ${to}`);
    } catch (error) {
        console.error('Error sending password reset email:', error);
        throw new Error('メールの送信に失敗しました');
    }
}

/**
 * 登録完了メールを送信
 */
export async function sendRegistrationCompleteEmail(
    to: string,
    name: string,
    memberId: string,
    affiliation: string
): Promise<void> {
    const loginUrl = `${APP_URL}/member/login?id=${encodeURIComponent(memberId)}`;

    const text = [
        `${name} 様`,
        '',
        'メンバー登録が完了しました。以下の情報でログインできます。',
        '',
        '【登録情報】',
        `・メンバーID: ${memberId}`,
        `・お名前: ${name}`,
        `・所属: ${affiliation}`,
        `・メールアドレス: ${to}`,
        '',
        `ログインページ: ${loginUrl}`,
        '',
        '※QRコードカードは、登録完了画面から印刷・ダウンロードできます。',
        '',
        getTextEmailFooter(),
    ].join('\n');

    const mailOptions: MailOptions = {
        to,
        subject: 'メンバー登録完了のお知らせ',
        text,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">メンバー登録が完了しました</h2>
        <p>${name} 様</p>
        <p>メンバー登録が完了しました。以下の情報でログインできます。</p>
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <table style="width: 100%;">
            <tr>
              <td style="padding: 8px 0; color: #666;">メンバーID:</td>
              <td style="padding: 8px 0; font-weight: bold;">${memberId}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">お名前:</td>
              <td style="padding: 8px 0; font-weight: bold;">${name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">所属:</td>
              <td style="padding: 8px 0; font-weight: bold;">${affiliation}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">メールアドレス:</td>
              <td style="padding: 8px 0; font-weight: bold;">${to}</td>
            </tr>
          </table>
        </div>
        <p>QRコードカードは、登録完了画面から印刷・ダウンロードできます。</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${loginUrl}" 
             style="background-color: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
            ログインページへ
          </a>
        </div>
        <p style="color: #666; font-size: 12px; word-break: break-all; margin: 15px 0;">
          ボタンをクリックできない場合は、以下のURLからログインしてください：<br>
          <a href="${loginUrl}" style="color: #10B981;">${loginUrl}</a>
        </p>
        ${getEmailFooter()}
      </div>
    `,
    };

    try {
        await sendMail(mailOptions);
        console.log(`Registration complete email sent to ${to}`);
    } catch (error) {
        console.error('Error sending registration complete email:', error);
        // 登録完了メールの送信失敗は致命的ではないため、エラーをログに記録するのみ
    }
}

/**
 * メールアドレス変更確認メールを送信
 */
export async function sendEmailChangeVerificationEmail(
    to: string,
    name: string,
    token: string
): Promise<void> {
    const verificationUrl = `${APP_URL}/member/verify-email?token=${token}`;

    const text = [
        `${name} 様`,
        '',
        'メールアドレスの変更リクエストを受け付けました。',
        '新しいメールアドレスを確認するために、以下のリンクをクリックしてください。',
        '',
        verificationUrl,
        '',
        '※このリンクは1時間有効です。',
        '※もしこのメールに心当たりがない場合は、無視してください。',
        '',
        getTextEmailFooter(),
    ].join('\n');

    const mailOptions: MailOptions = {
        to,
        subject: 'メールアドレス変更の確認',
        text,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">メールアドレス変更の確認</h2>
        <p>${name} 様</p>
        <p>メールアドレスの変更リクエストを受け付けました。</p>
        <p>新しいメールアドレスを確認するために、以下のリンクをクリックしてください。</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
            メールアドレスを確認する
          </a>
        </div>
        <p style="color: #666; font-size: 12px; word-break: break-all; margin: 15px 0;">
          ボタンをクリックできない場合は、以下のURLをブラウザのアドレスバーに貼り付けてアクセスしてください：<br>
          <a href="${verificationUrl}" style="color: #4F46E5;">${verificationUrl}</a>
        </p>
        <p style="color: #666; font-size: 14px;">
          このリンクは1時間有効です。<br>
          もしこのメールに心当たりがない場合は、無視してください。
        </p>
        ${getEmailFooter()}
      </div>
    `,
    };

    try {
        await sendMail(mailOptions);
        console.log(`Email change verification email sent to ${to}`);
    } catch (error) {
        console.error('Error sending email change verification email:', error);
        throw new Error('メールの送信に失敗しました');
    }
}

/**
 * マイページ案内メールを送信（既存メンバー向け）
 */
export async function sendMyPageAnnouncementEmail(
    to: string,
    name: string,
    memberId: string
): Promise<void> {
    // Resend設定がない場合はスキップ
    if (!isMailConfigured()) {
        console.log(`Skipping MyPage announcement email to ${to} (Resend not configured)`);
        return;
    }

    const loginUrl = `${APP_URL}/member/login?id=${encodeURIComponent(memberId)}`;

    const text = [
        `${name} 様`,
        '',
        'いつもご利用ありがとうございます。',
        'この度、メンバー専用のマイページ機能がリリースされました。マイページでは以下のことができます：',
        '',
        '【マイページでできること】',
        '・QRコードの表示: チェックイン用のQRコードをいつでも確認できます',
        '・メンバー情報の変更: お名前、所属、メールアドレスなどを変更できます',
        '・パスワードの変更: セキュリティ強化のためパスワード変更も可能です',
        '・チェックイン履歴の確認: 過去のご利用履歴をご覧いただけます',
        '',
        '【ログイン情報】',
        `・ログインID: ${memberId}`,
        `・初期パスワード: ${to}`,
        '※初期パスワードはメールアドレスと同じです。セキュリティのため、初回ログイン後にパスワードの変更をお勧めします。',
        '',
        `マイページログインURL: ${loginUrl}`,
        '',
        '※ヒント: マイページのURLをブックマークしておくと便利です。スマートフォンのホーム画面に追加すればアプリのように使えます。',
        '',
        getTextEmailFooter(),
    ].join('\n');

    const mailOptions: MailOptions = {
        to,
        subject: '【重要】メンバー専用マイページのご案内',
        text,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">メンバー専用マイページができました</h2>
        <p>${name} 様</p>
        <p>いつもご利用ありがとうございます。</p>
        <p>この度、メンバー専用のマイページ機能がリリースされました。マイページでは以下のことができます：</p>
        
        <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4F46E5;">
          <h3 style="color: #4F46E5; margin-top: 0;">✨ マイページでできること</h3>
          <ul style="color: #333; line-height: 1.8;">
            <li><strong>QRコードの表示</strong> - チェックイン用のQRコードをいつでも確認できます</li>
            <li><strong>メンバー情報の変更</strong> - お名前、所属、メールアドレスなどを変更できます</li>
            <li><strong>パスワードの変更</strong> - セキュリティ強化のためパスワード変更も可能です</li>
            <li><strong>チェックイン履歴の確認</strong> - 過去のご利用履歴をご覧いただけます</li>
          </ul>
        </div>

        <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
          <h3 style="color: #92400e; margin-top: 0;">🔐 ログイン情報</h3>
          <table style="width: 100%;">
            <tr>
              <td style="padding: 8px 0; color: #666;">ログインID:</td>
              <td style="padding: 8px 0; font-weight: bold;">${memberId}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">初期パスワード:</td>
              <td style="padding: 8px 0; font-weight: bold;">${to}</td>
            </tr>
          </table>
          <p style="color: #92400e; font-size: 14px; margin-bottom: 0;">
            ⚠️ 初期パスワードはメールアドレスと同じです。<br>
            セキュリティのため、初回ログイン後にパスワードの変更をお勧めします。
          </p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${loginUrl}" 
             style="background-color: #4F46E5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 16px; font-weight: bold;">
            マイページにログイン
          </a>
        </div>
        <p style="color: #666; font-size: 12px; word-break: break-all; margin: 15px 0;">
          ボタンをクリックできない場合は、以下のURLからログインしてください：<br>
          <a href="${loginUrl}" style="color: #4F46E5;">${loginUrl}</a>
        </p>

        <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="color: #666; font-size: 14px; margin: 0;">
            💡 <strong>ヒント:</strong> マイページのURLをブックマークしておくと便利です。<br>
            スマートフォンのホーム画面に追加すれば、アプリのように使えます。
          </p>
        </div>

        ${getEmailFooter()}
      </div>
    `,
    };

    try {
        await sendMail(mailOptions);
        console.log(`MyPage announcement email sent to ${to}`);
    } catch (error) {
        console.error('Error sending MyPage announcement email:', error);
        // マイページ案内メールの送信失敗は致命的ではないため、エラーをログに記録するのみ
    }
}

/**
 * テストメールを送信（管理画面からの送信設定確認用）
 * 送信に失敗した場合は Resend からのエラー内容を含む例外を投げる
 */
export async function sendTestEmail(to: string): Promise<void> {
    const sentAt = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

    const text = [
        'これはメール送信設定の確認用テストメールです。',
        '',
        `送信日時: ${sentAt}`,
        `送信元: ${MAIL_FROM}`,
        `アプリケーションURL: ${APP_URL}`,
        '',
        'このメールが届いていれば、メール送信設定は正常に動作しています。',
        '',
        getTextEmailFooter(),
    ].join('\n');

    const mailOptions: MailOptions = {
        to,
        subject: `[${APP_NAME}] テストメール`,
        text,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">テストメール</h2>
        <p>これはメール送信設定の確認用テストメールです。</p>
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <table style="width: 100%;">
            <tr>
              <td style="padding: 8px 0; color: #666;">送信日時:</td>
              <td style="padding: 8px 0; font-weight: bold;">${sentAt}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">送信元:</td>
              <td style="padding: 8px 0; font-weight: bold;">${MAIL_FROM}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">アプリケーションURL:</td>
              <td style="padding: 8px 0; font-weight: bold;">${APP_URL}</td>
            </tr>
          </table>
        </div>
        <p>このメールが届いていれば、メール送信設定は正常に動作しています。</p>
        ${getEmailFooter()}
      </div>
    `,
    };

    await sendMail(mailOptions);
    console.log(`Test email sent to ${to}`);
}
