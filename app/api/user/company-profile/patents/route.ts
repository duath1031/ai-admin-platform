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
    const items = await prisma.companyPatent.findMany({ where: { companyProfileId: profile.id }, orderBy: { createdAt: 'desc' } });
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
    if (!body.patentType || !body.title) return NextResponse.json({ error: '종류와 명칭 필수' }, { status: 400 });
    const created = await prisma.companyPatent.create({
      data: {
        companyProfileId: profile.id, patentType: body.patentType, title: body.title,
        registrationNo: body.registrationNo ?? null, applicationNo: body.applicationNo ?? null,
        status: body.status ?? 'registered',
        registrationDate: body.registrationDate ? new Date(body.registrationDate) : null,
        expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
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
    const existing = await prisma.companyPatent.findUnique({ where: { id: body.id } });
    if (!existing || existing.companyProfileId !== profile.id) return NextResponse.json({ error: '찾을 수 없음' }, { status: 404 });
    const updated = await prisma.companyPatent.update({
      where: { id: body.id },
      data: {
        ...(body.patentType !== undefined && { patentType: body.patentType }),
        ...(body.title !== undefined && { title: body.title }),
        ...(body.registrationNo !== undefined && { registrationNo: body.registrationNo }),
        ...(body.applicationNo !== undefined && { applicationNo: body.applicationNo }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.registrationDate !== undefined && { registrationDate: body.registrationDate ? new Date(body.registrationDate) : null }),
        ...(body.expiryDate !== undefined && { expiryDate: body.expiryDate ? new Date(body.expiryDate) : null }),
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
    const existing = await prisma.companyPatent.findUnique({ where: { id } });
    if (!existing || existing.companyProfileId !== profile.id) return NextResponse.json({ error: '찾을 수 없음' }, { status: 404 });
    await prisma.companyPatent.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) { console.error(e); return NextResponse.json({ error: '삭제 오류' }, { status: 500 }); }
}
