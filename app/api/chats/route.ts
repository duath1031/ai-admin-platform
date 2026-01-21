import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET: Fetch user's chat history
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const chats = await prisma.chat.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return NextResponse.json(chats);
  } catch (error) {
    console.error("Chats fetch error:", error);
    return NextResponse.json(
      { error: "채팅 목록을 불러오는데 실패했습니다." },
      { status: 500 }
    );
  }
}

// POST: Create new chat
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { title } = await req.json();

    const chat = await prisma.chat.create({
      data: {
        title: title || "새 상담",
        userId: session.user.id,
      },
    });

    return NextResponse.json(chat);
  } catch (error) {
    console.error("Chat create error:", error);
    return NextResponse.json(
      { error: "채팅을 생성하는데 실패했습니다." },
      { status: 500 }
    );
  }
}
