/**
 * =============================================================================
 * Template Upload API
 * =============================================================================
 * POST /api/admin/templates/upload
 * DOCX 템플릿 파일 업로드
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { saveTemplate } from '@/lib/document/docxEngine';

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

    // FormData 파싱
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const code = formData.get('code') as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: '파일이 필요합니다.' },
        { status: 400 }
      );
    }

    if (!file.name.endsWith('.docx')) {
      return NextResponse.json(
        { success: false, error: 'DOCX 파일만 업로드 가능합니다.' },
        { status: 400 }
      );
    }

    // 파일을 Buffer로 변환
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 템플릿 코드 생성 (파일명 기반)
    const templateCode = code || file.name
      .replace('.docx', '')
      .toUpperCase()
      .replace(/\s+/g, '_')
      .replace(/[^A-Z0-9_가-힣]/g, '');

    // 템플릿 저장
    const success = await saveTemplate(templateCode, buffer, {
      code: templateCode,
      name: file.name.replace('.docx', ''),
      category: '미분류',
      description: '',
      fields: [],
    });

    if (success) {
      return NextResponse.json({
        success: true,
        templateCode,
        message: '템플릿이 업로드되었습니다.',
      });
    } else {
      return NextResponse.json(
        { success: false, error: '템플릿 저장 실패' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('[API] Template upload error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
