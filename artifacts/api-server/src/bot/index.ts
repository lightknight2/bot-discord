import {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActivityType,
  Events,
} from "discord.js";
import type { BotClient, Command } from "./types.js";
import { moderationCommands } from "./commands/moderation.js";
import { utilityCommands } from "./commands/utility.js";
import { funCommands } from "./commands/fun.js";
import { settingsCommands } from "./commands/settings.js";
import { profileCommands } from "./commands/profile.js";
import { helpCommands } from "./commands/help.js";
import { advancedModCommands, registerSnipeListeners } from "./commands/advanced-mod.js";
import { automodCommands, registerAutoModListeners } from "./commands/automod.js";
import { systemsCommands, registerAfkListener } from "./commands/systems.js";
import { protectionCommands, registerProtectionListeners } from "./commands/protection.js";
import { ticketCommands, registerTicketInteractions } from "./commands/tickets.js";
import { getGuildSettings } from "./utils/db.js";
import { logger } from "../lib/logger.js";

const allCommands: Command[] = [
  ...moderationCommands,
  ...utilityCommands,
  ...funCommands,
  ...settingsCommands,
  ...profileCommands,
  ...helpCommands,
  ...advancedModCommands,
  ...automodCommands,
  ...systemsCommands,
  ...protectionCommands,
  ...ticketCommands,
];

function ordinal(n: number): string {
  const s = ["ème", "er", "ème", "ème"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]!);
}

function accountAge(ms: number): { text: string; isNew: boolean } {
  const days = Math.floor(ms / 86400000);
  if (days < 1) return { text: "Moins d'un jour", isNew: true };
  if (days < 7) return { text: `${days} jour(s)`, isNew: true };
  if (days < 30) return { text: `${days} jours`, isNew: false };
  if (days < 365) return { text: `${Math.floor(days / 30)} mois`, isNew: false };
  return { text: `${Math.floor(days / 365)} an(s)`, isNew: false };
}

