import {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import type { Command, BotClient } from "../types.js";

// ─── CONFIG ───────────────────────────────────────────────────────────────────

const CAT_META: Record<string, { emoji: string; color: number; desc: string }> = {
  "Modération":  { emoji: "🔨", color: 0xED4245, desc: "Gérer les membres, bans, mutes, cas" },
  "Utilitaire":  { emoji: "🛠️", color: 0x3498DB, desc: "AFK, écrire avec le bot, outils divers" },
  "Fun":         { emoji: "🎮", color: 0xF1C40F, desc: "Mini-jeux et commandes amusantes" },
  "Paramètres":  { emoji: "⚙️", color: 0x2ECC71, desc: "Configurer le bot sur ce serveur" },
  "Profil":      { emoji: "👤", color: 0x9B59B6, desc: "Profil, niveaux et statistiques" },
  "Info":        { emoji: "📋", color: 0x5865F2, desc: "Informations sur le bot et le serveur" },
  "Protection":  { emoji: "🛡️", color: 0xE74C3C, desc: "Anti-spam, anti-lien, anti-caps…" },
  "Tickets":     { emoji: "🎫", color: 0x57F287, desc: "Système de tickets de support" },
};

const DEFAULT_META = { emoji: "📌", color: 0x5865F2, desc: "Commandes diverses" };

function getCatMeta(cat: string) { return CAT_META[cat] ?? DEFAULT_META; }

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}j ${h % 24}h ${m % 60}m`;
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m ${s % 60}s`;
}

// ─── MAIN EMBED ───────────────────────────────────────────────────────────────

function buildMainEmbed(
  client: BotClient,
  categories: Map<string, Command[]>,
  prefix: string,
  requestor: any,
): EmbedBuilder {
  const uptime = formatUptime(Date.now() - client.startTime.getTime());
  const totalCmds = client.commands.size;
  const totalCats = categories.size;
  const serverCount = client.guilds.cache.size;

  const catLines = Array.from(categories.entries())
    .map(([cat, cmds]) => {
      const m = getCatMeta(cat);
      return `${m.emoji} **${cat}** \`${cmds.length}\``;
    })
    .join("  •  ");

  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setAuthor({
      name: `${client.user?.username} — Panneau d'aide`,
      iconURL: client.user?.displayAvatarURL(),
    })
    .setThumbnail(client.user?.displayAvatarURL() ?? null)
    .setDescription(
      `> Bienvenue dans l'aide de **${client.user?.username}** !\n` +
      `> Utilise le **menu déroulant** ci-dessous pour explorer les catégories.\n` +
      `> Tape \`${prefix}help <commande>\` pour les détails d'une commande.\n\u200b`
    )
    .addFields(
      {
        name: "📊 Statistiques",
        value: [
          `> 💬 **Commandes :** \`${totalCmds}\``,
          `> 📂 **Catégories :** \`${totalCats}\``,
          `> 🌐 **Serveurs :** \`${serverCount}\``,
          `> ⏱️ **Uptime :** \`${uptime}\``,
        ].join("\n"),
        inline: true,
      },
      {
        name: "⚡ Accès Rapide",
        value: [
          `> \`${prefix}help <cmd>\` — Détails d'une commande`,
          `> \`${prefix}setup\` — Config du serveur`,
          `> \`${prefix}ticketsetup panel\` — Panel tickets`,
          `> \`${prefix}protection\` — Tableau protections`,
        ].join("\n"),
        inline: true,
      },
      {
        name: `📚 Catégories (${totalCats})`,
        value: catLines || "Aucune catégorie",
        inline: false,
      },
    )
    .setFooter({
      text: `Demandé par ${requestor.tag} • Préfixe: ${prefix}`,
      iconURL: requestor.displayAvatarURL(),
    })
    .setTimestamp();
}

// ─── CATEGORY EMBED ───────────────────────────────────────────────────────────

