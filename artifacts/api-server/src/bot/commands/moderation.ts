import { EmbedBuilder, PermissionFlagsBits, AttachmentBuilder } from "discord.js";
import type { Command } from "../types.js";
import { addWarning, getWarnings, clearWarnings } from "../utils/db.js";
import { createCase, getCases, getCase, updateCaseReason, CASE_COLORS, CASE_EMOJI } from "../utils/cases.js";

// ─── HELPERS ──────────────────────────────────────────────────────────────────

async function resolveTarget(
  message: any,
  args: string[],
  allowOutsideGuild = false,
): Promise<{ id: string; tag: string; member?: any; user?: any; avatarURL: () => string } | null> {
  // 1. Try mention
  const mentioned = message.mentions.members?.first();
  if (mentioned) {
    return {
      id: mentioned.id,
      tag: mentioned.user.tag,
      member: mentioned,
      user: mentioned.user,
      avatarURL: () => mentioned.user.displayAvatarURL({ size: 256 }),
    };
  }
  // 2. Try by ID (first arg)
  const rawId = args[0]?.replace(/[<@!>]/g, "");
  if (!rawId || !/^\d{17,20}$/.test(rawId)) return null;
  try {
    // Try to fetch from guild
    const member = await message.guild.members.fetch(rawId).catch(() => null);
    if (member) {
      return {
        id: member.id,
        tag: member.user.tag,
        member,
        user: member.user,
        avatarURL: () => member.user.displayAvatarURL({ size: 256 }),
      };
    }
    if (allowOutsideGuild) {
      const user = await message.client.users.fetch(rawId).catch(() => null);
      if (user) {
        return {
          id: user.id,
          tag: user.tag,
          user,
          avatarURL: () => user.displayAvatarURL({ size: 256 }),
        };
      }
    }
  } catch {}
  return null;
}

async function logModAction(message: any, settings: any, embed: EmbedBuilder) {
  if (!settings.modlogChannelId) return;
  const ch = message.guild?.channels.cache.get(settings.modlogChannelId) as any;
  if (ch?.isTextBased()) ch.send({ embeds: [embed] }).catch(() => {});
}

async function dmTarget(target: { user?: any; id: string }, embed: EmbedBuilder, client?: any) {
  try {
    if (target.user?.send) {
      await target.user.send({ embeds: [embed] });
    } else if (client) {
      const u = await client.users.fetch(target.id).catch(() => null);
      if (u) await u.send({ embeds: [embed] });
    }
  } catch {}
}

function modEmbed(
  type: string,
  target: { id: string; tag: string; avatarURL: () => string },
  moderator: any,
  guild: any,
  reason: string,
  caseNum: number,
  extra?: { name: string; value: string }[],
): EmbedBuilder {
  const emoji = CASE_EMOJI[type] ?? "🔧";
  const color = CASE_COLORS[type] ?? 0x5865F2;
  const labels: Record<string, string> = {
    WARN: "Avertissement", KICK: "Expulsion", BAN: "Bannissement",
    TEMPBAN: "Ban Temporaire", SOFTBAN: "Softban", MUTE: "Mise en Sourdine",
    UNMUTE: "Sourdine Levée", UNBAN: "Débannissement", HACKBAN: "Hackban",
  };
  return new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: `${emoji} ${labels[type] ?? type} — Cas #${caseNum}`, iconURL: guild.iconURL() ?? undefined })
    .setThumbnail(target.avatarURL())
    .addFields(
      { name: "👤 Utilisateur", value: `<@${target.id}>\n\`${target.tag}\``, inline: true },
      { name: "👮 Modérateur", value: `<@${moderator.id}>\n\`${moderator.tag}\``, inline: true },
      { name: "\u200b", value: "\u200b", inline: true },
      { name: "📝 Raison", value: reason, inline: false },
      ...(extra ?? []),
    )
    .setFooter({ text: guild.name, iconURL: guild.iconURL() ?? undefined })
    .setTimestamp();
}

