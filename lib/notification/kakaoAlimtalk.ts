// =============================================================================
// Kakao Alimtalk Notification Service
// 카카오 알림톡 서비스
// =============================================================================

import prisma from '@/lib/prisma';

interface AlimtalkOptions {
  phoneNumber: string;
  templateCode: string;
  variables: Record<string, string>;
}

interface SendAlimtalkResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// =============================================================================
// Kakao Alimtalk Service Class
// =============================================================================

export class KakaoAlimtalkService {
  private apiKey: string;
  private senderKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.KAKAO_ALIMTALK_API_KEY || '';
    this.senderKey = process.env.KAKAO_ALIMTALK_SENDER_KEY || '';
    this.baseUrl = process.env.KAKAO_ALIMTALK_URL || 'https://alimtalk-api.kakao.com';
  }

  /**
   * Send Alimtalk message
   */
  async send(options: AlimtalkOptions): Promise<SendAlimtalkResult> {
    try {
      // Development mode - just log
      if (!this.apiKey || process.env.NODE_ENV === 'development') {
        console.log('[KakaoAlimtalk] Would send:', {
          phoneNumber: options.phoneNumber.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
          templateCode: options.templateCode,
          variables: options.variables,
        });
        return { success: true, messageId: `dev-${Date.now()}` };
      }

      // Format phone number
      const phone = this.formatPhoneNumber(options.phoneNumber);
      if (!phone) {
        return { success: false, error: 'Invalid phone number' };
      }

      // Build template message
      const message = this.buildMessage(options.templateCode, options.variables);

      // Send via API
      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          senderKey: this.senderKey,
          templateCode: options.templateCode,
          recipientList: [{
            recipientNo: phone,
            templateParameter: options.variables,
          }],
        }),
      });

      const data = await response.json();

      if (!response.ok || data.status !== 'success') {
        return {
          success: false,
          error: data.message || 'Alimtalk API error',
        };
      }

      return {
        success: true,
        messageId: data.messageId,
      };
    } catch (error) {
      console.error('Alimtalk send error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Format phone number to E.164 format
   */
  private formatPhoneNumber(phone: string): string | null {
    const cleaned = phone.replace(/[^0-9]/g, '');

    // Korean mobile number
    if (cleaned.startsWith('010') && cleaned.length === 11) {
      return `82${cleaned.slice(1)}`; // 8210xxxxxxxx
    }

    // Already in international format
    if (cleaned.startsWith('82') && cleaned.length === 12) {
      return cleaned;
    }

    return null;
  }

  /**
   * Build message from template
   */
  private buildMessage(templateCode: string, variables: Record<string, string>): string {
    const template = alimtalkTemplates[templateCode];
    if (!template) return '';

    let message = template.content;
    for (const [key, value] of Object.entries(variables)) {
      message = message.replace(new RegExp(`#{${key}}`, 'g'), value);
    }
    return message;
  }
}

// =============================================================================
// Alimtalk Templates
// =============================================================================

export const alimtalkTemplates: Record<string, {
  code: string;
  name: string;
  content: string;
  buttons?: Array<{ name: string; type: string; url?: string }>;
}> = {
  SUBMISSION_COMPLETE: {
    code: 'SUBMISSION_COMPLETE',
    name: '민원 접수 완료',
    content: `[어드미니] 민원 접수 완료

안녕하세요, #{userName}님

요청하신 민원이 성공적으로 접수되었습니다.

■ 민원명: #{serviceName}
■ 접수번호: #{applicationNumber}
■ 완료일시: #{completedAt}

상세 내용은 어드미니 앱에서 확인하세요.`,
    buttons: [
      { name: '접수 내역 확인', type: 'WL', url: 'https://admini.co.kr/civil-service' },
    ],
  },

  SUBMISSION_FAILED: {
    code: 'SUBMISSION_FAILED',
    name: '민원 접수 실패',
    content: `[어드미니] 민원 접수 실패

안녕하세요, #{userName}님

요청하신 민원 접수 중 오류가 발생했습니다.

■ 민원명: #{serviceName}
■ 오류 내용: #{errorMessage}

문제가 지속될 경우 고객센터로 문의해 주세요.`,
    buttons: [
      { name: '고객센터 문의', type: 'WL', url: 'https://admini.co.kr/support' },
    ],
  },

  CREDIT_LOW: {
    code: 'CREDIT_LOW',
    name: '크레딧 부족 알림',
    content: `[어드미니] 크레딧 잔액 부족

안녕하세요, #{userName}님

현재 크레딧 잔액이 #{currentCredits}입니다.
원활한 서비스 이용을 위해 크레딧을 충전해 주세요.`,
    buttons: [
      { name: '크레딧 충전', type: 'WL', url: 'https://admini.co.kr/payment' },
    ],
  },

  POA_CREATED: {
    code: 'POA_CREATED',
    name: '전자위임장 생성',
    content: `[어드미니] 전자위임장 생성 완료

안녕하세요, #{delegatorName}님

#{serviceName}에 대한 전자위임장이 생성되었습니다.

■ 위임 범위: #{delegationScope}
■ 유효기간: #{validTo}까지

본 위임장으로 대리인이 민원을 접수할 수 있습니다.`,
  },

  PAYMENT_SUCCESS: {
    code: 'PAYMENT_SUCCESS',
    name: '결제 완료',
    content: `[어드미니] 결제 완료

안녕하세요, #{userName}님

결제가 완료되었습니다.

■ 상품: #{itemName}
■ 결제금액: #{amount}원
■ 결제일시: #{paidAt}

이용해 주셔서 감사합니다.`,
    buttons: [
      { name: '결제 내역 확인', type: 'WL', url: 'https://admini.co.kr/payment/history' },
    ],
  },
};

// =============================================================================
// Notification Helper Functions
// =============================================================================

const alimtalkService = new KakaoAlimtalkService();

/**
 * Send and record Alimtalk notification
 */
export async function sendAlimtalkNotification(
  userId: string,
  phone: string,
  templateCode: string,
  variables: Record<string, string>
): Promise<boolean> {
  try {
    const template = alimtalkTemplates[templateCode];
    if (!template) {
      console.error('Template not found:', templateCode);
      return false;
    }

    // Send Alimtalk
    const result = await alimtalkService.send({
      phoneNumber: phone,
      templateCode,
      variables,
    });

    // Record notification
    await prisma.notification.create({
      data: {
        userId,
        type: templateCode,
        title: template.name,
        message: alimtalkService['buildMessage'](templateCode, variables),
        channel: 'kakao',
        status: result.success ? 'sent' : 'failed',
        sentAt: result.success ? new Date() : undefined,
        errorMessage: result.error,
      },
    });

    return result.success;
  } catch (error) {
    console.error('Send Alimtalk notification error:', error);
    return false;
  }
}

export { alimtalkService };
