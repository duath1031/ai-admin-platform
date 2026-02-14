export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET - 서류 상세 조회
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const document = await prisma.clientDocument.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
      include: {
        clientCompany: {
          select: {
            id: true,
            companyName: true,
            ownerName: true,
            bizRegNo: true,
          },
        },
      },
    });

    if (!document) {
      return NextResponse.json({ error: "서류를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: document,
    });
  } catch (error) {
    console.error("Client document fetch error:", error);
    return NextResponse.json({ error: "서류 조회 실패" }, { status: 500 });
  }
}

// PUT - 서류 수정
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // 소유권 확인
    const existing = await prisma.clientDocument.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "서류를 찾을 수 없습니다." }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.documentType !== undefined) updateData.documentType = body.documentType;

    const document = await prisma.clientDocument.update({
      where: { id: params.id },
      data: updateData,
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
    console.error("Client document update error:", error);
    return NextResponse.json({ error: "서류 수정 실패" }, { status: 500 });
  }
}

// DELETE - 서류 삭제
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await prisma.clientDocument.deleteMany({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "서류를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "서류가 삭제되었습니다.",
    });
  } catch (error) {
    console.error("Client document delete error:", error);
    return NextResponse.json({ error: "서류 삭제 실패" }, { status: 500 });
  }
}
