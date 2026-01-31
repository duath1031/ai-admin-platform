export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: 특정 신청 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    // 관리자 권한 확인
    const adminEmails = (process.env.ADMIN_EMAILS || "Lawyeom@naver.com").split(",");
    if (!session?.user?.email || !adminEmails.includes(session.user.email)) {
      return NextResponse.json(
        { error: "접근 권한이 없습니다." },
        { status: 403 }
      );
    }

    const submission = await prisma.submissionRequest.findUnique({
      where: { id: params.id },
    });

    if (!submission) {
      return NextResponse.json(
        { error: "신청을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json(submission);
  } catch (error: any) {
    console.error("[Submission API] 상세 조회 오류:", error);
    return NextResponse.json(
      { error: "조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// PATCH: 신청 상태 업데이트
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    // 관리자 권한 확인
    const adminEmails = (process.env.ADMIN_EMAILS || "Lawyeom@naver.com").split(",");
    if (!session?.user?.email || !adminEmails.includes(session.user.email)) {
      return NextResponse.json(
        { error: "접근 권한이 없습니다." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { status, adminNote, assignedTo } = body;

    const updateData: any = {};
    if (status) {
      updateData.status = status;
      if (status === "contacted" || status === "in_progress") {
        updateData.processedAt = new Date();
      }
      if (status === "completed") {
        updateData.completedAt = new Date();
      }
    }
    if (adminNote !== undefined) updateData.adminNote = adminNote;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;

    const submission = await prisma.submissionRequest.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      submission,
    });
  } catch (error: any) {
    console.error("[Submission API] 업데이트 오류:", error);
    return NextResponse.json(
      { error: "업데이트 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
