import { db, modCasesTable } from "@workspace/db";
import { eq, and, desc, max } from "drizzle-orm";
import type { ModCase } from "@workspace/db";

export async function createCase(data: {
  guildId: string;
  type: string;
  userId: string;
  userTag: string;
  moderatorId: string;
  moderatorTag: string;
  reason: string;
  duration?: number;
}): Promise<ModCase> {
  const result = await db
    .select({ max: max(modCasesTable.caseNumber) })
    .from(modCasesTable)
    .where(eq(modCasesTable.guildId, data.guildId));
  const nextCase = (result[0]?.max ?? 0) + 1;
  const inserted = await db.insert(modCasesTable).values({ ...data, caseNumber: nextCase }).returning();
  return inserted[0]!;
}

export async function getCase(guildId: string, caseNumber: number): Promise<ModCase | undefined> {
  const rows = await db
    .select()
    .from(modCasesTable)
    .where(and(eq(modCasesTable.guildId, guildId), eq(modCasesTable.caseNumber, caseNumber)));
  return rows[0];
}

export async function getCases(guildId: string, userId: string): Promise<ModCase[]> {
  return db
    .select()
    .from(modCasesTable)
    .where(and(eq(modCasesTable.guildId, guildId), eq(modCasesTable.userId, userId)))
    .orderBy(desc(modCasesTable.createdAt));
}

export async function getRecentCases(guildId: string, limit = 10): Promise<ModCase[]> {
  return db
    .select()
    .from(modCasesTable)
    .where(eq(modCasesTable.guildId, guildId))
    .orderBy(desc(modCasesTable.createdAt))
    .limit(limit);
}

export async function updateCaseReason(guildId: string, caseNumber: number, reason: string): Promise<void> {
  await db
    .update(modCasesTable)
    .set({ reason })
    .where(and(eq(modCasesTable.guildId, guildId), eq(modCasesTable.caseNumber, caseNumber)));
}

const TYPE_COLORS: Record<string, number> = {
  WARN: 0xF0B232,
  KICK: 0xE67E22,
  BAN: 0xED4245,
  TEMPBAN: 0xC0392B,
  SOFTBAN: 0xE74C3C,
  MUTE: 0x9B59B6,
  UNMUTE: 0x2ECC71,
  UNBAN: 0x27AE60,
  HACKBAN: 0x992D22,
};

export const CASE_COLORS = TYPE_COLORS;

const TYPE_EMOJI: Record<string, string> = {
  WARN: "⚠️",
  KICK: "👢",
  BAN: "🔨",
  TEMPBAN: "⏳",
  SOFTBAN: "🥊",
  MUTE: "🔇",
  UNMUTE: "🔊",
  UNBAN: "✅",
  HACKBAN: "💀",
};

export const CASE_EMOJI = TYPE_EMOJI;
