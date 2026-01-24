import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "Lawyeom@naver.com").split(",");

// 기본 설정 정의
const DEFAULT_SETTINGS = [
  // 일반 설정
  { key: "site_name", category: "general", value: "AI 행정사 - 어드미니", displayName: "사이트 이름", valueType: "string" },
  { key: "site_description", category: "general", value: "AI 기반 행정 업무 자동화 플랫폼", displayName: "사이트 설명", valueType: "string" },
  { key: "contact_email", category: "general", value: "support@admini.co.kr", displayName: "고객센터 이메일", valueType: "string" },
  { key: "contact_phone", category: "general", value: "02-1234-5678", displayName: "고객센터 전화", valueType: "string" },

  // 외관 설정
  { key: "primary_color", category: "appearance", value: "#3B82F6", displayName: "주요 색상", valueType: "string" },
  { key: "logo_url", category: "appearance", value: "", displayName: "로고 URL", valueType: "string" },
  { key: "favicon_url", category: "appearance", value: "", displayName: "파비콘 URL", valueType: "string" },

  // 푸터 설정
  { key: "footer_text", category: "footer", value: "행정사합동사무소 정의 | 대표: 염현수 행정사", displayName: "푸터 문구", valueType: "string" },
  { key: "footer_links", category: "footer", value: JSON.stringify([
    { label: "이용약관", url: "/terms" },
    { label: "개인정보처리방침", url: "/privacy" },
  ]), displayName: "푸터 링크", valueType: "json" },

  // 기능 설정
  { key: "enable_chat", category: "features", value: "true", displayName: "AI 채팅 활성화", valueType: "boolean" },
  { key: "enable_document", category: "features", value: "true", displayName: "문서 생성 활성화", valueType: "boolean" },
  { key: "enable_submission", category: "features", value: "true", displayName: "민원 접수 활성화", valueType: "boolean" },
  { key: "maintenance_mode", category: "features", value: "false", displayName: "점검 모드", valueType: "boolean" },
  { key: "maintenance_message", category: "features", value: "시스템 점검 중입니다. 잠시 후 다시 이용해주세요.", displayName: "점검 안내 메시지", valueType: "string" },
];

async function checkAdminAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return { authorized: false, session: null };
  }
  return { authorized: true, session };
}

// GET: 설정 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { authorized } = await checkAdminAuth();
    if (!authorized) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    // DB에서 설정 조회
    const where = category ? { category } : {};
    let settings = await prisma.siteSettings.findMany({
      where,
      orderBy: [{ category: "asc" }, { key: "asc" }],
    });

    // 설정이 없으면 기본 설정 생성
    if (settings.length === 0) {
      await prisma.siteSettings.createMany({
        data: DEFAULT_SETTINGS,
      });
      settings = await prisma.siteSettings.findMany({
        where,
        orderBy: [{ category: "asc" }, { key: "asc" }],
      });
    }

    // 카테고리별로 그룹화
    const grouped = settings.reduce((acc, s) => {
      if (!acc[s.category]) acc[s.category] = [];
      acc[s.category].push(s);
      return acc;
    }, {} as Record<string, typeof settings>);

    return NextResponse.json({ settings, grouped });
  } catch (error: any) {
    console.error("[Admin Settings API] 조회 오류:", error);
    return NextResponse.json({ error: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}

// PUT: 설정 일괄 업데이트
export async function PUT(request: NextRequest) {
  try {
    const { authorized, session } = await checkAdminAuth();
    if (!authorized) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }

    const body = await request.json();
    const { settings } = body;

    if (!settings || !Array.isArray(settings)) {
      return NextResponse.json({ error: "settings 배열이 필요합니다." }, { status: 400 });
    }

    // 각 설정 업데이트
    for (const setting of settings) {
      await prisma.siteSettings.update({
        where: { key: setting.key },
        data: {
          value: setting.value,
          updatedBy: session?.user?.email || null,
        },
      });
    }

    return NextResponse.json({ success: true, message: "설정이 저장되었습니다." });
  } catch (error: any) {
    console.error("[Admin Settings API] 저장 오류:", error);
    return NextResponse.json({ error: "저장 중 오류가 발생했습니다." }, { status: 500 });
  }
}
