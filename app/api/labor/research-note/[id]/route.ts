/**
 * 연구노트 상세 API
 * GET    /api/labor/research-note/[id] - 상세 조회
 * PUT    /api/labor/research-note/[id] - 수정
 * DELETE /api/labor/research-note/[id] - 삭제
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { id } = await params;
    const note = await prisma.researchNote.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!note) {
      return NextResponse.json({ error: "연구노트를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: note });
  } catch (error) {
    console.error("[ResearchNote GET] Error:", error);
    return NextResponse.json({ error: "연구노트 조회 실패" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.researchNote.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "연구노트를 찾을 수 없습니다." }, { status: 404 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    const stringFields = [
      "projectName",
      "projectCode",
      "researchPeriod",
      "title",
      "purpose",
      "content",
      "result",
      "conclusion",
      "nextPlan",
      "materials",
      "equipment",
      "researcherName",
      "supervisorName",
      "status",
    ];
    for (const f of stringFields) {
      if (body[f] !== undefined) {
        updateData[f] = body[f] || null;
      }
    }

    // 필수 필드는 null 방지
    if (body.projectName !== undefined) updateData.projectName = body.projectName;
    if (body.title !== undefined) updateData.title = body.title;
    if (body.content !== undefined) updateData.content = body.content;

    if (body.noteDate !== undefined) {
      updateData.noteDate = body.noteDate ? new Date(body.noteDate) : new Date();
    }
    if (body.noteNumber !== undefined) {
      updateData.noteNumber = Number(body.noteNumber) || 1;
    }
    if (body.clientCompanyId !== undefined) {
      updateData.clientCompanyId = body.clientCompanyId || null;
    }

    const note = await prisma.researchNote.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: note });
  } catch (error) {
    console.error("[ResearchNote PUT] Error:", error);
    return NextResponse.json({ error: "연구노트 수정 실패" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.researchNote.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "연구노트를 찾을 수 없습니다." }, { status: 404 });
    }

    await prisma.researchNote.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "연구노트가 삭제되었습니다." });
  } catch (error) {
    console.error("[ResearchNote DELETE] Error:", error);
    return NextResponse.json({ error: "연구노트 삭제 실패" }, { status: 500 });
  }
}