export function startBot(): void {
  const token = process.env["DISCORD_TOKEN"];
  if (!token) {
    logger.warn("DISCORD_TOKEN not set — Discord bot will not start.");
    return;
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildPresences,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.GuildEmojisAndStickers,
      GatewayIntentBits.GuildInvites,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
  }) as BotClient;

  client.commands = new Map();
  client.aliases = new Map();
  client.categories = new Map();
  client.startTime = new Date();

  for (const cmd of allCommands) {
    client.commands.set(cmd.name, cmd);
    if (cmd.aliases) {
      for (const alias of cmd.aliases) client.aliases.set(alias, cmd.name);
    }
    if (!client.categories.has(cmd.category)) client.categories.set(cmd.category, []);
    client.categories.get(cmd.category)!.push(cmd);
  }

  registerSnipeListeners(client);
  registerAutoModListeners(client);
  registerAfkListener(client);
  registerProtectionListeners(client);
  registerTicketInteractions(client);

  logger.info(`Loaded ${client.commands.size} commands across ${client.categories.size} categories.`);

  // ─── READY ──────────────────────────────────────────────────────────────────
  client.once(Events.ClientReady, (c) => {
    logger.info(`Discord bot logged in as ${c.user.tag}`);
    c.user.setActivity(`${c.guilds.cache.size} serveurs • +help`, { type: ActivityType.Watching });
  });

  // ─── COMMAND HANDLER ────────────────────────────────────────────────────────
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;
    const settings = await getGuildSettings(message.guild.id).catch(() => null);
    if (!settings) return;
    if (!message.content.startsWith(settings.prefix)) return;
    const args = message.content.slice(settings.prefix.length).trim().split(/\s+/);
    const commandName = args.shift()?.toLowerCase();
    if (!commandName) return;
    const cmd = client.commands.get(commandName) ?? client.commands.get(client.aliases.get(commandName) ?? "");
    if (!cmd) return;
    try {
      await cmd.execute(message, args, settings, client);
    } catch (err) {
      logger.error({ err, command: commandName }, "Command error");
      message.reply({ embeds: [
        new EmbedBuilder().setColor(0xED4245)
          .setTitle("❌ Erreur")
          .setDescription("Une erreur est survenue. Réessaie plus tard.")
          .setTimestamp()
      ]}).catch(() => {});
    }
  });

  // ─── MEMBER JOIN — WELCOME ───────────────────────────────────────────────────
  client.on(Events.GuildMemberAdd, async (member) => {
    try {
      const settings = await getGuildSettings(member.guild.id);

      // Auto-role
      if (settings.autoroleId) {
        const role = member.guild.roles.cache.get(settings.autoroleId);
        if (role) await member.roles.add(role).catch(() => {});
      }

      const age = accountAge(Date.now() - member.user.createdTimestamp);
      const memberNum = member.guild.memberCount;

      // Welcome channel — super styled
      if (settings.welcomeChannelId) {
        const ch = member.guild.channels.cache.get(settings.welcomeChannelId) as any;
        if (ch?.isTextBased()) {
          const customMsg = settings.welcomeMessage
            ? settings.welcomeMessage
                .replace(/{user}/g, `<@${member.id}>`)
                .replace(/{username}/g, member.user.username)
                .replace(/{server}/g, member.guild.name)
                .replace(/{count}/g, `${memberNum}`)
            : null;

          const embed = new EmbedBuilder()
            .setColor(age.isNew ? 0xED4245 : 0x5865F2)
            .setAuthor({ name: `✨ Nouveau membre !`, iconURL: member.guild.iconURL() ?? undefined })
            .setTitle(`Bienvenue, ${member.user.username} !`)
            .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
            .setDescription(
              customMsg ??
              `> 👋 <@${member.id}> vient de rejoindre **${member.guild.name}** !\n> Bienvenue parmi nous — amuse-toi bien !`
            )
            .addFields(
              { name: "👤 Compte", value: `<@${member.id}>\n\`${member.user.tag}\``, inline: true },
              { name: "📅 Créé", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:D>\n*(${age.text})*`, inline: true },
              { name: "🎉 Membre", value: `**${ordinal(memberNum)}** membre`, inline: true },
            )
            .setFooter({
              text: `ID: ${member.id}${age.isNew ? " • ⚠️ Compte récent" : ""}`,
              iconURL: member.user.displayAvatarURL(),
            })
            .setTimestamp();

          ch.send({ content: `<@${member.id}>`, embeds: [embed] }).catch(() => {});
        }
      }

      // Auto-log
      if (settings.autologChannelId) {
        const ch = member.guild.channels.cache.get(settings.autologChannelId) as any;
        if (ch?.isTextBased()) {
          ch.send({ embeds: [
            new EmbedBuilder()
              .setColor(0x2ECC71)
              .setAuthor({ name: "📥 Membre Rejoint", iconURL: member.user.displayAvatarURL() })
              .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
              .addFields(
                { name: "👤 Utilisateur", value: `${member.user.tag}\n\`${member.id}\``, inline: true },
                { name: "📅 Compte créé", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
                { name: "👥 Membres", value: `${memberNum}`, inline: true },
                ...(age.isNew ? [{ name: "⚠️ Alerte", value: "Compte récent (moins de 7 jours) !", inline: false }] : []),
              )
              .setFooter({ text: member.guild.name, iconURL: member.guild.iconURL() ?? undefined })
              .setTimestamp()
          ]}).catch(() => {});
        }
      }
    } catch (err) {
      logger.error({ err }, "GuildMemberAdd error");
    }
  });

  // ─── MEMBER LEAVE — GOODBYE ──────────────────────────────────────────────────
  client.on(Events.GuildMemberRemove, async (member) => {
    try {
      const settings = await getGuildSettings(member.guild.id);

      if (settings.goodbyeChannelId) {
        const ch = member.guild.channels.cache.get(settings.goodbyeChannelId) as any;
        if (ch?.isTextBased()) {
          const customMsg = settings.goodbyeMessage
            ? settings.goodbyeMessage
                .replace(/{user}/g, member.user.username)
                .replace(/{server}/g, member.guild.name)
            : null;

          ch.send({ embeds: [
            new EmbedBuilder()
              .setColor(0x95A5A6)
              .setAuthor({ name: "👋 Départ", iconURL: member.user.displayAvatarURL() })
              .setTitle(`Au revoir, ${member.user.username}`)
              .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
              .setDescription(customMsg ?? `> **${member.user.username}** a quitté le serveur.\n> Il reste maintenant **${member.guild.memberCount}** membres.`)
              .setFooter({ text: member.guild.name, iconURL: member.guild.iconURL() ?? undefined })
              .setTimestamp()
          ]}).catch(() => {});
        }
      }

      if (settings.autologChannelId) {
        const ch = member.guild.channels.cache.get(settings.autologChannelId) as any;
        if (ch?.isTextBased()) {
          ch.send({ embeds: [
            new EmbedBuilder()
              .setColor(0xED4245)
              .setAuthor({ name: "📤 Membre Parti", iconURL: member.user.displayAvatarURL() })
              .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
              .addFields(
                { name: "👤 Utilisateur", value: `${member.user.tag}\n\`${member.id}\``, inline: true },
                { name: "👥 Membres restants", value: `${member.guild.memberCount}`, inline: true },
                { name: "📥 Avait rejoint", value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : "Inconnu", inline: true },
              )
              .setFooter({ text: member.guild.name, iconURL: member.guild.iconURL() ?? undefined })
              .setTimestamp()
          ]}).catch(() => {});
        }
      }
    } catch (err) {
      logger.error({ err }, "GuildMemberRemove error");
    }
  });

  // ─── MESSAGE DELETE LOG ──────────────────────────────────────────────────────
  client.on(Events.MessageDelete, async (message) => {
    if (!message.guild || message.author?.bot) return;
    // Cache for .snipe command
    if (message.content && message.author) {
      const snipeMap: Map<string, any> = (client as any)._snipeCache ?? ((client as any)._snipeCache = new Map());
      snipeMap.set(message.channelId, {
        content: message.content,
        author: message.author.tag,
        avatarURL: message.author.displayAvatarURL(),
        deletedAt: new Date(),
      });
    }
    try {
      const settings = await getGuildSettings(message.guild.id);
      if (!settings.autologChannelId) return;
      const ch = message.guild.channels.cache.get(settings.autologChannelId) as any;
      if (!ch?.isTextBased()) return;
      ch.send({ embeds: [
        new EmbedBuilder()
          .setColor(0xE67E22)
          .setAuthor({ name: "🗑️ Message Supprimé", iconURL: message.author?.displayAvatarURL() })
          .addFields(
            { name: "👤 Auteur", value: message.author ? `${message.author.tag} (<@${message.author.id}>)` : "Inconnu", inline: true },
            { name: "💬 Salon", value: `<#${message.channelId}>`, inline: true },
            { name: "📝 Contenu", value: message.content?.slice(0, 1024) || "*Indisponible*", inline: false },
          )
          .setFooter({ text: message.guild.name, iconURL: message.guild.iconURL() ?? undefined })
          .setTimestamp()
      ]}).catch(() => {});
    } catch {}
  });

  // ─── MESSAGE EDIT LOG ────────────────────────────────────────────────────────
  client.on(Events.MessageUpdate, async (oldMsg, newMsg) => {
    if (!newMsg.guild || newMsg.author?.bot || oldMsg.content === newMsg.content) return;
    try {
      const settings = await getGuildSettings(newMsg.guild.id);
      if (!settings.autologChannelId) return;
      const ch = newMsg.guild.channels.cache.get(settings.autologChannelId) as any;
      if (!ch?.isTextBased()) return;
      ch.send({ embeds: [
        new EmbedBuilder()
          .setColor(0x3498DB)
          .setAuthor({ name: "✏️ Message Modifié", iconURL: newMsg.author?.displayAvatarURL() })
          .addFields(
            { name: "👤 Auteur", value: newMsg.author ? `${newMsg.author.tag} (<@${newMsg.author.id}>)` : "Inconnu", inline: true },
            { name: "💬 Salon", value: `<#${newMsg.channelId}> • [Voir](${newMsg.url})`, inline: true },
            { name: "📝 Avant", value: oldMsg.content?.slice(0, 512) || "*Indisponible*", inline: false },
            { name: "📝 Après", value: newMsg.content?.slice(0, 512) || "*Indisponible*", inline: false },
          )
          .setFooter({ text: newMsg.guild.name, iconURL: newMsg.guild.iconURL() ?? undefined })
          .setTimestamp()
      ]}).catch(() => {});
    } catch {}
  });

  // ─── BAN LOG ─────────────────────────────────────────────────────────────────
  client.on(Events.GuildBanAdd, async (ban) => {
    try {
      const settings = await getGuildSettings(ban.guild.id);
      if (!settings.modlogChannelId) return;
      const ch = ban.guild.channels.cache.get(settings.modlogChannelId) as any;
      if (!ch?.isTextBased()) return;
      ch.send({ embeds: [
        new EmbedBuilder()
          .setColor(0xED4245)
          .setAuthor({ name: "🔨 Membre Banni", iconURL: ban.user.displayAvatarURL() })
          .setThumbnail(ban.user.displayAvatarURL({ size: 128 }))
          .addFields(
            { name: "👤 Utilisateur", value: `${ban.user.tag}\n\`${ban.user.id}\``, inline: true },
            { name: "📝 Raison", value: ban.reason ?? "Aucune raison", inline: true },
          )
          .setFooter({ text: ban.guild.name, iconURL: ban.guild.iconURL() ?? undefined })
          .setTimestamp()
      ]}).catch(() => {});
    } catch {}
  });

  // ─── UNBAN LOG ───────────────────────────────────────────────────────────────
  client.on(Events.GuildBanRemove, async (ban) => {
    try {
      const settings = await getGuildSettings(ban.guild.id);
      if (!settings.modlogChannelId) return;
      const ch = ban.guild.channels.cache.get(settings.modlogChannelId) as any;
      if (!ch?.isTextBased()) return;
      ch.send({ embeds: [
        new EmbedBuilder()
          .setColor(0x2ECC71)
          .setAuthor({ name: "✅ Membre Débanni", iconURL: ban.user.displayAvatarURL() })
          .setThumbnail(ban.user.displayAvatarURL({ size: 128 }))
          .addFields({ name: "👤 Utilisateur", value: `${ban.user.tag}\n\`${ban.user.id}\``, inline: true })
          .setFooter({ text: ban.guild.name, iconURL: ban.guild.iconURL() ?? undefined })
          .setTimestamp()
      ]}).catch(() => {});
    } catch {}
  });

  // ─── LOG HELPERS ─────────────────────────────────────────────────────────────
  type LogType = "auto" | "mod" | "vocal" | "server" | "member" | "ticket";

  async function autoLog(guildId: string, guild: any, embed: EmbedBuilder, type: LogType = "auto") {
    try {
      const s = await getGuildSettings(guildId);
      const channelId = (
        type === "vocal"  ? s.vocalLogChannelId  :
        type === "server" ? s.serverLogChannelId :
        type === "member" ? s.memberLogChannelId :
        type === "ticket" ? s.ticketLogChannelId :
        type === "mod"    ? s.modlogChannelId    :
        s.autologChannelId
      ) ?? s.autologChannelId;
      if (!channelId) return;
      const ch = guild.channels.cache.get(channelId) as any;
      if (ch?.isTextBased()) ch.send({ embeds: [embed] }).catch(() => {});
    } catch {}
  }

  function memberInfo(member: any) {
    return `<@${member.id}>\n\`${member.user?.tag ?? member.tag ?? "?"}\`\n\`${member.id}\``;
  }
  function sep() { return { name: "\u200b", value: "\u200b", inline: true }; }

  // ─── VOICE STATE ─────────────────────────────────────────────────────────────
  client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    const member = newState.member ?? oldState.member;
    if (!member || member.user.bot) return;
    const guild = newState.guild;
    const avatar = member.user.displayAvatarURL({ size: 128 });
    const foot = { text: `ID: ${member.id} • ${guild.name}`, iconURL: guild.iconURL() ?? undefined };
    let embed: EmbedBuilder | null = null;

    // ── Join voice ──
    if (!oldState.channelId && newState.channelId) {
      const ch = newState.channel;
      embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setAuthor({ name: "🎙️ Connexion Vocale", iconURL: avatar })
        .setThumbnail(avatar)
        .setDescription(`> <@${member.id}> a **rejoint** un salon vocal`)
        .addFields(
          { name: "👤 Membre", value: memberInfo(member), inline: true },
          { name: "🔊 Salon rejoint", value: `<#${newState.channelId}>\n\`${ch?.name ?? "?"}\``, inline: true },
          { name: "👥 Membres en vocal", value: `${ch?.members?.size ?? "?"}`, inline: true },
          { name: "🔇 Micro", value: newState.selfMute ? "🔴 Muet" : "🟢 Actif", inline: true },
          { name: "🎧 Son", value: newState.selfDeaf ? "🔴 Sourd" : "🟢 Actif", inline: true },
          { name: "📹 Caméra", value: newState.selfVideo ? "🟢 Activée" : "⚫ Off", inline: true },
        )
        .setFooter(foot).setTimestamp();

    // ── Leave voice ──
    } else if (oldState.channelId && !newState.channelId) {
      embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setAuthor({ name: "🚪 Déconnexion Vocale", iconURL: avatar })
        .setThumbnail(avatar)
        .setDescription(`> <@${member.id}> a **quitté** un salon vocal`)
        .addFields(
          { name: "👤 Membre", value: memberInfo(member), inline: true },
          { name: "🔇 Salon quitté", value: `<#${oldState.channelId}>\n\`${oldState.channel?.name ?? "?"}\``, inline: true },
          sep(),
        )
        .setFooter(foot).setTimestamp();

    // ── Move between channels ──
    } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      embed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setAuthor({ name: "↔️ Déplacement Vocal", iconURL: avatar })
        .setThumbnail(avatar)
        .setDescription(`> <@${member.id}> a **changé** de salon vocal`)
        .addFields(
          { name: "👤 Membre", value: memberInfo(member), inline: true },
          { name: "⬅️ Quitté", value: `<#${oldState.channelId}>\n\`${oldState.channel?.name ?? "?"}\``, inline: true },
          { name: "➡️ Rejoint", value: `<#${newState.channelId}>\n\`${newState.channel?.name ?? "?"}\``, inline: true },
        )
        .setFooter(foot).setTimestamp();

    // ── Mute / Unmute ──
    } else if (oldState.channelId && newState.channelId && oldState.selfMute !== newState.selfMute) {
      embed = new EmbedBuilder()
        .setColor(newState.selfMute ? 0x99AAB5 : 0x57F287)
        .setAuthor({ name: newState.selfMute ? "🔇 Micro Coupé" : "🎤 Micro Activé", iconURL: avatar })
        .setThumbnail(avatar)
        .addFields(
          { name: "👤 Membre", value: memberInfo(member), inline: true },
          { name: "🔊 Salon", value: `<#${newState.channelId}>`, inline: true },
          { name: "🔇 Statut micro", value: newState.selfMute ? "🔴 Coupé" : "🟢 Actif", inline: true },
        )
        .setFooter(foot).setTimestamp();

    // ── Deaf / Undeaf ──
    } else if (oldState.channelId && newState.channelId && oldState.selfDeaf !== newState.selfDeaf) {
      embed = new EmbedBuilder()
        .setColor(newState.selfDeaf ? 0x99AAB5 : 0x57F287)
        .setAuthor({ name: newState.selfDeaf ? "🔕 Son Coupé" : "🔔 Son Activé", iconURL: avatar })
        .setThumbnail(avatar)
        .addFields(
          { name: "👤 Membre", value: memberInfo(member), inline: true },
          { name: "🔊 Salon", value: `<#${newState.channelId}>`, inline: true },
          { name: "🎧 Statut son", value: newState.selfDeaf ? "🔴 Sourd" : "🟢 Actif", inline: true },
        )
        .setFooter(foot).setTimestamp();

    // ── Stream on/off ──
    } else if (oldState.channelId && newState.channelId && oldState.streaming !== newState.streaming) {
      embed = new EmbedBuilder()
        .setColor(newState.streaming ? 0x9B59B6 : 0x99AAB5)
        .setAuthor({ name: newState.streaming ? "📡 Stream Démarré" : "📡 Stream Arrêté", iconURL: avatar })
        .setThumbnail(avatar)
        .addFields(
          { name: "👤 Membre", value: memberInfo(member), inline: true },
          { name: "🔊 Salon", value: `<#${newState.channelId}>`, inline: true },
          { name: "📡 Stream", value: newState.streaming ? "🟢 En direct" : "🔴 Arrêté", inline: true },
        )
        .setFooter(foot).setTimestamp();

    // ── Camera on/off ──
    } else if (oldState.channelId && newState.channelId && oldState.selfVideo !== newState.selfVideo) {
      embed = new EmbedBuilder()
        .setColor(newState.selfVideo ? 0x1ABC9C : 0x99AAB5)
        .setAuthor({ name: newState.selfVideo ? "📷 Caméra Activée" : "📷 Caméra Désactivée", iconURL: avatar })
        .setThumbnail(avatar)
        .addFields(
          { name: "👤 Membre", value: memberInfo(member), inline: true },
          { name: "🔊 Salon", value: `<#${newState.channelId}>`, inline: true },
          { name: "📹 Caméra", value: newState.selfVideo ? "🟢 Activée" : "🔴 Off", inline: true },
        )
        .setFooter(foot).setTimestamp();
    }

    if (embed) await autoLog(guild.id, guild, embed, "vocal");
  });

  // ─── CHANNEL CREATE ───────────────────────────────────────────────────────────
  client.on(Events.ChannelCreate, async (channel) => {
    if (!channel.guild) return;
    const typeLabel: Record<number, string> = { 0: "💬 Texte", 2: "🔊 Vocal", 4: "📁 Catégorie", 5: "📢 Annonces", 13: "🎤 Stage", 15: "🗂️ Forum" };
    await autoLog(channel.guild.id, channel.guild, new EmbedBuilder()
      .setColor(0x57F287)
      .setAuthor({ name: "📁 Nouveau Salon Créé", iconURL: channel.guild.iconURL() ?? undefined })
      .setDescription(`> Un nouveau salon a été créé sur **${channel.guild.name}**`)
      .addFields(
        { name: "📋 Nom", value: `\`#${channel.name}\``, inline: true },
        { name: "🏷️ Type", value: typeLabel[channel.type] ?? "Autre", inline: true },
        { name: "🆔 ID", value: `\`${channel.id}\``, inline: true },
        { name: "📁 Catégorie", value: (channel as any).parent?.name ? `\`${(channel as any).parent.name}\`` : "*Aucune*", inline: true },
        { name: "🔒 Privé", value: (channel as any).permissionsLocked !== undefined ? ((channel as any).permissionsLocked ? "🔴 Oui" : "🟢 Non") : "—", inline: true },
      )
      .setFooter({ text: channel.guild.name, iconURL: channel.guild.iconURL() ?? undefined }).setTimestamp()
    , "server");
  });

  // ─── CHANNEL DELETE ───────────────────────────────────────────────────────────
  client.on(Events.ChannelDelete, async (channel) => {
    if (!("guild" in channel) || !channel.guild) return;
    const typeLabel: Record<number, string> = { 0: "💬 Texte", 2: "🔊 Vocal", 4: "📁 Catégorie", 5: "📢 Annonces", 13: "🎤 Stage", 15: "🗂️ Forum" };
    await autoLog(channel.guild.id, channel.guild, new EmbedBuilder()
      .setColor(0xED4245)
      .setAuthor({ name: "🗑️ Salon Supprimé", iconURL: channel.guild.iconURL() ?? undefined })
      .setDescription(`> Le salon **\`#${channel.name}\`** a été supprimé`)
      .addFields(
        { name: "📋 Nom", value: `\`#${channel.name}\``, inline: true },
        { name: "🏷️ Type", value: typeLabel[channel.type] ?? "Autre", inline: true },
        { name: "🆔 ID", value: `\`${channel.id}\``, inline: true },
      )
      .setFooter({ text: channel.guild.name, iconURL: channel.guild.iconURL() ?? undefined }).setTimestamp()
    , "server");
  });

  // ─── CHANNEL UPDATE ───────────────────────────────────────────────────────────
  client.on(Events.ChannelUpdate, async (oldCh, newCh) => {
    if (!("guild" in newCh) || !newCh.guild) return;
    const changes: { name: string; before: string; after: string }[] = [];
    if ((oldCh as any).name !== (newCh as any).name)
      changes.push({ name: "📋 Nom", before: `\`#${(oldCh as any).name}\``, after: `\`#${(newCh as any).name}\`` });
    if ((oldCh as any).topic !== (newCh as any).topic)
      changes.push({ name: "📝 Topic", before: (oldCh as any).topic || "*Aucun*", after: (newCh as any).topic || "*Aucun*" });
    if ((oldCh as any).nsfw !== (newCh as any).nsfw)
      changes.push({ name: "🔞 NSFW", before: (oldCh as any).nsfw ? "✅" : "❌", after: (newCh as any).nsfw ? "✅" : "❌" });
    if (!changes.length) return;
    const fields = changes.flatMap(c => [
      { name: `${c.name} — Avant`, value: c.before.slice(0, 512), inline: true },
      { name: `${c.name} — Après`, value: c.after.slice(0, 512), inline: true },
      sep(),
    ]);
    await autoLog(newCh.guild.id, newCh.guild, new EmbedBuilder()
      .setColor(0xFEE75C)
      .setAuthor({ name: "✏️ Salon Modifié", iconURL: newCh.guild.iconURL() ?? undefined })
      .setDescription(`> <#${newCh.id}> a été mis à jour (${changes.length} changement(s))`)
      .addFields(...fields, { name: "🆔 ID", value: `\`${newCh.id}\``, inline: true })
      .setFooter({ text: newCh.guild.name, iconURL: newCh.guild.iconURL() ?? undefined }).setTimestamp()
    , "server");
  });

  // ─── ROLE CREATE ──────────────────────────────────────────────────────────────
  client.on(Events.GuildRoleCreate, async (role) => {
    await autoLog(role.guild.id, role.guild, new EmbedBuilder()
      .setColor(role.color || 0x57F287)
      .setAuthor({ name: "🎭 Nouveau Rôle Créé", iconURL: role.guild.iconURL() ?? undefined })
      .setDescription(`> Le rôle **${role.name}** a été créé`)
      .addFields(
        { name: "🏷️ Nom", value: `\`${role.name}\``, inline: true },
        { name: "🎨 Couleur", value: `\`${role.hexColor}\``, inline: true },
        { name: "🆔 ID", value: `\`${role.id}\``, inline: true },
        { name: "📌 Mentionnable", value: role.mentionable ? "✅ Oui" : "❌ Non", inline: true },
        { name: "📌 Affiché séparément", value: role.hoist ? "✅ Oui" : "❌ Non", inline: true },
        { name: "🤖 Géré par bot", value: role.managed ? "✅ Oui" : "❌ Non", inline: true },
      )
      .setFooter({ text: `Position: ${role.position} • ${role.guild.name}`, iconURL: role.guild.iconURL() ?? undefined }).setTimestamp()
    , "server");
  });

  // ─── ROLE DELETE ──────────────────────────────────────────────────────────────
  client.on(Events.GuildRoleDelete, async (role) => {
    await autoLog(role.guild.id, role.guild, new EmbedBuilder()
      .setColor(0xED4245)
      .setAuthor({ name: "🗑️ Rôle Supprimé", iconURL: role.guild.iconURL() ?? undefined })
      .setDescription(`> Le rôle **${role.name}** a été supprimé`)
      .addFields(
        { name: "🏷️ Nom", value: `\`${role.name}\``, inline: true },
        { name: "🎨 Couleur", value: `\`${role.hexColor}\``, inline: true },
        { name: "🆔 ID", value: `\`${role.id}\``, inline: true },
        { name: "👥 Membres concernés", value: `${role.members.size}`, inline: true },
      )
      .setFooter({ text: role.guild.name, iconURL: role.guild.iconURL() ?? undefined }).setTimestamp()
    , "server");
  });

  // ─── ROLE UPDATE ──────────────────────────────────────────────────────────────
  client.on(Events.GuildRoleUpdate, async (oldRole, newRole) => {
    const changes: { n: string; b: string; a: string }[] = [];
    if (oldRole.name !== newRole.name) changes.push({ n: "🏷️ Nom", b: `\`${oldRole.name}\``, a: `\`${newRole.name}\`` });
    if (oldRole.hexColor !== newRole.hexColor) changes.push({ n: "🎨 Couleur", b: `\`${oldRole.hexColor}\``, a: `\`${newRole.hexColor}\`` });
    if (oldRole.hoist !== newRole.hoist) changes.push({ n: "📌 Affiché séparé", b: oldRole.hoist ? "✅" : "❌", a: newRole.hoist ? "✅" : "❌" });
    if (oldRole.mentionable !== newRole.mentionable) changes.push({ n: "📣 Mentionnable", b: oldRole.mentionable ? "✅" : "❌", a: newRole.mentionable ? "✅" : "❌" });
    if (!changes.length) return;
    await autoLog(newRole.guild.id, newRole.guild, new EmbedBuilder()
      .setColor(newRole.color || 0xFEE75C)
      .setAuthor({ name: "✏️ Rôle Modifié", iconURL: newRole.guild.iconURL() ?? undefined })
      .setDescription(`> Le rôle <@&${newRole.id}> a été mis à jour`)
      .addFields(
        ...changes.flatMap(c => [
          { name: `${c.n} avant`, value: c.b, inline: true },
          { name: `${c.n} après`, value: c.a, inline: true },
          sep(),
        ]),
        { name: "🆔 ID", value: `\`${newRole.id}\``, inline: true },
      )
      .setFooter({ text: newRole.guild.name, iconURL: newRole.guild.iconURL() ?? undefined }).setTimestamp()
    , "server");
  });

  // ─── MEMBER UPDATE (pseudo, rôles, timeout) ───────────────────────────────────
  client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    if (newMember.user.bot) return;
    const guild = newMember.guild;
    const avatar = newMember.user.displayAvatarURL({ size: 128 });
    const foot = { text: `ID: ${newMember.id} • ${guild.name}`, iconURL: guild.iconURL() ?? undefined };

    // Nickname change
    if (oldMember.nickname !== newMember.nickname) {
      await autoLog(guild.id, guild, new EmbedBuilder()
        .setColor(0x9B59B6)
        .setAuthor({ name: "📛 Pseudo Modifié", iconURL: avatar })
        .setThumbnail(avatar)
        .setDescription(`> Le pseudo de <@${newMember.id}> a changé`)
        .addFields(
          { name: "👤 Membre", value: memberInfo(newMember), inline: true },
          { name: "📛 Avant", value: `\`${oldMember.nickname ?? "Aucun"}\``, inline: true },
          { name: "📛 Après", value: `\`${newMember.nickname ?? "Aucun"}\``, inline: true },
        )
        .setFooter(foot).setTimestamp()
      , "member");
    }

    // Timeout added/removed
    const oldTimeout = oldMember.communicationDisabledUntil?.getTime() ?? 0;
    const newTimeout = newMember.communicationDisabledUntil?.getTime() ?? 0;
    if (oldTimeout !== newTimeout) {
      const muted = newTimeout > Date.now();
      await autoLog(guild.id, guild, new EmbedBuilder()
        .setColor(muted ? 0xFEE75C : 0x57F287)
        .setAuthor({ name: muted ? "🔇 Timeout Ajouté" : "🔔 Timeout Levé", iconURL: avatar })
        .setThumbnail(avatar)
        .addFields(
          { name: "👤 Membre", value: memberInfo(newMember), inline: true },
          ...(muted && newMember.communicationDisabledUntil
            ? [{ name: "⏰ Expire", value: `<t:${Math.floor(newMember.communicationDisabledUntil.getTime() / 1000)}:R>`, inline: true }]
            : []),
        )
        .setFooter(foot).setTimestamp()
      , "member");
    }

    // Role changes
    const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id) && r.id !== guild.id);
    const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id) && r.id !== guild.id);

    if (addedRoles.size > 0) {
      await autoLog(guild.id, guild, new EmbedBuilder()
        .setColor(0x57F287)
        .setAuthor({ name: "➕ Rôle(s) Attribué(s)", iconURL: avatar })
        .setThumbnail(avatar)
        .setDescription(`> <@${newMember.id}> a reçu ${addedRoles.size} rôle(s)`)
        .addFields(
          { name: "👤 Membre", value: memberInfo(newMember), inline: true },
          { name: "✅ Rôle(s) ajouté(s)", value: addedRoles.map(r => `<@&${r.id}>`).join(" "), inline: true },
          { name: "🎭 Total rôles", value: `${newMember.roles.cache.size - 1}`, inline: true },
        )
        .setFooter(foot).setTimestamp()
      , "member");
    }
    if (removedRoles.size > 0) {
      await autoLog(guild.id, guild, new EmbedBuilder()
        .setColor(0xEB459E)
        .setAuthor({ name: "➖ Rôle(s) Retiré(s)", iconURL: avatar })
        .setThumbnail(avatar)
        .setDescription(`> <@${newMember.id}> a perdu ${removedRoles.size} rôle(s)`)
        .addFields(
          { name: "👤 Membre", value: memberInfo(newMember), inline: true },
          { name: "❌ Rôle(s) retiré(s)", value: removedRoles.map(r => `<@&${r.id}>`).join(" "), inline: true },
          { name: "🎭 Total rôles", value: `${newMember.roles.cache.size - 1}`, inline: true },
        )
        .setFooter(foot).setTimestamp()
      , "member");
    }
  });

  // ─── MESSAGE BULK DELETE ─────────────────────────────────────────────────────
  client.on(Events.MessageBulkDelete, async (messages) => {
    const first = messages.first();
    if (!first?.guild) return;
    const authors = new Set(messages.filter((m: any) => !m.author?.bot).map((m: any) => m.author?.tag ?? "?"));
    await autoLog(first.guild.id, first.guild, new EmbedBuilder()
      .setColor(0xEB459E)
      .setAuthor({ name: "🗑️ Suppression Groupée", iconURL: first.guild.iconURL() ?? undefined })
      .setDescription(`> **${messages.size} message(s)** supprimés d'un coup dans <#${first.channelId}>`)
      .addFields(
        { name: "📊 Messages supprimés", value: `\`${messages.size}\``, inline: true },
        { name: "💬 Salon", value: `<#${first.channelId}>`, inline: true },
        { name: "👤 Auteurs concernés", value: `${authors.size}`, inline: true },
      )
      .setFooter({ text: first.guild.name, iconURL: first.guild.iconURL() ?? undefined }).setTimestamp()
    );
  });

  // ─── EMOJI CREATE / DELETE ───────────────────────────────────────────────────
  client.on(Events.GuildEmojiCreate, async (emoji) => {
    await autoLog(emoji.guild.id, emoji.guild, new EmbedBuilder()
      .setColor(0x57F287)
      .setAuthor({ name: "😀 Emoji Ajouté", iconURL: emoji.guild.iconURL() ?? undefined })
      .setThumbnail(emoji.imageURL())
      .setDescription(`> L'emoji **${emoji.name}** a été ajouté`)
      .addFields(
        { name: "🏷️ Nom", value: `\`:${emoji.name}:\``, inline: true },
        { name: "🆔 ID", value: `\`${emoji.id}\``, inline: true },
        { name: "🤖 Animé", value: emoji.animated ? "✅ Oui" : "❌ Non", inline: true },
        { name: "💬 Usage", value: `<:${emoji.name}:${emoji.id}>`, inline: true },
      )
      .setFooter({ text: emoji.guild.name, iconURL: emoji.guild.iconURL() ?? undefined }).setTimestamp()
    , "server");
  });

  client.on(Events.GuildEmojiDelete, async (emoji) => {
    await autoLog(emoji.guild.id, emoji.guild, new EmbedBuilder()
      .setColor(0xED4245)
      .setAuthor({ name: "🗑️ Emoji Supprimé", iconURL: emoji.guild.iconURL() ?? undefined })
      .setDescription(`> L'emoji **${emoji.name}** a été supprimé`)
      .addFields(
        { name: "🏷️ Nom", value: `\`:${emoji.name}:\``, inline: true },
        { name: "🆔 ID", value: `\`${emoji.id}\``, inline: true },
        { name: "🤖 Animé", value: emoji.animated ? "✅ Oui" : "❌ Non", inline: true },
      )
      .setFooter({ text: emoji.guild.name, iconURL: emoji.guild.iconURL() ?? undefined }).setTimestamp()
    , "server");
  });

  // ─── INVITE CREATE / DELETE ──────────────────────────────────────────────────
  client.on(Events.InviteCreate, async (invite) => {
    if (!invite.guild) return;
    await autoLog(invite.guild.id, invite.guild, new EmbedBuilder()
      .setColor(0x5865F2)
      .setAuthor({ name: "🔗 Invitation Créée", iconURL: invite.guild.iconURL() ?? undefined })
      .setDescription(`> Une nouvelle invitation a été créée par <@${invite.inviterId}>`)
      .addFields(
        { name: "🔗 Code", value: `\`${invite.code}\``, inline: true },
        { name: "💬 Salon", value: invite.channelId ? `<#${invite.channelId}>` : "?", inline: true },
        { name: "♾️ Utilisations max", value: `${invite.maxUses === 0 ? "∞" : invite.maxUses}`, inline: true },
        { name: "⏱️ Expire", value: invite.maxAge === 0 ? "Jamais" : `<t:${Math.floor((Date.now() + (invite.maxAge ?? 0) * 1000) / 1000)}:R>`, inline: true },
        { name: "👤 Créé par", value: invite.inviterId ? `<@${invite.inviterId}>` : "?", inline: true },
        { name: "🔁 Temporaire", value: invite.temporary ? "✅ Oui" : "❌ Non", inline: true },
      )
      .setFooter({ text: invite.guild.name, iconURL: invite.guild.iconURL() ?? undefined }).setTimestamp()
    , "server");
  });

  client.on(Events.InviteDelete, async (invite) => {
    if (!invite.guild) return;
    await autoLog(invite.guild.id, invite.guild, new EmbedBuilder()
      .setColor(0xED4245)
      .setAuthor({ name: "🗑️ Invitation Supprimée", iconURL: invite.guild.iconURL() ?? undefined })
      .setDescription(`> L'invitation **\`${invite.code}\`** a été supprimée`)
      .addFields(
        { name: "🔗 Code", value: `\`${invite.code}\``, inline: true },
        { name: "💬 Salon", value: invite.channelId ? `<#${invite.channelId}>` : "?", inline: true },
      )
      .setFooter({ text: invite.guild.name, iconURL: invite.guild.iconURL() ?? undefined }).setTimestamp()
    , "server");
  });

  client.login(token).catch((err) => {
    logger.error({ err }, "Failed to login to Discord");
  });
}