function buildCategoryEmbed(
  cat: string,
  cmds: Command[],
  prefix: string,
): EmbedBuilder {
  const m = getCatMeta(cat);

  const cmdLines = cmds.map(cmd => {
    const aliases = cmd.aliases?.length ? ` *(${cmd.aliases.slice(0, 3).join(", ")})*` : "";
    const perm = cmd.permissions?.length ? ` 🔒` : "";
    return `**\`${prefix}${cmd.name}\`**${aliases}${perm}\n╰ ${cmd.description}`;
  }).join("\n\n");

  return new EmbedBuilder()
    .setColor(m.color)
    .setAuthor({ name: `${m.emoji} Catégorie — ${cat}` })
    .setDescription(
      `*${m.desc}*\n\u200b\n` +
      (cmdLines.slice(0, 3900) || "Aucune commande")
    )
    .addFields({
      name: "ℹ️ Infos",
      value: `\`${cmds.length}\` commande(s) • 🔒 = permission requise • \`${prefix}help <nom>\` pour détails`,
    })
    .setTimestamp();
}

// ─── COMMAND DETAIL EMBED ─────────────────────────────────────────────────────

function buildCmdEmbed(cmd: Command, prefix: string): EmbedBuilder {
  const m = getCatMeta(cmd.category);
  return new EmbedBuilder()
    .setColor(m.color)
    .setAuthor({ name: `${m.emoji} ${cmd.category} — ${cmd.name}` })
    .setTitle(`📖 \`${prefix}${cmd.name}\``)
    .setDescription(`> ${cmd.description}`)
    .addFields(
      {
        name: "⌨️ Usage",
        value: `\`${(cmd.usage ?? `${prefix}${cmd.name}`).replace(/^\+/, prefix)}\``,
        inline: false,
      },
      {
        name: "🔀 Aliases",
        value: cmd.aliases?.length ? cmd.aliases.map(a => `\`${a}\``).join(", ") : "Aucun",
        inline: true,
      },
      {
        name: "🔑 Permissions",
        value: cmd.permissions?.length ? cmd.permissions.map(p => `\`${p}\``).join(", ") : "Aucune",
        inline: true,
      },
      {
        name: "📂 Catégorie",
        value: `${m.emoji} ${cmd.category}`,
        inline: true,
      },
    )
    .setTimestamp();
}

// ─── SELECT MENU BUILDER ──────────────────────────────────────────────────────

function buildSelectMenu(categories: Map<string, Command[]>): ActionRowBuilder<StringSelectMenuBuilder> {
  const options = Array.from(categories.entries()).map(([cat, cmds]) => {
    const m = getCatMeta(cat);
    return new StringSelectMenuOptionBuilder()
      .setLabel(cat)
      .setDescription(`${cmds.length} commande(s) — ${m.desc.slice(0, 50)}`)
      .setEmoji(m.emoji)
      .setValue(cat);
  });

  const menu = new StringSelectMenuBuilder()
    .setCustomId("help_category")
    .setPlaceholder("📂 Explorer une catégorie...")
    .addOptions(options);

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

function buildBackRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("help_back")
      .setLabel("← Retour")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🏠"),
  );
}

// ─── EXPORTED COMMANDS ────────────────────────────────────────────────────────

