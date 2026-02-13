export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET - 거래처 목록 조회
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clients = await prisma.clientCompany.findMany({
      where: { userId: session.user.id, isActive: true },
      orderBy: { companyName: "asc" },
    });

    return NextResponse.json({ success: true, data: clients });
  } catch (error) {
    console.error("Client companies fetch error:", error);
    return NextResponse.json({ error: "거래처 목록 조회 실패" }, { status: 500 });
  }
}

// POST - 거래처 등록
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { companyName, ownerName, bizRegNo, address, phone, npBizNo, hiBizNo, eiBizNo, memo } = body;

    if (!companyName) {
      return NextResponse.json({ error: "거래처 상호를 입력해주세요." }, { status: 400 });
    }

    const client = await prisma.clientCompany.create({
      data: {
        userId: session.user.id,
        companyName,
        ownerName: ownerName || null,
        bizRegNo: bizRegNo || null,
        address: address || null,
        phone: phone || null,
        npBizNo: npBizNo || null,
        hiBizNo: hiBizNo || null,
        eiBizNo: eiBizNo || null,
        memo: memo || null,
      },
    });

    return NextResponse.json({ success: true, data: client });
  } catch (error) {
    console.error("Client company create error:", error);
    return NextResponse.json({ error: "거래처 등록 실패" }, { status: 500 });
  }
}
