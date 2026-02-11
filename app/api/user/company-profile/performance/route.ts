export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

const serialize = (obj: any) => JSON.parse(JSON.stringify(obj, (_, v) => typeof v === 'bigint' ? Number(v) : v));

async function getProfile(userId: string) {
  return prisma.companyProfile.findUnique({ where: { userId } });
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: '인증 필요' }, { status: 401 });
    const profile = await getProfile(session.user.id);
    if (!profile) return NextResponse.json({ error: '프로필 없음' }, { status: 404 });
    const items = await prisma.performanceRecord.findMany({ where: { companyProfileId: profile.id }, orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ success: true, data: serialize(items) });
  } catch (e) { console.error(e); return NextResponse.json({ error: '조회 오류' }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: '인증 필요' }, { status: 401 });
    const profile = await getProfile(session.user.id);
    if (!profile) return NextResponse.json({ error: '프로필 없음' }, { status: 404 });
    const body = await req.json();
    if (!body.projectName) return NextResponse.json({ error: '사업명 필수' }, { status: 400 });
    const created = await prisma.performanceRecord.create({
      data: {
        companyProfileId: profile.id, projectName: body.projectName,
        clientName: body.clientName ?? null,
        contractAmount: body.contractAmount != null ? BigInt(body.contractAmount) : null,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        projectType: body.projectType ?? null, description: body.description ?? null,
      },
    });
    return NextResponse.json({ success: true, data: serialize(created) });
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
    const existing = await prisma.performanceRecord.findUnique({ where: { id: body.id } });
    if (!existing || existing.companyProfileId !== profile.id) return NextResponse.json({ error: '찾을 수 없음' }, { status: 404 });
    const updated = await prisma.performanceRecord.update({
      where: { id: body.id },
      data: {
        ...(body.projectName !== undefined && { projectName: body.projectName }),
        ...(body.clientName !== undefined && { clientName: body.clientName }),
        ...(body.contractAmount !== undefined && { contractAmount: body.contractAmount != null ? BigInt(body.contractAmount) : null }),
        ...(body.startDate !== undefined && { startDate: body.startDate ? new Date(body.startDate) : null }),
        ...(body.endDate !== undefined && { endDate: body.endDate ? new Date(body.endDate) : null }),
        ...(body.projectType !== undefined && { projectType: body.projectType }),
        ...(body.description !== undefined && { description: body.description }),
      },
    });
    return NextResponse.json({ success: true, data: serialize(updated) });
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
    const existing = await prisma.performanceRecord.findUnique({ where: { id } });
    if (!existing || existing.companyProfileId !== profile.id) return NextResponse.json({ error: '찾을 수 없음' }, { status: 404 });
    await prisma.performanceRecord.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) { console.error(e); return NextResponse.json({ error: '삭제 오류' }, { status: 500 }); }
}
