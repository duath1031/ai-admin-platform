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

    const [documents, chats] = await Promise.all([
      prisma.document.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          title: true,
          createdAt: true,
        },
      }),
      prisma.chat.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          title: true,
          createdAt: true,
        },
      }),
    ]);

    const activities = [
      ...documents.map((doc) => ({
        id: doc.id,
        type: "document" as const,
        title: doc.title,
        createdAt: doc.createdAt.toISOString(),
      })),
      ...chats.map((chat) => ({
        id: chat.id,
        type: "chat" as const,
        title: chat.title || "AI 상담",
        createdAt: chat.createdAt.toISOString(),
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

    return NextResponse.json(activities);
  } catch (error) {
    console.error("Activities fetch error:", error);
    return NextResponse.json(
      { error: "활동 내역을 불러오는데 실패했습니다." },
      { status: 500 }
    );
  }
}
