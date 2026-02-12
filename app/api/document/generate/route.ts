/**
 * =============================================================================
 * Document Generation API
 * =============================================================================
 * POST /api/document/generate - 서식 문서 생성
 *
 * 요청:
 * {
 *   templateKey: "통신판매업신고서",
 *   formData: { businessName: "...", representativeName: "...", ... },
 *   format: "docx" // 또는 "pdf" (현재 docx만 지원)
 * }
 *
 * 응답:
 * - 성공: 문서 파일 (Content-Disposition: attachment)
 * - 실패: JSON 에러 메시지
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateDocx, validateFormData, FormData } from "@/lib/document/generator";
import { FORM_TEMPLATES } from "@/lib/document/templates";
import prisma from "@/lib/prisma";
import { deductTokens } from "@/lib/token/tokenService";
import { checkFeatureAccess } from "@/lib/token/planAccess";

export async function POST(req: NextRequest) {
  try {
    // 세션 확인 (필수)
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "로그인이 필요합니다." }, { status: 401 });
    }

    // 토큰/플랜 체크
    const userId = session.user.id;
    const access = await checkFeatureAccess(userId, "document_create");
    if (!access.allowed) {
      return NextResponse.json({ success: false, error: "플랜 업그레이드가 필요합니다.", requiredPlan: access.requiredPlan }, { status: 403 });
    }
    const deducted = await deductTokens(userId, "document_create");
    if (!deducted) {
      return NextResponse.json({ success: false, error: "토큰이 부족합니다.", required: 3000, redirect: "/token-charge" }, { status: 402 });
    }

    // 요청 파싱
    const body = await req.json();
    const { templateKey, formData, format = "docx" } = body;

    // 필수 파라미터 확인
    if (!templateKey) {
      return NextResponse.json(
        { success: false, error: "templateKey가 필요합니다." },
        { status: 400 }
      );
    }

    if (!formData || typeof formData !== "object") {
      return NextResponse.json(
        { success: false, error: "formData가 필요합니다." },
        { status: 400 }
      );
    }

    // 템플릿 확인 (레거시 또는 DB)
    const template = FORM_TEMPLATES[templateKey];
    if (!template) {
      // DB 템플릿 확인
      const dbTemplate = await prisma.formTemplate.findUnique({
        where: { code: templateKey },
      });
      if (!dbTemplate || dbTemplate.status !== "active") {
        return NextResponse.json(
          { success: false, error: `템플릿을 찾을 수 없습니다: ${templateKey}` },
          { status: 404 }
        );
      }
      // DB 템플릿은 generator.ts 내부에서 검증하므로 바로 생성 진행
    } else {
      // 레거시 템플릿 필수 필드 검증
      const validation = validateFormData(template, formData as FormData);
      if (!validation.valid) {
        return NextResponse.json(
          {
            success: false,
            error: "필수 항목이 누락되었습니다.",
            missingFields: validation.missingFields,
          },
          { status: 400 }
        );
      }
    }

    console.log(`[Document Generate] Template: ${templateKey}, User: ${session?.user?.email || "anonymous"}`);

    // 문서 생성
    const result = await generateDocx(templateKey, formData as FormData);

    if (!result.success || !result.fileData) {
      return NextResponse.json(
        { success: false, error: result.error || "문서 생성 실패" },
        { status: 500 }
      );
    }

    // Buffer를 정확한 바이너리로 변환 (Node.js Buffer pool 문제 방지)
    // Buffer가 pool에서 할당되면 underlying ArrayBuffer가 더 크므로
    // 정확한 byte range만 추출해야 DOCX ZIP 구조가 유지됨
    const safeBuffer = Buffer.from(result.fileData);

    const headers = new Headers();
    headers.set("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    headers.set("Content-Disposition", "attachment; filename=document.docx");
    headers.set("Content-Length", String(safeBuffer.length));
    headers.set("Cache-Control", "no-cache, no-store");

    console.log(`[Document Generate] Success: ${result.fileName} (${safeBuffer.length} bytes)`);

    return new NextResponse(safeBuffer, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("[Document Generate] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "서버 오류",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/document/generate?templateKey=xxx
 * 템플릿 필드 정보 조회 (AI가 질문 목록 생성할 때 사용)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const templateKey = searchParams.get("templateKey");

    if (!templateKey) {
      // 레거시 템플릿 목록
      const legacyTemplates = Object.entries(FORM_TEMPLATES).map(([key, template]) => ({
        key,
        id: template.id,
        name: template.name,
        category: template.category,
        description: template.description,
        fieldCount: template.fields.length,
        requiredFieldCount: template.fields.filter((f) => f.required).length,
        source: "legacy" as const,
      }));

      // DB 템플릿 목록
      let dbTemplates: Array<{
        key: string;
        id: string;
        name: string;
        category: string;
        description: string;
        fieldCount: number;
        requiredFieldCount: number;
        source: string;
      }> = [];
      try {
        const dbResults = await prisma.formTemplate.findMany({
          where: { status: "active" },
          orderBy: { name: "asc" },
        });
        dbTemplates = dbResults.map((t) => {
          const fields = JSON.parse(t.fields);
          return {
            key: t.code,
            id: t.id,
            name: t.name,
            category: t.category,
            description: t.description || "",
            fieldCount: fields.length,
            requiredFieldCount: fields.filter((f: { required?: boolean }) => f.required).length,
            source: "db" as const,
          };
        });
      } catch (e) {
        console.warn("[Document Generate GET] DB 조회 실패:", e);
      }

      // DB 템플릿이 레거시를 override (같은 code)
      const dbCodes = new Set(dbTemplates.map((t) => t.key));
      const merged = [
        ...dbTemplates,
        ...legacyTemplates.filter((t) => !dbCodes.has(t.key)),
      ];

      return NextResponse.json({
        success: true,
        templates: merged,
      });
    }

    // 특정 템플릿 상세 정보
    const template = FORM_TEMPLATES[templateKey];
    if (template) {
      return NextResponse.json({
        success: true,
        template: { key: templateKey, ...template, source: "legacy" },
      });
    }

    // DB 템플릿 fallback
    try {
      const dbTemplate = await prisma.formTemplate.findUnique({
        where: { code: templateKey },
      });
      if (dbTemplate && dbTemplate.status === "active") {
        return NextResponse.json({
          success: true,
          template: {
            key: dbTemplate.code,
            id: dbTemplate.id,
            name: dbTemplate.name,
            category: dbTemplate.category,
            description: dbTemplate.description,
            fields: JSON.parse(dbTemplate.fields),
            gov24ServiceKey: dbTemplate.gov24ServiceKey,
            outputFileName: dbTemplate.outputFileName,
            source: "db",
          },
        });
      }
    } catch (e) {
      console.warn("[Document Generate GET] DB 조회 실패:", e);
    }

    return NextResponse.json(
      { success: false, error: `템플릿을 찾을 수 없습니다: ${templateKey}` },
      { status: 404 }
    );
  } catch (error) {
    console.error("[Document Generate GET] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "서버 오류",
      },
      { status: 500 }
    );
  }
}