export const helpCommands: Command[] = [
  {
    name: "help",
    aliases: ["aide", "h", "?"],
    category: "Info",
    description: "Affiche toutes les commandes avec navigation interactive",
    usage: "+help [commande]",
    async execute(message, args, settings, client) {
      const bot = client as BotClient;
      const prefix = settings.prefix;

      // ── Specific command lookup ──
      if (args[0]) {
        const cmd =
          bot.commands.get(args[0].toLowerCase()) ??
          bot.commands.get(bot.aliases.get(args[0].toLowerCase()) ?? "");
        if (!cmd)
          return void message.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle("❌ Commande introuvable")
                .setDescription(`Aucune commande \`${args[0]}\` n'existe.\nTape \`${prefix}help\` pour voir toutes les commandes.`)
                .setTimestamp(),
            ],
          });
        return void message.reply({ embeds: [buildCmdEmbed(cmd, prefix)] });
      }

      // ── Build categories ──
      const categories = new Map<string, Command[]>();
      for (const cmd of bot.commands.values()) {
        if (!categories.has(cmd.category)) categories.set(cmd.category, []);
        categories.get(cmd.category)!.push(cmd);
      }

      const mainEmbed = buildMainEmbed(bot, categories, prefix, message.author);
      const selectRow = buildSelectMenu(categories);

      const helpMsg = await message.reply({ embeds: [mainEmbed], components: [selectRow] });

      const collector = helpMsg.createMessageComponentCollector({
        time: 120_000,
        filter: (i) => i.user.id === message.author.id,
      });

      collector.on("collect", async (interaction) => {
        // Back button → main page
        if (interaction.isButton() && interaction.customId === "help_back") {
          await interaction.update({ embeds: [mainEmbed], components: [selectRow] });
          return;
        }
        // Select menu → category page
        if (interaction.isStringSelectMenu() && interaction.customId === "help_category") {
          const selected = interaction.values[0]!;
          const cmds = categories.get(selected) ?? [];
          const catEmbed = buildCategoryEmbed(selected, cmds, prefix);
          const backRow = buildBackRow();
          const newSelect = buildSelectMenu(categories);
          await interaction.update({ embeds: [catEmbed], components: [newSelect, backRow] });
        }
      });

      collector.on("end", () => {
        helpMsg.edit({ components: [] }).catch(() => {});
      });
    },
  },

  {
    name: "botinfo",
    aliases: ["bot", "info"],
    category: "Info",
    description: "Affiche les informations du bot",
    usage: "+botinfo",
    async execute(message, _args, _s, client) {
      const bot = client as BotClient;
      const uptime = formatUptime(Date.now() - bot.startTime.getTime());
      const mem = process.memoryUsage();
      const memMB = (mem.heapUsed / 1024 / 1024).toFixed(1);
      message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865F2)
            .setAuthor({ name: client.user?.username ?? "LIGHT bot", iconURL: client.user?.displayAvatarURL() })
            .setThumbnail(client.user?.displayAvatarURL() ?? null)
            .setTitle("🤖 Informations du Bot")
            .addFields(
              { name: "🏷️ Nom", value: `\`${client.user?.tag}\``, inline: true },
              { name: "🆔 ID", value: `\`${client.user?.id}\``, inline: true },
              { name: "📅 Créé le", value: `<t:${Math.floor((client.user?.createdTimestamp ?? 0) / 1000)}:D>`, inline: true },
              { name: "⏱️ Uptime", value: `\`${uptime}\``, inline: true },
              { name: "🌐 Serveurs", value: `\`${client.guilds.cache.size}\``, inline: true },
              { name: "👥 Utilisateurs", value: `\`${client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)}\``, inline: true },
              { name: "💬 Commandes", value: `\`${bot.commands.size}\``, inline: true },
              { name: "📂 Catégories", value: `\`${bot.categories.size}\``, inline: true },
              { name: "🧠 RAM", value: `\`${memMB} MB\``, inline: true },
            )
            .setFooter({ text: "discord.js v14 • Node.js " + process.version, iconURL: client.user?.displayAvatarURL() })
            .setTimestamp(),
        ],
      });
    },
  },

  {
    name: "ping",
    aliases: ["latency", "pong"],
    category: "Info",
    description: "Affiche la latence du bot",
    usage: "+ping",
    async execute(message, _a, _s, client) {
      const start = Date.now();
      const msg = await message.reply({ embeds: [new EmbedBuilder().setColor(0xF0B232).setDescription("📡 Mesure de la latence...")] });
      const roundtrip = Date.now() - start;
      const ws = Math.round(client.ws.ping);
      const color = ws < 100 ? 0x2ECC71 : ws < 250 ? 0xF0B232 : 0xED4245;
      msg.edit({ embeds: [
        new EmbedBuilder()
          .setColor(color)
          .setTitle("🏓 Pong !")
          .addFields(
            { name: "📡 WebSocket", value: `\`${ws}ms\``, inline: true },
            { name: "⏱️ Aller-Retour", value: `\`${roundtrip}ms\``, inline: true },
            { name: "💚 Statut", value: ws < 100 ? "Excellent" : ws < 250 ? "Bon" : "Lent", inline: true },
          )
          .setTimestamp(),
      ]});
    },
  },

  {
    name: "serverinfo",
    aliases: ["guildinfo", "serveur"],
    category: "Info",
    description: "Informations sur le serveur",
    usage: "+serverinfo",
    async execute(message) {
      const g = message.guild!;
      await g.fetch();
      const channels = g.channels.cache;
      const textCount = channels.filter(c => c.type === 0).size;
      const voiceCount = channels.filter(c => c.type === 2).size;
      const categories = channels.filter(c => c.type === 4).size;
      const boosts = g.premiumSubscriptionCount ?? 0;
      const boostTier = g.premiumTier;
      const verif = ["Aucune", "Faible", "Moyenne", "Élevée", "Très élevée"][g.verificationLevel] ?? "Inconnue";

      message.reply({ embeds: [
        new EmbedBuilder()
          .setColor(0x5865F2)
          .setAuthor({ name: g.name, iconURL: g.iconURL() ?? undefined })
          .setThumbnail(g.iconURL())
          .setTitle("🏰 Informations du Serveur")
          .addFields(
            { name: "🆔 ID", value: `\`${g.id}\``, inline: true },
            { name: "👑 Propriétaire", value: `<@${g.ownerId}>`, inline: true },
            { name: "📅 Créé", value: `<t:${Math.floor(g.createdTimestamp / 1000)}:D>`, inline: true },
            { name: "👥 Membres", value: `\`${g.memberCount}\``, inline: true },
            { name: "🎭 Rôles", value: `\`${g.roles.cache.size}\``, inline: true },
            { name: "😀 Emojis", value: `\`${g.emojis.cache.size}\``, inline: true },
            { name: "💬 Salons Texte", value: `\`${textCount}\``, inline: true },
            { name: "🔊 Salons Vocal", value: `\`${voiceCount}\``, inline: true },
            { name: "📁 Catégories", value: `\`${categories}\``, inline: true },
            { name: "🚀 Boosts", value: `\`${boosts}\` — Tier ${boostTier}`, inline: true },
            { name: "🔒 Vérification", value: verif, inline: true },
            { name: "🌍 Région", value: g.preferredLocale, inline: true },
          )
          .setImage(g.bannerURL({ size: 1024 }) ?? null)
          .setFooter({ text: `Demandé par ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
          .setTimestamp(),
      ]});
    },
  },

  {
    name: "userinfo",
    aliases: ["profil", "ui"],
    category: "Info",
    description: "Informations sur un utilisateur",
    usage: "+userinfo [@membre]",
    async execute(message) {
      const target = message.mentions.members?.first() ?? message.member!;
      const u = target.user;
      const roles = target.roles.cache
        .filter(r => r.id !== message.guild!.roles.everyone.id)
        .sort((a, b) => b.position - a.position)
        .map(r => `<@&${r.id}>`)
        .slice(0, 8)
        .join(" ");
      const badges = [];
      if (u.flags?.has("Staff")) badges.push("👨‍💼 Discord Staff");
      if (u.flags?.has("Partner")) badges.push("🤝 Partenaire");
      if (u.flags?.has("HypeSquadOnlineHouse1")) badges.push("🏠 HypeSquad Bravery");
      if (u.flags?.has("ActiveDeveloper")) badges.push("👨‍💻 Développeur Actif");
      if (u.bot) badges.push("🤖 Bot");

      message.reply({ embeds: [
        new EmbedBuilder()
          .setColor(target.displayColor || 0x5865F2)
          .setAuthor({ name: u.tag, iconURL: u.displayAvatarURL() })
          .setThumbnail(u.displayAvatarURL({ size: 256 }))
          .addFields(
            { name: "🆔 ID", value: `\`${u.id}\``, inline: true },
            { name: "📛 Surnom", value: target.nickname ?? "*Aucun*", inline: true },
            { name: "🤖 Bot", value: u.bot ? "✅ Oui" : "❌ Non", inline: true },
            { name: "📅 Compte créé", value: `<t:${Math.floor(u.createdTimestamp / 1000)}:R>`, inline: true },
            { name: "📥 A rejoint", value: target.joinedTimestamp ? `<t:${Math.floor(target.joinedTimestamp / 1000)}:R>` : "Inconnu", inline: true },
            { name: "🎭 Rôle Principal", value: `<@&${target.roles.highest.id}>`, inline: true },
            { name: `🎭 Rôles (${target.roles.cache.size - 1})`, value: roles || "*Aucun*", inline: false },
            ...(badges.length ? [{ name: "🏅 Badges", value: badges.join("\n"), inline: false }] : []),
          )
          .setFooter({ text: `Demandé par ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
          .setTimestamp(),
      ]});
    },
  },

  {
    name: "commands",
    aliases: ["cmds"],
    category: "Info",
    description: "Liste toutes les commandes en texte brut",
    usage: "+commands",
    async execute(message, _args, settings, client) {
      const bot = client as BotClient;
      const prefix = settings.prefix;
      const categories = new Map<string, Command[]>();
      for (const cmd of bot.commands.values()) {
        if (!categories.has(cmd.category)) categories.set(cmd.category, []);
        categories.get(cmd.category)!.push(cmd);
      }
      const lines = Array.from(categories.entries()).map(([cat, cmds]) => {
        const m = getCatMeta(cat);
        return `${m.emoji} **${cat}**\n${cmds.map(c => `\`${prefix}${c.name}\``).join(" ")}`;
      }).join("\n\n");
      message.reply({ embeds: [
        new EmbedBuilder()
          .setColor(0x5865F2)
          .setAuthor({ name: `📋 ${client.user?.username} — Toutes les commandes`, iconURL: client.user?.displayAvatarURL() })
          .setDescription(lines.slice(0, 4096))
          .setFooter({ text: `${bot.commands.size} commandes • ${bot.categories.size} catégories • Préfixe: ${prefix}` })
          .setTimestamp(),
      ]});
    },
  },

  {
    name: "botinvite",
    aliases: ["invite", "addbot"],
    category: "Info",
    description: "Lien pour inviter le bot sur ton serveur",
    usage: "+botinvite",
    async execute(message, _a, _s, client) {
      const bot = client as BotClient;
      const url = `https://discord.com/oauth2/authorize?client_id=${client.user?.id}&permissions=8&scope=bot`;
      message.reply({ embeds: [
        new EmbedBuilder()
          .setColor(0x5865F2)
          .setAuthor({ name: `Inviter ${client.user?.username}`, iconURL: client.user?.displayAvatarURL() })
          .setThumbnail(client.user?.displayAvatarURL() ?? null)
          .setDescription(
            `[**🔗 Clique ici pour m'ajouter à ton serveur !**](${url})\n\n` +
            `> ✅ Plus de **${bot.commands.size}** commandes\n` +
            `> 🛡️ Protection & modération avancée\n` +
            `> 🎫 Système de tickets complet\n` +
            `> ⚙️ Entièrement configurable`
          )
          .setFooter({ text: client.user?.tag ?? "", iconURL: client.user?.displayAvatarURL() })
          .setTimestamp(),
      ]});
    },
  },
];
