export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET - 거래처별 서류 목록 조회
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const clientCompanyId = searchParams.get("clientCompanyId");
    const category = searchParams.get("category");
    const status = searchParams.get("status") || "active";

    const where: Record<string, unknown> = {
      userId: session.user.id,
    };

    if (clientCompanyId) {
      where.clientCompanyId = clientCompanyId;
    }
    if (category && category !== "all") {
      where.category = category;
    }
    if (status && status !== "all") {
      where.status = status;
    }

    const documents = await prisma.clientDocument.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        clientCompany: {
          select: {
            id: true,
            companyName: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: documents,
    });
  } catch (error) {
    console.error("Client documents fetch error:", error);
    return NextResponse.json({ error: "서류 목록 조회 실패" }, { status: 500 });
  }
}

// POST - 서류 추가
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    if (!body.clientCompanyId) {
      return NextResponse.json({ error: "거래처를 선택해주세요." }, { status: 400 });
    }
    if (!body.category) {
      return NextResponse.json({ error: "카테고리를 선택해주세요." }, { status: 400 });
    }
    if (!body.title) {
      return NextResponse.json({ error: "제목을 입력해주세요." }, { status: 400 });
    }

    // 거래처 소유권 확인
    const client = await prisma.clientCompany.findFirst({
      where: {
        id: body.clientCompanyId,
        userId: session.user.id,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "거래처를 찾을 수 없습니다." }, { status: 404 });
    }

    const document = await prisma.clientDocument.create({
      data: {
        clientCompanyId: body.clientCompanyId,
        userId: session.user.id,
        category: body.category,
        documentType: body.documentType || body.category,
        title: body.title,
        description: body.description || null,
        fileUrl: body.fileUrl || null,
        fileType: body.fileType || null,
        metadata: body.metadata ? JSON.stringify(body.metadata) : null,
        status: "active",
      },
      include: {
        clientCompany: {
          select: {
            id: true,
            companyName: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: document,
    });
  } catch (error) {
    console.error("Client document create error:", error);
    return NextResponse.json({ error: "서류 등록 실패" }, { status: 500 });
  }
}
