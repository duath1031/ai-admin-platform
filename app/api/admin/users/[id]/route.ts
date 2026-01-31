export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth } from "@/lib/admin-auth";

// GET: 특정 사용자 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { authorized } = await checkAdminAuth();
    if (!authorized) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      include: {
        subscriptions: {
          include: { plan: true },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        payments: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        creditTransactions: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        _count: {
          select: {
            chats: true,
            documents: true,
            civilServiceSubmissions: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error: any) {
    console.error("[Admin Users API] 상세 조회 오류:", error);
    return NextResponse.json({ error: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}

// PATCH: 사용자 정보 수정
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { authorized } = await checkAdminAuth();
    if (!authorized) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }

    const body = await request.json();
    const { plan, credits, phone, role } = body;

    const existing = await prisma.user.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
    }

    const updateData: any = {};

    if (plan !== undefined) {
      updateData.plan = plan;
    }

    if (credits !== undefined) {
      // 크레딧 변경 시 트랜잭션 기록
      const creditDiff = credits - existing.credits;
      if (creditDiff !== 0) {
        updateData.credits = credits;

        await prisma.creditTransaction.create({
          data: {
            userId: params.id,
            amount: creditDiff,
            balance: credits,
            type: creditDiff > 0 ? "bonus" : "use",
            description: `관리자 조정: ${creditDiff > 0 ? "+" : ""}${creditDiff} 크레딧`,
          },
        });
      }
    }

    if (phone !== undefined) {
      updateData.phone = phone;
    }

    if (role !== undefined && (role === "USER" || role === "ADMIN")) {
      updateData.role = role;
    }

    const user = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    console.error("[Admin Users API] 수정 오류:", error);
    return NextResponse.json({ error: "수정 중 오류가 발생했습니다." }, { status: 500 });
  }
}

// DELETE: 사용자 강제 탈퇴
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { authorized, session } = await checkAdminAuth();
    if (!authorized) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }

    // 자기 자신 삭제 방지
    if (session?.user?.id === params.id) {
      return NextResponse.json({ error: "자기 자신은 삭제할 수 없습니다." }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
    }

    // Cascade 삭제 (Account, Session 등 관련 레코드 포함)
    await prisma.user.delete({
      where: { id: params.id },
    });

    console.log(`[Admin] User deleted: ${existing.email} by ${session?.user?.email}`);

    return NextResponse.json({ success: true, message: "사용자가 삭제되었습니다." });
  } catch (error: any) {
    console.error("[Admin Users API] 삭제 오류:", error);
    return NextResponse.json({ error: "삭제 중 오류가 발생했습니다." }, { status: 500 });
  }
}
