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
    const items = await prisma.constructionLicense.findMany({ where: { companyProfileId: profile.id }, orderBy: { createdAt: 'desc' } });
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
    if (!body.licenseType) return NextResponse.json({ error: '면허 종류 필수' }, { status: 400 });
    const created = await prisma.constructionLicense.create({
      data: {
        companyProfileId: profile.id,
        licenseType: body.licenseType,
        licenseNumber: body.licenseNumber ?? null,
        grade: body.grade ?? null,
        capacity: body.capacity != null ? BigInt(body.capacity) : null,
        issueDate: body.issueDate ? new Date(body.issueDate) : null,
        expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
        isActive: body.isActive ?? true,
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
    const existing = await prisma.constructionLicense.findUnique({ where: { id: body.id } });
    if (!existing || existing.companyProfileId !== profile.id) return NextResponse.json({ error: '찾을 수 없음' }, { status: 404 });
    const updated = await prisma.constructionLicense.update({
      where: { id: body.id },
      data: {
        ...(body.licenseType !== undefined && { licenseType: body.licenseType }),
        ...(body.licenseNumber !== undefined && { licenseNumber: body.licenseNumber }),
        ...(body.grade !== undefined && { grade: body.grade }),
        ...(body.capacity !== undefined && { capacity: body.capacity != null ? BigInt(body.capacity) : null }),
        ...(body.issueDate !== undefined && { issueDate: body.issueDate ? new Date(body.issueDate) : null }),
        ...(body.expiryDate !== undefined && { expiryDate: body.expiryDate ? new Date(body.expiryDate) : null }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
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
    const existing = await prisma.constructionLicense.findUnique({ where: { id } });
    if (!existing || existing.companyProfileId !== profile.id) return NextResponse.json({ error: '찾을 수 없음' }, { status: 404 });
    await prisma.constructionLicense.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) { console.error(e); return NextResponse.json({ error: '삭제 오류' }, { status: 500 }); }
}
