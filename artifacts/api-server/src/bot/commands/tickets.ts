import {
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  AttachmentBuilder,
} from "discord.js";
import type { Command } from "../types.js";
import { db, ticketsTable } from "@workspace/db";
import { eq, and, max } from "drizzle-orm";
import { updateGuildSettings } from "../utils/db.js";

// ─── TRANSCRIPT GENERATOR ─────────────────────────────────────────────────────

async function generateTranscript(channel: any, ticket: any, closedBy: any): Promise<AttachmentBuilder> {
  const msgs = await channel.messages.fetch({ limit: 100 }).catch(() => new Map());
  const sorted = [...msgs.values()].sort((a: any, b: any) => a.createdTimestamp - b.createdTimestamp);
  const numStr = String(ticket.ticketNumber).padStart(4, "0");
  const lines: string[] = [
    `╔══════════════════════════════════════════════╗`,
    `║      TRANSCRIPT — TICKET #${numStr}              ║`,
    `╚══════════════════════════════════════════════╝`,
    ``,
    `Serveur      : ${channel.guild.name} (${channel.guild.id})`,
    `Salon        : ${channel.name} (${channel.id})`,
    `Ouvert par   : ${ticket.userTag} (${ticket.userId})`,
    `Fermé par    : ${closedBy.tag} (${closedBy.id})`,
    `Ouvert le    : ${ticket.createdAt.toLocaleString("fr-FR")}`,
    `Fermé le     : ${new Date().toLocaleString("fr-FR")}`,
    `Messages     : ${sorted.length}`,
    ``,
    `────────────────────────────────────────────────`,
    ``,
    ...sorted.map((m: any) => {
      const time = m.createdAt.toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
      const content = m.content || (m.embeds.length ? "[Embed]" : "") || (m.attachments.size ? "[Pièce jointe]" : "[Message vide]");
      const attach = m.attachments.size ? ` [+${m.attachments.size} fichier(s)]` : "";
      return `[${time}] ${m.author.tag}: ${content}${attach}`;
    }),
    ``,
    `────────────────────────────────────────────────`,
    `Fin du transcript — Généré par LIGHT bot`,
  ];
  const buffer = Buffer.from(lines.join("\n"), "utf-8");
  return new AttachmentBuilder(buffer, { name: `transcript-${numStr}.txt`, description: `Transcript du ticket #${numStr}` });
}

async function sendTranscript(guild: any, logChannelId: string | null | undefined, ticket: any, closedBy: any, channel: any) {
  if (!logChannelId) return;
  const ch = guild.channels.cache.get(logChannelId) as any;
  if (!ch?.isTextBased()) return;
  const numStr = String(ticket.ticketNumber).padStart(4, "0");
  const attachment = await generateTranscript(channel, ticket, closedBy).catch(() => null);
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setAuthor({ name: `📄 Transcript — Ticket #${numStr}`, iconURL: guild.iconURL() ?? undefined })
    .addFields(
      { name: "👤 Ouvert par", value: `\`${ticket.userTag}\``, inline: true },
      { name: "👮 Fermé par", value: `\`${closedBy.tag}\``, inline: true },
      { name: "⏱️ Durée", value: `<t:${Math.floor(ticket.createdAt.getTime() / 1000)}:R>`, inline: true },
    )
    .setFooter({ text: guild.name, iconURL: guild.iconURL() ?? undefined })
    .setTimestamp();
  const payload: any = { embeds: [embed] };
  if (attachment) payload.files = [attachment];
  ch.send(payload).catch(() => {});
}

async function dmTranscriptToCreator(client: any, channel: any, ticket: any, closedBy: any) {
  try {
    const creator = await client.users.fetch(ticket.userId).catch(() => null);
    if (!creator) return;
    const numStr = String(ticket.ticketNumber).padStart(4, "0");
    const attachment = await generateTranscript(channel, ticket, closedBy).catch(() => null);
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`📄 Transcript — Ticket #${numStr}`)
      .setDescription(`Ton ticket sur **${channel.guild.name}** a été fermé par **${closedBy.tag}**.\nVoici le transcript complet de votre échange.`)
      .addFields(
        { name: "🔒 Fermé par", value: `\`${closedBy.tag}\``, inline: true },
        { name: "⏱️ Ouvert le", value: `<t:${Math.floor(ticket.createdAt.getTime() / 1000)}:R>`, inline: true },
      )
      .setFooter({ text: `${channel.guild.name} • LIGHT bot`, iconURL: channel.guild.iconURL() ?? undefined })
      .setTimestamp();
    const payload: any = { embeds: [embed] };
    if (attachment) payload.files = [attachment];
    await creator.send(payload).catch(() => {});
  } catch {}
}

