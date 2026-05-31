import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import type { Command } from "../types.js";
import { updateGuildSettings, getGuildSettings } from "../utils/db.js";

function errorEmbed(msg: string) { return new EmbedBuilder().setColor(0xe74c3c).setDescription(`❌ ${msg}`); }
function successEmbed(msg: string) { return new EmbedBuilder().setColor(0x2ecc71).setDescription(`✅ ${msg}`); }

const bannedWordsByGuild = new Map<string, Set<string>>();

export function getBannedWords(guildId: string): Set<string> {
  if (!bannedWordsByGuild.has(guildId)) bannedWordsByGuild.set(guildId, new Set());
  return bannedWordsByGuild.get(guildId)!;
}

export function registerAutoModListeners(client: any) {
  client.on("messageCreate", async (message: any) => {
    if (!message.guild || message.author?.bot) return;
    const words = getBannedWords(message.guild.id);
    if (words.size === 0) return;
    const content = message.content.toLowerCase();
    for (const word of words) {
      if (content.includes(word)) {
        await message.delete().catch(() => {});
        const warn = await message.channel.send({
          embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription(`⚠️ <@${message.author.id}>, ton message a été supprimé car il contient un mot interdit.`)],
        }).catch(() => null);
        if (warn) setTimeout(() => warn.delete().catch(() => {}), 5000);
        return;
      }
    }
  });
}

export const automodCommands: Command[] = [
  {
    name: "addword",
    aliases: ["banword"],
    category: "Auto-Mod",
    description: "Ajoute un mot interdit (filtré automatiquement)",
    usage: "+addword <mot>",
    permissions: ["ManageMessages"],
    async execute(message, args) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageMessages))
        return void message.reply({ embeds: [errorEmbed("Tu n'as pas la permission.")] });
      const word = args[0]?.toLowerCase();
      if (!word) return void message.reply({ embeds: [errorEmbed("Fournis un mot à interdire.")] });
      getBannedWords(message.guild!.id).add(word);
      message.reply({ embeds: [successEmbed(`Mot \`${word}\` ajouté aux mots interdits.`)] });
    },
  },
  {
    name: "removeword",
    aliases: ["unbanword"],
    category: "Auto-Mod",
    description: "Retire un mot interdit",
    usage: "+removeword <mot>",
    permissions: ["ManageMessages"],
    async execute(message, args) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageMessages))
        return void message.reply({ embeds: [errorEmbed("Tu n'as pas la permission.")] });
      const word = args[0]?.toLowerCase();
      if (!word) return void message.reply({ embeds: [errorEmbed("Fournis le mot à retirer.")] });
      getBannedWords(message.guild!.id).delete(word);
      message.reply({ embeds: [successEmbed(`Mot \`${word}\` retiré de la liste des mots interdits.`)] });
    },
  },
  {
    name: "wordlist",
    aliases: ["bannedwords", "filteredwords"],
    category: "Auto-Mod",
    description: "Affiche la liste des mots interdits",
    usage: "+wordlist",
    permissions: ["ManageMessages"],
    async execute(message) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageMessages))
        return void message.reply({ embeds: [errorEmbed("Tu n'as pas la permission.")] });
      const words = getBannedWords(message.guild!.id);
      message.reply({ embeds: [
        new EmbedBuilder().setColor(0xe67e22)
          .setTitle("🚫 Mots interdits")
          .setDescription(words.size > 0 ? [...words].map(w => `• \`${w}\``).join("\n") : "Aucun mot interdit configuré.")
      ]});
    },
  },
  {
    name: "clearwords",
    category: "Auto-Mod",
    description: "Efface tous les mots interdits",
    usage: "+clearwords",
    permissions: ["ManageMessages"],
    async execute(message) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageMessages))
        return void message.reply({ embeds: [errorEmbed("Tu n'as pas la permission.")] });
      getBannedWords(message.guild!.id).clear();
      message.reply({ embeds: [successEmbed("Liste des mots interdits effacée.")] });
    },
  },
  {
    name: "automodinfo",
    aliases: ["amod"],
    category: "Auto-Mod",
    description: "Affiche le statut de l'auto-modération",
    usage: "+automodinfo",
    async execute(message, _args, settings) {
      const words = getBannedWords(message.guild!.id);
      message.reply({ embeds: [
        new EmbedBuilder().setColor(0x5865F2)
          .setTitle("🛡️ Auto-Modération")
          .addFields(
            { name: "Filtre de mots", value: `${words.size} mot(s) interdit(s)`, inline: true },
            { name: "Auto-Log", value: settings.autologChannelId ? `<#${settings.autologChannelId}>` : "Désactivé", inline: true },
            { name: "Mod-Log", value: settings.modlogChannelId ? `<#${settings.modlogChannelId}>` : "Désactivé", inline: true },
          )
          .setFooter({ text: "Utilisez +addword, +autolog, +modlog pour configurer" })
      ]});
    },
  },
];
