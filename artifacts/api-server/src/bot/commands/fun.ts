import { EmbedBuilder } from "discord.js";
import type { Command } from "../types.js";

const eightBallAnswers = [
  "Oui, absolument ! ✅", "C'est certain. ✅", "Sans aucun doute. ✅",
  "Ne compte pas là-dessus. ❌", "Ma réponse est non. ❌", "Très douteux. ❌",
  "Demande encore plus tard. 🤔", "Difficile à dire. 🤔", "Concentre-toi et redemande. 🤔",
];
const jokes = [
  "Pourquoi les plongeurs plongent-ils toujours en arrière ? Parce que sinon ils tomberaient dans le bateau !",
  "Qu'est-ce qu'un canif ? Un petit fien !",
  "C'est l'histoire de deux amis qui s'appellent... Non et Rien. Non tombe à l'eau. Qui reste-t-il ? Rien.",
  "Pourquoi l'épouvantail a-t-il reçu une récompense ? Parce qu'il était exceptionnel dans son domaine !",
];
const facts = [
  "Les pieuvres ont trois cœurs.", "Le miel ne se périme jamais.",
  "Les flamants roses sont blancs à la naissance.", "Les humains partagent 50% de leur ADN avec les bananes.",
];

function rand<T>(arr: readonly T[]): T { return arr[Math.floor(Math.random() * arr.length)]!; }

