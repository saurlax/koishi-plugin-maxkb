import { Context, Schema } from "koishi";
import { transform } from "koishi-plugin-markdown";
import { chat, openChat } from "./maxkb";

export const name = "maxkb";

export const inject = ["database", "http"];

export interface Config {
  baseUrl: string;
  apikey: string;
  atTrigger: boolean;
  keywordTrigger: boolean;
  keyword: string;
}

export const Config: Schema<Config> = Schema.object({
  baseUrl: Schema.string().description("MaxKB 应用的 Base URL"),
  apikey: Schema.string().description("MaxKB 应用的 API Key").role("secret"),
  privateChatTrigger: Schema.boolean()
    .default(true)
    .description("是否允许私聊触发对话"),
  atTrigger: Schema.boolean()
    .default(true)
    .description("是否允许@机器人触发对话"),
  keywordTrigger: Schema.boolean()
    .default(false)
    .description("是否检测关键词触发对话"),
  keyword: Schema.string().description("检测关键词的正则表达式"),
});

export interface MaxKBChat {
  id: string;
  chatId: string;
}

declare module "koishi" {
  interface Tables {
    maxkb: MaxKBChat;
  }
}

export function apply(ctx: Context) {
  const keyword = new RegExp(ctx.config.keyword);
  ctx.model.extend("maxkb", {
    id: "string",
    chatId: "string",
  });

  ctx.middleware(async (session, next) => {
    if (
      (session.stripped.atSelf && ctx.config.atTrigger) ||
      (session.isDirect && ctx.config.privateChatTrigger) ||
      (ctx.config.keywordTrigger && session.content.match(keyword))
    ) {
      const chats = await ctx.database.get("maxkb", session.channelId);
      let chatId: string;
      if (chats.length > 0) {
        chatId = chats[0].chatId;
      } else {
        chatId = await openChat(ctx);
        await ctx.database.create("maxkb", { id: session.channelId, chatId });
      }
      const rawAnswer = await chat(ctx, session.content, chatId);
      session.send(transform(rawAnswer));
    }
  });
}
