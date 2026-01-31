export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invalidatePromptCache } from "@/lib/systemPromptService";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "Lawyeom@naver.com").split(",");

async function checkAdminAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return { authorized: false, session: null };
  }
  return { authorized: true, session };
}

// GET: 특정 프롬프트 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { authorized } = await checkAdminAuth();
    if (!authorized) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }

    const prompt = await prisma.systemPrompt.findUnique({
      where: { id: params.id },
    });

    if (!prompt) {
      return NextResponse.json({ error: "프롬프트를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ prompt });
  } catch (error: any) {
    console.error("[Admin Prompts API] 조회 오류:", error);
    return NextResponse.json({ error: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}

// PUT: 프롬프트 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { authorized, session } = await checkAdminAuth();
    if (!authorized) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }

    const body = await request.json();
    const { name, displayName, description, content, isActive, isDefault } = body;

    const existing = await prisma.systemPrompt.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "프롬프트를 찾을 수 없습니다." }, { status: 404 });
    }

    // 이름 변경 시 중복 체크
    if (name && name !== existing.name) {
      const nameExists = await prisma.systemPrompt.findUnique({ where: { name } });
      if (nameExists) {
        return NextResponse.json({ error: "이미 존재하는 프롬프트 이름입니다." }, { status: 400 });
      }
    }

    // 기본 프롬프트로 설정 시 기존 기본 해제
    if (isDefault && !existing.isDefault) {
      await prisma.systemPrompt.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const prompt = await prisma.systemPrompt.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(displayName && { displayName }),
        ...(description !== undefined && { description }),
        ...(content && { content }),
        ...(isActive !== undefined && { isActive }),
        ...(isDefault !== undefined && { isDefault }),
        version: { increment: 1 },
        updatedBy: session?.user?.email || null,
      },
    });

    // 프롬프트 캐시 무효화
    invalidatePromptCache();

    return NextResponse.json({ success: true, prompt });
  } catch (error: any) {
    console.error("[Admin Prompts API] 수정 오류:", error);
    return NextResponse.json({ error: "수정 중 오류가 발생했습니다." }, { status: 500 });
  }
}

// DELETE: 프롬프트 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { authorized } = await checkAdminAuth();
    if (!authorized) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }

    const existing = await prisma.systemPrompt.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "프롬프트를 찾을 수 없습니다." }, { status: 404 });
    }

    if (existing.isDefault) {
      return NextResponse.json(
        { error: "기본 프롬프트는 삭제할 수 없습니다. 다른 프롬프트를 기본으로 설정한 후 삭제해주세요." },
        { status: 400 }
      );
    }

    await prisma.systemPrompt.delete({
      where: { id: params.id },
    });

    // 프롬프트 캐시 무효화
    invalidatePromptCache();

    return NextResponse.json({ success: true, message: "프롬프트가 삭제되었습니다." });
  } catch (error: any) {
    console.error("[Admin Prompts API] 삭제 오류:", error);
    return NextResponse.json({ error: "삭제 중 오류가 발생했습니다." }, { status: 500 });
  }
}
