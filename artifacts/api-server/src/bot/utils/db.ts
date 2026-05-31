import { db, guildSettingsTable, warningsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import type { GuildSettings } from "@workspace/db";

const cache = new Map<string, GuildSettings>();

export async function getGuildSettings(guildId: string): Promise<GuildSettings> {
  if (cache.has(guildId)) return cache.get(guildId)!;
  const rows = await db.select().from(guildSettingsTable).where(eq(guildSettingsTable.guildId, guildId));
  if (rows.length > 0) {
    cache.set(guildId, rows[0]!);
    return rows[0]!;
  }
  const inserted = await db.insert(guildSettingsTable).values({ guildId }).returning();
  cache.set(guildId, inserted[0]!);
  return inserted[0]!;
}

export async function updateGuildSettings(guildId: string, values: Partial<Omit<GuildSettings, "guildId" | "createdAt">>): Promise<void> {
  await db.update(guildSettingsTable)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(guildSettingsTable.guildId, guildId));
  cache.delete(guildId);
}

export async function addWarning(guildId: string, userId: string, moderatorId: string, reason: string): Promise<number> {
  const rows = await db.select().from(warningsTable)
    .where(and(eq(warningsTable.guildId, guildId), eq(warningsTable.userId, userId)));
  await db.insert(warningsTable).values({ guildId, userId, moderatorId, reason });
  return rows.length + 1;
}

export async function getWarnings(guildId: string, userId: string) {
  return db.select().from(warningsTable)
    .where(and(eq(warningsTable.guildId, guildId), eq(warningsTable.userId, userId)));
}

export async function clearWarnings(guildId: string, userId: string): Promise<void> {
  await db.delete(warningsTable)
    .where(and(eq(warningsTable.guildId, guildId), eq(warningsTable.userId, userId)));
}
