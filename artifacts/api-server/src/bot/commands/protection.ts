import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import type { Command } from "../types.js";
import { updateGuildSettings } from "../utils/db.js";

const spamMap = new Map<string, { count: number; timer: NodeJS.Timeout }>();

export function registerProtectionListeners(client: any) {
  client.on("messageCreate", async (message: any) => {
    if (!message.guild || message.author?.bot) return;
    if (message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) return;

    const { getGuildSettings } = await import("../utils/db.js");
    const settings = await getGuildSettings(message.guild.id).catch(() => null);
    if (!settings) return;

    const content: string = message.content ?? "";
    const channelId: string = message.channelId;
    const guildId: string = message.guild.id;
    const userId: string = message.author.id;

    const INVITE_RE = /discord\.gg\/[a-zA-Z0-9]+|discord\.com\/invite\/[a-zA-Z0-9]+/i;
    const LINK_RE = /https?:\/\//i;

    async function deleteAndWarn(reason: string) {
      await message.delete().catch(() => {});
      const warn = await (message.channel as any).send({
        content: `<@${userId}>`,
        embeds: [
          new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle("🛡️ Auto-Modération")
            .setDescription(`Ton message a été supprimé — **${reason}**`)
            .setFooter({ text: message.guild.name })
            .setTimestamp(),
        ],
      }).catch(() => null);
      if (warn) setTimeout(() => warn.delete().catch(() => {}), 6000);
    }

    if (settings.antiinvite && INVITE_RE.test(content)) {
      return deleteAndWarn("Liens d'invitation Discord interdits");
    }

    if (settings.antilink && LINK_RE.test(content) && !INVITE_RE.test(content)) {
      return deleteAndWarn("Liens externes interdits dans ce serveur");
    }

    if (settings.anticaps && content.length > 10) {
      const upper = (content.match(/[A-Z]/g) ?? []).length;
      const total = (content.match(/[a-zA-Z]/g) ?? []).length;
      if (total > 0 && (upper / total) * 100 >= settings.capsPercent) {
        return deleteAndWarn(`Trop de majuscules (>${settings.capsPercent}%)`);
      }
    }

    if (settings.antimention) {
      const mentionCount = (message.mentions.users.size ?? 0) + (message.mentions.roles.size ?? 0);
      if (mentionCount >= settings.mentionLimit) {
        return deleteAndWarn(`Trop de mentions (max ${settings.mentionLimit})`);
      }
    }

    if (settings.antispam) {
      const key = `${guildId}:${channelId}:${userId}`;
      const current = spamMap.get(key);
      if (current) {
        current.count++;
        if (current.count >= 5) {
          spamMap.delete(key);
          await message.member?.timeout(30000, "Anti-spam").catch(() => {});
          await deleteAndWarn("Spam détecté — timeout 30 secondes");
          return;
        }
      } else {
        const timer = setTimeout(() => spamMap.delete(key), 4000);
        spamMap.set(key, { count: 1, timer });
      }
    }
  });
}

function successEmbed(title: string, desc: string) {
  return new EmbedBuilder().setColor(0x2ECC71).setTitle(`✅ ${title}`).setDescription(desc).setTimestamp();
}

