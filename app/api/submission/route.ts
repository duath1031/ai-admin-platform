import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyNewSubmission } from "@/lib/notification";

// POST: 새 신청 접수
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = await request.json();

    const { type, name, phone, email, documentType, description, attachmentUrls } = body;

    // 유효성 검사
    if (!type || !name || !phone || !email || !documentType) {
      return NextResponse.json(
        { error: "필수 항목을 모두 입력해주세요." },
        { status: 400 }
      );
    }

    if (!["proxy", "delegate"].includes(type)) {
      return NextResponse.json(
        { error: "잘못된 신청 유형입니다." },
        { status: 400 }
      );
    }

    // DB에 저장
    const submission = await prisma.submissionRequest.create({
      data: {
        type,
        name,
        phone,
        email,
        documentType,
        description: description || null,
        attachmentUrls: attachmentUrls ? JSON.stringify(attachmentUrls) : null,
        userId: session?.user?.id || null,
        status: "pending",
      },
    });

    // 알림 발송 (비동기로 처리)
    notifyNewSubmission({
      type,
      name,
      phone,
      email,
      documentType,
      description,
      requestId: submission.id,
    }).then((results) => {
      // 알림 결과 업데이트
      prisma.submissionRequest.update({
        where: { id: submission.id },
        data: {
          emailSent: results.email,
          smsSent: results.sms,
          kakaoSent: results.kakao,
        },
      }).catch(console.error);
    });

    return NextResponse.json({
      success: true,
      requestId: submission.id,
      message: "신청이 접수되었습니다.",
    });
  } catch (error: any) {
    console.error("[Submission API] 오류:", error);
    return NextResponse.json(
      { error: "신청 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// GET: 신청 목록 조회 (관리자용)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    // 관리자 권한 확인 (이메일 기반 간단한 체크)
    const adminEmails = (process.env.ADMIN_EMAILS || "Lawyeom@naver.com").split(",");
    if (!session?.user?.email || !adminEmails.includes(session.user.email)) {
      return NextResponse.json(
        { error: "접근 권한이 없습니다." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const [submissions, total] = await Promise.all([
      prisma.submissionRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.submissionRequest.count({ where }),
    ]);

    return NextResponse.json({
      submissions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("[Submission API] 조회 오류:", error);
    return NextResponse.json(
      { error: "조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
