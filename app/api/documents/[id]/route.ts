import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET: Fetch single document
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const document = await prisma.document.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: "서류를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json(document);
  } catch (error) {
    console.error("Document fetch error:", error);
    return NextResponse.json(
      { error: "서류를 불러오는데 실패했습니다." },
      { status: 500 }
    );
  }
}

// PUT: Update document
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();
    const { title, content, status } = data;

    const document = await prisma.document.updateMany({
      where: {
        id: params.id,
        userId: session.user.id,
      },
      data: {
        ...(title && { title }),
        ...(content && { content }),
        ...(status && { status }),
        updatedAt: new Date(),
      },
    });

    if (document.count === 0) {
      return NextResponse.json(
        { error: "서류를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "수정되었습니다." });
  } catch (error) {
    console.error("Document update error:", error);
    return NextResponse.json(
      { error: "수정에 실패했습니다." },
      { status: 500 }
    );
  }
}

// DELETE: Delete document
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const document = await prisma.document.deleteMany({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    if (document.count === 0) {
      return NextResponse.json(
        { error: "서류를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "삭제되었습니다." });
  } catch (error) {
    console.error("Document delete error:", error);
    return NextResponse.json(
      { error: "삭제에 실패했습니다." },
      { status: 500 }
    );
  }
}
