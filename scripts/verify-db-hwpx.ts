import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const templates = await prisma.formTemplate.findMany({
    where: { code: { startsWith: 'hwpx_' } },
  });

  console.log(`=== DB에 등록된 HWPX 템플릿 (${templates.length}개) ===\n`);

  for (const t of templates) {
    const fields = JSON.parse(t.fields || '[]');
    console.log(`code:          ${t.code}`);
    console.log(`name:          ${t.name}`);
    console.log(`category:      ${t.category}`);
    console.log(`description:   ${t.description}`);
    console.log(`fileType:      ${t.originalFileType}`);
    console.log(`fileUrl:       ${t.originalFileUrl}`);
    console.log(`outputFile:    ${t.outputFileName}`);
    console.log(`status:        ${t.status}`);
    console.log(`fields (${fields.length}):  ${fields.map((f: any) => f.name).join(', ')}`);
    console.log(`createdAt:     ${t.createdAt}`);
    console.log('');
  }

  await prisma.$disconnect();
}

main().catch(console.error);