function dmPunishEmbed(type: string, guild: any, reason: string, extra?: string): EmbedBuilder {
  const labels: Record<string, string> = {
    WARN: "⚠️ Tu as reçu un avertissement",
    KICK: "👢 Tu as été expulsé(e)",
    BAN: "🔨 Tu as été banni(e)",
    TEMPBAN: "⏳ Tu as été banni(e) temporairement",
    SOFTBAN: "🥊 Tu as été softbanni(e)",
    MUTE: "🔇 Tu as été mis(e) en sourdine",
  };
  const color = CASE_COLORS[type] ?? 0x5865F2;
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(labels[type] ?? `🔧 Sanction : ${type}`)
    .setDescription(`**Serveur :** ${guild.name}`)
    .addFields(
      { name: "📝 Raison", value: reason },
      ...(extra ? [{ name: "ℹ️ Info", value: extra }] : []),
    )
    .setFooter({ text: "Contacte le staff si tu penses que c'est une erreur." })
    .setTimestamp();
}

function noPermEmbed() {
  return new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle("❌ Permission Insuffisante")
    .setDescription("Tu n'as pas les permissions requises pour cette action.")
    .setTimestamp();
}

function errEmbed(msg: string) {
  return new EmbedBuilder().setColor(0xED4245).setDescription(`❌ ${msg}`).setTimestamp();
}

// ─── COMMANDS ─────────────────────────────────────────────────────────────────

