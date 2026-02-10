// =============================================================================
// 문서24 계정 연동 API
// GET  /api/user/doc24-account - 연동 상태 확인
// POST /api/user/doc24-account - 계정 연동
// DELETE /api/user/doc24-account - 계정 해제
// =============================================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { encrypt } from '@/lib/crypto';

// GET - 연동 상태 확인
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const account = await prisma.doc24Account.findUnique({
      where: { userId: session.user.id },
      select: {
        doc24LoginId: true,
        displayName: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });

    if (!account) {
      return NextResponse.json({ isLinked: false });
    }

    // ID 마스킹 (hong**** 형태)
    const id = account.doc24LoginId;
    const maskedId = id.length > 4
      ? id.substring(0, 4) + '*'.repeat(Math.min(id.length - 4, 4))
      : id;

    return NextResponse.json({
      isLinked: true,
      maskedId,
      displayName: account.displayName,
      isActive: account.isActive,
      lastUsedAt: account.lastUsedAt,
      createdAt: account.createdAt,
    });
  } catch (error: any) {
    console.error('[Doc24Account GET] Error:', error);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}

// POST - 계정 연동
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const body = await request.json();
    const { doc24Id, doc24Password, displayName } = body;

    if (!doc24Id || !doc24Password) {
      return NextResponse.json(
        { error: '문서24 ID와 비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    if (doc24Id.length < 2 || doc24Password.length < 4) {
      return NextResponse.json(
        { error: 'ID 또는 비밀번호가 너무 짧습니다.' },
        { status: 400 }
      );
    }

    // 비밀번호 암호화
    const { encrypted, iv, tag } = encrypt(doc24Password);

    // Upsert (기존 계정 있으면 업데이트)
    await prisma.doc24Account.upsert({
      where: { userId: session.user.id },
      update: {
        doc24LoginId: doc24Id,
        encryptedPassword: encrypted,
        encryptionIv: iv,
        encryptionTag: tag,
        displayName: displayName || null,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        userId: session.user.id,
        doc24LoginId: doc24Id,
        encryptedPassword: encrypted,
        encryptionIv: iv,
        encryptionTag: tag,
        displayName: displayName || null,
      },
    });

    const maskedId = doc24Id.length > 4
      ? doc24Id.substring(0, 4) + '*'.repeat(Math.min(doc24Id.length - 4, 4))
      : doc24Id;

    return NextResponse.json({ success: true, maskedId });
  } catch (error: any) {
    console.error('[Doc24Account POST] Error:', error);
    if (error.message?.includes('DOC24_ENCRYPTION_KEY')) {
      return NextResponse.json(
        { error: `암호화 키 오류: ${error.message}` },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: '저장 실패' }, { status: 500 });
  }
}

// DELETE - 계정 해제
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    await prisma.doc24Account.deleteMany({
      where: { userId: session.user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Doc24Account DELETE] Error:', error);
    return NextResponse.json({ error: '삭제 실패' }, { status: 500 });
  }
}
