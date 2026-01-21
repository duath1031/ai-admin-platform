// =============================================================================
// Notification Send API
// POST /api/notification/send - 알림 발송
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendEmailNotification, emailTemplates } from '@/lib/notification/email';
import { sendAlimtalkNotification } from '@/lib/notification/kakaoAlimtalk';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const sendNotificationSchema = z.object({
  type: z.enum(['submission_complete', 'submission_failed', 'credit_low', 'payment_success']),
  channels: z.array(z.enum(['email', 'kakao'])).min(1),
  data: z.record(z.string()),
  userId: z.string().optional(), // Admin only
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const validationResult = sendNotificationSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: '입력값이 올바르지 않습니다' },
        { status: 400 }
      );
    }

    const { type, channels, data, userId: targetUserId } = validationResult.data;

    // Determine target user (admin can send to other users)
    const targetUser = targetUserId || session.user.id;

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: targetUser },
      select: { id: true, name: true, email: true, phone: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    const results: { channel: string; success: boolean; error?: string }[] = [];

    // Send email notification
    if (channels.includes('email') && user.email) {
      let emailData;

      switch (type) {
        case 'submission_complete':
          emailData = emailTemplates.submissionComplete({
            userName: user.name || '고객',
            serviceName: data.serviceName,
            applicationNumber: data.applicationNumber || null,
            completedAt: new Date(data.completedAt || Date.now()),
          });
          break;

        case 'submission_failed':
          emailData = emailTemplates.submissionFailed({
            userName: user.name || '고객',
            serviceName: data.serviceName,
            errorMessage: data.errorMessage || '알 수 없는 오류',
          });
          break;

        case 'credit_low':
          emailData = emailTemplates.creditLow({
            userName: user.name || '고객',
            currentCredits: parseInt(data.currentCredits || '0', 10),
            threshold: parseInt(data.threshold || '50', 10),
          });
          break;

        default:
          emailData = null;
      }

      if (emailData) {
        const emailSuccess = await sendEmailNotification(user.id, type, emailData);
        results.push({ channel: 'email', success: emailSuccess });
      }
    }

    // Send Kakao Alimtalk
    if (channels.includes('kakao') && user.phone) {
      const templateCodeMap: Record<string, string> = {
        submission_complete: 'SUBMISSION_COMPLETE',
        submission_failed: 'SUBMISSION_FAILED',
        credit_low: 'CREDIT_LOW',
        payment_success: 'PAYMENT_SUCCESS',
      };

      const templateCode = templateCodeMap[type];
      if (templateCode) {
        const variables: Record<string, string> = {
          userName: user.name || '고객',
          ...data,
        };

        const kakaoSuccess = await sendAlimtalkNotification(
          user.id,
          user.phone,
          templateCode,
          variables
        );
        results.push({ channel: 'kakao', success: kakaoSuccess });
      }
    }

    const allSuccess = results.every(r => r.success);
    const anySuccess = results.some(r => r.success);

    return NextResponse.json({
      success: anySuccess,
      message: allSuccess
        ? '모든 알림이 발송되었습니다'
        : anySuccess
        ? '일부 알림이 발송되었습니다'
        : '알림 발송에 실패했습니다',
      results,
    });

  } catch (error) {
    console.error('Send notification error:', error);
    return NextResponse.json(
      { error: '알림 발송 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
