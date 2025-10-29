import { cookies } from 'next/headers';
import { SignJWT, jwtVerify, JWTPayload } from 'jose';

const MEMBER_SECRET_KEY = new TextEncoder().encode(
    process.env.MEMBER_JWT_SECRET || 'your-member-secret-key-change-this-in-production'
);

const MEMBER_COOKIE_NAME = 'member_session';

export interface MemberSession {
    memberId: number;
    email: string;
    name: string;
}

interface MemberJWTPayload extends JWTPayload {
    memberId: number;
    email: string;
    name: string;
}

// メンバーセッションを作成
export async function createMemberSession(session: MemberSession) {
    const token = await new SignJWT(session as MemberJWTPayload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d') // 7日間有効
        .sign(MEMBER_SECRET_KEY);

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
        const verified = await jwtVerify(token.value, MEMBER_SECRET_KEY);
        const payload = verified.payload as MemberJWTPayload;
        return {
            memberId: payload.memberId,
            email: payload.email,
            name: payload.name,
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
