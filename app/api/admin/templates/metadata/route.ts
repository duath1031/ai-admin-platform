/**
 * =============================================================================
 * Template Metadata API
 * =============================================================================
 * POST /api/admin/templates/metadata
 * 템플릿 메타데이터 저장
 *
 * GET /api/admin/templates/metadata?code=TEMPLATE_CODE
 * 템플릿 메타데이터 조회
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { promises as fs } from 'fs';
import path from 'path';

const TEMPLATES_DIR = path.join(process.cwd(), 'public', 'templates', 'docx');

export async function POST(request: NextRequest) {
  try {
    // 관리자 권한 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
    if (!adminEmails.includes(session.user.email.toLowerCase())) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const metadata = await request.json();

    if (!metadata.code) {
      return NextResponse.json(
        { success: false, error: 'code는 필수입니다.' },
        { status: 400 }
      );
    }

    // 디렉토리 생성
    await fs.mkdir(TEMPLATES_DIR, { recursive: true });

    // 메타데이터 저장
    const metadataPath = path.join(TEMPLATES_DIR, `${metadata.code}.json`);
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

    console.log(`[API] Metadata saved: ${metadata.code}`);

    return NextResponse.json({
      success: true,
      message: '메타데이터가 저장되었습니다.',
    });

  } catch (error) {
    console.error('[API] Metadata save error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json(
        { success: false, error: 'code 파라미터가 필요합니다.' },
        { status: 400 }
      );
    }

    const metadataPath = path.join(TEMPLATES_DIR, `${code}.json`);

    try {
      const content = await fs.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(content);

      return NextResponse.json({
        success: true,
        metadata,
      });
    } catch {
      return NextResponse.json(
        { success: false, error: '메타데이터를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

  } catch (error) {
    console.error('[API] Metadata get error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
