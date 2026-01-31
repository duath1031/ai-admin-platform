/**
 * Admin Template Management API
 * GET  /api/admin/templates - 템플릿 목록 조회
 * POST /api/admin/templates - 새 템플릿 업로드
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { saveTemplateToSupabase } from "@/lib/supabaseStorage";
import { extractPlaceholders } from "@/lib/document/placeholderExtractor";

/**
 * GET /api/admin/templates?category=사업자/영업&status=active
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const status = searchParams.get("status") || "active";

    const where: Record<string, string> = {};
    if (category) where.category = category;
    if (status) where.status = status;

    const templates = await prisma.formTemplate.findMany({
      where,
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        description: true,
        originalFileType: true,
        docxStoragePath: true,
        fields: true,
        gov24ServiceKey: true,
        outputFileName: true,
        status: true,
        version: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // fields JSON 파싱
    const parsed = templates.map((t) => ({
      ...t,
      fields: JSON.parse(t.fields),
      fieldCount: JSON.parse(t.fields).length,
    }));

    return NextResponse.json({ success: true, templates: parsed });
  } catch (error) {
    console.error("[Admin Templates GET]", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "서버 오류" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/templates
 * multipart/form-data:
 *   - file: DOCX 파일 (필수)
 *   - originalFile: 원본 HWP 파일 (선택)
 *   - code: 템플릿 코드 (필수)
 *   - name: 표시명 (필수)
 *   - category: 카테고리 (필수)
 *   - description: 설명 (선택)
 *   - gov24ServiceKey: 정부24 키 (선택)
 *   - outputFileName: 파일명 템플릿 (선택)
 *   - fields: JSON 문자열 (선택 - 없으면 자동 추출)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const originalFile = formData.get("originalFile") as File | null;
    const code = formData.get("code") as string;
    const name = formData.get("name") as string;
    const category = formData.get("category") as string;
    const description = formData.get("description") as string | null;
    const gov24ServiceKey = formData.get("gov24ServiceKey") as string | null;
    const outputFileName = formData.get("outputFileName") as string | null;
    const fieldsJson = formData.get("fields") as string | null;

    // 필수 파라미터 확인
    if (!file) {
      return NextResponse.json(
        { success: false, error: "DOCX 파일이 필요합니다." },
        { status: 400 }
      );
    }
    if (!code || !name || !category) {
      return NextResponse.json(
        { success: false, error: "code, name, category는 필수입니다." },
        { status: 400 }
      );
    }

    // 중복 코드 확인
    const existing = await prisma.formTemplate.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: `이미 존재하는 코드입니다: ${code}` },
        { status: 409 }
      );
    }

    // DOCX 파일 읽기
    const docxBuffer = Buffer.from(await file.arrayBuffer());

    // Supabase에 DOCX 저장
    const { storagePath: docxStoragePath } = await saveTemplateToSupabase(
      docxBuffer,
      `${code}.docx`,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

    // 원본 HWP 저장 (있는 경우)
    let originalFileUrl: string | null = null;
    let originalFileType: string | null = null;
    if (originalFile) {
      const origBuffer = Buffer.from(await originalFile.arrayBuffer());
      const origName = originalFile.name;
      const ext = origName.split(".").pop()?.toLowerCase() || "hwp";
      const { storagePath: origPath } = await saveTemplateToSupabase(
        origBuffer,
        `${code}_original.${ext}`,
        ext === "hwp" ? "application/x-hwp" : file.type
      );
      originalFileUrl = origPath;
      originalFileType = ext;
    }

    // 필드 정의: 제공된 JSON 사용 또는 자동 추출
    let fields: string;
    let extractedPlaceholders: string[] = [];

    if (fieldsJson) {
      fields = fieldsJson;
    } else {
      // DOCX에서 {{placeholder}} 자동 추출
      const extraction = await extractPlaceholders(docxBuffer);
      extractedPlaceholders = extraction.placeholders;
      fields = JSON.stringify(extraction.suggestedFields);
    }

    // DB 저장
    const template = await prisma.formTemplate.create({
      data: {
        code,
        name,
        category,
        description,
        originalFileUrl,
        originalFileType,
        docxStoragePath,
        fields,
        gov24ServiceKey,
        outputFileName: outputFileName || `${name}_{representativeName}님.docx`,
        uploadedBy: session?.user?.email || null,
      },
    });

    return NextResponse.json({
      success: true,
      template: {
        ...template,
        fields: JSON.parse(template.fields),
      },
      extractedPlaceholders:
        extractedPlaceholders.length > 0 ? extractedPlaceholders : undefined,
    });
  } catch (error) {
    console.error("[Admin Templates POST]", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "서버 오류" },
      { status: 500 }
    );
  }
}
