import nodemailer from 'nodemailer';
import { google } from 'googleapis';

// Gmail OAuth2設定を環境変数から取得
const GMAIL_USER = process.env.GMAIL_USER;
const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

if (!GMAIL_USER || !CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    console.warn('Warning: Gmail OAuth2 credentials are not configured. Email sending will fail.');
    console.warn('Required: GMAIL_USER, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN');
}

// OAuth2クライアントの作成
const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    'https://developers.google.com/oauthplayground' // リダイレクトURI
);

// リフレッシュトークンを設定
oauth2Client.setCredentials({
    refresh_token: REFRESH_TOKEN,
});

// アクセストークンを取得する関数
async function getAccessToken() {
    try {
        const { token } = await oauth2Client.getAccessToken();
        return token;
    } catch (error) {
        console.error('Error getting access token:', error);
        console.error('Gmail OAuth2 configuration check:');
        console.error('- GMAIL_USER:', GMAIL_USER ? 'Set' : 'NOT SET');
        console.error('- CLIENT_ID:', CLIENT_ID ? 'Set' : 'NOT SET');
        console.error('- CLIENT_SECRET:', CLIENT_SECRET ? 'Set' : 'NOT SET');
        console.error('- REFRESH_TOKEN:', REFRESH_TOKEN ? 'Set' : 'NOT SET');
        throw new Error('Failed to get Gmail access token');
    }
}

// Gmailトランスポーターを作成する関数
async function createTransporter() {
    const accessToken = await getAccessToken();

    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            type: 'OAuth2',
            user: GMAIL_USER,
            clientId: CLIENT_ID,
            clientSecret: CLIENT_SECRET,
            refreshToken: REFRESH_TOKEN,
            accessToken: accessToken || '',
        },
    });
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

    const mailOptions = {
        from: `"メンバー登録システム" <${GMAIL_USER}>`,
        to,
        subject: 'メンバー登録の確認',
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
        <p style="color: #666; font-size: 14px;">
          このリンクは24時間有効です。<br>
          もしこのメールに心当たりがない場合は、無視してください。
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">
          このメールはシステムから自動送信されています。<br>
          直接返信しないでください。
        </p>
      </div>
    `,
    };

    try {
        const transporter = await createTransporter();
        await transporter.sendMail(mailOptions);
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

    const mailOptions = {
        from: `"メンバー登録システム" <${GMAIL_USER}>`,
        to,
        subject: 'パスワードリセットのお知らせ',
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
        <p style="color: #666; font-size: 14px;">
          このリンクは1時間有効です。<br>
          もしこのメールに心当たりがない場合は、無視してください。
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">
          このメールはシステムから自動送信されています。<br>
          直接返信しないでください。
        </p>
      </div>
    `,
    };

    try {
        const transporter = await createTransporter();
        await transporter.sendMail(mailOptions);
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
          <div style="text-align: center;">
            <a href="${resetUrl}" 
               style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 14px;">
              このアカウントのパスワードをリセット
            </a>
          </div>
        </div>
      `;
    }).join('');

    const mailOptions = {
        from: `"メンバー登録システム" <${GMAIL_USER}>`,
        to,
        subject: 'パスワードリセットのお知らせ',
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
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">
          このメールはシステムから自動送信されています。<br>
          直接返信しないでください。
        </p>
      </div>
    `,
    };

    try {
        const transporter = await createTransporter();
        await transporter.sendMail(mailOptions);
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
    const mailOptions = {
        from: `"メンバー登録システム" <${GMAIL_USER}>`,
        to,
        subject: 'メンバー登録完了のお知らせ',
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
          <a href="${APP_URL}/member/login?id=${encodeURIComponent(memberId)}" 
             style="background-color: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
            ログインページへ
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">
          このメールはシステムから自動送信されています。<br>
          直接返信しないでください。
        </p>
      </div>
    `,
    };

    try {
        const transporter = await createTransporter();
        await transporter.sendMail(mailOptions);
        console.log(`Registration complete email sent to ${to}`);
    } catch (error) {
        console.error('Error sending registration complete email:', error);
        // 登録完了メールの送信失敗は致命的ではないため、エラーをログに記録するのみ
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
    // Gmail設定がない場合はスキップ
    if (!GMAIL_USER || !CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
        console.log(`Skipping MyPage announcement email to ${to} (Gmail not configured)`);
        return;
    }

    const loginUrl = `${APP_URL}/member/login?id=${encodeURIComponent(memberId)}`;

    const mailOptions = {
        from: `"メンバー登録システム" <${GMAIL_USER}>`,
        to,
        subject: '【重要】メンバー専用マイページのご案内',
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

        <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="color: #666; font-size: 14px; margin: 0;">
            💡 <strong>ヒント:</strong> マイページのURLをブックマークしておくと便利です。<br>
            スマートフォンのホーム画面に追加すれば、アプリのように使えます。
          </p>
        </div>

        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">
          このメールはシステムから自動送信されています。<br>
          直接返信しないでください。
        </p>
      </div>
    `,
    };

    try {
        const transporter = await createTransporter();
        await transporter.sendMail(mailOptions);
        console.log(`MyPage announcement email sent to ${to}`);
    } catch (error) {
        console.error('Error sending MyPage announcement email:', error);
        // マイページ案内メールの送信失敗は致命的ではないため、エラーをログに記録するのみ
    }
}
