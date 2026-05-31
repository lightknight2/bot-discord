import { EmbedBuilder, PermissionFlagsBits, ChannelType, AttachmentBuilder } from "discord.js";
import type { Command } from "../types.js";

function errorEmbed(msg: string) {
  return new EmbedBuilder().setColor(0xe74c3c).setDescription(`❌ ${msg}`);
}

export const utilityCommands: Command[] = [
  {
    name: "ping",
    aliases: ["latency"],
    category: "Utilitaire",
    description: "Affiche la latence du bot",
    usage: "+ping",
    async execute(message, _args, _s, client) {
      const sent = await message.reply({ embeds: [new EmbedBuilder().setColor(0x3498db).setDescription("🏓 Calcul...")] });
      const latency = sent.createdTimestamp - message.createdTimestamp;
      sent.edit({ embeds: [
        new EmbedBuilder().setColor(0x3498db)
          .setTitle("🏓 Pong !")
          .addFields(
            { name: "📶 Latence Bot", value: `${latency}ms`, inline: true },
            { name: "💓 Heartbeat API", value: `${Math.round(client.ws.ping)}ms`, inline: true },
          )
      ]});
    },
  },
  {
    name: "uptime",
    category: "Utilitaire",
    description: "Affiche depuis combien de temps le bot est actif",
    usage: "+uptime",
    async execute(message, _args, _s, client) {
      const uptime = (client as any).startTime as Date;
      const diff = Date.now() - uptime.getTime();
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      message.reply({ embeds: [
        new EmbedBuilder().setColor(0x9b59b6)
          .setTitle("⏱️ Temps de fonctionnement")
          .setDescription(`\`${days}j ${hours}h ${minutes}m ${seconds}s\``)
      ]});
    },
  },
  {
    name: "botinfo",
    aliases: ["bot", "info"],
    category: "Utilitaire",
    description: "Informations sur le bot",
    usage: "+botinfo",
    async execute(message, _args, _s, client) {
      const uptime = (client as any).startTime as Date;
      const diff = Date.now() - uptime.getTime();
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`📊 Informations — ${client.user?.username}`)
        .setThumbnail(client.user?.displayAvatarURL() ?? null)
        .addFields(
          { name: "🤖 Tag", value: client.user?.tag ?? "?", inline: true },
          { name: "🆔 ID", value: client.user?.id ?? "?", inline: true },
          { name: "🌐 Serveurs", value: `${client.guilds.cache.size}`, inline: true },
          { name: "👥 Membres", value: `${client.users.cache.size}`, inline: true },
          { name: "⏱️ Uptime", value: `${days}j ${hours}h`, inline: true },
          { name: "📚 discord.js", value: "v14", inline: true },
        )
        .setFooter({ text: "Bot Discord • Propulsé par discord.js" });
      message.reply({ embeds: [embed] });
    },
  },
  {
    name: "serverinfo",
    aliases: ["server", "guild"],
    category: "Utilitaire",
    description: "Informations sur le serveur",
    usage: "+serverinfo",
    async execute(message) {
      const g = message.guild!;
      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle(`🏠 ${g.name}`)
        .setThumbnail(g.iconURL())
        .addFields(
          { name: "🆔 ID", value: g.id, inline: true },
          { name: "👑 Propriétaire", value: `<@${g.ownerId}>`, inline: true },
          { name: "👥 Membres", value: `${g.memberCount}`, inline: true },
          { name: "💬 Salons", value: `${g.channels.cache.size}`, inline: true },
          { name: "🎭 Rôles", value: `${g.roles.cache.size}`, inline: true },
          { name: "😀 Emojis", value: `${g.emojis.cache.size}`, inline: true },
          { name: "🔒 Vérification", value: g.verificationLevel.toString(), inline: true },
          { name: "📅 Créé le", value: `<t:${Math.floor(g.createdTimestamp / 1000)}:D>`, inline: true },
        );
      message.reply({ embeds: [embed] });
    },
  },
  {
    name: "userinfo",
    aliases: ["user", "whois", "ui"],
    category: "Utilitaire",
    description: "Informations sur un utilisateur",
    usage: "+userinfo [@membre]",
    async execute(message) {
      const target = message.mentions.members?.first() ?? message.member!;
      const embed = new EmbedBuilder()
        .setColor(0x1abc9c)
        .setTitle(`👤 ${target.user.tag}`)
        .setThumbnail(target.user.displayAvatarURL())
        .addFields(
          { name: "🆔 ID", value: target.id, inline: true },
          { name: "📛 Surnom", value: target.nickname ?? "Aucun", inline: true },
          { name: "🤖 Bot", value: target.user.bot ? "Oui" : "Non", inline: true },
          { name: "📅 Compte créé", value: `<t:${Math.floor(target.user.createdTimestamp / 1000)}:D>`, inline: true },
          { name: "📥 A rejoint le", value: `<t:${Math.floor((target.joinedTimestamp ?? 0) / 1000)}:D>`, inline: true },
          { name: "🎭 Rôles", value: target.roles.cache.filter(r => r.name !== "@everyone").map(r => `<@&${r.id}>`).slice(0, 5).join(", ") || "Aucun", inline: false },
        );
      message.reply({ embeds: [embed] });
    },
  },
  {
    name: "roleinfo",
    aliases: ["role"],
    category: "Utilitaire",
    description: "Informations sur un rôle",
    usage: "+roleinfo @rôle",
    async execute(message) {
      const role = message.mentions.roles.first();
      if (!role) return void message.reply({ embeds: [errorEmbed("Mentionne un rôle.")] });
      const embed = new EmbedBuilder()
        .setColor(role.color || 0x95a5a6)
        .setTitle(`🎭 ${role.name}`)
        .addFields(
          { name: "🆔 ID", value: role.id, inline: true },
          { name: "👥 Membres", value: `${role.members.size}`, inline: true },
          { name: "🎨 Couleur", value: role.hexColor, inline: true },
          { name: "📌 Affiché séparément", value: role.hoist ? "Oui" : "Non", inline: true },
          { name: "🏷️ Mentionnable", value: role.mentionable ? "Oui" : "Non", inline: true },
          { name: "📅 Créé le", value: `<t:${Math.floor(role.createdTimestamp / 1000)}:D>`, inline: true },
        );
      message.reply({ embeds: [embed] });
    },
  },
  {
    name: "channelinfo",
    aliases: ["channel"],
    category: "Utilitaire",
    description: "Informations sur un salon",
    usage: "+channelinfo [#salon]",
    async execute(message) {
      const ch = (message.mentions.channels.first() ?? message.channel) as any;
      const embed = new EmbedBuilder()
        .setColor(0x2980b9)
        .setTitle(`💬 #${ch.name ?? "salon"}`)
        .addFields(
          { name: "🆔 ID", value: ch.id, inline: true },
          { name: "📂 Type", value: ch.type?.toString() ?? "?", inline: true },
          { name: "📅 Créé le", value: `<t:${Math.floor(ch.createdTimestamp / 1000)}:D>`, inline: true },
          { name: "📝 Sujet", value: ch.topic ?? "Aucun", inline: false },
        );
      message.reply({ embeds: [embed] });
    },
  },
  {
    name: "avatar",
    aliases: ["av", "pfp"],
    category: "Utilitaire",
    description: "Affiche l'avatar d'un membre",
    usage: "+avatar [@membre]",
    async execute(message) {
      const target = message.mentions.users.first() ?? message.author;
      const url = target.displayAvatarURL({ size: 512 });
      message.reply({ embeds: [
        new EmbedBuilder().setColor(0x5865F2)
          .setTitle(`🖼️ Avatar de ${target.tag}`)
          .setImage(url)
          .setURL(url)
      ]});
    },
  },
  {
    name: "banner",
    category: "Utilitaire",
    description: "Affiche la bannière d'un membre",
    usage: "+banner [@membre]",
    async execute(message) {
      const target = await message.mentions.users.first()?.fetch() ?? await message.author.fetch();
      const url = target.bannerURL({ size: 1024 });
      if (!url) return void message.reply({ embeds: [errorEmbed("Cet utilisateur n'a pas de bannière.")] });
      message.reply({ embeds: [
        new EmbedBuilder().setColor(0x5865F2)
          .setTitle(`🖼️ Bannière de ${target.tag}`)
          .setImage(url)
          .setURL(url)
      ]});
    },
  },
  {
    name: "membercount",
    aliases: ["members"],
    category: "Utilitaire",
    description: "Affiche le nombre de membres",
    usage: "+membercount",
    async execute(message) {
      const g = message.guild!;
      const humans = g.members.cache.filter(m => !m.user.bot).size;
      const bots = g.members.cache.filter(m => m.user.bot).size;
      message.reply({ embeds: [
        new EmbedBuilder().setColor(0x27ae60)
          .setTitle(`👥 Membres de ${g.name}`)
          .addFields(
            { name: "Total", value: `${g.memberCount}`, inline: true },
            { name: "Humains", value: `${humans}`, inline: true },
            { name: "Bots", value: `${bots}`, inline: true },
          )
      ]});
    },
  },
  {
    name: "say",
    aliases: ["echo"],
    category: "Utilitaire",
    description: "Fait parler le bot",
    usage: "+say <message>",
    permissions: ["ManageMessages"],
    async execute(message, args) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageMessages))
        return void message.reply({ embeds: [errorEmbed("Tu n'as pas la permission.")] });
      if (!args.length) return void message.reply({ embeds: [errorEmbed("Fournis un message.")] });
      await message.delete().catch(() => {});
      (message.channel as any).send(args.join(" "));
    },
  },
  {
    name: "embed",
    category: "Utilitaire",
    description: "Envoie un embed",
    usage: "+embed <titre> | <description>",
    permissions: ["ManageMessages"],
    async execute(message, args, settings) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageMessages))
        return void message.reply({ embeds: [errorEmbed("Tu n'as pas la permission.")] });
      const text = args.join(" ");
      const [title, ...descParts] = text.split("|");
      if (!title) return void message.reply({ embeds: [errorEmbed("Usage: +embed titre | description")] });
      await message.delete().catch(() => {});
      (message.channel as any).send({ embeds: [
        new EmbedBuilder()
          .setColor(parseInt(settings.embedColor.replace("#", ""), 16) || 0x5865F2)
          .setTitle(title.trim())
          .setDescription(descParts.join("|").trim() || "\u200b")
      ]});
    },
  },
  {
    name: "poll",
    category: "Utilitaire",
    description: "Crée un sondage",
    usage: "+poll <question>",
    async execute(message, args, settings) {
      if (!args.length) return void message.reply({ embeds: [errorEmbed("Fournis une question.")] });
      const embed = new EmbedBuilder()
        .setColor(parseInt(settings.embedColor.replace("#", ""), 16) || 0x5865F2)
        .setTitle("📊 Sondage")
        .setDescription(args.join(" "))
        .setFooter({ text: `Sondage par ${message.author.tag}` });
      const msg = await (message.channel as any).send({ embeds: [embed] });
      await msg.react("✅");
      await msg.react("❌");
      message.delete().catch(() => {});
    },
  },
  {
    name: "id",
    category: "Utilitaire",
    description: "Affiche l'ID d'un utilisateur/rôle/salon",
    usage: "+id [@mention]",
    async execute(message) {
      const user = message.mentions.users.first();
      const role = message.mentions.roles.first();
      const ch = message.mentions.channels.first();
      const target = user ?? role ?? ch ?? message.author;
      message.reply({ embeds: [
        new EmbedBuilder().setColor(0x95a5a6)
          .setDescription(`🆔 **ID :** \`${target.id}\``)
      ]});
    },
  },
  {
    name: "permissions",
    aliases: ["perms"],
    category: "Utilitaire",
    description: "Affiche les permissions d'un membre",
    usage: "+permissions [@membre]",
    async execute(message) {
      const target = message.mentions.members?.first() ?? message.member!;
      const perms = target.permissions.toArray().map(p => `\`${p}\``).join(", ");
      message.reply({ embeds: [
        new EmbedBuilder().setColor(0xe67e22)
          .setTitle(`🔑 Permissions de ${target.user.tag}`)
          .setDescription(perms || "Aucune")
      ]});
    },
  },
  {
    name: "emojis",
    category: "Utilitaire",
    description: "Liste les emojis personnalisés du serveur",
    usage: "+emojis",
    async execute(message) {
      const emojis = message.guild!.emojis.cache.map(e => `${e}`).join(" ");
      message.reply({ embeds: [
        new EmbedBuilder().setColor(0xf1c40f)
          .setTitle(`😀 Emojis de ${message.guild!.name}`)
          .setDescription(emojis.slice(0, 2048) || "Aucun emoji personnalisé.")
      ]});
    },
  },
  {
    name: "invite",
    category: "Utilitaire",
    description: "Obtenir le lien d'invitation du bot",
    usage: "+invite",
    async execute(message, _args, _s, client) {
      const url = `https://discord.com/oauth2/authorize?client_id=${client.user?.id}&permissions=8&scope=bot`;
      message.reply({ embeds: [
        new EmbedBuilder().setColor(0x5865F2)
          .setTitle("📨 Inviter le bot")
          .setDescription(`[Clique ici pour m'inviter](${url})`)
      ]});
    },
  },
  {
    name: "calc",
    aliases: ["calculate"],
    category: "Utilitaire",
    description: "Calculatrice simple",
    usage: "+calc <expression>",
    async execute(message, args) {
      const expr = args.join(" ").replace(/[^0-9+\-*/.() ]/g, "");
      if (!expr) return void message.reply({ embeds: [errorEmbed("Fournis une expression.")] });
      try {
        const result = Function(`"use strict"; return (${expr})`)();
        message.reply({ embeds: [
          new EmbedBuilder().setColor(0x3498db)
            .addFields(
              { name: "🔢 Expression", value: `\`${expr}\`` },
              { name: "✅ Résultat", value: `\`${result}\`` },
            )
        ]});
      } catch {
        message.reply({ embeds: [errorEmbed("Expression invalide.")] });
      }
    },
  },
  {
    name: "color",
    category: "Utilitaire",
    description: "Affiche une couleur en hex",
    usage: "+color <#hex>",
    async execute(message, args) {
      const hex = args[0]?.replace("#", "");
      if (!hex || !/^[0-9A-Fa-f]{6}$/.test(hex))
        return void message.reply({ embeds: [errorEmbed("Fournis un code hex valide. Ex: `+color #FF5733`")] });
      message.reply({ embeds: [
        new EmbedBuilder().setColor(parseInt(hex, 16) as any)
          .setTitle(`🎨 Couleur : #${hex.toUpperCase()}`)
          .setDescription(`RGB : \`${parseInt(hex.slice(0,2),16)}, ${parseInt(hex.slice(2,4),16)}, ${parseInt(hex.slice(4,6),16)}\``)
          .setThumbnail(`https://singlecolorimage.com/get/${hex}/128x128`)
      ]});
    },
  },
  // ─── STEAL EMOJI ──────────────────────────────────────────────────────────────
  {
    name: "steal",
    aliases: ["addemoji", "stealemoji"],
    category: "Utilitaire",
    description: "Vole/ajoute un emoji d'un autre serveur",
    usage: ".steal <emoji> [nom]",
    permissions: ["ManageEmojisAndStickers"],
    async execute(message, args) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageEmojisAndStickers))
        return void message.reply({ embeds: [errorEmbed("Tu dois avoir **Gérer les emojis**.")] });
      const raw = args[0];
      if (!raw) return void message.reply({ embeds: [errorEmbed("Fournis un emoji. Ex: `.steal :monEmoji:`")] });
      const animated = raw.startsWith("<a:");
      const match = raw.match(/<a?:(\w+):(\d+)>/);
      if (!match) return void message.reply({ embeds: [errorEmbed("Emoji personnalisé introuvable. Utilise un emoji d'un autre serveur.")] });
      const [, emojiName, emojiId] = match;
      const name = args[1] ?? emojiName;
      const ext = animated ? "gif" : "png";
      const url = `https://cdn.discordapp.com/emojis/${emojiId}.${ext}?size=128`;
      try {
        const created = await message.guild!.emojis.create({ attachment: url, name });
        message.reply({ embeds: [
          new EmbedBuilder().setColor(0x2ECC71)
            .setTitle("✅ Emoji Ajouté !")
            .setDescription(`${created} — \`:${created.name}:\``)
            .setThumbnail(created.imageURL())
            .addFields(
              { name: "🆔 ID", value: `\`${created.id}\``, inline: true },
              { name: "🤖 Animé", value: created.animated ? "✅ Oui" : "❌ Non", inline: true },
            ).setTimestamp()
        ]});
      } catch (e: any) {
        message.reply({ embeds: [errorEmbed(`Impossible d'ajouter l'emoji : ${e.message ?? "Erreur inconnue"}`)] });
      }
    },
  },
  // ─── IN ROLE ──────────────────────────────────────────────────────────────────
  {
    name: "inrole",
    aliases: ["rolemembers", "membersinrole"],
    category: "Utilitaire",
    description: "Liste les membres ayant un rôle spécifique",
    usage: ".inrole @role",
    async execute(message, args) {
      const role = message.mentions.roles.first()
        ?? (args[0] && /^\d{17,20}$/.test(args[0].replace(/[<@&>]/g, ""))
          ? message.guild!.roles.cache.get(args[0].replace(/[<@&>]/g, "")) : null);
      if (!role) return void message.reply({ embeds: [errorEmbed("Mentionne un rôle ou fournis son ID.")] });
      await message.guild!.members.fetch().catch(() => {});
      const members = role.members.map((m: any) => `\`${m.user.tag}\``);
      if (members.length === 0)
        return void message.reply({ embeds: [new EmbedBuilder().setColor(0xFEE75C).setDescription(`Aucun membre n'a le rôle <@&${role.id}>.`)] });
      const chunks: string[] = [];
      let current = "";
      for (const m of members) {
        if ((current + m + ", ").length > 1000) { chunks.push(current.replace(/, $/, "")); current = ""; }
        current += m + ", ";
      }
      if (current) chunks.push(current.replace(/, $/, ""));
      const embed = new EmbedBuilder()
        .setColor(role.color || 0x5865F2)
        .setTitle(`👥 Membres avec @${role.name}`)
        .setDescription(chunks[0] ?? "Aucun")
        .addFields({ name: "Total", value: `**${members.length}** membre(s)`, inline: true })
        .setTimestamp();
      message.reply({ embeds: [embed] });
    },
  },
  // ─── TEMPBAN ──────────────────────────────────────────────────────────────────
  {
    name: "tempban",
    aliases: ["tban"],
    category: "Modération",
    description: "Ban temporaire d'un membre (auto-unban)",
    usage: ".tempban @user <durée_minutes> [raison]",
    permissions: ["BanMembers"],
    async execute(message, args, _s, client) {
      if (!message.member?.permissions.has(PermissionFlagsBits.BanMembers))
        return void message.reply({ embeds: [errorEmbed("Tu dois avoir **Bannir des membres**.")] });
      const mentioned = message.mentions.users.first();
      const rawId = args[0]?.replace(/[<@!>]/g, "");
      const target = mentioned ?? (rawId && /^\d{17,20}$/.test(rawId)
        ? await client.users.fetch(rawId).catch(() => null) : null);
      if (!target) return void message.reply({ embeds: [errorEmbed("Mentionne un utilisateur ou fournis un ID.")] });
      const durationArg = mentioned ? args[1] : args[1] ?? args[0];
      const minutes = parseInt(mentioned ? args[1] ?? "0" : args[1] ?? args[0] ?? "0", 10);
      if (!minutes || minutes < 1) return void message.reply({ embeds: [errorEmbed("Fournis une durée en minutes. Ex: `.tempban @user 30 raison`")] });
      const reason = (mentioned ? args.slice(2) : args.slice(2)).join(" ") || "Aucune raison";
      const expireTs = Math.floor((Date.now() + minutes * 60_000) / 1000);
      try {
        await target.send({ embeds: [
          new EmbedBuilder().setColor(0xED4245).setTitle(`🔨 Tu as été temporairement banni de **${message.guild!.name}**`)
            .addFields(
              { name: "📝 Raison", value: reason, inline: false },
              { name: "⏱️ Durée", value: `${minutes} minute(s)`, inline: true },
              { name: "🔓 Unban prévu", value: `<t:${expireTs}:R>`, inline: true },
            ).setTimestamp()
        ]}).catch(() => {});
        await message.guild!.members.ban(target.id, { reason: `TempBan ${minutes}min — ${reason}` });
        message.reply({ embeds: [
          new EmbedBuilder().setColor(0xED4245)
            .setTitle("🔨 TempBan Effectué")
            .setDescription(`**${target.tag}** (\`${target.id}\`) a été banni.`)
            .addFields(
              { name: "⏱️ Durée", value: `${minutes} minute(s)`, inline: true },
              { name: "🔓 Unban", value: `<t:${expireTs}:R>`, inline: true },
              { name: "📝 Raison", value: reason, inline: false },
            ).setTimestamp()
        ]});
        setTimeout(async () => {
          await message.guild!.bans.remove(target.id, "TempBan expiré — unban automatique").catch(() => {});
        }, minutes * 60_000);
      } catch (e: any) {
        message.reply({ embeds: [errorEmbed(`Impossible de bannir : ${e.message ?? "Erreur inconnue"}`)] });
      }
    },
  },
  // ─── NUKE ─────────────────────────────────────────────────────────────────────
  {
    name: "nuke",
    category: "Modération",
    description: "Supprime et recrée le salon (efface tous les messages)",
    usage: ".nuke [raison]",
    permissions: ["ManageChannels"],
    async execute(message, args) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageChannels))
        return void message.reply({ embeds: [errorEmbed("Tu dois avoir **Gérer les salons**.")] });
      const reason = args.join(" ") || "Nuke demandé par " + message.author.tag;
      const ch = message.channel as any;
      const pos = ch.position;
      const parent = ch.parentId;
      const name = ch.name;
      const topic = ch.topic ?? undefined;
      const nsfw = ch.nsfw ?? false;
      const slowmode = ch.rateLimitPerUser ?? 0;
      const perms = ch.permissionOverwrites?.cache?.map((o: any) => ({
        id: o.id, allow: o.allow.toArray(), deny: o.deny.toArray(), type: o.type,
      })) ?? [];
      try {
        await ch.delete(`Nuke par ${message.author.tag} — ${reason}`);
        const newCh = await message.guild!.channels.create({
          name, type: ChannelType.GuildText, topic, nsfw, rateLimitPerUser: slowmode,
          parent: parent ?? undefined, permissionOverwrites: perms, position: pos,
        }) as any;
        await newCh.send({ embeds: [
          new EmbedBuilder().setColor(0xED4245)
            .setTitle("💥 Salon Nuké !")
            .setDescription(`Ce salon a été recréé par <@${message.author.id}>.`)
            .addFields({ name: "📝 Raison", value: reason })
            .setTimestamp()
        ]});
      } catch (e: any) {
        message.reply({ embeds: [errorEmbed(`Impossible de nuke : ${e.message ?? "Erreur inconnue"}`)] }).catch(() => {});
      }
    },
  },
  // ─── LOCKDOWN / UNLOCKDOWN ────────────────────────────────────────────────────
  {
    name: "lockdown",
    aliases: ["lock"],
    category: "Modération",
    description: "Verrouille tous les salons texte (mode urgence)",
    usage: ".lockdown [raison]",
    permissions: ["ManageChannels"],
    async execute(message, args) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageChannels))
        return void message.reply({ embeds: [errorEmbed("Tu dois avoir **Gérer les salons**.")] });
      const reason = args.join(" ") || "Lockdown serveur";
      const loading = await message.reply({ embeds: [new EmbedBuilder().setColor(0xFEE75C).setDescription("⏳ Verrouillage de tous les salons en cours...")] });
      const channels = message.guild!.channels.cache.filter((c: any) => c.type === ChannelType.GuildText);
      let done = 0;
      for (const [, ch] of channels) {
        await (ch as any).permissionOverwrites.edit(message.guild!.roles.everyone, { SendMessages: false })
          .then(() => done++).catch(() => {});
      }
      loading.edit({ embeds: [
        new EmbedBuilder().setColor(0xED4245)
          .setTitle("🔒 Serveur Verrouillé !")
          .setDescription(`**${done}** salon(s) verrouillé(s).\nPersonne ne peut plus envoyer de messages.`)
          .addFields({ name: "📝 Raison", value: reason }, { name: "👮 Par", value: `<@${message.author.id}>` })
          .setTimestamp()
      ]});
    },
  },
  {
    name: "unlockdown",
    aliases: ["unlock"],
    category: "Modération",
    description: "Déverrouille tous les salons texte",
    usage: ".unlockdown [raison]",
    permissions: ["ManageChannels"],
    async execute(message, args) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageChannels))
        return void message.reply({ embeds: [errorEmbed("Tu dois avoir **Gérer les salons**.")] });
      const reason = args.join(" ") || "Fin de lockdown";
      const loading = await message.reply({ embeds: [new EmbedBuilder().setColor(0xFEE75C).setDescription("⏳ Déverrouillage de tous les salons en cours...")] });
      const channels = message.guild!.channels.cache.filter((c: any) => c.type === ChannelType.GuildText);
      let done = 0;
      for (const [, ch] of channels) {
        await (ch as any).permissionOverwrites.edit(message.guild!.roles.everyone, { SendMessages: null })
          .then(() => done++).catch(() => {});
      }
      loading.edit({ embeds: [
        new EmbedBuilder().setColor(0x2ECC71)
          .setTitle("🔓 Serveur Déverrouillé !")
          .setDescription(`**${done}** salon(s) déverrouillé(s).`)
          .addFields({ name: "📝 Raison", value: reason }, { name: "👮 Par", value: `<@${message.author.id}>` })
          .setTimestamp()
      ]});
    },
  },
  // ─── MASSROLE ─────────────────────────────────────────────────────────────────
  {
    name: "massrole",
    aliases: ["bulkrole"],
    category: "Modération",
    description: "Ajoute/retire un rôle à tous les membres",
    usage: ".massrole <add|remove> @role",
    permissions: ["ManageRoles"],
    async execute(message, args) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageRoles))
        return void message.reply({ embeds: [errorEmbed("Tu dois avoir **Gérer les rôles**.")] });
      const action = args[0]?.toLowerCase();
      if (action !== "add" && action !== "remove")
        return void message.reply({ embeds: [errorEmbed("Utilise `add` ou `remove`. Ex: `.massrole add @role`")] });
      const role = message.mentions.roles.first()
        ?? (args[1] && /^\d{17,20}$/.test(args[1].replace(/[<@&>]/g, ""))
          ? message.guild!.roles.cache.get(args[1].replace(/[<@&>]/g, "")) : null);
      if (!role) return void message.reply({ embeds: [errorEmbed("Mentionne un rôle ou fournis son ID.")] });
      if (role.position >= message.guild!.members.me!.roles.highest.position)
        return void message.reply({ embeds: [errorEmbed("Ce rôle est au-dessus de mon rôle. Je ne peux pas le gérer.")] });
      await message.guild!.members.fetch().catch(() => {});
      const loading = await message.reply({ embeds: [
        new EmbedBuilder().setColor(0xFEE75C)
          .setDescription(`⏳ ${action === "add" ? "Ajout" : "Retrait"} du rôle **${role.name}** en cours...`)
      ]});
      let success = 0;
      for (const [, member] of message.guild!.members.cache) {
        if (member.user.bot) continue;
        try {
          if (action === "add" && !member.roles.cache.has(role.id)) {
            await member.roles.add(role); success++;
          } else if (action === "remove" && member.roles.cache.has(role.id)) {
            await member.roles.remove(role); success++;
          }
        } catch {}
      }
      loading.edit({ embeds: [
        new EmbedBuilder().setColor(0x2ECC71)
          .setTitle(`✅ MassRole ${action === "add" ? "Ajout" : "Retrait"} Terminé`)
          .setDescription(`Rôle <@&${role.id}> ${action === "add" ? "ajouté à" : "retiré de"} **${success}** membre(s).`)
          .addFields({ name: "👮 Par", value: `<@${message.author.id}>` })
          .setTimestamp()
      ]});
    },
  },
  // ─── SNIPE ────────────────────────────────────────────────────────────────────
  {
    name: "snipe",
    aliases: ["s"],
    category: "Utilitaire",
    description: "Affiche le dernier message supprimé dans ce salon",
    usage: ".snipe",
    async execute(message, _args, _s, client) {
      const snipeMap: Map<string, { content: string; author: string; avatarURL: string; deletedAt: Date }> =
        (client as any)._snipeCache ?? ((client as any)._snipeCache = new Map());
      const data = snipeMap.get(message.channelId);
      if (!data) return void message.reply({ embeds: [new EmbedBuilder().setColor(0xFEE75C).setDescription("Aucun message sniped dans ce salon.")] });
      message.reply({ embeds: [
        new EmbedBuilder().setColor(0x9B59B6)
          .setAuthor({ name: data.author, iconURL: data.avatarURL })
          .setTitle("🎯 Message Sniped")
          .setDescription(data.content.slice(0, 2048) || "*[Aucun contenu textuel]*")
          .setFooter({ text: `Supprimé ${data.deletedAt.toLocaleString("fr-FR")}` })
      ]});
    },
  },
];
