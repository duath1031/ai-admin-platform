// 알림 시스템 - 이메일, SMS, 카카오 알림톡
// nodemailer 대신 fetch 기반 API 사용

// =============================================================================
// 이메일 알림 서비스 (네이버 SMTP 대신 Resend 또는 기본 알림 사용)
// =============================================================================

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
  try {
    // Resend API 사용 (설정된 경우)
    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    if (RESEND_API_KEY) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "행정사합동사무소 정의 <onboarding@resend.dev>",
          to: [options.to],
          subject: options.subject,
          html: options.html,
        }),
      });

      if (response.ok) {
        console.log("[Email] Resend 발송 성공");
        return { success: true };
      } else {
        const error = await response.text();
        console.error("[Email] Resend 발송 실패:", error);
        return { success: false, error };
      }
    }

    // 이메일 API가 설정되지 않은 경우 로그만 남김
    console.log("[Email] 이메일 발송 (API 미설정, 로그만 기록):", {
      to: options.to,
      subject: options.subject,
    });

    return { success: true }; // 로그 기록은 성공으로 처리
  } catch (error: any) {
    console.error("[Email] 발송 오류:", error);
    return { success: false, error: error.message };
  }
}

// =============================================================================
// SMS 알림 서비스 (알리고 API)
// =============================================================================

interface SmsOptions {
  to: string;
  message: string;
}

