import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET: Fetch single chat with messages
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const chat = await prisma.chat.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!chat) {
      return NextResponse.json(
        { error: "채팅을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json(chat);
  } catch (error) {
    console.error("Chat fetch error:", error);
    return NextResponse.json(
      { error: "채팅을 불러오는데 실패했습니다." },
      { status: 500 }
    );
  }
}

// PUT: Update chat title
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { title } = await req.json();

    const chat = await prisma.chat.updateMany({
      where: {
        id: params.id,
        userId: session.user.id,
      },
      data: { title },
    });

    if (chat.count === 0) {
      return NextResponse.json(
        { error: "채팅을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "수정되었습니다." });
  } catch (error) {
    console.error("Chat update error:", error);
    return NextResponse.json(
      { error: "수정에 실패했습니다." },
      { status: 500 }
    );
  }
}

// DELETE: Delete chat and its messages
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const chat = await prisma.chat.deleteMany({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    if (chat.count === 0) {
      return NextResponse.json(
        { error: "채팅을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "삭제되었습니다." });
  } catch (error) {
    console.error("Chat delete error:", error);
    return NextResponse.json(
      { error: "삭제에 실패했습니다." },
      { status: 500 }
    );
  }
}
