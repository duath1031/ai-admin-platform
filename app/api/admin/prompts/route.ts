export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "Lawyeom@naver.com").split(",");

async function checkAdminAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return { authorized: false, session: null };
  }
  return { authorized: true, session };
}

// GET: 시스템 프롬프트 목록 조회
export async function GET() {
  try {
    const { authorized } = await checkAdminAuth();
    if (!authorized) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }

    const prompts = await prisma.systemPrompt.findMany({
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ prompts });
  } catch (error: any) {
    console.error("[Admin Prompts API] 조회 오류:", error);
    return NextResponse.json({ error: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}

// POST: 새 시스템 프롬프트 생성
export async function POST(request: NextRequest) {
  try {
    const { authorized, session } = await checkAdminAuth();
    if (!authorized) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }

    const body = await request.json();
    const { name, displayName, description, content, isActive, isDefault } = body;

    if (!name || !displayName || !content) {
      return NextResponse.json(
        { error: "필수 항목(name, displayName, content)을 모두 입력해주세요." },
        { status: 400 }
      );
    }

    // 이름 중복 체크
    const existing = await prisma.systemPrompt.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json({ error: "이미 존재하는 프롬프트 이름입니다." }, { status: 400 });
    }

    // 기본 프롬프트로 설정 시 기존 기본 해제
    if (isDefault) {
      await prisma.systemPrompt.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const prompt = await prisma.systemPrompt.create({
      data: {
        name,
        displayName,
        description: description || null,
        content,
        isActive: isActive ?? true,
        isDefault: isDefault ?? false,
        createdBy: session?.user?.email || null,
        updatedBy: session?.user?.email || null,
      },
    });

    return NextResponse.json({ success: true, prompt });
  } catch (error: any) {
    console.error("[Admin Prompts API] 생성 오류:", error);
    return NextResponse.json({ error: "생성 중 오류가 발생했습니다." }, { status: 500 });
  }
}
