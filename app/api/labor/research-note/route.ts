/**
 * 연구노트 API
 * GET  /api/labor/research-note - 연구노트 목록 (clientCompanyId 필터 지원)
 * POST /api/labor/research-note - 연구노트 생성
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientCompanyId = searchParams.get("clientCompanyId");

    const whereClause: Record<string, unknown> = {
      userId: session.user.id,
    };

    if (clientCompanyId && clientCompanyId !== "none") {
      whereClause.clientCompanyId = clientCompanyId;
    }

    const notes = await prisma.researchNote.findMany({
      where: whereClause,
      orderBy: [{ noteDate: "desc" }, { noteNumber: "desc" }],
    });

    return NextResponse.json({ success: true, data: notes });
  } catch (error) {
    console.error("[ResearchNote GET] Error:", error);
    return NextResponse.json({ error: "연구노트 목록 조회 실패" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const {
      clientCompanyId,
      projectName,
      projectCode,
      researchPeriod,
      noteDate,
      noteNumber,
      title,
      purpose,
      content,
      result,
      conclusion,
      nextPlan,
      materials,
      equipment,
      researcherName,
      supervisorName,
      status,
      attachments,
    } = body;

    if (!projectName || !title || !content) {
      return NextResponse.json(
        { error: "과제명, 제목, 연구내용은 필수입니다." },
        { status: 400 }
      );
    }

    // 거래처 ID가 있으면 소유권 확인
    if (clientCompanyId) {
      const client = await prisma.clientCompany.findFirst({
        where: { id: clientCompanyId, userId: session.user.id, isActive: true },
      });
      if (!client) {
        return NextResponse.json(
          { error: "해당 거래처를 찾을 수 없습니다." },
          { status: 404 }
        );
      }
    }

    // 자동 noteNumber: 같은 과제명 내 최대 번호 + 1
    let finalNoteNumber = noteNumber ? Number(noteNumber) : 1;
    if (!noteNumber) {
      const maxNote = await prisma.researchNote.findFirst({
        where: {
          userId: session.user.id,
          projectName,
          ...(clientCompanyId ? { clientCompanyId } : {}),
        },
        orderBy: { noteNumber: "desc" },
        select: { noteNumber: true },
      });
      if (maxNote) {
        finalNoteNumber = maxNote.noteNumber + 1;
      }
    }

    const note = await prisma.researchNote.create({
      data: {
        userId: session.user.id,
        clientCompanyId: clientCompanyId || null,
        projectName,
        projectCode: projectCode || null,
        researchPeriod: researchPeriod || null,
        noteDate: noteDate ? new Date(noteDate) : new Date(),
        noteNumber: finalNoteNumber,
        title,
        purpose: purpose || null,
        content,
        result: result || null,
        conclusion: conclusion || null,
        nextPlan: nextPlan || null,
        materials: materials || null,
        equipment: equipment || null,
        researcherName: researcherName || null,
        supervisorName: supervisorName || null,
        attachments: attachments ? JSON.stringify(attachments) : null,
        status: status || "draft",
      },
    });

    return NextResponse.json({ success: true, data: note }, { status: 201 });
  } catch (error) {
    console.error("[ResearchNote POST] Error:", error);
    return NextResponse.json({ error: "연구노트 생성 실패" }, { status: 500 });
  }
}
