import { cookies } from 'next/headers';
import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import crypto from 'crypto';

let memberSecretKey: Uint8Array | null = null;

// 会員セッションの署名鍵
// MEMBER_JWT_SECRET が未設定なら、管理者用の秘密値から会員用の鍵を派生させる。
// どちらも無い本番環境では、誰でも知っている既定値で署名しないようエラーにする。
function getMemberSecretKey(): Uint8Array {
    if (memberSecretKey) return memberSecretKey;
    const explicit = process.env.MEMBER_JWT_SECRET;
    const base = process.env.ADMIN_JWT_SECRET || process.env.ADMIN_PASSWORD_HASH;
    let secret: string;
    if (explicit) {
        secret = explicit;
    } else if (base) {
        secret = crypto.createHmac('sha256', base).update('m-pass-member-session').digest('hex');
    } else if (process.env.NODE_ENV === 'production') {
        throw new Error('MEMBER_JWT_SECRET（または ADMIN_JWT_SECRET / ADMIN_PASSWORD_HASH）が設定されていません');
    } else {
        secret = 'dev-only-member-secret';
    }
    memberSecretKey = new TextEncoder().encode(secret);
    return memberSecretKey;
}

const MEMBER_COOKIE_NAME = 'member_session';

// JWT は署名されているだけで中身は誰でも読めるため、個人情報（メールアドレス・氏名）は入れない
export interface MemberSession {
    memberId: number;
}

interface MemberJWTPayload extends JWTPayload {
    memberId: number;
}

// メンバーセッションを作成
export async function createMemberSession(session: MemberSession) {
    const token = await new SignJWT({ memberId: session.memberId } as MemberJWTPayload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d') // 7日間有効
        .sign(getMemberSecretKey());

    const cookieStore = await cookies();
    cookieStore.set(MEMBER_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7日間
        path: '/',
    });
}

// メンバーセッションを検証
export async function verifyMemberSession(): Promise<MemberSession | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get(MEMBER_COOKIE_NAME);

    if (!token) {
        return null;
    }

    try {
        const verified = await jwtVerify(token.value, getMemberSecretKey());
        const payload = verified.payload as MemberJWTPayload;
        return {
            memberId: payload.memberId,
        };
    } catch (error) {
        return null;
    }
}

// メンバーセッションを削除
export async function deleteMemberSession() {
    const cookieStore = await cookies();
    cookieStore.delete(MEMBER_COOKIE_NAME);
}
