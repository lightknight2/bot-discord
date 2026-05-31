import { EmbedBuilder, PermissionFlagsBits, ChannelType } from "discord.js";
import type { Command } from "../types.js";

const sniped = new Map<string, { content: string; author: string; time: Date }>();
const editSniped = new Map<string, { before: string; after: string; author: string; time: Date }>();

export function registerSnipeListeners(client: any) {
  client.on("messageDelete", (msg: any) => {
    if (!msg.guild || msg.author?.bot || !msg.content) return;
    sniped.set(msg.channel.id, { content: msg.content, author: msg.author?.tag ?? "?", time: new Date() });
  });
  client.on("messageUpdate", (old: any, newMsg: any) => {
    if (!newMsg.guild || newMsg.author?.bot || old.content === newMsg.content) return;
    editSniped.set(newMsg.channel.id, { before: old.content ?? "?", after: newMsg.content ?? "?", author: newMsg.author?.tag ?? "?", time: new Date() });
  });
}

function errorEmbed(msg: string) { return new EmbedBuilder().setColor(0xe74c3c).setDescription(`❌ ${msg}`); }
function successEmbed(msg: string) { return new EmbedBuilder().setColor(0x2ecc71).setDescription(`✅ ${msg}`); }

export const advancedModCommands: Command[] = [
  {
    name: "hackban",
    aliases: ["forceban", "idban"],
    category: "Modération",
    description: "Banni un utilisateur par ID (même hors du serveur)",
    usage: "+hackban <userId> [raison]",
    permissions: ["BanMembers"],
    async execute(message, args) {
      if (!message.member?.permissions.has(PermissionFlagsBits.BanMembers))
        return void message.reply({ embeds: [errorEmbed("Tu n'as pas la permission de bannir.")] });
      const userId = args[0];
      if (!userId) return void message.reply({ embeds: [errorEmbed("Fournis un ID utilisateur.")] });
      const reason = args.slice(1).join(" ") || "Hackban";
      try {
        await message.guild!.members.ban(userId, { reason });
        message.reply({ embeds: [successEmbed(`Utilisateur \`${userId}\` banni (hackban). Raison : ${reason}`)] });
      } catch {
        message.reply({ embeds: [errorEmbed("Impossible de bannir. ID invalide ?")] });
      }
    },
  },
  {
    name: "massban",
    category: "Modération",
    description: "Banni plusieurs utilisateurs à la fois (IDs séparés par des espaces)",
    usage: "+massban <id1> <id2> ... [| raison]",
    permissions: ["BanMembers"],
    async execute(message, args) {
      if (!message.member?.permissions.has(PermissionFlagsBits.BanMembers))
        return void message.reply({ embeds: [errorEmbed("Tu n'as pas la permission.")] });
      const splitAt = args.indexOf("|");
      const ids = splitAt === -1 ? args : args.slice(0, splitAt);
      const reason = splitAt === -1 ? "Massban" : args.slice(splitAt + 1).join(" ");
      if (!ids.length) return void message.reply({ embeds: [errorEmbed("Fournis au moins un ID.")] });
      let success = 0, failed = 0;
      for (const id of ids) {
        try { await message.guild!.members.ban(id, { reason }); success++; }
        catch { failed++; }
      }
      message.reply({ embeds: [
        new EmbedBuilder().setColor(0xe74c3c)
          .setTitle("🔨 Massban terminé")
          .addFields(
            { name: "✅ Bannis", value: `${success}`, inline: true },
            { name: "❌ Échecs", value: `${failed}`, inline: true },
          )
      ]});
    },
  },
  {
    name: "tempban",
    aliases: ["tban"],
    category: "Modération",
    description: "Banni temporairement un membre",
    usage: "+tempban @membre <durée en minutes> [raison]",
    permissions: ["BanMembers"],
    async execute(message, args) {
      if (!message.member?.permissions.has(PermissionFlagsBits.BanMembers))
        return void message.reply({ embeds: [errorEmbed("Tu n'as pas la permission.")] });
      const target = message.mentions.members?.first();
      if (!target) return void message.reply({ embeds: [errorEmbed("Mentionne un membre.")] });
      const duration = parseInt(args[1] ?? "10");
      const reason = args.slice(2).join(" ") || "Tempban";
      if (isNaN(duration) || duration < 1) return void message.reply({ embeds: [errorEmbed("Durée invalide (en minutes).")] });
      await target.ban({ reason });
      message.reply({ embeds: [successEmbed(`**${target.user.tag}** banni pour ${duration} minute(s). Raison : ${reason}`)] });
      setTimeout(async () => {
        await message.guild!.members.unban(target.id, "Fin du tempban").catch(() => {});
      }, duration * 60 * 1000);
    },
  },
  {
    name: "voicekick",
    aliases: ["vkick", "deconnect"],
    category: "Modération",
    description: "Déconnecte un membre d'un salon vocal",
    usage: "+voicekick @membre [raison]",
    permissions: ["MoveMembers"],
    async execute(message, args) {
      if (!message.member?.permissions.has(PermissionFlagsBits.MoveMembers))
        return void message.reply({ embeds: [errorEmbed("Tu n'as pas la permission.")] });
      const target = message.mentions.members?.first();
      if (!target?.voice.channel) return void message.reply({ embeds: [errorEmbed("Ce membre n'est pas en salon vocal.")] });
      await target.voice.disconnect();
      message.reply({ embeds: [successEmbed(`**${target.user.tag}** a été déconnecté du vocal.`)] });
    },
  },
  {
    name: "voicemove",
    aliases: ["vmove"],
    category: "Modération",
    description: "Déplace un membre vers un autre salon vocal",
    usage: "+voicemove @membre <#salon>",
    permissions: ["MoveMembers"],
    async execute(message, args) {
      if (!message.member?.permissions.has(PermissionFlagsBits.MoveMembers))
        return void message.reply({ embeds: [errorEmbed("Tu n'as pas la permission.")] });
      const target = message.mentions.members?.first();
      if (!target?.voice.channel) return void message.reply({ embeds: [errorEmbed("Ce membre n'est pas en salon vocal.")] });
      const destId = args[1]?.replace(/[<#>]/g, "");
      const dest = destId ? message.guild!.channels.cache.get(destId) : null;
      if (!dest || dest.type !== ChannelType.GuildVoice)
        return void message.reply({ embeds: [errorEmbed("Fournis un salon vocal valide.")] });
      await target.voice.setChannel(dest as any);
      message.reply({ embeds: [successEmbed(`**${target.user.tag}** déplacé vers **${dest.name}**.`)] });
    },
  },
  {
    name: "moveall",
    aliases: ["massvoicemove"],
    category: "Modération",
    description: "Déplace tous les membres d'un vocal vers un autre",
    usage: "+moveall <#source> <#destination>",
    permissions: ["MoveMembers"],
    async execute(message, args) {
      if (!message.member?.permissions.has(PermissionFlagsBits.MoveMembers))
        return void message.reply({ embeds: [errorEmbed("Tu n'as pas la permission.")] });
      const ids = [...message.mentions.channels.values()];
      const source = ids[0] as any;
      const dest = ids[1] as any;
      if (!source || !dest) return void message.reply({ embeds: [errorEmbed("Mentionne deux salons vocaux.")] });
      const members = source.members;
      let moved = 0;
      for (const [, m] of members) {
        await (m as any).voice.setChannel(dest).catch(() => {});
        moved++;
      }
      message.reply({ embeds: [successEmbed(`**${moved}** membre(s) déplacé(s) vers **${dest.name}**.`)] });
    },
  },
  {
    name: "nuke",
    category: "Modération",
    description: "Clone et supprime un salon (efface tous les messages)",
    usage: "+nuke [#salon]",
    permissions: ["ManageChannels"],
    async execute(message) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageChannels))
        return void message.reply({ embeds: [errorEmbed("Tu n'as pas la permission.")] });
      const ch = message.channel as any;
      const pos = ch.position;
      const newCh = await ch.clone({ reason: `Nuke par ${message.author.tag}` });
      await newCh.setPosition(pos).catch(() => {});
      await ch.delete();
      (newCh as any).send({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle("💣 Nuke effectué !").setDescription("Ce salon a été nuké et recréé.")] });
    },
  },
  {
    name: "announce",
    aliases: ["annonce"],
    category: "Modération",
    description: "Envoie une annonce stylisée",
    usage: "+announce [#salon] <message>",
    permissions: ["ManageMessages"],
    async execute(message, args, settings) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageMessages))
        return void message.reply({ embeds: [errorEmbed("Tu n'as pas la permission.")] });
      const ch = (message.mentions.channels.first() as any) ?? message.channel;
      const text = args.filter(a => !a.startsWith("<#")).join(" ");
      if (!text) return void message.reply({ embeds: [errorEmbed("Fournis un message d'annonce.")] });
      await message.delete().catch(() => {});
      ch.send({ embeds: [
        new EmbedBuilder()
          .setColor(parseInt(settings.embedColor.replace("#", ""), 16) || 0x5865F2)
          .setTitle("📢 Annonce")
          .setDescription(text)
          .setFooter({ text: message.guild!.name, iconURL: message.guild!.iconURL() ?? undefined })
          .setTimestamp()
      ]});
    },
  },
  {
    name: "lockdown",
    aliases: ["lockall"],
    category: "Modération",
    description: "Verrouille tous les salons textuels",
    usage: "+lockdown [raison]",
    permissions: ["ManageChannels"],
    async execute(message, args) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageChannels))
        return void message.reply({ embeds: [errorEmbed("Tu n'as pas la permission.")] });
      const reason = args.join(" ") || "Lockdown";
      let count = 0;
      for (const [, ch] of message.guild!.channels.cache) {
        if (ch.type === ChannelType.GuildText) {
          await (ch as any).permissionOverwrites.edit(message.guild!.roles.everyone, { SendMessages: false }, { reason }).catch(() => {});
          count++;
        }
      }
      message.reply({ embeds: [successEmbed(`🔒 **${count}** salons verrouillés. Raison : ${reason}`)] });
    },
  },
  {
    name: "unlockdown",
    aliases: ["unlockall"],
    category: "Modération",
    description: "Déverrouille tous les salons textuels",
    usage: "+unlockdown",
    permissions: ["ManageChannels"],
    async execute(message) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageChannels))
        return void message.reply({ embeds: [errorEmbed("Tu n'as pas la permission.")] });
      let count = 0;
      for (const [, ch] of message.guild!.channels.cache) {
        if (ch.type === ChannelType.GuildText) {
          await (ch as any).permissionOverwrites.edit(message.guild!.roles.everyone, { SendMessages: null }).catch(() => {});
          count++;
        }
      }
      message.reply({ embeds: [successEmbed(`🔓 **${count}** salons déverrouillés.`)] });
    },
  },
  {
    name: "roleall",
    aliases: ["massrole"],
    category: "Modération",
    description: "Donne un rôle à tous les membres humains",
    usage: "+roleall @rôle",
    permissions: ["ManageRoles"],
    async execute(message) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageRoles))
        return void message.reply({ embeds: [errorEmbed("Tu n'as pas la permission.")] });
      const role = message.mentions.roles.first();
      if (!role) return void message.reply({ embeds: [errorEmbed("Mentionne un rôle.")] });
      const msg = await message.reply({ embeds: [new EmbedBuilder().setColor(0x3498db).setDescription(`⏳ Attribution du rôle **${role.name}** à tous les membres...`)] });
      let done = 0;
      for (const [, m] of message.guild!.members.cache) {
        if (!m.user.bot) { await m.roles.add(role).catch(() => {}); done++; }
      }
      msg.edit({ embeds: [successEmbed(`Rôle **${role.name}** donné à **${done}** membre(s).`)] });
    },
  },
  {
    name: "unroleall",
    category: "Modération",
    description: "Retire un rôle de tous les membres",
    usage: "+unroleall @rôle",
    permissions: ["ManageRoles"],
    async execute(message) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageRoles))
        return void message.reply({ embeds: [errorEmbed("Tu n'as pas la permission.")] });
      const role = message.mentions.roles.first();
      if (!role) return void message.reply({ embeds: [errorEmbed("Mentionne un rôle.")] });
      const msg = await message.reply({ embeds: [new EmbedBuilder().setColor(0x3498db).setDescription(`⏳ Retrait du rôle **${role.name}** de tous les membres...`)] });
      let done = 0;
      for (const [, m] of message.guild!.members.cache) {
        if (!m.user.bot && m.roles.cache.has(role.id)) { await m.roles.remove(role).catch(() => {}); done++; }
      }
      msg.edit({ embeds: [successEmbed(`Rôle **${role.name}** retiré de **${done}** membre(s).`)] });
    },
  },
  {
    name: "prune",
    category: "Modération",
    description: "Expulse les membres inactifs sans rôle",
    usage: "+prune <jours> [--dry]",
    permissions: ["KickMembers"],
    async execute(message, args) {
      if (!message.member?.permissions.has(PermissionFlagsBits.KickMembers))
        return void message.reply({ embeds: [errorEmbed("Tu n'as pas la permission.")] });
      const days = Math.min(parseInt(args[0] ?? "7") || 7, 30);
      const dry = args.includes("--dry");
      const count = await message.guild!.members.prune({ days, dry, reason: `Prune par ${message.author.tag}` });
      message.reply({ embeds: [
        new EmbedBuilder().setColor(dry ? 0x3498db : 0xe74c3c)
          .setTitle(dry ? "🔍 Simulation de prune" : "🔨 Prune effectué")
          .setDescription(`**${count ?? 0}** membre(s) ${dry ? "seraient expulsés" : "expulsés"} (inactifs depuis ${days} jours).`)
      ]});
    },
  },
  {
    name: "purgebot",
    aliases: ["clearbot"],
    category: "Modération",
    description: "Supprime les messages de bots dans ce salon",
    usage: "+purgebot [nombre]",
    permissions: ["ManageMessages"],
    async execute(message, args) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageMessages))
        return void message.reply({ embeds: [errorEmbed("Tu n'as pas la permission.")] });
      const amount = Math.min(parseInt(args[0] ?? "50") || 50, 100);
      const messages = await message.channel.messages.fetch({ limit: amount });
      const botMessages = messages.filter(m => m.author.bot);
      await (message.channel as any).bulkDelete(botMessages, true).catch(() => {});
      const reply = await message.reply({ embeds: [successEmbed(`${botMessages.size} message(s) de bots supprimés.`)] });
      setTimeout(() => reply.delete().catch(() => {}), 4000);
    },
  },
  {
    name: "purgeuser",
    aliases: ["clearuser"],
    category: "Modération",
    description: "Supprime les messages d'un utilisateur spécifique",
    usage: "+purgeuser @membre [nombre]",
    permissions: ["ManageMessages"],
    async execute(message, args) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageMessages))
        return void message.reply({ embeds: [errorEmbed("Tu n'as pas la permission.")] });
      const target = message.mentions.users.first();
      if (!target) return void message.reply({ embeds: [errorEmbed("Mentionne un utilisateur.")] });
      const amount = Math.min(parseInt(args[1] ?? "50") || 50, 100);
      const messages = await message.channel.messages.fetch({ limit: amount });
      const userMessages = messages.filter(m => m.author.id === target.id);
      await (message.channel as any).bulkDelete(userMessages, true).catch(() => {});
      const reply = await message.reply({ embeds: [successEmbed(`${userMessages.size} message(s) de **${target.tag}** supprimés.`)] });
      setTimeout(() => reply.delete().catch(() => {}), 4000);
    },
  },
  {
    name: "snipe",
    category: "Utilitaire",
    description: "Affiche le dernier message supprimé dans ce salon",
    usage: "+snipe",
    async execute(message) {
      const data = sniped.get(message.channelId);
      if (!data) return void message.reply({ embeds: [errorEmbed("Aucun message récemment supprimé dans ce salon.")] });
      message.reply({ embeds: [
        new EmbedBuilder().setColor(0xe67e22)
          .setTitle("🗑️ Dernier message supprimé")
          .setDescription(data.content.slice(0, 1024))
          .setFooter({ text: `Auteur : ${data.author} • ${data.time.toLocaleTimeString()}` })
      ]});
    },
  },
  {
    name: "editsnipe",
    aliases: ["esnipe"],
    category: "Utilitaire",
    description: "Affiche le dernier message modifié dans ce salon",
    usage: "+editsnipe",
    async execute(message) {
      const data = editSniped.get(message.channelId);
      if (!data) return void message.reply({ embeds: [errorEmbed("Aucun message récemment modifié.")] });
      message.reply({ embeds: [
        new EmbedBuilder().setColor(0x3498db)
          .setTitle("✏️ Dernier message modifié")
          .addFields(
            { name: "Avant", value: data.before.slice(0, 512) },
            { name: "Après", value: data.after.slice(0, 512) },
          )
          .setFooter({ text: `Auteur : ${data.author} • ${data.time.toLocaleTimeString()}` })
      ]});
    },
  },
  {
    name: "createchannel",
    aliases: ["mkch", "newchannel"],
    category: "Utilitaire",
    description: "Crée un nouveau salon textuel",
    usage: "+createchannel <nom> [--voice] [--private]",
    permissions: ["ManageChannels"],
    async execute(message, args) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageChannels))
        return void message.reply({ embeds: [errorEmbed("Tu n'as pas la permission.")] });
      const voice = args.includes("--voice");
      const isPrivate = args.includes("--private");
      const name = args.filter(a => !a.startsWith("--")).join("-").toLowerCase().replace(/[^a-z0-9-]/g, "");
      if (!name) return void message.reply({ embeds: [errorEmbed("Fournis un nom de salon.")] });
      const permOverwrites = isPrivate ? [{
        id: message.guild!.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      }] : [];
      const created = await message.guild!.channels.create({
        name,
        type: voice ? ChannelType.GuildVoice : ChannelType.GuildText,
        permissionOverwrites: permOverwrites,
        reason: `Créé par ${message.author.tag}`,
      });
      message.reply({ embeds: [successEmbed(`Salon **${created.name}** créé. ${isPrivate ? "(Privé)" : ""}`)] });
    },
  },
  {
    name: "deletechannel",
    aliases: ["delch", "rmchannel"],
    category: "Utilitaire",
    description: "Supprime un salon",
    usage: "+deletechannel [#salon]",
    permissions: ["ManageChannels"],
    async execute(message) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageChannels))
        return void message.reply({ embeds: [errorEmbed("Tu n'as pas la permission.")] });
      const ch = (message.mentions.channels.first() ?? message.channel) as any;
      const name = ch.name;
      await ch.delete(`Supprimé par ${message.author.tag}`);
      if (ch.id !== message.channelId)
        message.reply({ embeds: [successEmbed(`Salon **#${name}** supprimé.`)] });
    },
  },
  {
    name: "renamechannel",
    aliases: ["setchannelname"],
    category: "Utilitaire",
    description: "Renomme un salon",
    usage: "+renamechannel [#salon] <nouveau nom>",
    permissions: ["ManageChannels"],
    async execute(message, args) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageChannels))
        return void message.reply({ embeds: [errorEmbed("Tu n'as pas la permission.")] });
      const ch = (message.mentions.channels.first() ?? message.channel) as any;
      const newName = args.filter(a => !a.startsWith("<#")).join("-");
      if (!newName) return void message.reply({ embeds: [errorEmbed("Fournis un nouveau nom.")] });
      await ch.setName(newName);
      message.reply({ embeds: [successEmbed(`Salon renommé en **${newName}**.`)] });
    },
  },
  {
    name: "createrole",
    aliases: ["mkrole", "newrole"],
    category: "Utilitaire",
    description: "Crée un nouveau rôle",
    usage: "+createrole <nom> [#couleur]",
    permissions: ["ManageRoles"],
    async execute(message, args) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageRoles))
        return void message.reply({ embeds: [errorEmbed("Tu n'as pas la permission.")] });
      const colorArg = args.find(a => /^#[0-9a-fA-F]{6}$/.test(a));
      const name = args.filter(a => a !== colorArg).join(" ");
      if (!name) return void message.reply({ embeds: [errorEmbed("Fournis un nom de rôle.")] });
      const color = colorArg ? (parseInt(colorArg.replace("#", ""), 16) as any) : undefined;
      const role = await message.guild!.roles.create({ name, color, reason: `Créé par ${message.author.tag}` });
      message.reply({ embeds: [successEmbed(`Rôle **${role.name}** créé !`)] });
    },
  },
  {
    name: "deleterole",
    aliases: ["delrole", "rmrole"],
    category: "Utilitaire",
    description: "Supprime un rôle",
    usage: "+deleterole @rôle",
    permissions: ["ManageRoles"],
    async execute(message) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageRoles))
        return void message.reply({ embeds: [errorEmbed("Tu n'as pas la permission.")] });
      const role = message.mentions.roles.first();
      if (!role) return void message.reply({ embeds: [errorEmbed("Mentionne un rôle à supprimer.")] });
      const name = role.name;
      await role.delete(`Supprimé par ${message.author.tag}`);
      message.reply({ embeds: [successEmbed(`Rôle **${name}** supprimé.`)] });
    },
  },
  {
    name: "setservername",
    aliases: ["renameserver"],
    category: "Utilitaire",
    description: "Renomme le serveur",
    usage: "+setservername <nouveau nom>",
    permissions: ["ManageGuild"],
    async execute(message, args) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild))
        return void message.reply({ embeds: [errorEmbed("Tu n'as pas la permission.")] });
      const name = args.join(" ");
      if (!name) return void message.reply({ embeds: [errorEmbed("Fournis un nouveau nom.")] });
      await message.guild!.setName(name);
      message.reply({ embeds: [successEmbed(`Serveur renommé en **${name}** !`)] });
    },
  },
  {
    name: "remind",
    aliases: ["remindme", "rappel"],
    category: "Utilitaire",
    description: "Définit un rappel",
    usage: "+remind <durée en minutes> <message>",
    async execute(message, args) {
      const minutes = parseInt(args[0] ?? "");
      if (isNaN(minutes) || minutes < 1 || minutes > 10080)
        return void message.reply({ embeds: [errorEmbed("Durée invalide (1 à 10080 minutes).")] });
      const reminder = args.slice(1).join(" ");
      if (!reminder) return void message.reply({ embeds: [errorEmbed("Fournis un message de rappel.")] });
      message.reply({ embeds: [successEmbed(`⏰ Rappel dans **${minutes}** minute(s) : ${reminder}`)] });
      setTimeout(() => {
        (message.channel as any).send({
          content: `<@${message.author.id}>`,
          embeds: [new EmbedBuilder().setColor(0xf1c40f).setTitle("⏰ Rappel !").setDescription(reminder).setTimestamp()],
        }).catch(() => {});
      }, minutes * 60 * 1000);
    },
  },
  {
    name: "timer",
    aliases: ["countdown"],
    category: "Utilitaire",
    description: "Lance un minuteur",
    usage: "+timer <secondes>",
    async execute(message, args) {
      const seconds = parseInt(args[0] ?? "");
      if (isNaN(seconds) || seconds < 1 || seconds > 3600)
        return void message.reply({ embeds: [errorEmbed("Durée invalide (1 à 3600 secondes).")] });
      const msg = await message.reply({ embeds: [new EmbedBuilder().setColor(0x3498db).setTitle("⏱️ Minuteur").setDescription(`Démarré pour **${seconds}** secondes...`)] });
      setTimeout(() => {
        msg.edit({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setTitle("⏱️ Minuteur").setDescription(`✅ ${seconds} secondes écoulées !`)] });
        (message.channel as any).send({ content: `<@${message.author.id}> ⏱️ Ton minuteur est terminé !` }).catch(() => {});
      }, seconds * 1000);
    },
  },
  {
    name: "giveaway",
    aliases: ["gw"],
    category: "Utilitaire",
    description: "Lance un giveaway",
    usage: "+giveaway <durée en minutes> <lot>",
    permissions: ["ManageMessages"],
    async execute(message, args) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageMessages))
        return void message.reply({ embeds: [errorEmbed("Tu n'as pas la permission.")] });
      const duration = parseInt(args[0] ?? "");
      if (isNaN(duration) || duration < 1) return void message.reply({ embeds: [errorEmbed("Durée invalide (en minutes).")] });
      const prize = args.slice(1).join(" ");
      if (!prize) return void message.reply({ embeds: [errorEmbed("Indique le lot du giveaway.")] });
      const endTime = Math.floor((Date.now() + duration * 60 * 1000) / 1000);
      const embed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle("🎉 GIVEAWAY 🎉")
        .setDescription(`**Lot :** ${prize}\n\nRéagis avec 🎉 pour participer !\n\n**Fin :** <t:${endTime}:R>`)
        .setFooter({ text: `Organisé par ${message.author.tag}` })
        .setTimestamp(new Date(endTime * 1000));
      const msg = await (message.channel as any).send({ embeds: [embed] });
      await msg.react("🎉");
      setTimeout(async () => {
        const updated = await msg.fetch();
        const reaction = updated.reactions.cache.get("🎉");
        const users = await reaction?.users.fetch();
        const participants = users?.filter((u: any) => !u.bot);
        if (!participants || participants.size === 0) {
          msg.edit({ embeds: [new EmbedBuilder().setColor(0x95a5a6).setTitle("🎉 Giveaway terminé").setDescription(`Lot : **${prize}**\n\nPas de participants.`)] });
          return;
        }
        const winner = participants.random();
        msg.edit({ embeds: [
          new EmbedBuilder().setColor(0x2ecc71)
            .setTitle("🎉 Giveaway terminé !")
            .setDescription(`Lot : **${prize}**\n\n🏆 Gagnant : <@${winner!.id}>`)
        ]});
        (message.channel as any).send({ content: `🎉 Félicitations <@${winner!.id}> ! Tu as gagné **${prize}** !` });
      }, duration * 60 * 1000);
      message.delete().catch(() => {});
    },
  },
  {
    name: "ticket",
    aliases: ["support"],
    category: "Utilitaire",
    description: "Ouvre un ticket de support",
    usage: "+ticket [sujet]",
    async execute(message, args) {
      const topic = args.join(" ") || "Support général";
      const existing = message.guild!.channels.cache.find(c => c.name === `ticket-${message.author.username.toLowerCase()}`);
      if (existing) return void message.reply({ embeds: [errorEmbed(`Tu as déjà un ticket ouvert : <#${existing.id}>`)] });
      const ch = await message.guild!.channels.create({
        name: `ticket-${message.author.username.toLowerCase()}`,
        type: ChannelType.GuildText,
        topic,
        permissionOverwrites: [
          { id: message.guild!.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: message.author.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        ],
        reason: `Ticket créé par ${message.author.tag}`,
      });
      await (ch as any).send({
        content: `<@${message.author.id}>`,
        embeds: [
          new EmbedBuilder().setColor(0x5865F2)
            .setTitle("🎫 Ticket de Support")
            .setDescription(`Bienvenue ${message.author.username} !\n\nSujet : **${topic}**\n\nUn membre du staff va te répondre bientôt.\nTape \`+closeticket\` pour fermer ce ticket.`)
        ],
      });
      message.reply({ embeds: [successEmbed(`Ton ticket a été ouvert dans <#${ch.id}> !`)] });
    },
  },
  {
    name: "closeticket",
    aliases: ["close"],
    category: "Utilitaire",
    description: "Ferme le ticket actuel",
    usage: "+closeticket",
    async execute(message) {
      const ch = message.channel as any;
      if (!ch.name?.startsWith("ticket-"))
        return void message.reply({ embeds: [errorEmbed("Ce salon n'est pas un ticket.")] });
      message.reply({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription("🎫 Ce ticket sera fermé dans 5 secondes...")] });
      setTimeout(() => ch.delete("Ticket fermé").catch(() => {}), 5000);
    },
  },
  {
    name: "steal",
    aliases: ["addemoji"],
    category: "Utilitaire",
    description: "Ajoute un emoji au serveur depuis une URL ou un emoji custom",
    usage: "+steal <nom> <url ou emoji>",
    permissions: ["ManageGuildExpressions"],
    async execute(message, args) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuildExpressions))
        return void message.reply({ embeds: [errorEmbed("Tu n'as pas la permission.")] });
      const name = args[0];
      const src = args[1];
      if (!name || !src) return void message.reply({ embeds: [errorEmbed("Usage : `+steal <nom> <url>`")] });
      const emojiMatch = src.match(/^<a?:\w+:(\d+)>$/);
      const url = emojiMatch
        ? `https://cdn.discordapp.com/emojis/${emojiMatch[1]}.${src.startsWith("<a") ? "gif" : "png"}`
        : src;
      try {
        const emoji = await message.guild!.emojis.create({ name, attachment: url, reason: `Steal par ${message.author.tag}` });
        message.reply({ embeds: [successEmbed(`Emoji **${emoji.name}** ajouté : ${emoji}`)] });
      } catch {
        message.reply({ embeds: [errorEmbed("Impossible d'ajouter l'emoji. URL invalide ?")] });
      }
    },
  },
  {
    name: "bots",
    category: "Utilitaire",
    description: "Liste tous les bots du serveur",
    usage: "+bots",
    async execute(message) {
      const bots = message.guild!.members.cache.filter(m => m.user.bot);
      message.reply({ embeds: [
        new EmbedBuilder().setColor(0x5865F2)
          .setTitle(`🤖 Bots du serveur (${bots.size})`)
          .setDescription(bots.map(b => `• <@${b.id}> — \`${b.user.tag}\``).join("\n").slice(0, 4096) || "Aucun bot.")
      ]});
    },
  },
  {
    name: "firstmessage",
    aliases: ["first"],
    category: "Utilitaire",
    description: "Lien vers le premier message du salon",
    usage: "+firstmessage",
    async execute(message) {
      const messages = await message.channel.messages.fetch({ limit: 1, after: "0" });
      const first = messages.first();
      if (!first) return void message.reply({ embeds: [errorEmbed("Impossible de trouver le premier message.")] });
      message.reply({ embeds: [
        new EmbedBuilder().setColor(0x3498db)
          .setTitle("📜 Premier message")
          .setDescription(`[Cliquer ici](${first.url})`)
          .addFields(
            { name: "Auteur", value: first.author.tag, inline: true },
            { name: "Date", value: `<t:${Math.floor(first.createdTimestamp / 1000)}:F>`, inline: true },
            { name: "Contenu", value: first.content.slice(0, 200) || "*Aucun contenu textuel*" },
          )
      ]});
    },
  },
];
