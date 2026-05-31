import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import type { Command } from "../types.js";
import { db, afkTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const OWNER_ID = process.env["DISCORD_OWNER_ID"] ?? "";

function errorEmbed(title: string, desc: string) {
  return new EmbedBuilder().setColor(0xED4245).setTitle(`❌ ${title}`).setDescription(desc).setTimestamp();
}
function successEmbed(title: string, desc: string) {
  return new EmbedBuilder().setColor(0x2ECC71).setTitle(`✅ ${title}`).setDescription(desc).setTimestamp();
}

export function registerAfkListener(client: any) {
  client.on("messageCreate", async (message: any) => {
    if (!message.guild || message.author.bot) return;

    const rows = await db.select().from(afkTable)
      .where(and(eq(afkTable.guildId, message.guild.id), eq(afkTable.userId, message.author.id)));
    if (rows.length > 0) {
      await db.delete(afkTable)
        .where(and(eq(afkTable.guildId, message.guild.id), eq(afkTable.userId, message.author.id)));
      const reply = await message.reply({ embeds: [
        new EmbedBuilder().setColor(0x5865F2)
          .setTitle("👋 Bienvenue de retour !")
          .setDescription(`Ton AFK a été retiré. Tu étais absent depuis <t:${Math.floor(rows[0]!.createdAt.getTime() / 1000)}:R>.`)
          .setTimestamp()
      ]}).catch(() => null);
      if (reply) setTimeout(() => reply.delete().catch(() => {}), 6000);
    }

    for (const mention of message.mentions.users.values()) {
      const afkRows = await db.select().from(afkTable)
        .where(and(eq(afkTable.guildId, message.guild.id), eq(afkTable.userId, mention.id)));
      if (afkRows.length > 0) {
        const reply = await message.reply({ embeds: [
          new EmbedBuilder().setColor(0xF0B232)
            .setTitle("💤 Utilisateur AFK")
            .setDescription(`**${mention.username}** est actuellement AFK depuis <t:${Math.floor(afkRows[0]!.createdAt.getTime() / 1000)}:R>.`)
            .addFields({ name: "📝 Raison", value: afkRows[0]!.reason })
            .setTimestamp()
        ]}).catch(() => null);
        if (reply) setTimeout(() => reply.delete().catch(() => {}), 8000);
      }
    }
  });
}

export const systemsCommands: Command[] = [
  {
    name: "afk",
    category: "Utilitaire",
    description: "Active le mode AFK",
    usage: "+afk [raison]",
    async execute(message, args) {
      const reason = args.join(" ") || "AFK";
      const existing = await db.select().from(afkTable)
        .where(and(eq(afkTable.guildId, message.guild!.id), eq(afkTable.userId, message.author.id)));
      if (existing.length > 0) {
        await db.update(afkTable).set({ reason, createdAt: new Date() })
          .where(and(eq(afkTable.guildId, message.guild!.id), eq(afkTable.userId, message.author.id)));
      } else {
        await db.insert(afkTable).values({ guildId: message.guild!.id, userId: message.author.id, reason });
      }
      message.reply({ embeds: [
        new EmbedBuilder().setColor(0x9B59B6)
          .setTitle("💤 Mode AFK Activé")
          .setDescription(`Tu es maintenant AFK. Les autres membres verront ton statut si tu es mentionné.`)
          .addFields({ name: "📝 Raison", value: reason })
          .setFooter({ text: "Envoie un message pour retirer ton AFK" })
          .setTimestamp()
      ]});
    },
  },

  // ─── WRITE WITH BOT ──────────────────────────────────────────────────────

  {
    name: "botwrite",
    aliases: ["write", "send"],
    category: "Utilitaire",
    description: "Fait écrire le bot dans un salon",
    usage: "+botwrite [#salon] <message>",
    permissions: ["ManageMessages"],
    async execute(message, args, settings) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageMessages))
        return void message.reply({ embeds: [errorEmbed("Permission refusée", "Tu dois avoir la permission **Gérer les messages**.")] });
      const ch = (message.mentions.channels.first() as any) ?? message.channel;
      const text = args.filter(a => !a.startsWith("<#")).join(" ");
      if (!text) return void message.reply({ embeds: [errorEmbed("Contenu manquant", "Fournis un message à envoyer.")] });
      await message.delete().catch(() => {});
      await ch.send(text);
    },
  },
  {
    name: "botwriteem",
    aliases: ["writeem", "sendembed"],
    category: "Utilitaire",
    description: "Fait envoyer un embed stylisé par le bot",
    usage: "+botwriteem [#salon] <titre> | <description> | [couleur hex]",
    permissions: ["ManageMessages"],
    async execute(message, args, settings) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageMessages))
        return void message.reply({ embeds: [errorEmbed("Permission refusée", "Tu dois avoir la permission **Gérer les messages**.")] });
      const ch = (message.mentions.channels.first() as any) ?? message.channel;
      const raw = args.filter(a => !a.startsWith("<#")).join(" ");
      const parts = raw.split("|").map(s => s.trim());
      if (!parts[0]) return void message.reply({ embeds: [errorEmbed("Contenu manquant", "Usage: `+botwriteem [#salon] titre | description | #couleur`")] });
      const colorHex = parts[2]?.replace("#", "");
      const color = colorHex && /^[0-9a-fA-F]{6}$/.test(colorHex)
        ? parseInt(colorHex, 16)
        : parseInt(settings.embedColor.replace("#", ""), 16) || 0x5865F2;
      await message.delete().catch(() => {});
      ch.send({ embeds: [
        new EmbedBuilder()
          .setColor(color as any)
          .setTitle(parts[0])
          .setDescription(parts[1] ?? "\u200b")
          .setFooter({ text: message.guild!.name, iconURL: message.guild!.iconURL() ?? undefined })
          .setTimestamp()
      ]});
    },
  },
  {
    name: "dm",
    aliases: ["botdm"],
    category: "Utilitaire",
    description: "Envoie un DM à un utilisateur via le bot",
    usage: "+dm @membre <message>",
    permissions: ["ManageMessages"],
    async execute(message, args) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageMessages))
        return void message.reply({ embeds: [errorEmbed("Permission refusée", "Tu dois avoir la permission **Gérer les messages**.")] });
      const target = message.mentions.users.first();
      if (!target) return void message.reply({ embeds: [errorEmbed("Utilisateur manquant", "Mentionne un utilisateur.")] });
      const text = args.slice(1).join(" ");
      if (!text) return void message.reply({ embeds: [errorEmbed("Contenu manquant", "Fournis un message.")] });
      try {
        await target.send({ embeds: [
          new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`📨 Message de ${message.guild!.name}`)
            .setDescription(text)
            .setThumbnail(message.guild!.iconURL())
            .setFooter({ text: `Envoyé par ${message.author.tag}` })
            .setTimestamp()
        ]});
        message.reply({ embeds: [successEmbed("DM Envoyé", `Message envoyé à **${target.tag}**.`)] });
      } catch {
        message.reply({ embeds: [errorEmbed("Erreur", "Impossible d'envoyer le DM. L'utilisateur les a peut-être désactivés.")] });
      }
    },
  },
  {
    name: "edit",
    aliases: ["editmsg"],
    category: "Utilitaire",
    description: "Modifie un message du bot",
    usage: "+edit <messageId> <nouveau contenu>",
    permissions: ["ManageMessages"],
    async execute(message, args) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageMessages))
        return void message.reply({ embeds: [errorEmbed("Permission refusée", "Tu dois avoir la permission **Gérer les messages**.")] });
      const msgId = args[0];
      const newContent = args.slice(1).join(" ");
      if (!msgId || !newContent)
        return void message.reply({ embeds: [errorEmbed("Paramètres manquants", "Usage: `+edit <messageId> <contenu>`")] });
      const target = await message.channel.messages.fetch(msgId).catch(() => null);
      if (!target) return void message.reply({ embeds: [errorEmbed("Message introuvable", "ID de message invalide.")] });
      if (target.author.id !== message.client.user?.id)
        return void message.reply({ embeds: [errorEmbed("Impossible", "Je ne peux modifier que mes propres messages.")] });
      await target.edit(newContent);
      message.reply({ embeds: [successEmbed("Message modifié", `[Voir le message](${target.url})`)] });
    },
  },
  {
    name: "react",
    aliases: ["addreaction"],
    category: "Utilitaire",
    description: "Ajoute une réaction à un message",
    usage: "+react <messageId> <emoji>",
    permissions: ["ManageMessages"],
    async execute(message, args) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageMessages))
        return void message.reply({ embeds: [errorEmbed("Permission refusée", "Tu dois avoir la permission **Gérer les messages**.")] });
      const msgId = args[0];
      const emoji = args[1];
      if (!msgId || !emoji)
        return void message.reply({ embeds: [errorEmbed("Paramètres manquants", "Usage: `+react <messageId> <emoji>`")] });
      const target = await message.channel.messages.fetch(msgId).catch(() => null);
      if (!target) return void message.reply({ embeds: [errorEmbed("Message introuvable", "ID de message invalide.")] });
      try {
        await target.react(emoji);
        await message.delete().catch(() => {});
      } catch {
        message.reply({ embeds: [errorEmbed("Emoji invalide", "Cet emoji n'est pas utilisable.")] });
      }
    },
  },
  {
    name: "broadcast",
    category: "Utilitaire",
    description: "Envoie un message dans tous les salons textuels (propriétaire uniquement)",
    usage: "+broadcast <message>",
    ownerOnly: true,
    async execute(message, args, _s, client) {
      if (message.author.id !== OWNER_ID && OWNER_ID !== "")
        return void message.reply({ embeds: [errorEmbed("Permission refusée", "Réservé au propriétaire du bot.")] });
      const text = args.join(" ");
      if (!text) return void message.reply({ embeds: [errorEmbed("Contenu manquant", "Fournis un message.")] });
      let sent = 0;
      for (const [, guild] of client.guilds.cache) {
        const ch = guild.channels.cache.find((c: any) => c.isTextBased() && c.permissionsFor(guild.members.me!)?.has(PermissionFlagsBits.SendMessages)) as any;
        if (ch) { await ch.send(text).catch(() => {}); sent++; }
      }
      message.reply({ embeds: [successEmbed("Broadcast envoyé", `Message envoyé dans **${sent}** serveur(s).`)] });
    },
  },
];