export const protectionCommands: Command[] = [
  {
    name: "antilink",
    category: "Protection",
    description: "Active/désactive le filtre de liens externes",
    usage: "+antilink <on|off|status>",
    permissions: ["ManageGuild"],
    async execute(message, args, settings) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild))
        return void message.reply({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription("❌ Permission refusée.")] });
      const sub = args[0]?.toLowerCase();
      if (sub === "on") {
        await updateGuildSettings(message.guild!.id, { antilink: true });
        message.reply({ embeds: [successEmbed("Anti-Lien Activé", "Les liens externes seront automatiquement supprimés.")] });
      } else if (sub === "off") {
        await updateGuildSettings(message.guild!.id, { antilink: false });
        message.reply({ embeds: [successEmbed("Anti-Lien Désactivé", "Les liens externes sont maintenant autorisés.")] });
      } else {
        message.reply({ embeds: [statusEmbed("🔗 Anti-Lien", settings.antilink, "antilink on/off")] });
      }
    },
  },
  {
    name: "antiinvite",
    category: "Protection",
    description: "Active/désactive le filtre d'invitations Discord",
    usage: "+antiinvite <on|off|status>",
    permissions: ["ManageGuild"],
    async execute(message, args, settings) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild))
        return void message.reply({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription("❌ Permission refusée.")] });
      const sub = args[0]?.toLowerCase();
      if (sub === "on") {
        await updateGuildSettings(message.guild!.id, { antiinvite: true });
        message.reply({ embeds: [successEmbed("Anti-Invite Activé", "Les liens d'invitation Discord seront supprimés.")] });
      } else if (sub === "off") {
        await updateGuildSettings(message.guild!.id, { antiinvite: false });
        message.reply({ embeds: [successEmbed("Anti-Invite Désactivé", "Les liens d'invitation sont maintenant autorisés.")] });
      } else {
        message.reply({ embeds: [statusEmbed("📨 Anti-Invite", settings.antiinvite, "antiinvite on/off")] });
      }
    },
  },
  {
    name: "antispam",
    category: "Protection",
    description: "Active/désactive la protection anti-spam",
    usage: "+antispam <on|off|status>",
    permissions: ["ManageGuild"],
    async execute(message, args, settings) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild))
        return void message.reply({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription("❌ Permission refusée.")] });
      const sub = args[0]?.toLowerCase();
      if (sub === "on") {
        await updateGuildSettings(message.guild!.id, { antispam: true });
        message.reply({ embeds: [successEmbed("Anti-Spam Activé", "Les spammeurs seront automatiquement mis en timeout (30s).")] });
      } else if (sub === "off") {
        await updateGuildSettings(message.guild!.id, { antispam: false });
        message.reply({ embeds: [successEmbed("Anti-Spam Désactivé", "La protection anti-spam est désactivée.")] });
      } else {
        message.reply({ embeds: [statusEmbed("🚫 Anti-Spam", settings.antispam, "antispam on/off")] });
      }
    },
  },
  {
    name: "anticaps",
    category: "Protection",
    description: "Active/désactive le filtre anti-majuscules",
    usage: "+anticaps <on|off|status> [pourcentage]",
    permissions: ["ManageGuild"],
    async execute(message, args, settings) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild))
        return void message.reply({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription("❌ Permission refusée.")] });
      const sub = args[0]?.toLowerCase();
      const pct = parseInt(args[1] ?? "70");
      if (sub === "on") {
        await updateGuildSettings(message.guild!.id, { anticaps: true, capsPercent: isNaN(pct) ? 70 : pct });
        message.reply({ embeds: [successEmbed("Anti-Caps Activé", `Messages avec >${isNaN(pct) ? 70 : pct}% de majuscules seront supprimés.`)] });
      } else if (sub === "off") {
        await updateGuildSettings(message.guild!.id, { anticaps: false });
        message.reply({ embeds: [successEmbed("Anti-Caps Désactivé", "")] });
      } else {
        message.reply({ embeds: [statusEmbed(`🔠 Anti-Caps (${settings.capsPercent}%)`, settings.anticaps, "anticaps on/off [%]")] });
      }
    },
  },
  {
    name: "antimention",
    category: "Protection",
    description: "Active/désactive le filtre anti-mentions de masse",
    usage: "+antimention <on|off|status> [limite]",
    permissions: ["ManageGuild"],
    async execute(message, args, settings) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild))
        return void message.reply({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription("❌ Permission refusée.")] });
      const sub = args[0]?.toLowerCase();
      const limit = parseInt(args[1] ?? "5");
      if (sub === "on") {
        await updateGuildSettings(message.guild!.id, { antimention: true, mentionLimit: isNaN(limit) ? 5 : limit });
        message.reply({ embeds: [successEmbed("Anti-Mention Activé", `Messages avec ≥${isNaN(limit) ? 5 : limit} mentions seront supprimés.`)] });
      } else if (sub === "off") {
        await updateGuildSettings(message.guild!.id, { antimention: false });
        message.reply({ embeds: [successEmbed("Anti-Mention Désactivé", "")] });
      } else {
        message.reply({ embeds: [statusEmbed(`🏷️ Anti-Mention (max ${settings.mentionLimit})`, settings.antimention, "antimention on/off [limite]")] });
      }
    },
  },
  {
    name: "protection",
    aliases: ["security", "shield"],
    category: "Protection",
    description: "Affiche le statut de toutes les protections",
    usage: "+protection",
    async execute(message, _args, settings) {
      const on = "🟢 Activé";
      const off = "🔴 Désactivé";
      message.reply({ embeds: [
        new EmbedBuilder()
          .setColor(0x5865F2)
          .setAuthor({ name: `🛡️ Protections — ${message.guild!.name}`, iconURL: message.guild!.iconURL() ?? undefined })
          .addFields(
            { name: "🔗 Anti-Lien", value: settings.antilink ? on : off, inline: true },
            { name: "📨 Anti-Invite", value: settings.antiinvite ? on : off, inline: true },
            { name: "🚫 Anti-Spam", value: settings.antispam ? on : off, inline: true },
            { name: `🔠 Anti-Caps (${settings.capsPercent}%)`, value: settings.anticaps ? on : off, inline: true },
            { name: `🏷️ Anti-Mention (max ${settings.mentionLimit})`, value: settings.antimention ? on : off, inline: true },
          )
          .setFooter({ text: "Utilisez +antilink on/off, +antispam on/off, etc." })
          .setTimestamp()
      ]});
    },
  },
];

function statusEmbed(title: string, active: boolean, hint: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(active ? 0x2ECC71 : 0xED4245)
    .setTitle(`${active ? "🟢" : "🔴"} ${title}`)
    .setDescription(`Statut : **${active ? "Activé" : "Désactivé"}**\nUsage : \`+${hint}\``)
    .setTimestamp();
}
