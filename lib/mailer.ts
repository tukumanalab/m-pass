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
          <a href="${APP_URL}/member/login" 
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
