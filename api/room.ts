import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");

// PrismaClient は使い回し（Vercelで多重接続を防ぐ）
const globalForPrisma = globalThis as unknown as { prisma?: any };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}




// Vercel Postgres/Neon の環境変数名が異なる場合に対応
if (!process.env.DATABASE_URL) {
  if (process.env.POSTGRES_URL) {
    process.env.DATABASE_URL = process.env.POSTGRES_URL;
  } else if (process.env.NEON_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.NEON_DATABASE_URL;
  }
}



// Node.js ランタイムを明示的に指定（Edge Runtime での Prisma 不具合回避）
export const runtime = 'nodejs';

export default async function handler(req: any, res: any) {
  const { method } = req;
  const { id } = req.query;

  try {
    if (method === 'GET') {
      if (!id) return res.status(400).json({ error: 'ID_REQUIRED', message: 'ルームIDが指定されていません。' });
      
      const roomId = String(id).trim().toUpperCase();
      const room = await prisma.room.findUnique({ where: { id: roomId } });
      
      if (!room) {
        return res.status(404).json({ 
          error: 'ROOM_NOT_FOUND', 
          message: `ルーム「${roomId}」が見つかりません。作成されていないか、削除された可能性があります。` 
        });
      }
      return res.status(200).json(room);
    }

    if (method === 'POST') {
      const roomData = req.body;
      const roomId = String(roomData.roomId).trim().toUpperCase();
      
      // 保存処理
      await prisma.room.upsert({
        where: { id: roomId },
        update: {
          phase: roomData.phase,
          day: roomData.day,
          timer: roomData.timer,
          players: roomData.players,
          messages: roomData.messages,
          winner: roomData.winner || null,
          roleConfig: roomData.roleConfig,
        },
        create: {
          id: roomId,
          name: roomData.roomName,
          passcode: String(roomData.passcode), // stringとして扱う
          passcodeHash: roomData.passcodeHash,
          phase: roomData.phase,
          day: roomData.day,
          timer: roomData.timer,
          players: roomData.players,
          messages: roomData.messages,
          winner: roomData.winner || null,
          roleConfig: roomData.roleConfig,
        },
      });

      // 書き込み直後に再取得して存在を確認
      const savedRoom = await prisma.room.findUnique({ where: { id: roomId } });
      if (!savedRoom) throw new Error('DB保存に失敗しました（再取得不可）');

      return res.status(200).json(savedRoom);
    }

    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: '許可されていないHTTPメソッドです。' });
  } catch (error: any) {
    console.error('Prisma Error:', error);
    return res.status(500).json({ 
      error: 'DATABASE_ERROR', 
      message: 'データベース処理中にエラーが発生しました。', 
      detail: error.message 
    });
  }
}