export async function sendSms(options: SmsOptions): Promise<{ success: boolean; error?: string }> {
  try {
    const ALIGO_API_KEY = process.env.ALIGO_API_KEY;
    const ALIGO_USER_ID = process.env.ALIGO_USER_ID;
    const ALIGO_SENDER = process.env.ALIGO_SENDER || "07086571888";

    if (!ALIGO_API_KEY || !ALIGO_USER_ID) {
      console.log("[SMS] 알리고 API 미설정, 로그만 기록:", {
        to: options.to,
        message: options.message.substring(0, 50) + "...",
      });
      return { success: true }; // 로그 기록은 성공으로 처리
    }

    const formData = new URLSearchParams();
    formData.append("key", ALIGO_API_KEY);
    formData.append("user_id", ALIGO_USER_ID);
    formData.append("sender", ALIGO_SENDER);
    formData.append("receiver", options.to.replace(/-/g, ""));
    formData.append("msg", options.message);

    const response = await fetch("https://apis.aligo.in/send/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });

    const data = await response.json();

    if (data.result_code === "1") {
      console.log("[SMS] 발송 성공");
      return { success: true };
    } else {
      console.error("[SMS] 발송 실패:", data);
      return { success: false, error: data.message || "SMS 발송 실패" };
    }
  } catch (error: any) {
    console.error("[SMS] 오류:", error);
    return { success: false, error: error.message };
  }
}

// =============================================================================
// 카카오 알림톡 서비스 (알리고 API)
// =============================================================================

interface KakaoOptions {
  to: string;
  templateCode: string;
  variables: Record<string, string>;
}

export async function sendKakaoAlimtalk(options: KakaoOptions): Promise<{ success: boolean; error?: string }> {
  try {
    const ALIGO_API_KEY = process.env.ALIGO_API_KEY;
    const ALIGO_USER_ID = process.env.ALIGO_USER_ID;
    const ALIGO_SENDER_KEY = process.env.ALIGO_SENDER_KEY;

    if (!ALIGO_API_KEY || !ALIGO_USER_ID || !ALIGO_SENDER_KEY) {
      console.log("[Kakao] 알림톡 API 미설정, 로그만 기록:", {
        to: options.to,
        templateCode: options.templateCode,
      });
      return { success: true }; // 로그 기록은 성공으로 처리
    }

    const formData = new URLSearchParams();
    formData.append("apikey", ALIGO_API_KEY);
    formData.append("userid", ALIGO_USER_ID);
    formData.append("senderkey", ALIGO_SENDER_KEY);
    formData.append("tpl_code", options.templateCode);
    formData.append("sender", process.env.ALIGO_SENDER || "07086571888");
    formData.append("receiver_1", options.to.replace(/-/g, ""));

    // 변수 치환
    for (const [key, value] of Object.entries(options.variables)) {
      formData.append(`emtitle_1`, value);
    }

    const response = await fetch("https://kakaoapi.aligo.in/akv10/alimtalk/send/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });

    const data = await response.json();

    if (data.code === 0) {
      console.log("[Kakao] 알림톡 발송 성공");
      return { success: true };
    } else {
      console.error("[Kakao] 발송 실패:", data);
      return { success: false, error: data.message || "알림톡 발송 실패" };
    }
  } catch (error: any) {
    console.error("[Kakao] 오류:", error);
    return { success: false, error: error.message };
  }
}

// =============================================================================
// 신청 알림 통합 발송
// =============================================================================

interface SubmissionNotification {
  type: "proxy" | "delegate";
  name: string;
  phone: string;
  email: string;
  documentType: string;
  description?: string;
  requestId: string;
}

export async function notifyNewSubmission(data: SubmissionNotification) {
  const typeLabel = data.type === "proxy" ? "접수대행" : "대리의뢰";
  const adminEmail = process.env.ADMIN_EMAIL || "Lawyeom@naver.com";
  const adminPhone = process.env.ADMIN_PHONE || "01012345678";

  const results = {
    email: false,
    sms: false,
    kakao: false,
  };

  console.log(`[Notification] 새 ${typeLabel} 신청 알림 발송 시작:`, {
    requestId: data.requestId,
    name: data.name,
    documentType: data.documentType,
  });

  // 1. 관리자에게 이메일 발송
  const emailHtml = `
    <div style="font-family: 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); padding: 20px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">📋 새로운 ${typeLabel} 신청</h1>
      </div>
      <div style="background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; width: 100px;">신청 유형</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${typeLabel}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">신청자</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${data.name}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">연락처</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;"><a href="tel:${data.phone}">${data.phone}</a></td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">이메일</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;"><a href="mailto:${data.email}">${data.email}</a></td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">민원 종류</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${data.documentType}</td>
          </tr>
          ${data.description ? `
          <tr>
            <td style="padding: 10px; font-weight: bold; vertical-align: top;">상세 내용</td>
            <td style="padding: 10px;">${data.description}</td>
          </tr>
          ` : ""}
        </table>
        <div style="margin-top: 20px; text-align: center;">
          <a href="${process.env.NEXTAUTH_URL || "http://localhost:3000"}/admin/submissions"
             style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            관리자 페이지에서 확인하기
          </a>
        </div>
      </div>
    </div>
  `;

  const emailResult = await sendEmail({
    to: adminEmail,
    subject: `[${typeLabel}] 새로운 신청 - ${data.name}님 (${data.documentType})`,
    html: emailHtml,
  });
  results.email = emailResult.success;

  // 2. 관리자에게 SMS 발송
  const smsMessage = `[행정사합동사무소 정의]\n새 ${typeLabel} 신청\n신청자: ${data.name}\n연락처: ${data.phone}\n민원: ${data.documentType}`;

  const smsResult = await sendSms({
    to: adminPhone,
    message: smsMessage,
  });
  results.sms = smsResult.success;

  // 3. 카카오 알림톡 발송 (설정된 경우)
  if (process.env.ALIGO_SENDER_KEY) {
    const kakaoResult = await sendKakaoAlimtalk({
      to: adminPhone,
      templateCode: "NEW_SUBMISSION",
      variables: {
        type: typeLabel,
        name: data.name,
        phone: data.phone,
        documentType: data.documentType,
      },
    });
    results.kakao = kakaoResult.success;
  } else {
    results.kakao = true; // 미설정시 성공으로 처리
  }

  // 4. 신청자에게 접수 확인 이메일 발송
  const customerEmailHtml = `
    <div style="font-family: 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #10b981, #3b82f6); padding: 20px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">✅ ${typeLabel} 신청이 접수되었습니다</h1>
      </div>
      <div style="background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; color: #334155;">안녕하세요, <strong>${data.name}</strong>님!</p>
        <p style="font-size: 16px; color: #334155;">${typeLabel} 신청이 정상적으로 접수되었습니다.</p>

        <div style="background: white; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
          <p style="margin: 0 0 8px 0;"><strong>민원 종류:</strong> ${data.documentType}</p>
          <p style="margin: 0;"><strong>접수번호:</strong> ${data.requestId}</p>
        </div>

        <p style="font-size: 14px; color: #64748b;">담당 행정사가 확인 후 빠른 시일 내에 연락드리겠습니다.</p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">

        <div style="text-align: center;">
          <p style="font-size: 14px; color: #334155; margin-bottom: 8px;"><strong>행정사합동사무소 정의</strong></p>
          <p style="font-size: 14px; color: #64748b; margin: 4px 0;">전화: <a href="tel:070-8657-1888">070-8657-1888</a></p>
          <p style="font-size: 14px; color: #64748b; margin: 4px 0;">이메일: Lawyeom@naver.com</p>
        </div>
      </div>
    </div>
  `;

  await sendEmail({
    to: data.email,
    subject: `[행정사합동사무소 정의] ${typeLabel} 신청이 접수되었습니다`,
    html: customerEmailHtml,
  });

  console.log(`[Notification] 알림 발송 결과:`, results);

  return results;
}
