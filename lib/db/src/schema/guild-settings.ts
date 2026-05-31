import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const guildSettingsTable = pgTable("guild_settings", {
  guildId: text("guild_id").primaryKey(),
  prefix: text("prefix").notNull().default("."),
  autoroleId: text("autorole_id"),
  autologChannelId: text("autolog_channel_id"),
  modlogChannelId: text("modlog_channel_id"),
  welcomeChannelId: text("welcome_channel_id"),
  welcomeMessage: text("welcome_message"),
  goodbyeChannelId: text("goodbye_channel_id"),
  goodbyeMessage: text("goodbye_message"),
  embedColor: text("embed_color").notNull().default("#5865F2"),
  antilink: boolean("antilink").notNull().default(false),
  antiinvite: boolean("antiinvite").notNull().default(false),
  antispam: boolean("antispam").notNull().default(false),
  anticaps: boolean("anticaps").notNull().default(false),
  antimention: boolean("antimention").notNull().default(false),
  mentionLimit: integer("mention_limit").notNull().default(5),
  capsPercent: integer("caps_percent").notNull().default(70),
  ticketCategoryId: text("ticket_category_id"),
  ticketLogChannelId: text("ticket_log_channel_id"),
  ticketSupportRoleId: text("ticket_support_role_id"),
  ticketPanelChannelId: text("ticket_panel_channel_id"),
  vocalLogChannelId: text("vocal_log_channel_id"),
  serverLogChannelId: text("server_log_channel_id"),
  memberLogChannelId: text("member_log_channel_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const warningsTable = pgTable("warnings", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  userId: text("user_id").notNull(),
  moderatorId: text("moderator_id").notNull(),
  reason: text("reason").notNull().default("Aucune raison fournie"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const modCasesTable = pgTable("mod_cases", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  caseNumber: integer("case_number").notNull(),
  type: text("type").notNull(),
  userId: text("user_id").notNull(),
  userTag: text("user_tag").notNull(),
  moderatorId: text("moderator_id").notNull(),
  moderatorTag: text("moderator_tag").notNull(),
  reason: text("reason").notNull().default("Aucune raison"),
  duration: integer("duration"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const afkTable = pgTable("afk_users", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  userId: text("user_id").notNull(),
  reason: text("reason").notNull().default("AFK"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const ticketsTable = pgTable("tickets", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull().unique(),
  userId: text("user_id").notNull(),
  userTag: text("user_tag").notNull(),
  ticketNumber: integer("ticket_number").notNull(),
  reason: text("reason").notNull().default("Aucune raison"),
  status: text("status").notNull().default("open"),
  closedById: text("closed_by_id"),
  closedByTag: text("closed_by_tag"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  closedAt: timestamp("closed_at"),
});

export const insertGuildSettingsSchema = createInsertSchema(guildSettingsTable);
export const insertWarningSchema = createInsertSchema(warningsTable).omit({ id: true, createdAt: true });
export const insertModCaseSchema = createInsertSchema(modCasesTable).omit({ id: true, createdAt: true });
export const insertAfkSchema = createInsertSchema(afkTable).omit({ id: true, createdAt: true });
export const insertTicketSchema = createInsertSchema(ticketsTable).omit({ id: true, createdAt: true });

export type GuildSettings = typeof guildSettingsTable.$inferSelect;
export type InsertGuildSettings = z.infer<typeof insertGuildSettingsSchema>;
export type Warning = typeof warningsTable.$inferSelect;
export type InsertWarning = z.infer<typeof insertWarningSchema>;
export type ModCase = typeof modCasesTable.$inferSelect;
export type AfkUser = typeof afkTable.$inferSelect;
export type Ticket = typeof ticketsTable.$inferSelect;
