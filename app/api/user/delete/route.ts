// =============================================================================
// User Account Delete API
// DELETE /api/user/delete - 회원 탈퇴
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const deleteAccountSchema = z.object({
  confirmation: z.literal('DELETE'),
  reason: z.string().optional(),
});

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const validationResult = deleteAccountSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: '삭제 확인이 필요합니다. confirmation 필드에 "DELETE"를 입력하세요.' },
        { status: 400 }
      );
    }

    const { reason } = validationResult.data;

    // Check for pending submissions
    const pendingSubmissions = await prisma.civilServiceSubmission.count({
      where: {
        userId: session.user.id,
        status: { in: ['pending', 'submitted', 'processing'] },
      },
    });

    if (pendingSubmissions > 0) {
      return NextResponse.json(
        { error: '진행 중인 민원이 있어 탈퇴할 수 없습니다. 민원 완료 후 다시 시도해주세요.' },
        { status: 400 }
      );
    }

    // Check for active subscription
    const activeSubscription = await prisma.subscription.findFirst({
      where: {
        userId: session.user.id,
        status: 'active',
      },
    });

    if (activeSubscription) {
      return NextResponse.json(
        { error: '활성화된 구독이 있습니다. 구독 해지 후 탈퇴해주세요.' },
        { status: 400 }
      );
    }

    // Log deletion reason (optional)
    if (reason) {
      console.log(`[Account Delete] User ${session.user.id} deleted account. Reason: ${reason}`);
    }

    // Delete user (cascades to related records)
    await prisma.user.delete({
      where: { id: session.user.id },
    });

    return NextResponse.json({
      success: true,
      message: '계정이 삭제되었습니다',
    });

  } catch (error) {
    console.error('Account delete error:', error);
    return NextResponse.json(
      { error: '계정 삭제 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