export const funCommands: Command[] = [
  {
    name: "8ball",
    aliases: ["8b"],
    category: "Fun",
    description: "Pose une question à la boule magique",
    usage: "+8ball <question>",
    async execute(message, args) {
      if (!args.length) return void message.reply({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription("❌ Pose une question !")] });
      message.reply({ embeds: [
        new EmbedBuilder().setColor(0x9B59B6)
          .setTitle("🎱 Boule Magique")
          .addFields({ name: "❓ Question", value: args.join(" ") }, { name: "🔮 Réponse", value: rand(eightBallAnswers) })
          .setFooter({ text: message.author.tag, iconURL: message.author.displayAvatarURL() })
          .setTimestamp()
      ]});
    },
  },
  {
    name: "coinflip",
    aliases: ["pile", "face"],
    category: "Fun",
    description: "Lance une pièce",
    usage: "+coinflip",
    async execute(message) {
      const result = Math.random() < 0.5;
      message.reply({ embeds: [
        new EmbedBuilder().setColor(result ? 0xF1C40F : 0x95A5A6)
          .setTitle(`🪙 ${result ? "Pile !" : "Face !"}`)
          .setTimestamp()
      ]});
    },
  },
  {
    name: "dice",
    aliases: ["roll", "dé"],
    category: "Fun",
    description: "Lance un dé",
    usage: "+dice [faces]",
    async execute(message, args) {
      const faces = parseInt(args[0] ?? "6") || 6;
      const result = Math.floor(Math.random() * faces) + 1;
      message.reply({ embeds: [
        new EmbedBuilder().setColor(0xE67E22)
          .setTitle(`🎲 Dé à ${faces} faces`)
          .setDescription(`Résultat : **${result}**`)
          .setTimestamp()
      ]});
    },
  },
  {
    name: "joke",
    aliases: ["blague"],
    category: "Fun",
    description: "Raconte une blague",
    usage: "+joke",
    async execute(message) {
      message.reply({ embeds: [new EmbedBuilder().setColor(0xF1C40F).setTitle("😄 Blague").setDescription(rand(jokes)).setTimestamp()] });
    },
  },
  {
    name: "fact",
    aliases: ["anecdote"],
    category: "Fun",
    description: "Un fait intéressant",
    usage: "+fact",
    async execute(message) {
      message.reply({ embeds: [new EmbedBuilder().setColor(0x1ABC9C).setTitle("🧠 Le savais-tu ?").setDescription(rand(facts)).setTimestamp()] });
    },
  },
  {
    name: "rate",
    aliases: ["noter"],
    category: "Fun",
    description: "Note quelque chose sur 10",
    usage: "+rate <chose>",
    async execute(message, args) {
      if (!args.length) return void message.reply({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription("❌ Que veux-tu noter ?")] });
      const score = Math.floor(Math.random() * 11);
      message.reply({ embeds: [
        new EmbedBuilder().setColor(score >= 7 ? 0x2ECC71 : score >= 4 ? 0xF1C40F : 0xED4245)
          .setTitle("⭐ Noteur")
          .setDescription(`**${args.join(" ")}**`)
          .addFields({ name: "Score", value: `${"⭐".repeat(score)}${"☆".repeat(10 - score)} **${score}/10**` })
          .setTimestamp()
      ]});
    },
  },
  {
    name: "ship",
    category: "Fun",
    description: "Compatibilité entre deux personnes",
    usage: "+ship @user1 @user2",
    async execute(message) {
      const users = [...message.mentions.users.values()];
      if (users.length < 2) return void message.reply({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription("❌ Mentionne 2 utilisateurs.")] });
      const score = Math.floor(Math.random() * 101);
      const hearts = Math.round(score / 10);
      message.reply({ embeds: [
        new EmbedBuilder().setColor(0xE91E63)
          .setTitle("💕 Compatibilité")
          .setDescription(`**${users[0]!.username}** 💘 **${users[1]!.username}**`)
          .addFields({ name: "Score", value: `${"❤️".repeat(hearts)}${"🖤".repeat(10 - hearts)} **${score}%**` })
          .setTimestamp()
      ]});
    },
  },
  {
    name: "choose",
    aliases: ["choix"],
    category: "Fun",
    description: "Choisit parmi plusieurs options",
    usage: "+choose <opt1 | opt2 | ...>",
    async execute(message, args) {
      const options = args.join(" ").split("|").map(s => s.trim()).filter(Boolean);
      if (options.length < 2) return void message.reply({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription("❌ Donne au moins 2 options séparées par `|`.")] });
      message.reply({ embeds: [new EmbedBuilder().setColor(0x2ECC71).setTitle("🎯 Mon choix").setDescription(`**${rand(options)}**`).setTimestamp()] });
    },
  },
  {
    name: "wyr",
    category: "Fun",
    description: "Tu préfèrerais...?",
    usage: "+wyr <opt1 | opt2>",
    async execute(message, args) {
      const parts = args.join(" ").split("|").map(s => s.trim());
      if (parts.length < 2) return void message.reply({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription("❌ Sépare les options avec `|`.")] });
      const msg = await (message.channel as any).send({ embeds: [
        new EmbedBuilder().setColor(0x9B59B6)
          .setTitle("🤔 Tu préfèrerais... ?")
          .addFields({ name: "🅰️ Option A", value: parts[0]!, inline: true }, { name: "🅱️ Option B", value: parts[1]!, inline: true })
          .setTimestamp()
      ]});
      await msg.react("🅰️");
      await msg.react("🅱️");
    },
  },
  {
    name: "iq",
    category: "Fun",
    description: "Calcule ton QI (humour)",
    usage: "+iq [@membre]",
    async execute(message) {
      const target = message.mentions.users.first() ?? message.author;
      const score = Math.floor(Math.random() * 201);
      message.reply({ embeds: [
        new EmbedBuilder().setColor(score > 120 ? 0x2ECC71 : score > 80 ? 0xF1C40F : 0xED4245)
          .setTitle("🧠 Test de QI")
          .setThumbnail(target.displayAvatarURL())
          .setDescription(`**${target.username}** a un QI de **${score}** !`)
          .setTimestamp()
      ]});
    },
  },
  {
    name: "love",
    aliases: ["lovetest"],
    category: "Fun",
    description: "Calcule l'amour entre deux personnes",
    usage: "+love @user1 @user2",
    async execute(message) {
      const users = [...message.mentions.users.values()];
      const u1 = users[0] ?? message.author;
      const u2 = users[1] ?? message.author;
      const score = Math.floor(Math.random() * 101);
      message.reply({ embeds: [
        new EmbedBuilder().setColor(0xE91E63)
          .setTitle("❤️ Amouromètre")
          .setDescription(`**${u1.username}** 💘 **${u2.username}**`)
          .addFields({ name: "Score", value: `${"❤️".repeat(Math.round(score / 10))} **${score}%**` })
          .setTimestamp()
      ]});
    },
  },
  {
    name: "rps",
    aliases: ["shifumi"],
    category: "Fun",
    description: "Pierre-Feuille-Ciseaux",
    usage: "+rps <pierre|feuille|ciseaux>",
    async execute(message, args) {
      const choices = ["pierre", "feuille", "ciseaux"] as const;
      const emojis: Record<string, string> = { pierre: "🪨", feuille: "📄", ciseaux: "✂️" };
      const user = args[0]?.toLowerCase() as typeof choices[number];
      if (!(choices as readonly string[]).includes(user))
        return void message.reply({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription("❌ Choisis `pierre`, `feuille` ou `ciseaux`.")] });
      const bot = rand(choices) as string;
      let result = "Égalité ! 🤝";
      if ((user === "pierre" && bot === "ciseaux") || (user === "feuille" && bot === "pierre") || (user === "ciseaux" && bot === "feuille"))
        result = "Tu as gagné ! 🎉";
      else if (user !== bot) result = "J'ai gagné ! 😎";
      message.reply({ embeds: [
        new EmbedBuilder().setColor(result.includes("gagné") && !result.includes("J'ai") ? 0x2ECC71 : result.includes("J'ai") ? 0xED4245 : 0xF1C40F)
          .setTitle("✊ Pierre-Feuille-Ciseaux")
          .addFields(
            { name: "Toi", value: `${emojis[user]} ${user}`, inline: true },
            { name: "Moi", value: `${emojis[bot]} ${bot}`, inline: true },
            { name: "Résultat", value: result },
          )
          .setTimestamp()
      ]});
    },
  },
];
