import { EmbedBuilder, ActivityType, PermissionFlagsBits } from "discord.js";
import type { Command } from "../types.js";

const OWNER_ID = process.env["DISCORD_OWNER_ID"] ?? "";

function errorEmbed(msg: string) {
  return new EmbedBuilder().setColor(0xe74c3c).setDescription(`❌ ${msg}`);
}
function successEmbed(msg: string) {
  return new EmbedBuilder().setColor(0x2ecc71).setDescription(`✅ ${msg}`);
}

export const profileCommands: Command[] = [
  {
    name: "profile",
    aliases: ["profil"],
    category: "Profil",
    description: "Affiche le profil complet d'un utilisateur",
    usage: "+profile [@membre]",
    async execute(message, _args, _s, client) {
      const targetUser = await (message.mentions.users.first()?.fetch() ?? message.author.fetch());
      const targetMember = message.guild?.members.cache.get(targetUser.id);
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`👤 Profil de ${targetUser.username}`)
        .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: "🆔 ID", value: targetUser.id, inline: true },
          { name: "📛 Tag", value: targetUser.tag, inline: true },
          { name: "🤖 Bot", value: targetUser.bot ? "Oui" : "Non", inline: true },
          { name: "📅 Compte créé", value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`, inline: true },
        );
      if (targetMember) {
        embed.addFields(
          { name: "📥 A rejoint", value: `<t:${Math.floor((targetMember.joinedTimestamp ?? 0) / 1000)}:R>`, inline: true },
          { name: "📛 Surnom", value: targetMember.nickname ?? "Aucun", inline: true },
          { name: "🎭 Rôle principal", value: targetMember.roles.highest.name, inline: true },
        );
      }
      const banner = targetUser.bannerURL({ size: 1024 });
      if (banner) embed.setImage(banner);
      message.reply({ embeds: [embed] });
    },
  },
  {
    name: "setavatar",
    aliases: ["changeavatar"],
    category: "Profil",
    description: "Change l'avatar du bot (propriétaire uniquement)",
    usage: "+setavatar <url>",
    ownerOnly: true,
    async execute(message, args, _s, client) {
      if (message.author.id !== OWNER_ID && OWNER_ID !== "")
        return void message.reply({ embeds: [errorEmbed("Commande réservée au propriétaire du bot.")] });
      const url = args[0] ?? message.attachments.first()?.url;
      if (!url) return void message.reply({ embeds: [errorEmbed("Fournis une URL ou attache une image.")] });
      try {
        await client.user?.setAvatar(url);
        message.reply({ embeds: [successEmbed("Avatar du bot mis à jour !")] });
      } catch (e) {
        message.reply({ embeds: [errorEmbed(`Erreur : ${(e as Error).message}`)] });
      }
    },
  },
  {
    name: "setbanner",
    aliases: ["changebanner"],
    category: "Profil",
    description: "Change la bannière du bot (propriétaire uniquement)",
    usage: "+setbanner <url>",
    ownerOnly: true,
    async execute(message, args, _s, client) {
      if (message.author.id !== OWNER_ID && OWNER_ID !== "")
        return void message.reply({ embeds: [errorEmbed("Commande réservée au propriétaire du bot.")] });
      const url = args[0] ?? message.attachments.first()?.url;
      if (!url) return void message.reply({ embeds: [errorEmbed("Fournis une URL ou attache une image.")] });
      try {
        await client.user?.setBanner(url);
        message.reply({ embeds: [successEmbed("Bannière du bot mise à jour !")] });
      } catch (e) {
        message.reply({ embeds: [errorEmbed(`Erreur : ${(e as Error).message}`)] });
      }
    },
  },
  {
    name: "setgame",
    aliases: ["setstatus", "setplaying"],
    category: "Profil",
    description: "Change le statut d'activité du bot (propriétaire uniquement)",
    usage: "+setgame <playing|watching|listening|competing> <texte>",
    ownerOnly: true,
    async execute(message, args, _s, client) {
      if (message.author.id !== OWNER_ID && OWNER_ID !== "")
        return void message.reply({ embeds: [errorEmbed("Commande réservée au propriétaire du bot.")] });
      const typeMap: Record<string, number> = {
        playing: ActivityType.Playing,
        watching: ActivityType.Watching,
        listening: ActivityType.Listening,
        competing: ActivityType.Competing,
      };
      const type = typeMap[args[0]?.toLowerCase() ?? "playing"] ?? ActivityType.Playing;
      const text = args.slice(1).join(" ");
      if (!text) return void message.reply({ embeds: [errorEmbed("Fournis un texte d'activité.")] });
      client.user?.setActivity(text, { type });
      message.reply({ embeds: [successEmbed(`Statut mis à jour !`)] });
    },
  },
  {
    name: "setnick",
    aliases: ["setnickname"],
    category: "Profil",
    description: "Change le surnom du bot sur ce serveur",
    usage: "+setnick <surnom>",
    permissions: ["ManageNicknames"],
    async execute(message, args, _s, client) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageNicknames))
        return void message.reply({ embeds: [errorEmbed("Tu n'as pas la permission.")] });
      const nick = args.join(" ") || null;
      await message.guild?.members.me?.setNickname(nick);
      message.reply({ embeds: [successEmbed(nick ? `Mon surnom a été changé en **${nick}**.` : "Mon surnom a été réinitialisé.")] });
    },
  },
];
