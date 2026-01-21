import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [totalDocuments, completedDocuments, draftDocuments, totalChats] = await Promise.all([
      prisma.document.count({
        where: { userId: session.user.id },
      }),
      prisma.document.count({
        where: { userId: session.user.id, status: "completed" },
      }),
      prisma.document.count({
        where: { userId: session.user.id, status: "draft" },
      }),
      prisma.chat.count({
        where: { userId: session.user.id },
      }),
    ]);

    return NextResponse.json({
      totalDocuments,
      completedDocuments,
      draftDocuments,
      totalChats,
    });
  } catch (error) {
    console.error("Stats fetch error:", error);
    return NextResponse.json(
      { error: "통계를 불러오는데 실패했습니다." },
      { status: 500 }
    );
  }
}