export const moderationCommands: Command[] = [
  {
    name: "kick",
    category: "Modération",
    description: "Expulse un membre (mention ou ID)",
    usage: ".kick @membre|ID [raison]",
    permissions: ["KickMembers"],
    async execute(message, args, settings, client) {
      if (!message.member?.permissions.has(PermissionFlagsBits.KickMembers))
        return void message.reply({ embeds: [noPermEmbed()] });
      const target = await resolveTarget(message, args);
      if (!target) return void message.reply({ embeds: [errEmbed("Mentionne un membre ou fournis un ID valide.")] });
      if (!target.member?.kickable) return void message.reply({ embeds: [errEmbed("Je ne peux pas expulser ce membre.")] });
      const reason = args.slice(message.mentions.users.size ? 1 : 1).join(" ") || "Aucune raison";
      const c = await createCase({ guildId: message.guild!.id, type: "KICK", userId: target.id, userTag: target.tag, moderatorId: message.author.id, moderatorTag: message.author.tag, reason });
      const embed = modEmbed("KICK", target, message.author, message.guild!, reason, c.caseNumber);
      await dmTarget(target, dmPunishEmbed("KICK", message.guild!, reason), client);
      await target.member!.kick(reason);
      message.reply({ embeds: [embed] });
      logModAction(message, settings, embed);
    },
  },
  {
    name: "ban",
    category: "Modération",
    description: "Banni un membre (mention ou ID)",
    usage: ".ban @membre|ID [raison]",
    permissions: ["BanMembers"],
    async execute(message, args, settings, client) {
      if (!message.member?.permissions.has(PermissionFlagsBits.BanMembers))
        return void message.reply({ embeds: [noPermEmbed()] });
      const target = await resolveTarget(message, args, true);
      if (!target) return void message.reply({ embeds: [errEmbed("Mentionne un membre ou fournis un ID valide.")] });
      if (target.member && !target.member.bannable) return void message.reply({ embeds: [errEmbed("Je ne peux pas bannir ce membre.")] });
      const reason = args.slice(1).join(" ") || "Aucune raison";
      const c = await createCase({ guildId: message.guild!.id, type: "BAN", userId: target.id, userTag: target.tag, moderatorId: message.author.id, moderatorTag: message.author.tag, reason });
      const embed = modEmbed("BAN", target, message.author, message.guild!, reason, c.caseNumber);
      await dmTarget(target, dmPunishEmbed("BAN", message.guild!, reason), client);
      await message.guild!.members.ban(target.id, { reason });
      message.reply({ embeds: [embed] });
      logModAction(message, settings, embed);
    },
  },
  {
    name: "hackban",
    aliases: ["forceban"],
    category: "Modération",
    description: "Banni un utilisateur par son ID (même absent du serveur)",
    usage: ".hackban <ID> [raison]",
    permissions: ["BanMembers"],
    async execute(message, args, settings, client) {
      if (!message.member?.permissions.has(PermissionFlagsBits.BanMembers))
        return void message.reply({ embeds: [noPermEmbed()] });
      const rawId = args[0];
      if (!rawId || !/^\d{17,20}$/.test(rawId))
        return void message.reply({ embeds: [errEmbed("Fournis un ID Discord valide (17-20 chiffres).")] });
      const reason = args.slice(1).join(" ") || "Hackban";
      let tag = `ID: ${rawId}`;
      const user = await client.users.fetch(rawId).catch(() => null);
      if (user) tag = user.tag;
      await message.guild!.members.ban(rawId, { reason });
      const c = await createCase({ guildId: message.guild!.id, type: "HACKBAN", userId: rawId, userTag: tag, moderatorId: message.author.id, moderatorTag: message.author.tag, reason });
      const embed = new EmbedBuilder()
        .setColor(0x992D22)
        .setAuthor({ name: `💀 Hackban — Cas #${c.caseNumber}`, iconURL: message.guild!.iconURL() ?? undefined })
        .setThumbnail(user?.displayAvatarURL({ size: 128 }) ?? null)
        .addFields(
          { name: "👤 Utilisateur", value: `\`${tag}\`\n\`${rawId}\``, inline: true },
          { name: "👮 Modérateur", value: `<@${message.author.id}>\n\`${message.author.tag}\``, inline: true },
          { name: "📝 Raison", value: reason, inline: false },
        )
        .setFooter({ text: message.guild!.name, iconURL: message.guild!.iconURL() ?? undefined })
        .setTimestamp();
      message.reply({ embeds: [embed] });
      logModAction(message, settings, embed);
    },
  },
  {
    name: "unban",
    category: "Modération",
    description: "Débanni un utilisateur (ID obligatoire)",
    usage: ".unban <ID> [raison]",
    permissions: ["BanMembers"],
    async execute(message, args, settings) {
      if (!message.member?.permissions.has(PermissionFlagsBits.BanMembers))
        return void message.reply({ embeds: [noPermEmbed()] });
      const userId = args[0];
      if (!userId) return void message.reply({ embeds: [errEmbed("Fournis l'ID de l'utilisateur à débannir.")] });
      const reason = args.slice(1).join(" ") || "Aucune raison";
      const ban = await message.guild!.bans.fetch(userId).catch(() => null);
      if (!ban) return void message.reply({ embeds: [errEmbed("Cet utilisateur n'est pas banni ou l'ID est invalide.")] });
      await message.guild!.members.unban(userId, reason);
      const c = await createCase({ guildId: message.guild!.id, type: "UNBAN", userId: ban.user.id, userTag: ban.user.tag, moderatorId: message.author.id, moderatorTag: message.author.tag, reason });
      const embed = modEmbed(
        "UNBAN",
        { id: ban.user.id, tag: ban.user.tag, avatarURL: () => ban.user.displayAvatarURL({ size: 256 }) },
        message.author, message.guild!, reason, c.caseNumber,
      );
      message.reply({ embeds: [embed] });
      logModAction(message, settings, embed);
    },
  },
  {
    name: "mute",
    aliases: ["timeout"],
    category: "Modération",
    description: "Met un membre en timeout (mention ou ID)",
    usage: ".mute @membre|ID [durée en minutes] [raison]",
    permissions: ["ModerateMembers"],
    async execute(message, args, settings, client) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ModerateMembers))
        return void message.reply({ embeds: [noPermEmbed()] });
      const target = await resolveTarget(message, args);
      if (!target?.member) return void message.reply({ embeds: [errEmbed("Ce membre doit être sur le serveur pour être mis en sourdine.")] });
      const minuteArg = args.find(a => /^\d+$/.test(a) && !a.match(/^\d{17,20}$/));
      const minutes = parseInt(minuteArg ?? "10") || 10;
      const reason = args.filter(a => !/^\d+$/.test(a) && !a.startsWith("<")).join(" ") || "Aucune raison";
      await target.member.timeout(minutes * 60 * 1000, reason);
      const c = await createCase({ guildId: message.guild!.id, type: "MUTE", userId: target.id, userTag: target.tag, moderatorId: message.author.id, moderatorTag: message.author.tag, reason, duration: minutes });
      const embed = modEmbed("MUTE", target, message.author, message.guild!, reason, c.caseNumber, [{ name: "⏱️ Durée", value: `${minutes} minute(s)` }]);
      await dmTarget(target, dmPunishEmbed("MUTE", message.guild!, reason, `Durée : ${minutes} minute(s)`), client);
      message.reply({ embeds: [embed] });
      logModAction(message, settings, embed);
    },
  },
  {
    name: "unmute",
    aliases: ["untimeout"],
    category: "Modération",
    description: "Retire le timeout (mention ou ID)",
    usage: ".unmute @membre|ID",
    permissions: ["ModerateMembers"],
    async execute(message, args, settings) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ModerateMembers))
        return void message.reply({ embeds: [noPermEmbed()] });
      const target = await resolveTarget(message, args);
      if (!target?.member) return void message.reply({ embeds: [errEmbed("Membre introuvable sur ce serveur.")] });
      await target.member.timeout(null);
      const c = await createCase({ guildId: message.guild!.id, type: "UNMUTE", userId: target.id, userTag: target.tag, moderatorId: message.author.id, moderatorTag: message.author.tag, reason: "Timeout retiré" });
      const embed = modEmbed("UNMUTE", target, message.author, message.guild!, "Timeout retiré", c.caseNumber);
      message.reply({ embeds: [embed] });
      logModAction(message, settings, embed);
    },
  },
  {
    name: "warn",
    category: "Modération",
    description: "Avertit un membre (mention ou ID)",
    usage: ".warn @membre|ID [raison]",
    permissions: ["KickMembers"],
    async execute(message, args, settings, client) {
      if (!message.member?.permissions.has(PermissionFlagsBits.KickMembers))
        return void message.reply({ embeds: [noPermEmbed()] });
      const target = await resolveTarget(message, args);
      if (!target) return void message.reply({ embeds: [errEmbed("Membre introuvable.")] });
      const reason = args.slice(1).join(" ") || "Aucune raison";
      const count = await addWarning(message.guild!.id, target.id, message.author.id, reason);
      const c = await createCase({ guildId: message.guild!.id, type: "WARN", userId: target.id, userTag: target.tag, moderatorId: message.author.id, moderatorTag: message.author.tag, reason });
      const embed = modEmbed("WARN", target, message.author, message.guild!, reason, c.caseNumber, [{ name: "⚠️ Total Avertissements", value: `${count}` }]);
      await dmTarget(target, dmPunishEmbed("WARN", message.guild!, reason, `Tu as maintenant ${count} avertissement(s).`), client);
      message.reply({ embeds: [embed] });
      logModAction(message, settings, embed);
    },
  },
  {
    name: "warnings",
    aliases: ["warns"],
    category: "Modération",
    description: "Affiche les avertissements d'un membre",
    usage: ".warnings @membre|ID",
    async execute(message, args) {
      const target = await resolveTarget(message, args) ?? { id: message.author.id, tag: message.author.tag, user: message.author, avatarURL: () => message.author.displayAvatarURL() };
      const warns = await getWarnings(message.guild!.id, target.id);
      message.reply({ embeds: [
        new EmbedBuilder()
          .setColor(0xF0B232)
          .setAuthor({ name: `⚠️ Avertissements — ${target.tag}`, iconURL: target.avatarURL() })
          .setThumbnail(target.avatarURL())
          .setDescription(
            warns.length === 0
              ? "✅ Aucun avertissement."
              : warns.map((w, i) => `**\`#${i + 1}\`** ${w.reason}\n> Par <@${w.moderatorId}> • <t:${Math.floor(w.createdAt.getTime() / 1000)}:R>`).join("\n\n")
          )
          .addFields({ name: "📊 Total", value: `${warns.length} avertissement(s)`, inline: true })
          .setFooter({ text: message.guild!.name, iconURL: message.guild!.iconURL() ?? undefined })
          .setTimestamp()
      ]});
    },
  },
  {
    name: "clearwarn",
    aliases: ["delwarn", "clearwarns"],
    category: "Modération",
    description: "Supprime les avertissements d'un membre",
    usage: ".clearwarn @membre|ID",
    permissions: ["KickMembers"],
    async execute(message, args) {
      if (!message.member?.permissions.has(PermissionFlagsBits.KickMembers))
        return void message.reply({ embeds: [noPermEmbed()] });
      const target = await resolveTarget(message, args);
      if (!target) return void message.reply({ embeds: [errEmbed("Membre introuvable.")] });
      await clearWarnings(message.guild!.id, target.id);
      message.reply({ embeds: [new EmbedBuilder().setColor(0x2ECC71).setTitle("🗑️ Avertissements Effacés").setDescription(`Les avertissements de **${target.tag}** ont été supprimés.`).setTimestamp()] });
    },
  },
  {
    name: "case",
    aliases: ["modcase"],
    category: "Modération",
    description: "Affiche un cas de modération",
    usage: ".case <numéro>",
    async execute(message, args) {
      const num = parseInt(args[0] ?? "");
      if (isNaN(num)) return void message.reply({ embeds: [errEmbed("Fournis un numéro de cas.")] });
      const c = await getCase(message.guild!.id, num);
      if (!c) return void message.reply({ embeds: [errEmbed(`Cas **#${num}** introuvable.`)] });
      const emoji = (CASE_EMOJI as any)[c.type] ?? "🔧";
      const color = (CASE_COLORS as any)[c.type] ?? 0x5865F2;
      message.reply({ embeds: [
        new EmbedBuilder()
          .setColor(color)
          .setTitle(`${emoji} Cas #${c.caseNumber} — ${c.type}`)
          .addFields(
            { name: "👤 Utilisateur", value: `\`${c.userTag}\`\n\`${c.userId}\``, inline: true },
            { name: "👮 Modérateur", value: `\`${c.moderatorTag}\``, inline: true },
            { name: "📝 Raison", value: c.reason, inline: false },
            ...(c.duration ? [{ name: "⏱️ Durée", value: `${c.duration} min`, inline: true }] : []),
          )
          .setFooter({ text: message.guild!.name, iconURL: message.guild!.iconURL() ?? undefined })
          .setTimestamp(c.createdAt)
      ]});
    },
  },
  {
    name: "cases",
    aliases: ["history", "modhistory"],
    category: "Modération",
    description: "Historique de modération d'un membre",
    usage: ".cases @membre|ID",
    async execute(message, args) {
      const target = await resolveTarget(message, args, true) ?? { id: message.author.id, tag: message.author.tag, user: message.author, avatarURL: () => message.author.displayAvatarURL() };
      const cases = await getCases(message.guild!.id, target.id);
      if (!cases.length) return void message.reply({ embeds: [new EmbedBuilder().setColor(0x2ECC71).setDescription(`✅ **${target.tag}** n'a aucun historique de modération.`)] });
      message.reply({ embeds: [
        new EmbedBuilder()
          .setColor(0x5865F2)
          .setAuthor({ name: `📋 Historique — ${target.tag}`, iconURL: target.avatarURL() })
          .setThumbnail(target.avatarURL())
          .setDescription(
            cases.slice(0, 10).map(c => {
              const emoji = (CASE_EMOJI as any)[c.type] ?? "🔧";
              return `${emoji} **Cas #${c.caseNumber}** \`${c.type}\` — ${c.reason.slice(0, 40)}\n> <t:${Math.floor(c.createdAt.getTime() / 1000)}:R> par \`${c.moderatorTag}\``;
            }).join("\n\n")
          )
          .addFields({ name: "📊 Total", value: `${cases.length} cas`, inline: true })
          .setFooter({ text: message.guild!.name, iconURL: message.guild!.iconURL() ?? undefined })
          .setTimestamp()
      ]});
    },
  },
  {
    name: "reason",
    aliases: ["editreason"],
    category: "Modération",
    description: "Modifie la raison d'un cas",
    usage: ".reason <#cas> <nouvelle raison>",
    permissions: ["KickMembers"],
    async execute(message, args) {
      if (!message.member?.permissions.has(PermissionFlagsBits.KickMembers))
        return void message.reply({ embeds: [noPermEmbed()] });
      const num = parseInt(args[0] ?? "");
      const reason = args.slice(1).join(" ");
      if (isNaN(num) || !reason) return void message.reply({ embeds: [errEmbed("Usage: `.reason <#cas> <raison>`")] });
      await updateCaseReason(message.guild!.id, num, reason);
      message.reply({ embeds: [new EmbedBuilder().setColor(0x2ECC71).setTitle("✅ Raison mise à jour").setDescription(`Cas **#${num}** → ${reason}`).setTimestamp()] });
    },
  },
  {
    name: "purge",
    aliases: ["clear"],
    category: "Modération",
    description: "Supprime des messages en masse",
    usage: ".purge <1-100> [@membre]",
    permissions: ["ManageMessages"],
    async execute(message, args) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageMessages))
        return void message.reply({ embeds: [noPermEmbed()] });
      const amount = parseInt(args[0] ?? "10");
      if (isNaN(amount) || amount < 1 || amount > 100)
        return void message.reply({ embeds: [errEmbed("Nombre invalide (1–100).")] });
      const targetUser = message.mentions.users.first();
      await message.delete().catch(() => {});
      let msgs = await message.channel.messages.fetch({ limit: amount });
      if (targetUser) msgs = msgs.filter((m: any) => m.author.id === targetUser.id);
      const deleted = await (message.channel as any).bulkDelete(msgs, true).catch(() => null);
      const reply = await (message.channel as any).send({ embeds: [
        new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle("🗑️ Messages Supprimés")
          .addFields(
            { name: "📊 Supprimés", value: `${deleted?.size ?? 0}`, inline: true },
            { name: "👮 Par", value: message.author.tag, inline: true },
            ...(targetUser ? [{ name: "👤 Filtre", value: targetUser.tag, inline: true }] : []),
          )
          .setTimestamp()
      ]});
      setTimeout(() => reply.delete().catch(() => {}), 4000);
    },
  },
  {
    name: "lock",
    category: "Modération",
    description: "Verrouille le salon",
    usage: ".lock [raison]",
    permissions: ["ManageChannels"],
    async execute(message, args) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageChannels))
        return void message.reply({ embeds: [noPermEmbed()] });
      await (message.channel as any).permissionOverwrites.edit(message.guild!.roles.everyone, { SendMessages: false });
      message.reply({ embeds: [new EmbedBuilder().setColor(0xED4245).setTitle("🔒 Salon Verrouillé").setDescription(`<#${message.channelId}> est verrouillé.${args.length ? `\n**Raison :** ${args.join(" ")}` : ""}`).setTimestamp()] });
    },
  },
  {
    name: "unlock",
    category: "Modération",
    description: "Déverrouille le salon",
    usage: ".unlock",
    permissions: ["ManageChannels"],
    async execute(message) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageChannels))
        return void message.reply({ embeds: [noPermEmbed()] });
      await (message.channel as any).permissionOverwrites.edit(message.guild!.roles.everyone, { SendMessages: null });
      message.reply({ embeds: [new EmbedBuilder().setColor(0x2ECC71).setTitle("🔓 Salon Déverrouillé").setDescription(`<#${message.channelId}> est rouvert.`).setTimestamp()] });
    },
  },
  {
    name: "slowmode",
    category: "Modération",
    description: "Change le mode lent du salon",
    usage: ".slowmode <secondes>",
    permissions: ["ManageChannels"],
    async execute(message, args) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageChannels))
        return void message.reply({ embeds: [noPermEmbed()] });
      const seconds = parseInt(args[0] ?? "0");
      if (isNaN(seconds) || seconds < 0 || seconds > 21600)
        return void message.reply({ embeds: [errEmbed("Valeur invalide (0–21600s).")] });
      await (message.channel as any).setRateLimitPerUser(seconds);
      message.reply({ embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle("⏱️ Mode Lent").setDescription(seconds === 0 ? "Mode lent désactivé." : `Mode lent : **${seconds}s**`).setTimestamp()] });
    },
  },
  {
    name: "nick",
    category: "Modération",
    description: "Change le surnom d'un membre",
    usage: ".nick @membre|ID [surnom]",
    permissions: ["ManageNicknames"],
    async execute(message, args) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageNicknames))
        return void message.reply({ embeds: [noPermEmbed()] });
      const target = await resolveTarget(message, args);
      if (!target?.member) return void message.reply({ embeds: [errEmbed("Membre introuvable.")] });
      const oldNick = target.member.nickname ?? target.member.user.username;
      const newNick = args.filter(a => !a.startsWith("<@") && !/^\d{17,20}$/.test(a)).join(" ") || null;
      await target.member.setNickname(newNick);
      message.reply({ embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle("📛 Surnom Modifié").addFields({ name: "Avant", value: oldNick, inline: true }, { name: "Après", value: newNick ?? "*Réinitialisé*", inline: true }).setTimestamp()] });
    },
  },
  {
    name: "softban",
    category: "Modération",
    description: "Banni puis débanni pour supprimer les messages",
    usage: ".softban @membre|ID [raison]",
    permissions: ["BanMembers"],
    async execute(message, args, settings, client) {
      if (!message.member?.permissions.has(PermissionFlagsBits.BanMembers))
        return void message.reply({ embeds: [noPermEmbed()] });
      const target = await resolveTarget(message, args, true);
      if (!target) return void message.reply({ embeds: [errEmbed("Membre introuvable.")] });
      const reason = args.slice(1).join(" ") || "Softban";
      await dmTarget(target, dmPunishEmbed("SOFTBAN", message.guild!, reason), client);
      await message.guild!.members.ban(target.id, { deleteMessageSeconds: 7 * 24 * 3600, reason });
      await message.guild!.members.unban(target.id);
      const c = await createCase({ guildId: message.guild!.id, type: "SOFTBAN", userId: target.id, userTag: target.tag, moderatorId: message.author.id, moderatorTag: message.author.tag, reason });
      const embed = modEmbed("SOFTBAN", target, message.author, message.guild!, reason, c.caseNumber);
      message.reply({ embeds: [embed] });
      logModAction(message, settings, embed);
    },
  },
  {
    name: "addrole",
    aliases: ["giverole"],
    category: "Modération",
    description: "Donne un rôle à un membre",
    usage: ".addrole @membre|ID @rôle",
    permissions: ["ManageRoles"],
    async execute(message, args) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageRoles))
        return void message.reply({ embeds: [noPermEmbed()] });
      const target = await resolveTarget(message, args);
      const role = message.mentions.roles.first();
      if (!target?.member || !role) return void message.reply({ embeds: [errEmbed("Mentionne un membre et un rôle.")] });
      await target.member.roles.add(role);
      message.reply({ embeds: [new EmbedBuilder().setColor(role.color || 0x2ECC71).setTitle("🎭 Rôle Attribué").addFields({ name: "👤 Membre", value: target.tag, inline: true }, { name: "🎭 Rôle", value: `<@&${role.id}>`, inline: true }).setTimestamp()] });
    },
  },
  {
    name: "removerole",
    aliases: ["takerole"],
    category: "Modération",
    description: "Retire un rôle à un membre",
    usage: ".removerole @membre|ID @rôle",
    permissions: ["ManageRoles"],
    async execute(message, args) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageRoles))
        return void message.reply({ embeds: [noPermEmbed()] });
      const target = await resolveTarget(message, args);
      const role = message.mentions.roles.first();
      if (!target?.member || !role) return void message.reply({ embeds: [errEmbed("Mentionne un membre et un rôle.")] });
      await target.member.roles.remove(role);
      message.reply({ embeds: [new EmbedBuilder().setColor(0xE67E22).setTitle("🎭 Rôle Retiré").addFields({ name: "👤 Membre", value: target.tag, inline: true }, { name: "🎭 Rôle", value: `<@&${role.id}>`, inline: true }).setTimestamp()] });
    },
  },
  {
    name: "hidechannel",
    aliases: ["hide", "lockchannel"],
    category: "Modération",
    description: "Rend un salon invisible pour @everyone",
    usage: ".hidechannel [#salon]",
    permissions: ["ManageChannels"],
    async execute(message) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageChannels))
        return void message.reply({ embeds: [noPermEmbed()] });
      const ch = (message.mentions.channels.first() as any) ?? (message.channel as any);
      await ch.permissionOverwrites.edit(message.guild!.roles.everyone, { ViewChannel: false });
      message.reply({ embeds: [
        new EmbedBuilder().setColor(0x2C2F33)
          .setTitle("🙈 Salon Masqué")
          .setDescription(`<#${ch.id}> est maintenant **invisible** pour @everyone.`)
          .setFooter({ text: `Par ${message.author.tag}` })
          .setTimestamp()
      ]});
    },
  },
  {
    name: "showchannel",
    aliases: ["show", "unlockchannel", "unhide"],
    category: "Modération",
    description: "Rend un salon visible pour @everyone",
    usage: ".showchannel [#salon]",
    permissions: ["ManageChannels"],
    async execute(message) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageChannels))
        return void message.reply({ embeds: [noPermEmbed()] });
      const ch = (message.mentions.channels.first() as any) ?? (message.channel as any);
      await ch.permissionOverwrites.edit(message.guild!.roles.everyone, { ViewChannel: null });
      message.reply({ embeds: [
        new EmbedBuilder().setColor(0x2ECC71)
          .setTitle("👁️ Salon Visible")
          .setDescription(`<#${ch.id}> est maintenant **visible** pour @everyone.`)
          .setFooter({ text: `Par ${message.author.tag}` })
          .setTimestamp()
      ]});
    },
  },
  {
    name: "deafen",
    category: "Modération",
    description: "Rend sourd un membre vocal",
    usage: ".deafen @membre",
    permissions: ["DeafenMembers"],
    async execute(message, args) {
      if (!message.member?.permissions.has(PermissionFlagsBits.DeafenMembers))
        return void message.reply({ embeds: [noPermEmbed()] });
      const target = await resolveTarget(message, args);
      if (!target?.member?.voice.channel) return void message.reply({ embeds: [errEmbed("Ce membre n'est pas en vocal.")] });
      await target.member.voice.setDeaf(true);
      message.reply({ embeds: [new EmbedBuilder().setColor(0x9B59B6).setTitle("🔇 Sourdine Vocal").setDescription(`**${target.tag}** est maintenant sourd.`).setTimestamp()] });
    },
  },
  {
    name: "undeafen",
    category: "Modération",
    description: "Retire la surdité vocale d'un membre",
    usage: ".undeafen @membre",
    permissions: ["DeafenMembers"],
    async execute(message, args) {
      if (!message.member?.permissions.has(PermissionFlagsBits.DeafenMembers))
        return void message.reply({ embeds: [noPermEmbed()] });
      const target = await resolveTarget(message, args);
      if (!target?.member?.voice.channel) return void message.reply({ embeds: [errEmbed("Ce membre n'est pas en vocal.")] });
      await target.member.voice.setDeaf(false);
      message.reply({ embeds: [new EmbedBuilder().setColor(0x2ECC71).setTitle("🔊 Surdité Levée").setDescription(`**${target.tag}** peut de nouveau entendre.`).setTimestamp()] });
    },
  },
];
