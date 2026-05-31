import type { Message, Client } from "discord.js";
import type { GuildSettings } from "@workspace/db";

export interface Command {
  name: string;
  aliases?: string[];
  category: string;
  description: string;
  usage?: string;
  permissions?: string[];
  ownerOnly?: boolean;
  execute(message: Message, args: string[], settings: GuildSettings, client: Client): Promise<void>;
}

export interface BotClient extends Client {
  commands: Map<string, Command>;
  aliases: Map<string, string>;
  categories: Map<string, Command[]>;
  startTime: Date;
}
