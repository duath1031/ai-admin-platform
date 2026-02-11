export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

async function getProfile(userId: string) {
  return prisma.companyProfile.findUnique({ where: { userId } });
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: '인증 필요' }, { status: 401 });
    const profile = await getProfile(session.user.id);
    if (!profile) return NextResponse.json({ error: '프로필 없음' }, { status: 404 });
    const items = await prisma.companyCertification.findMany({ where: { companyProfileId: profile.id }, orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ success: true, data: items });
  } catch (e) { console.error(e); return NextResponse.json({ error: '조회 오류' }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: '인증 필요' }, { status: 401 });
    const profile = await getProfile(session.user.id);
    if (!profile) return NextResponse.json({ error: '프로필 없음' }, { status: 404 });
    const body = await req.json();
    if (!body.certType || !body.certName) return NextResponse.json({ error: '인증유형과 인증명 필수' }, { status: 400 });
    const created = await prisma.companyCertification.create({
      data: {
        companyProfileId: profile.id, certType: body.certType, certName: body.certName,
        certNumber: body.certNumber ?? null, issuer: body.issuer ?? null,
        issueDate: body.issueDate ? new Date(body.issueDate) : null,
        expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
        isActive: body.isActive ?? true,
      },
    });
    return NextResponse.json({ success: true, data: created });
  } catch (e) { console.error(e); return NextResponse.json({ error: '등록 오류' }, { status: 500 }); }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: '인증 필요' }, { status: 401 });
    const profile = await getProfile(session.user.id);
    if (!profile) return NextResponse.json({ error: '프로필 없음' }, { status: 404 });
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: 'id 필수' }, { status: 400 });
    const existing = await prisma.companyCertification.findUnique({ where: { id: body.id } });
    if (!existing || existing.companyProfileId !== profile.id) return NextResponse.json({ error: '찾을 수 없음' }, { status: 404 });
    const updated = await prisma.companyCertification.update({
      where: { id: body.id },
      data: {
        ...(body.certType !== undefined && { certType: body.certType }),
        ...(body.certName !== undefined && { certName: body.certName }),
        ...(body.certNumber !== undefined && { certNumber: body.certNumber }),
        ...(body.issuer !== undefined && { issuer: body.issuer }),
        ...(body.issueDate !== undefined && { issueDate: body.issueDate ? new Date(body.issueDate) : null }),
        ...(body.expiryDate !== undefined && { expiryDate: body.expiryDate ? new Date(body.expiryDate) : null }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (e) { console.error(e); return NextResponse.json({ error: '수정 오류' }, { status: 500 }); }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: '인증 필요' }, { status: 401 });
    const profile = await getProfile(session.user.id);
    if (!profile) return NextResponse.json({ error: '프로필 없음' }, { status: 404 });
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id 필수' }, { status: 400 });
    const existing = await prisma.companyCertification.findUnique({ where: { id } });
    if (!existing || existing.companyProfileId !== profile.id) return NextResponse.json({ error: '찾을 수 없음' }, { status: 404 });
    await prisma.companyCertification.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) { console.error(e); return NextResponse.json({ error: '삭제 오류' }, { status: 500 }); }
}
