import prismaPkg from "@prisma/client";
const { PrismaClient } = prismaPkg as any;


// 環境変数の補完
if (!process.env.DATABASE_URL) {
  if (process.env.POSTGRES_URL) {
    process.env.DATABASE_URL = process.env.POSTGRES_URL;
  } else if (process.env.NEON_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.NEON_DATABASE_URL;
  }
}

const prisma = new PrismaClient();
export const runtime = 'nodejs';

export default async function handler(req: any, res: any) {
  const { key } = req.query;
  const DEBUG_KEY = process.env.DEBUG_KEY || 'debug';

  if (process.env.NODE_ENV === 'production' && key !== DEBUG_KEY) {
    return res.status(403).json({ 
      error: 'FORBIDDEN', 
      message: 'システム診断へのアクセス権限がありません。' 
    });
  }

  const result: any = {
    appEnv: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
    runtime: 'nodejs',
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasPostgresUrl: !!process.env.POSTGRES_URL,
    hasNeonUrl: !!process.env.NEON_DATABASE_URL,
    databaseUrlScheme: null,
    prismaCanConnect: false,
    dbWriteTest: false,
    tablesOk: false,
    roomsCount: 0,
    timestamp: new Date().toISOString()
  };

  const dbUrl = process.env.DATABASE_URL || '';
  if (dbUrl) {
    result.databaseUrlScheme = dbUrl.split(':')[0];
  }

  try {
    // 1. 接続テスト
    await prisma.$executeRawUnsafe('SELECT 1');
    result.prismaCanConnect = true;

    // 2. 件数確認
    result.roomsCount = await prisma.room.count();
    result.tablesOk = true;

    // 3. 書き込みテスト
    const testId = `HEALTH-CHECK-${Date.now()}`;
    await prisma.room.create({
      data: {
        id: testId,
        name: 'HEALTH_CHECK',
        passcode: '000000',
        passcodeHash: 'hash',
        phase: 'LOBBY',
        day: 0,
        timer: 0,
        players: [],
        messages: [],
        roleConfig: {}
      }
    });
    await prisma.room.delete({ where: { id: testId } });
    result.dbWriteTest = true;

  } catch (err: any) {
    result.error = err.message;
    console.error('Diagnostic error:', err);
  }

  return res.status(200).json(result);
}