// ─── TICKET TYPES ─────────────────────────────────────────────────────────────

export const TICKET_TYPES = {
  support: {
    label: "🆘 Support",
    emoji: "🆘",
    description: "Besoin d'aide sur le serveur ?",
    color: 0x5865F2,
    welcome: "Décris ton problème en détail. Le staff va te répondre rapidement.",
    questions: [
      "📋 Explique ton problème en détail",
      "📸 Joins des captures d'écran si nécessaire",
    ],
  },
  report_member: {
    label: "👤 Report Membre",
    emoji: "👤",
    description: "Signaler un membre pour mauvais comportement",
    color: 0xE67E22,
    welcome: "Merci de signaler ce problème. Fournis autant de détails que possible.",
    questions: [
      "❓ Qui veux-tu signaler ? (tag ou ID)",
      "📝 Quelle est la raison du signalement ?",
      "📸 As-tu des preuves ? (screenshots, liens de messages)",
    ],
  },
  report_perm: {
    label: "🚨 Report Abus Perm",
    emoji: "🚨",
    description: "Signaler un abus de permission d'un staff",
    color: 0xED4245,
    welcome: "Tu signales un abus de la part d'un membre du staff. Sois précis et fournis des preuves.",
    questions: [
      "👮 Quel staff est concerné ? (tag ou ID)",
      "📝 Décris l'abus de permission commis",
      "📸 As-tu des preuves ? (screenshots, logs)",
      "🕐 Quand cela s'est-il produit ?",
    ],
  },
  staff_apply: {
    label: "⭐ Devenir Staff",
    emoji: "⭐",
    description: "Postuler pour rejoindre l'équipe du serveur",
    color: 0xF1C40F,
    welcome: "Tu postules pour rejoindre le staff ! Réponds aux questions ci-dessous pour compléter ta candidature.",
    questions: [
      "👤 Quel est ton âge ?",
      "🕐 Depuis combien de temps es-tu sur le serveur ?",
      "💼 As-tu de l'expérience en modération ? Si oui, laquelle ?",
      "⏱️ Quelle est ta disponibilité par semaine ? (en heures)",
      "🌟 Pourquoi veux-tu rejoindre le staff ?",
    ],
  },
  owner: {
    label: "📩 Contacter l'Owner",
    emoji: "📩",
    description: "Contacter directement le propriétaire du serveur",
    color: 0x9B59B6,
    welcome: "Tu contacteras directement le propriétaire du serveur. Expose ton sujet clairement.",
    questions: [
      "📋 Quel est l'objet de ton message ?",
      "✍️ Explique ton sujet en détail",
    ],
  },
};

type TicketTypeKey = keyof typeof TICKET_TYPES;

function err(msg: string) {
  return new EmbedBuilder().setColor(0xED4245).setTitle("❌ Erreur").setDescription(msg).setTimestamp();
}
function ok(msg: string) {
  return new EmbedBuilder().setColor(0x2ECC71).setTitle("✅ Succès").setDescription(msg).setTimestamp();
}

async function nextTicketNumber(guildId: string): Promise<number> {
  const result = await db.select({ max: max(ticketsTable.ticketNumber) })
    .from(ticketsTable).where(eq(ticketsTable.guildId, guildId));
  return (result[0]?.max ?? 0) + 1;
}

async function logTicketAction(guild: any, logChannelId: string | null | undefined, embed: EmbedBuilder) {
  if (!logChannelId) return;
  const ch = guild.channels.cache.get(logChannelId) as any;
  if (ch?.isTextBased()) ch.send({ embeds: [embed] }).catch(() => {});
}

