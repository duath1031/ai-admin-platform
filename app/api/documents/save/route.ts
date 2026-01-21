import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();
    const { type, title, content, applicantName, applicantId, applicantAddress, applicantPhone, recipient, purpose, reason, additionalInfo } = data;

    if (!content) {
      return NextResponse.json(
        { error: "저장할 내용이 없습니다." },
        { status: 400 }
      );
    }

    const document = await prisma.document.create({
      data: {
        title: title || getDefaultTitle(type),
        type: type || "application",
        content,
        inputData: {
          applicantName,
          applicantId,
          applicantAddress,
          applicantPhone,
          recipient,
          purpose,
          reason,
          additionalInfo,
        },
        status: "completed",
        userId: session.user.id,
      },
    });

    return NextResponse.json({ id: document.id, message: "저장되었습니다." });
  } catch (error) {
    console.error("Document save error:", error);
    return NextResponse.json(
      { error: "저장에 실패했습니다." },
      { status: 500 }
    );
  }
}

function getDefaultTitle(type: string): string {
  const titles: Record<string, string> = {
    petition: "진정서",
    appeal: "탄원서",
    objection: "이의신청서",
    application: "신청서",
  };
  return titles[type] || "서류";
}
