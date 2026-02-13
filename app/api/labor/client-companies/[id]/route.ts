export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET - 거래처 상세 조회
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const client = await prisma.clientCompany.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!client) {
      return NextResponse.json({ error: "거래처를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: client });
  } catch (error) {
    console.error("Client company fetch error:", error);
    return NextResponse.json({ error: "거래처 조회 실패" }, { status: 500 });
  }
}

// PUT - 거래처 수정
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.clientCompany.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "거래처를 찾을 수 없습니다." }, { status: 404 });
    }

    const client = await prisma.clientCompany.update({
      where: { id },
      data: {
        companyName: body.companyName ?? existing.companyName,
        ownerName: body.ownerName ?? existing.ownerName,
        bizRegNo: body.bizRegNo ?? existing.bizRegNo,
        address: body.address ?? existing.address,
        phone: body.phone ?? existing.phone,
        npBizNo: body.npBizNo ?? existing.npBizNo,
        hiBizNo: body.hiBizNo ?? existing.hiBizNo,
        eiBizNo: body.eiBizNo ?? existing.eiBizNo,
        memo: body.memo ?? existing.memo,
      },
    });

    return NextResponse.json({ success: true, data: client });
  } catch (error) {
    console.error("Client company update error:", error);
    return NextResponse.json({ error: "거래처 수정 실패" }, { status: 500 });
  }
}

// DELETE - 거래처 삭제 (soft delete)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.clientCompany.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "거래처를 찾을 수 없습니다." }, { status: 404 });
    }

    await prisma.clientCompany.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Client company delete error:", error);
    return NextResponse.json({ error: "거래처 삭제 실패" }, { status: 500 });
  }
}