async function createTicketChannel(
  guild: any,
  user: any,
  settings: any,
  typeKey: TicketTypeKey,
  reason: string,
): Promise<{ channel: any; ticketNumber: number } | null> {
  const type = TICKET_TYPES[typeKey];
  const num = await nextTicketNumber(guild.id);
  const numStr = String(num).padStart(4, "0");

  const permOverwrites: any[] = [
    { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
    { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
  ];
  // Owner tickets: only owner + bot can see
  if (typeKey === "owner") {
    const ownerId = guild.ownerId;
    if (ownerId) permOverwrites.push({ id: ownerId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
  } else if (settings.ticketSupportRoleId) {
    permOverwrites.push({ id: settings.ticketSupportRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] });
  }

  // For abuse reports, also add owner
  if (typeKey === "report_perm") {
    const ownerId = guild.ownerId;
    if (ownerId) permOverwrites.push({ id: ownerId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
  }

  const botUser = guild.members.me;
  if (botUser) permOverwrites.push({ id: botUser.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] });

  const channelNames: Record<TicketTypeKey, string> = {
    support: `support-${numStr}`,
    report_member: `report-${numStr}`,
    report_perm: `perm-abuse-${numStr}`,
    staff_apply: `candidature-${numStr}`,
    owner: `owner-${numStr}`,
  };

  try {
    const channel = await guild.channels.create({
      name: channelNames[typeKey],
      type: ChannelType.GuildText,
      parent: settings.ticketCategoryId ?? undefined,
      permissionOverwrites: permOverwrites,
      topic: `${type.emoji} ${type.label} — par ${user.tag} | ${reason}`,
    });

    await db.insert(ticketsTable).values({
      guildId: guild.id,
      channelId: channel.id,
      userId: user.id,
      userTag: user.tag,
      ticketNumber: num,
      reason,
      status: "open",
    });

    return { channel, ticketNumber: num };
  } catch {
    return null;
  }
}

async function sendTicketWelcome(
  channel: any,
  user: any,
  guild: any,
  settings: any,
  typeKey: TicketTypeKey,
  reason: string,
  ticketNumber: number,
) {
  const type = TICKET_TYPES[typeKey];
  const numStr = String(ticketNumber).padStart(4, "0");

  const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ticket_close").setLabel("🔒 Fermer").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("ticket_claim").setLabel("✋ Prendre en charge").setStyle(ButtonStyle.Secondary),
  );

  const questionsText = type.questions.map(q => `> ${q}`).join("\n");

  const pings: string[] = [`<@${user.id}>`];
  if (typeKey === "owner" || typeKey === "report_perm") {
    pings.push(`<@${guild.ownerId}>`);
  } else if (settings.ticketSupportRoleId && (typeKey as string) !== "owner") {
    pings.push(`<@&${settings.ticketSupportRoleId}>`);
  }

  await channel.send({
    content: pings.join(" "),
    embeds: [
      new EmbedBuilder()
        .setColor(type.color)
        .setAuthor({
          name: `${type.emoji} ${type.label} — Ticket #${numStr}`,
          iconURL: guild.iconURL() ?? undefined,
        })
        .setTitle(`Bienvenue, ${user.username} !`)
        .setThumbnail(user.displayAvatarURL({ size: 256 }))
        .setDescription(
          `${type.welcome}\n\n` +
          `**📋 Pour traiter ton ticket, merci de répondre aux points suivants :**\n${questionsText}`
        )
        .addFields(
          { name: "👤 Membre", value: `<@${user.id}>\n\`${user.tag}\``, inline: true },
          { name: "📂 Catégorie", value: `${type.emoji} ${type.label.replace(/^[^ ]+ /, "")}`, inline: true },
          { name: "🎫 Numéro", value: `#${numStr}`, inline: true },
          ...(reason !== "Panel" ? [{ name: "📝 Raison", value: reason, inline: false }] : []),
        )
        .setFooter({
          text: `${guild.name} • Utilise 🔒 Fermer pour fermer ce ticket`,
          iconURL: guild.iconURL() ?? undefined,
        })
        .setTimestamp(),
    ],
    components: [closeRow],
  });
}

// ─── PANEL BUILDER ────────────────────────────────────────────────────────────

function buildPanel(guild: any): { embed: EmbedBuilder; row: ActionRowBuilder<StringSelectMenuBuilder> } {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setAuthor({ name: `🎫 Support — ${guild.name}`, iconURL: guild.iconURL() ?? undefined })
    .setTitle("Comment pouvons-nous t'aider ?")
    .setThumbnail(guild.iconURL())
    .setDescription(
      "Sélectionne une catégorie dans le menu ci-dessous pour ouvrir un ticket.\n" +
      "Un salon privé sera créé rien que pour toi.\n\u200b"
    )
    .addFields(
      { name: "🆘 Support", value: "Besoin d'aide sur le serveur", inline: true },
      { name: "👤 Report Membre", value: "Signaler un comportement", inline: true },
      { name: "🚨 Report Abus Perm", value: "Signaler un staff abusif", inline: true },
      { name: "⭐ Devenir Staff", value: "Postuler pour le staff", inline: true },
      { name: "📩 Contacter Owner", value: "Message privé au proprio", inline: true },
      { name: "\u200b", value: "\u200b", inline: true },
    )
    .setFooter({
      text: `${guild.name} • Système de tickets • Un seul ticket ouvert à la fois`,
      iconURL: guild.iconURL() ?? undefined,
    })
    .setTimestamp();

  const menu = new StringSelectMenuBuilder()
    .setCustomId("ticket_select")
    .setPlaceholder("📋 Choisis une catégorie...")
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel("Support")
        .setDescription("Besoin d'aide sur le serveur ?")
        .setEmoji("🆘")
        .setValue("support"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Report Membre")
        .setDescription("Signaler un membre pour mauvais comportement")
        .setEmoji("👤")
        .setValue("report_member"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Report Abus de Permission")
        .setDescription("Signaler un staff qui abuse de ses permissions")
        .setEmoji("🚨")
        .setValue("report_perm"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Devenir Staff")
        .setDescription("Postuler pour rejoindre l'équipe")
        .setEmoji("⭐")
        .setValue("staff_apply"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Contacter l'Owner")
        .setDescription("Envoyer un message privé au propriétaire")
        .setEmoji("📩")
        .setValue("owner"),
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
  return { embed, row };
}

// ─── COMMANDS ─────────────────────────────────────────────────────────────────

export const ticketCommands: Command[] = [
  {
    name: "ticket",
    aliases: ["tkt"],
    category: "Tickets",
    description: "Ouvre un ticket (type optionnel)",
    usage: "+ticket [support|report|perm|staff|owner] [raison]",
    async execute(message, args, settings) {
      const typeMap: Record<string, TicketTypeKey> = {
        support: "support", aide: "support", help: "support",
        report: "report_member", membre: "report_member",
        perm: "report_perm", abuse: "report_perm", abus: "report_perm",
        staff: "staff_apply", candidature: "staff_apply",
        owner: "owner", proprio: "owner",
      };
      const typeKey: TicketTypeKey = typeMap[args[0]?.toLowerCase() ?? ""] ?? "support";
      const reason = args.slice(1).join(" ") || "Aucune raison";

      const existing = await db.select().from(ticketsTable).where(
        and(eq(ticketsTable.guildId, message.guild!.id), eq(ticketsTable.userId, message.author.id), eq(ticketsTable.status, "open"))
      );
      if (existing.length > 0)
        return void message.reply({ embeds: [
          new EmbedBuilder().setColor(0xF0B232).setTitle("⚠️ Ticket déjà ouvert")
            .setDescription(`Tu as déjà un ticket ouvert : <#${existing[0]!.channelId}>\nFerme-le d'abord.`)
        ]});

      const result = await createTicketChannel(message.guild!, message.author, settings, typeKey, reason);
      if (!result) return void message.reply({ embeds: [err("Impossible de créer le salon. Vérifie mes permissions.")] });

      await sendTicketWelcome(result.channel, message.author, message.guild!, settings, typeKey, reason, result.ticketNumber);
      message.reply({ embeds: [
        new EmbedBuilder().setColor(TICKET_TYPES[typeKey].color)
          .setTitle(`${TICKET_TYPES[typeKey].emoji} Ticket Créé !`)
          .setDescription(`Ton ticket a été ouvert : <#${result.channel.id}>`)
          .setTimestamp()
      ]});

      const numStr = String(result.ticketNumber).padStart(4, "0");
      await logTicketAction(message.guild!, settings.ticketLogChannelId, new EmbedBuilder()
        .setColor(TICKET_TYPES[typeKey].color)
        .setAuthor({ name: `📥 Ticket Créé — #${numStr}`, iconURL: message.author.displayAvatarURL() })
        .addFields(
          { name: "👤 Auteur", value: `${message.author.tag}\n\`${message.author.id}\``, inline: true },
          { name: "📂 Type", value: TICKET_TYPES[typeKey].label, inline: true },
          { name: "💬 Salon", value: `<#${result.channel.id}>`, inline: true },
          { name: "📝 Raison", value: reason, inline: false },
        )
        .setFooter({ text: message.guild!.name, iconURL: message.guild!.iconURL() ?? undefined })
        .setTimestamp()
      );
    },
  },
  {
    name: "tclose",
    aliases: ["closeticket"],
    category: "Tickets",
    description: "Ferme le ticket actuel",
    usage: "+tclose [raison]",
    async execute(message, args, settings, client) {
      const ticket = await db.select().from(ticketsTable).where(
        and(eq(ticketsTable.guildId, message.guild!.id), eq(ticketsTable.channelId, message.channelId), eq(ticketsTable.status, "open"))
      );
      if (!ticket[0]) return void message.reply({ embeds: [err("Ce salon n'est pas un ticket actif.")] });
      const isMod = message.member?.permissions.has(PermissionFlagsBits.ManageChannels);
      const isOwner = ticket[0].userId === message.author.id;
      if (!isMod && !isOwner) return void message.reply({ embeds: [err("Seul le propriétaire ou un modérateur peut fermer ce ticket.")] });

      const reason = args.join(" ") || "Fermé";
      const numStr = String(ticket[0].ticketNumber).padStart(4, "0");

      await (message.channel as any).send({ embeds: [
        new EmbedBuilder().setColor(0xED4245).setTitle("🔒 Ticket Fermé")
          .setDescription(`Fermé par <@${message.author.id}>.\n> **Raison :** ${reason}\n\n📄 Génération du transcript...\nSuppression dans **8 secondes**.`)
          .setTimestamp()
      ]});

      await db.update(ticketsTable).set({ status: "closed", closedById: message.author.id, closedByTag: message.author.tag, closedAt: new Date() })
        .where(eq(ticketsTable.channelId, message.channelId));

      const closedTicket = { ...ticket[0], closedById: message.author.id, closedByTag: message.author.tag };

      await logTicketAction(message.guild!, settings.ticketLogChannelId, new EmbedBuilder()
        .setColor(0xED4245).setAuthor({ name: `📤 Ticket Fermé — #${numStr}`, iconURL: message.author.displayAvatarURL() })
        .addFields(
          { name: "👤 Ouvert par", value: `${ticket[0].userTag}`, inline: true },
          { name: "👮 Fermé par", value: `${message.author.tag}`, inline: true },
          { name: "📝 Raison", value: reason, inline: true },
          { name: "⏱️ Durée", value: `<t:${Math.floor(ticket[0].createdAt.getTime() / 1000)}:R>`, inline: true },
        )
        .setFooter({ text: message.guild!.name, iconURL: message.guild!.iconURL() ?? undefined }).setTimestamp()
      );

      await sendTranscript(message.guild!, settings.ticketLogChannelId, closedTicket, message.author, message.channel);
      await dmTranscriptToCreator(client, message.channel, closedTicket, message.author);
      setTimeout(() => (message.channel as any).delete().catch(() => {}), 8000);
    },
  },
  {
    name: "tadd",
    aliases: ["ticket-add"],
    category: "Tickets",
    description: "Ajoute un utilisateur au ticket (mention ou ID)",
    usage: ".tadd @membre|ID",
    async execute(message, args) {
      const ticket = await db.select().from(ticketsTable).where(
        and(eq(ticketsTable.guildId, message.guild!.id), eq(ticketsTable.channelId, message.channelId))
      );
      if (!ticket[0]) return void message.reply({ embeds: [err("Ce salon n'est pas un ticket.")] });
      // Support mention or raw ID
      const mentioned = message.mentions.members?.first();
      const rawId = args[0]?.replace(/[<@!>]/g, "");
      const member = mentioned ?? (rawId && /^\d{17,20}$/.test(rawId)
        ? await message.guild!.members.fetch(rawId).catch(() => null) : null);
      if (!member) return void message.reply({ embeds: [err("Mentionne un membre ou fournis un ID valide.")] });
      await (message.channel as any).permissionOverwrites.edit(member.id, { ViewChannel: true, SendMessages: true });
      message.reply({ embeds: [new EmbedBuilder().setColor(0x2ECC71).setTitle("✅ Membre Ajouté").setDescription(`**${member.user.tag}** (\`${member.id}\`) ajouté au ticket.`).setTimestamp()] });
    },
  },
  {
    name: "tremove",
    aliases: ["ticket-remove"],
    category: "Tickets",
    description: "Retire un utilisateur du ticket (mention ou ID)",
    usage: ".tremove @membre|ID",
    async execute(message, args) {
      const ticket = await db.select().from(ticketsTable).where(
        and(eq(ticketsTable.guildId, message.guild!.id), eq(ticketsTable.channelId, message.channelId))
      );
      if (!ticket[0]) return void message.reply({ embeds: [err("Ce salon n'est pas un ticket.")] });
      const mentioned = message.mentions.members?.first();
      const rawId = args[0]?.replace(/[<@!>]/g, "");
      const member = mentioned ?? (rawId && /^\d{17,20}$/.test(rawId)
        ? await message.guild!.members.fetch(rawId).catch(() => null) : null);
      if (!member) return void message.reply({ embeds: [err("Mentionne un membre ou fournis un ID valide.")] });
      await (message.channel as any).permissionOverwrites.edit(member.id, { ViewChannel: false, SendMessages: false });
      message.reply({ embeds: [new EmbedBuilder().setColor(0xE67E22).setTitle("👋 Membre Retiré").setDescription(`**${member.user.tag}** (\`${member.id}\`) retiré du ticket.`).setTimestamp()] });
    },
  },
  {
    name: "tclaim",
    aliases: ["ticket-claim"],
    category: "Tickets",
    description: "Prend en charge le ticket (staff)",
    usage: "+tclaim",
    async execute(message, _a, settings) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageChannels))
        return void message.reply({ embeds: [err("Réservé au staff.")] });
      const ticket = await db.select().from(ticketsTable).where(
        and(eq(ticketsTable.guildId, message.guild!.id), eq(ticketsTable.channelId, message.channelId))
      );
      if (!ticket[0]) return void message.reply({ embeds: [err("Ce salon n'est pas un ticket.")] });
      message.reply({ embeds: [new EmbedBuilder().setColor(0x9B59B6).setTitle("✋ Ticket Pris en Charge").setDescription(`<@${message.author.id}> gère ce ticket.`).setTimestamp()] });
      await logTicketAction(message.guild!, settings.ticketLogChannelId, new EmbedBuilder()
        .setColor(0x9B59B6).setAuthor({ name: `✋ Ticket Pris — #${String(ticket[0].ticketNumber).padStart(4,"0")}`, iconURL: message.author.displayAvatarURL() })
        .addFields({ name: "👮 Staff", value: message.author.tag, inline: true }, { name: "👤 Auteur", value: ticket[0].userTag, inline: true })
        .setFooter({ text: message.guild!.name, iconURL: message.guild!.iconURL() ?? undefined }).setTimestamp()
      );
    },
  },
  {
    name: "tlist",
    aliases: ["tickets"],
    category: "Tickets",
    description: "Liste les tickets ouverts",
    usage: "+tlist",
    async execute(message) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageChannels))
        return void message.reply({ embeds: [err("Réservé au staff.")] });
      const open = await db.select().from(ticketsTable).where(
        and(eq(ticketsTable.guildId, message.guild!.id), eq(ticketsTable.status, "open"))
      );
      if (!open.length) return void message.reply({ embeds: [new EmbedBuilder().setColor(0x2ECC71).setTitle("🎫 Aucun ticket ouvert").setDescription("✅ Aucun ticket en ce moment.").setTimestamp()] });
      message.reply({ embeds: [
        new EmbedBuilder().setColor(0x5865F2).setTitle(`🎫 Tickets Ouverts — ${open.length}`)
          .setDescription(open.slice(0, 15).map(t =>
            `**#${String(t.ticketNumber).padStart(4,"0")}** <#${t.channelId}> — \`${t.userTag}\` <t:${Math.floor(t.createdAt.getTime()/1000)}:R>`
          ).join("\n"))
          .setFooter({ text: message.guild!.name, iconURL: message.guild!.iconURL() ?? undefined }).setTimestamp()
      ]});
    },
  },
  {
    name: "ticketsetup",
    aliases: ["tsetup", "setupticket"],
    category: "Tickets",
    description: "Configure le système de tickets",
    usage: "+ticketsetup <category|log|role|panel|info>",
    permissions: ["ManageGuild"],
    async execute(message, args, settings) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild))
        return void message.reply({ embeds: [err("Tu dois avoir **Gérer le serveur**.")] });
      const sub = args[0]?.toLowerCase();

      if (sub === "category") {
        const catId = args[1];
        if (!catId) return void message.reply({ embeds: [err("Fournis l'ID de la catégorie.")] });
        const cat = message.guild!.channels.cache.get(catId);
        if (!cat || cat.type !== ChannelType.GuildCategory) return void message.reply({ embeds: [err("ID de catégorie invalide.")] });
        await updateGuildSettings(message.guild!.id, { ticketCategoryId: catId });
        return void message.reply({ embeds: [ok(`Catégorie tickets : **${cat.name}**`)] });
      }
      if (sub === "log") {
        const ch = message.mentions.channels.first();
        if (!ch) return void message.reply({ embeds: [err("Mentionne un salon de logs.")] });
        await updateGuildSettings(message.guild!.id, { ticketLogChannelId: ch.id });
        return void message.reply({ embeds: [ok(`Logs tickets → <#${ch.id}>`)] });
      }
      if (sub === "role") {
        const role = message.mentions.roles.first();
        if (!role) return void message.reply({ embeds: [err("Mentionne un rôle support.")] });
        await updateGuildSettings(message.guild!.id, { ticketSupportRoleId: role.id });
        return void message.reply({ embeds: [ok(`Rôle support : **${role.name}**`)] });
      }
      if (sub === "panel") {
        const ch = (message.mentions.channels.first() as any) ?? (message.channel as any);
        await updateGuildSettings(message.guild!.id, { ticketPanelChannelId: ch.id });
        const { embed, row } = buildPanel(message.guild!);
        await ch.send({ embeds: [embed], components: [row] });
        return void message.reply({ embeds: [ok(`Panel tickets envoyé dans <#${ch.id}> !`)] });
      }

      // Info
      message.reply({ embeds: [
        new EmbedBuilder().setColor(0x5865F2)
          .setAuthor({ name: `🎫 Configuration Tickets — ${message.guild!.name}`, iconURL: message.guild!.iconURL() ?? undefined })
          .addFields(
            { name: "📁 Catégorie", value: settings.ticketCategoryId ? `\`${settings.ticketCategoryId}\`` : "🔴 Non configuré", inline: true },
            { name: "📋 Logs", value: settings.ticketLogChannelId ? `<#${settings.ticketLogChannelId}>` : "🔴 Non configuré", inline: true },
            { name: "🎭 Rôle Support", value: settings.ticketSupportRoleId ? `<@&${settings.ticketSupportRoleId}>` : "🔴 Non configuré", inline: true },
            { name: "📌 Sous-commandes", value: [
              "`+ticketsetup category <ID>` — catégorie",
              "`+ticketsetup log #salon` — logs",
              "`+ticketsetup role @rôle` — rôle support",
              "`+ticketsetup panel [#salon]` — envoyer le panel",
            ].join("\n") },
          )
          .setFooter({ text: "Commandes: +ticket | +tclose | +tadd | +tremove | +tlist" })
          .setTimestamp()
      ]});
    },
  },
];

