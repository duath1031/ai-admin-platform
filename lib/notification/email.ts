// =============================================================================
// Email Notification Service
// 이메일 알림 서비스
// =============================================================================

import prisma from '@/lib/prisma';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// =============================================================================
// Email Service Class
// =============================================================================

export class EmailService {
  private apiKey: string;
  private fromEmail: string;
  private fromName: string;

  constructor() {
    this.apiKey = process.env.EMAIL_API_KEY || '';
    this.fromEmail = process.env.EMAIL_FROM || 'noreply@admini.co.kr';
    this.fromName = process.env.EMAIL_FROM_NAME || 'AI 행정사 어드미니';
  }

  /**
   * Send email via API (supports various providers)
   */
  async send(options: EmailOptions): Promise<SendEmailResult> {
    try {
      // If using Resend
      if (process.env.EMAIL_PROVIDER === 'resend') {
        return await this.sendViaResend(options);
      }

      // If using SendGrid
      if (process.env.EMAIL_PROVIDER === 'sendgrid') {
        return await this.sendViaSendGrid(options);
      }

      // Default: Log only (development)
      console.log('[Email] Would send:', {
        to: options.to,
        subject: options.subject,
      });

      return { success: true, messageId: `dev-${Date.now()}` };
    } catch (error) {
      console.error('Email send error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send via Resend API
   */
  private async sendViaResend(options: EmailOptions): Promise<SendEmailResult> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.message || 'Resend API error' };
    }

    return { success: true, messageId: data.id };
  }

  /**
   * Send via SendGrid API
   */
  private async sendViaSendGrid(options: EmailOptions): Promise<SendEmailResult> {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: options.to }] }],
        from: { email: this.fromEmail, name: this.fromName },
        subject: options.subject,
        content: [
          { type: 'text/plain', value: options.text || '' },
          { type: 'text/html', value: options.html },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: text };
    }

    return { success: true, messageId: response.headers.get('x-message-id') || undefined };
  }
}

// =============================================================================
// Email Templates
// =============================================================================

export const emailTemplates = {
  /**
   * Submission complete notification
   */
  submissionComplete: (data: {
    userName: string;
    serviceName: string;
    applicationNumber: string | null;
    completedAt: Date;
  }) => ({
    subject: `[어드미니] 민원 접수 완료: ${data.serviceName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Apple SD Gothic Neo', sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .info-box { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>민원 접수 완료</h1>
          </div>
          <div class="content">
            <p>${data.userName}님, 안녕하세요.</p>
            <p>요청하신 민원이 성공적으로 접수되었습니다.</p>

            <div class="info-box">
              <p><strong>민원명:</strong> ${data.serviceName}</p>
              ${data.applicationNumber ? `<p><strong>접수번호:</strong> ${data.applicationNumber}</p>` : ''}
              <p><strong>완료일시:</strong> ${data.completedAt.toLocaleString('ko-KR')}</p>
            </div>

            <p>접수증 및 상세 내용은 마이페이지에서 확인하실 수 있습니다.</p>
          </div>
          <div class="footer">
            <p>AI 행정사 어드미니 | admini.co.kr</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `[어드미니] 민원 접수 완료\n\n${data.userName}님, 요청하신 민원이 성공적으로 접수되었습니다.\n\n민원명: ${data.serviceName}\n${data.applicationNumber ? `접수번호: ${data.applicationNumber}\n` : ''}완료일시: ${data.completedAt.toLocaleString('ko-KR')}`,
  }),

  /**
   * Submission failed notification
   */
  submissionFailed: (data: {
    userName: string;
    serviceName: string;
    errorMessage: string;
  }) => ({
    subject: `[어드미니] 민원 접수 실패: ${data.serviceName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Apple SD Gothic Neo', sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .error-box { background: #fef2f2; padding: 15px; border-radius: 8px; margin: 15px 0; border: 1px solid #fecaca; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>민원 접수 실패</h1>
          </div>
          <div class="content">
            <p>${data.userName}님, 안녕하세요.</p>
            <p>요청하신 민원 접수 중 오류가 발생했습니다.</p>

            <div class="error-box">
              <p><strong>민원명:</strong> ${data.serviceName}</p>
              <p><strong>오류 내용:</strong> ${data.errorMessage}</p>
            </div>

            <p>문제가 지속될 경우 고객센터로 문의해 주세요.</p>
          </div>
          <div class="footer">
            <p>AI 행정사 어드미니 | admini.co.kr</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `[어드미니] 민원 접수 실패\n\n${data.userName}님, 민원 접수 중 오류가 발생했습니다.\n\n민원명: ${data.serviceName}\n오류 내용: ${data.errorMessage}`,
  }),

  /**
   * Credit low warning
   */
  creditLow: (data: {
    userName: string;
    currentCredits: number;
    threshold: number;
  }) => ({
    subject: `[어드미니] 크레딧 잔액 부족 알림`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Apple SD Gothic Neo', sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f59e0b; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .warning-box { background: #fffbeb; padding: 15px; border-radius: 8px; margin: 15px 0; border: 1px solid #fcd34d; }
          .cta-button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>크레딧 잔액 부족</h1>
          </div>
          <div class="content">
            <p>${data.userName}님, 안녕하세요.</p>

            <div class="warning-box">
              <p>현재 크레딧 잔액이 <strong>${data.currentCredits}</strong>입니다.</p>
              <p>원활한 서비스 이용을 위해 크레딧을 충전해 주세요.</p>
            </div>

            <p style="text-align: center; margin-top: 20px;">
              <a href="https://admini.co.kr/payment" class="cta-button">크레딧 충전하기</a>
            </p>
          </div>
          <div class="footer">
            <p>AI 행정사 어드미니 | admini.co.kr</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `[어드미니] 크레딧 잔액 부족\n\n${data.userName}님, 현재 크레딧 잔액이 ${data.currentCredits}입니다.\n원활한 서비스 이용을 위해 크레딧을 충전해 주세요.`,
  }),
};

// =============================================================================
// Notification Helper Functions
// =============================================================================

const emailService = new EmailService();

/**
 * Send and record notification
 */
export async function sendEmailNotification(
  userId: string,
  type: string,
  emailOptions: { subject: string; html: string; text?: string }
): Promise<boolean> {
  try {
    // Get user email
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (!user?.email) {
      console.error('User email not found:', userId);
      return false;
    }

    // Send email
    const result = await emailService.send({
      to: user.email,
      ...emailOptions,
    });

    // Record notification
    await prisma.notification.create({
      data: {
        userId,
        type,
        title: emailOptions.subject,
        message: emailOptions.text || '',
        channel: 'email',
        status: result.success ? 'sent' : 'failed',
        sentAt: result.success ? new Date() : undefined,
        errorMessage: result.error,
      },
    });

    return result.success;
  } catch (error) {
    console.error('Send email notification error:', error);
    return false;
  }
}

export { emailService };
