import { EmbedBuilder, PermissionFlagsBits, ChannelType } from "discord.js";
import type { Command } from "../types.js";
import { updateGuildSettings } from "../utils/db.js";

function err(msg: string) { return new EmbedBuilder().setColor(0xED4245).setTitle("❌ Erreur").setDescription(msg).setTimestamp(); }
function ok(msg: string) { return new EmbedBuilder().setColor(0x2ECC71).setTitle("✅ Succès").setDescription(msg).setTimestamp(); }
function info(title: string) { return new EmbedBuilder().setColor(0x5865F2).setTitle(title).setTimestamp(); }

export const settingsCommands: Command[] = [
  {
    name: "prefix",
    aliases: ["setprefix"],
    category: "Paramètres",
    description: "Change le préfixe du bot sur ce serveur",
    usage: "+prefix <nouveau_préfixe>",
    permissions: ["ManageGuild"],
    async execute(message, args, settings) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild))
        return void message.reply({ embeds: [err("Tu dois avoir **Gérer le serveur**.")] });
      if (!args[0]) return void message.reply({ embeds: [
        info("📌 Préfixe actuel")
          .setDescription(`Préfixe : **\`${settings.prefix}\`**\nUsage : \`+prefix <nouveau>\``)
      ]});
      const newPrefix = args[0].slice(0, 5);
      await updateGuildSettings(message.guild!.id, { prefix: newPrefix });
      message.reply({ embeds: [ok(`Préfixe changé en **\`${newPrefix}\`** !`)] });
    },
  },
  {
    name: "autorole",
    category: "Paramètres",
    description: "Configure le rôle automatique pour les nouveaux membres",
    usage: "+autorole <set @rôle | remove | info>",
    permissions: ["ManageRoles"],
    async execute(message, args, settings) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageRoles))
        return void message.reply({ embeds: [err("Tu dois avoir **Gérer les rôles**.")] });
      const sub = args[0]?.toLowerCase();
      if (sub === "set") {
        const role = message.mentions.roles.first();
        if (!role) return void message.reply({ embeds: [err("Mentionne un rôle. Ex: `+autorole set @Membre`")] });
        await updateGuildSettings(message.guild!.id, { autoroleId: role.id });
        message.reply({ embeds: [ok(`Auto-rôle configuré sur **${role.name}**.`)] });
      } else if (sub === "remove" || sub === "off") {
        await updateGuildSettings(message.guild!.id, { autoroleId: null });
        message.reply({ embeds: [ok("Auto-rôle désactivé.")] });
      } else {
        message.reply({ embeds: [
          info("🎭 Auto-Rôle")
            .addFields(
              { name: "Statut", value: settings.autoroleId ? "🟢 Actif" : "🔴 Inactif", inline: true },
              { name: "Rôle", value: settings.autoroleId ? `<@&${settings.autoroleId}>` : "Non configuré", inline: true },
            )
            .setFooter({ text: "Sous-commandes: set @rôle | remove" })
        ]});
      }
    },
  },
  {
    name: "autolog",
    aliases: ["setlog"],
    category: "Paramètres",
    description: "Salon de logs automatiques (joins/leaves/éditions)",
    usage: "+autolog <set #salon | remove | info>",
    permissions: ["ManageGuild"],
    async execute(message, args, settings) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild))
        return void message.reply({ embeds: [err("Tu dois avoir **Gérer le serveur**.")] });
      const sub = args[0]?.toLowerCase();
      if (sub === "set") {
        const ch = message.mentions.channels.first();
        if (!ch) return void message.reply({ embeds: [err("Mentionne un salon.")] });
        await updateGuildSettings(message.guild!.id, { autologChannelId: ch.id });
        message.reply({ embeds: [ok(`Auto-log configuré dans <#${ch.id}>.`)] });
      } else if (sub === "remove" || sub === "off") {
        await updateGuildSettings(message.guild!.id, { autologChannelId: null });
        message.reply({ embeds: [ok("Auto-log désactivé.")] });
      } else {
        message.reply({ embeds: [
          info("📋 Auto-Log")
            .setDescription("Journalise les arrivées, départs, messages supprimés/modifiés.")
            .addFields(
              { name: "Statut", value: settings.autologChannelId ? "🟢 Actif" : "🔴 Inactif", inline: true },
              { name: "Salon", value: settings.autologChannelId ? `<#${settings.autologChannelId}>` : "Non configuré", inline: true },
            )
            .setFooter({ text: "Sous-commandes: set #salon | remove" })
        ]});
      }
    },
  },
  {
    name: "modlog",
    aliases: ["setmodlog"],
    category: "Paramètres",
    description: "Salon des logs de modération",
    usage: "+modlog <set #salon | remove | info>",
    permissions: ["ManageGuild"],
    async execute(message, args, settings) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild))
        return void message.reply({ embeds: [err("Tu dois avoir **Gérer le serveur**.")] });
      const sub = args[0]?.toLowerCase();
      if (sub === "set") {
        const ch = message.mentions.channels.first();
        if (!ch) return void message.reply({ embeds: [err("Mentionne un salon.")] });
        await updateGuildSettings(message.guild!.id, { modlogChannelId: ch.id });
        message.reply({ embeds: [ok(`Mod-log configuré dans <#${ch.id}>.`)] });
      } else if (sub === "remove" || sub === "off") {
        await updateGuildSettings(message.guild!.id, { modlogChannelId: null });
        message.reply({ embeds: [ok("Mod-log désactivé.")] });
      } else {
        message.reply({ embeds: [
          info("🔨 Mod-Log")
            .setDescription("Journalise les bans, débans, et actions de modération.")
            .addFields(
              { name: "Statut", value: settings.modlogChannelId ? "🟢 Actif" : "🔴 Inactif", inline: true },
              { name: "Salon", value: settings.modlogChannelId ? `<#${settings.modlogChannelId}>` : "Non configuré", inline: true },
            )
            .setFooter({ text: "Sous-commandes: set #salon | remove" })
        ]});
      }
    },
  },
  {
    name: "welcome",
    aliases: ["setwelcome"],
    category: "Paramètres",
    description: "Configure le système de bienvenue",
    usage: "+welcome <set #salon | message <texte> | remove | info>",
    permissions: ["ManageGuild"],
    async execute(message, args, settings) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild))
        return void message.reply({ embeds: [err("Tu dois avoir **Gérer le serveur**.")] });
      const sub = args[0]?.toLowerCase();
      if (sub === "set") {
        const ch = message.mentions.channels.first();
        if (!ch) return void message.reply({ embeds: [err("Mentionne un salon.")] });
        await updateGuildSettings(message.guild!.id, { welcomeChannelId: ch.id });
        message.reply({ embeds: [ok(`Salon de bienvenue configuré dans <#${ch.id}>.`)] });
      } else if (sub === "message") {
        const msg = args.slice(1).join(" ");
        if (!msg) return void message.reply({ embeds: [err("Fournis un message.")] });
        await updateGuildSettings(message.guild!.id, { welcomeMessage: msg });
        message.reply({ embeds: [ok("Message de bienvenue mis à jour !\n**Variables :** `{user}` `{username}` `{server}` `{count}`")] });
      } else if (sub === "remove" || sub === "off") {
        await updateGuildSettings(message.guild!.id, { welcomeChannelId: null, welcomeMessage: null });
        message.reply({ embeds: [ok("Message de bienvenue désactivé.")] });
      } else if (sub === "test") {
        if (!settings.welcomeChannelId) return void message.reply({ embeds: [err("Aucun salon de bienvenue configuré.")] });
        const ch = message.guild!.channels.cache.get(settings.welcomeChannelId) as any;
        if (!ch) return void message.reply({ embeds: [err("Salon introuvable.")] });
        const fakeMember = message.member!;
        const customMsg = settings.welcomeMessage
          ? settings.welcomeMessage
              .replace(/{user}/g, `<@${fakeMember.id}>`)
              .replace(/{username}/g, fakeMember.user.username)
              .replace(/{server}/g, message.guild!.name)
              .replace(/{count}/g, `${message.guild!.memberCount}`)
          : null;
        ch.send({ embeds: [
          new EmbedBuilder()
            .setColor(0x5865F2)
            .setAuthor({ name: "✨ [TEST] Nouveau membre !", iconURL: message.guild!.iconURL() ?? undefined })
            .setTitle(`Bienvenue, ${fakeMember.user.username} !`)
            .setThumbnail(fakeMember.user.displayAvatarURL({ size: 256 }))
            .setDescription(customMsg ?? `> 👋 <@${fakeMember.id}> vient de rejoindre **${message.guild!.name}** !`)
            .addFields(
              { name: "👤 Compte", value: `<@${fakeMember.id}>`, inline: true },
              { name: "🎉 Membre", value: `${message.guild!.memberCount}ème membre`, inline: true },
            )
            .setFooter({ text: "Ceci est un test du message de bienvenue" })
            .setTimestamp()
        ]}).catch(() => {});
        message.reply({ embeds: [ok("Message de bienvenue de test envoyé !")] });
      } else {
        message.reply({ embeds: [
          info("👋 Système de Bienvenue")
            .addFields(
              { name: "Statut", value: settings.welcomeChannelId ? "🟢 Actif" : "🔴 Inactif", inline: true },
              { name: "Salon", value: settings.welcomeChannelId ? `<#${settings.welcomeChannelId}>` : "Non configuré", inline: true },
              { name: "📝 Message", value: settings.welcomeMessage ?? "*Message par défaut*", inline: false },
              { name: "📌 Variables", value: "`{user}` `{username}` `{server}` `{count}`", inline: false },
            )
            .setFooter({ text: "Sous-commandes: set #salon | message <texte> | test | remove" })
        ]});
      }
    },
  },
  {
    name: "goodbye",
    aliases: ["setgoodbye"],
    category: "Paramètres",
    description: "Configure le message d'au revoir",
    usage: "+goodbye <set #salon | message <texte> | remove | info>",
    permissions: ["ManageGuild"],
    async execute(message, args, settings) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild))
        return void message.reply({ embeds: [err("Tu dois avoir **Gérer le serveur**.")] });
      const sub = args[0]?.toLowerCase();
      if (sub === "set") {
        const ch = message.mentions.channels.first();
        if (!ch) return void message.reply({ embeds: [err("Mentionne un salon.")] });
        await updateGuildSettings(message.guild!.id, { goodbyeChannelId: ch.id });
        message.reply({ embeds: [ok(`Salon d'au revoir configuré dans <#${ch.id}>.`)] });
      } else if (sub === "message") {
        const msg = args.slice(1).join(" ");
        if (!msg) return void message.reply({ embeds: [err("Fournis un message.")] });
        await updateGuildSettings(message.guild!.id, { goodbyeMessage: msg });
        message.reply({ embeds: [ok("Message d'au revoir mis à jour !\n**Variables :** `{user}` `{server}`")] });
      } else if (sub === "remove" || sub === "off") {
        await updateGuildSettings(message.guild!.id, { goodbyeChannelId: null, goodbyeMessage: null });
        message.reply({ embeds: [ok("Message d'au revoir désactivé.")] });
      } else {
        message.reply({ embeds: [
          info("🚪 Système d'Au Revoir")
            .addFields(
              { name: "Statut", value: settings.goodbyeChannelId ? "🟢 Actif" : "🔴 Inactif", inline: true },
              { name: "Salon", value: settings.goodbyeChannelId ? `<#${settings.goodbyeChannelId}>` : "Non configuré", inline: true },
              { name: "📝 Message", value: settings.goodbyeMessage ?? "*Message par défaut*", inline: false },
            )
            .setFooter({ text: "Sous-commandes: set #salon | message <texte> | remove" })
        ]});
      }
    },
  },
  {
    name: "embedcolor",
    aliases: ["setcolor"],
    category: "Paramètres",
    description: "Change la couleur des embeds du bot",
    usage: "+embedcolor <#hex>",
    permissions: ["ManageGuild"],
    async execute(message, args, settings) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild))
        return void message.reply({ embeds: [err("Tu dois avoir **Gérer le serveur**.")] });
      if (!args[0]) return void message.reply({ embeds: [
        info("🎨 Couleur d'embed")
          .setDescription(`Couleur actuelle : **${settings.embedColor}**\nUsage : \`+embedcolor #FF5733\``)
      ]});
      const hex = args[0].replace("#", "");
      if (!/^[0-9A-Fa-f]{6}$/.test(hex))
        return void message.reply({ embeds: [err("Code hex invalide. Ex: `+embedcolor #FF5733`")] });
      await updateGuildSettings(message.guild!.id, { embedColor: `#${hex.toUpperCase()}` });
      message.reply({ embeds: [
        new EmbedBuilder().setColor(parseInt(hex, 16) as any)
          .setTitle("✅ Couleur d'embed changée")
          .setDescription(`Nouvelle couleur : **#${hex.toUpperCase()}**`)
          .setTimestamp()
      ]});
    },
  },
  {
    name: "logcreate",
    aliases: ["createlog", "setuplog"],
    category: "Paramètres",
    description: "Crée automatiquement les salons de logs avec emojis",
    usage: ".logcreate",
    permissions: ["ManageGuild"],
    async execute(message, _args, settings) {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild))
        return void message.reply({ embeds: [err("Tu dois avoir **Gérer le serveur**.")] });

      const loading = await message.reply({ embeds: [
        new EmbedBuilder().setColor(0x5865F2).setTitle("⏳ Création des salons de logs...")
          .setDescription("Configuration en cours, patiente un instant...")
          .setTimestamp()
      ]});

      try {
        const guild = message.guild!;
        const botMember = guild.members.me!;

        // Mod role overwrites (any role with ManageMessages gets view access)
        const modRoles = guild.roles.cache
          .filter((r: any) => r.permissions.has(PermissionFlagsBits.ManageMessages) && !r.managed)
          .map((r: any) => ({ id: r.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory] }));

        const staffOverwrites: any[] = [
          { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: botMember.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
          ...modRoles,
        ];

        // ── Helper: find or create a channel in the category ──
        async function getOrCreate(emoji: string, slug: string, topic: string) {
          let ch = guild.channels.cache.find(
            (c: any) => c.parentId === category?.id && c.name.includes(slug)
          ) as any;
          if (!ch) {
            ch = await guild.channels.create({
              name: `${emoji}・${slug}`,
              type: ChannelType.GuildText,
              parent: category?.id,
              topic,
              permissionOverwrites: staffOverwrites,
            });
          }
          return ch;
        }

        // ── Create / find category ──
        let category = guild.channels.cache.find(
          (c: any) => c.type === ChannelType.GuildCategory && c.name.includes("Logs")
        ) as any;
        if (!category) {
          category = await guild.channels.create({
            name: "📝・Logs",
            type: ChannelType.GuildCategory,
            permissionOverwrites: [
              { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
              { id: botMember.id, allow: [PermissionFlagsBits.ViewChannel] },
            ],
          });
        }

        // ── Create all 6 channels ──
        const [autoLogCh, modLogCh, ticketLogCh, vocalLogCh, serverLogCh, memberLogCh] = await Promise.all([
          getOrCreate("📋", "logs-messages",    "Join/Quitte, messages supprimés/édités."),
          getOrCreate("🔨", "logs-modération",  "Bans, kicks, mutes, warns, cas de modération."),
          getOrCreate("🎫", "logs-tickets",     "Création, fermeture, transcripts des tickets."),
          getOrCreate("🎙️", "logs-vocal",       "Connexions/déconnexions vocales, mute, stream, caméra."),
          getOrCreate("📁", "logs-serveur",     "Salons, rôles, emojis, invitations créés/supprimés/modifiés."),
          getOrCreate("👤", "logs-membres",     "Pseudos, rôles attribués/retirés, timeouts."),
        ]);

        await updateGuildSettings(guild.id, {
          autologChannelId: autoLogCh.id,
          modlogChannelId: modLogCh.id,
          ticketLogChannelId: ticketLogCh.id,
          vocalLogChannelId: vocalLogCh.id,
          serverLogChannelId: serverLogCh.id,
          memberLogChannelId: memberLogCh.id,
        });

        loading.edit({ embeds: [
          new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle("✅ Salons de Logs Créés — 6/6 !")
            .setDescription(`La catégorie **📝・Logs** est prête.\nChaque type d'événement a son propre salon.`)
            .addFields(
              { name: "📋 Messages", value: `<#${autoLogCh.id}>`, inline: true },
              { name: "🔨 Modération", value: `<#${modLogCh.id}>`, inline: true },
              { name: "🎫 Tickets", value: `<#${ticketLogCh.id}>`, inline: true },
              { name: "🎙️ Vocal", value: `<#${vocalLogCh.id}>`, inline: true },
              { name: "📁 Serveur", value: `<#${serverLogCh.id}>`, inline: true },
              { name: "👤 Membres", value: `<#${memberLogCh.id}>`, inline: true },
              { name: "\u200b", value: "Visible uniquement par les rôles avec **Gérer les messages** + le bot.", inline: false },
            )
            .setFooter({ text: guild.name, iconURL: guild.iconURL() ?? undefined })
            .setTimestamp()
        ]});
      } catch (e: any) {
        loading.edit({ embeds: [err(`Erreur : ${e.message ?? "Inconnue"}\nVérifie que j'ai la permission **Gérer les salons**.`)] });
      }
    },
  },
  {
    name: "setup",
    aliases: ["config"],
    category: "Paramètres",
    description: "Affiche la configuration complète du serveur",
    usage: "+setup",
    async execute(message, _args, settings) {
      message.reply({ embeds: [
        new EmbedBuilder()
          .setColor(parseInt(settings.embedColor.replace("#", ""), 16) || 0x5865F2)
          .setAuthor({ name: `⚙️ Configuration — ${message.guild!.name}`, iconURL: message.guild!.iconURL() ?? undefined })
          .setThumbnail(message.guild!.iconURL())
          .addFields(
            { name: "📌 Préfixe", value: `\`${settings.prefix}\``, inline: true },
            { name: "🎨 Couleur embed", value: `\`${settings.embedColor}\``, inline: true },
            { name: "\u200b", value: "\u200b", inline: true },
            { name: "👋 Bienvenue", value: settings.welcomeChannelId ? `<#${settings.welcomeChannelId}>` : "🔴 Désactivé", inline: true },
            { name: "🚪 Au Revoir", value: settings.goodbyeChannelId ? `<#${settings.goodbyeChannelId}>` : "🔴 Désactivé", inline: true },
            { name: "🎭 Auto-rôle", value: settings.autoroleId ? `<@&${settings.autoroleId}>` : "🔴 Désactivé", inline: true },
            { name: "📋 Auto-Log", value: settings.autologChannelId ? `<#${settings.autologChannelId}>` : "🔴 Désactivé", inline: true },
            { name: "🔨 Mod-Log", value: settings.modlogChannelId ? `<#${settings.modlogChannelId}>` : "🔴 Désactivé", inline: true },
            { name: "\u200b", value: "\u200b", inline: true },
            { name: "🛡️ Protections", value: [
              `Anti-Lien: ${settings.antilink ? "🟢" : "🔴"}`,
              `Anti-Invite: ${settings.antiinvite ? "🟢" : "🔴"}`,
              `Anti-Spam: ${settings.antispam ? "🟢" : "🔴"}`,
              `Anti-Caps: ${settings.anticaps ? "🟢" : "🔴"}`,
              `Anti-Mention: ${settings.antimention ? "🟢" : "🔴"}`,
            ].join("\n"), inline: false },
          )
          .setFooter({ text: `ID Serveur: ${message.guild!.id}` })
          .setTimestamp()
      ]});
    },
  },
];