// ─── INTERACTION HANDLER ──────────────────────────────────────────────────────

export function registerTicketInteractions(client: any) {
  client.on("interactionCreate", async (interaction: any) => {
    if (!interaction.guild) return;
    const { getGuildSettings } = await import("../utils/db.js");
    const settings = await getGuildSettings(interaction.guild.id).catch(() => null);
    if (!settings) return;

    // ── SELECT MENU ────────────────────────────────────────────────────────────
    if (interaction.isStringSelectMenu() && interaction.customId === "ticket_select") {
      const typeKey = interaction.values[0] as TicketTypeKey;
      const type = TICKET_TYPES[typeKey];
      if (!type) return;

      await interaction.deferReply({ ephemeral: true });

      const existing = await db.select().from(ticketsTable).where(
        and(eq(ticketsTable.guildId, interaction.guild.id), eq(ticketsTable.userId, interaction.user.id), eq(ticketsTable.status, "open"))
      );
      if (existing.length > 0) {
        return interaction.editReply({
          content: `❌ Tu as déjà un ticket ouvert : <#${existing[0]!.channelId}>\nFerme-le avant d'en ouvrir un nouveau.`,
        });
      }

      const result = await createTicketChannel(interaction.guild, interaction.user, settings, typeKey, "Panel");
      if (!result) return interaction.editReply({ content: "❌ Impossible de créer le ticket. Vérifie mes permissions." });

      await sendTicketWelcome(result.channel, interaction.user, interaction.guild, settings, typeKey, "Panel", result.ticketNumber);

      const numStr = String(result.ticketNumber).padStart(4, "0");
      await logTicketAction(interaction.guild, settings.ticketLogChannelId, new EmbedBuilder()
        .setColor(type.color)
        .setAuthor({ name: `📥 Ticket Créé — #${numStr}`, iconURL: interaction.user.displayAvatarURL() })
        .addFields(
          { name: "👤 Auteur", value: `${interaction.user.tag}\n\`${interaction.user.id}\``, inline: true },
          { name: "📂 Type", value: type.label, inline: true },
          { name: "💬 Salon", value: `<#${result.channel.id}>`, inline: true },
          { name: "📝 Source", value: "Panel (menu déroulant)", inline: true },
        )
        .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() ?? undefined })
        .setTimestamp()
      );

      return interaction.editReply({
        content: `${type.emoji} Ton ticket **${type.label}** a été créé : <#${result.channel.id}>`,
      });
    }

    if (!interaction.isButton()) return;

    // ── CLOSE BUTTON ───────────────────────────────────────────────────────────
    if (interaction.customId === "ticket_close") {
      const ticket = await db.select().from(ticketsTable).where(
        and(eq(ticketsTable.guildId, interaction.guild.id), eq(ticketsTable.channelId, interaction.channelId), eq(ticketsTable.status, "open"))
      );
      if (!ticket[0]) return interaction.reply({ content: "❌ Ce n'est pas un ticket actif.", ephemeral: true });
      const isMod = interaction.member?.permissions?.has(PermissionFlagsBits.ManageChannels);
      const isOwner = ticket[0].userId === interaction.user.id;
      if (!isMod && !isOwner) return interaction.reply({ content: "❌ Tu n'as pas la permission.", ephemeral: true });

      await interaction.reply({ embeds: [
        new EmbedBuilder().setColor(0xED4245).setTitle("🔒 Ticket Fermé")
          .setDescription(`Fermé par <@${interaction.user.id}>.\n📄 Génération du transcript...\nSuppression dans **8 secondes**.`).setTimestamp()
      ]});

      await db.update(ticketsTable).set({
        status: "closed", closedById: interaction.user.id, closedByTag: interaction.user.tag, closedAt: new Date(),
      }).where(eq(ticketsTable.channelId, interaction.channelId));

      const closedTicket = { ...ticket[0], closedById: interaction.user.id, closedByTag: interaction.user.tag };

      await logTicketAction(interaction.guild, settings.ticketLogChannelId, new EmbedBuilder()
        .setColor(0xED4245).setAuthor({ name: `📤 Ticket Fermé — #${String(ticket[0].ticketNumber).padStart(4,"0")}`, iconURL: interaction.user.displayAvatarURL() })
        .addFields(
          { name: "👤 Ouvert par", value: ticket[0].userTag, inline: true },
          { name: "👮 Fermé par", value: interaction.user.tag, inline: true },
          { name: "⏱️ Durée", value: `<t:${Math.floor(ticket[0].createdAt.getTime()/1000)}:R>`, inline: true },
        )
        .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() ?? undefined }).setTimestamp()
      );

      await sendTranscript(interaction.guild, settings.ticketLogChannelId, closedTicket, interaction.user, interaction.channel);
      await dmTranscriptToCreator(client, interaction.channel, closedTicket, interaction.user);
      setTimeout(() => interaction.channel?.delete().catch(() => {}), 8000);
    }

    // ── CLAIM BUTTON ───────────────────────────────────────────────────────────
    if (interaction.customId === "ticket_claim") {
      const isMod = interaction.member?.permissions?.has(PermissionFlagsBits.ManageChannels);
      if (!isMod) return interaction.reply({ content: "❌ Réservé au staff.", ephemeral: true });
      await interaction.reply({ embeds: [
        new EmbedBuilder().setColor(0x9B59B6).setTitle("✋ Ticket Pris en Charge")
          .setDescription(`<@${interaction.user.id}> gère ce ticket.`).setTimestamp()
      ]});
      await logTicketAction(interaction.guild, settings.ticketLogChannelId, new EmbedBuilder()
        .setColor(0x9B59B6).setDescription(`✋ **${interaction.user.tag}** a pris en charge un ticket dans <#${interaction.channelId}>`)
        .setTimestamp()
      );
    }
  });
}
