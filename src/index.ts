import { posix } from "path";
import { Context, Schema } from "koishi";

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
  atTrigger: Schema.boolean().default(true).description("@机器人触发对话"),
  keywordTrigger: Schema.boolean()
    .default(false)
    .description("检测关键词触发对话"),
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

async function openChat(ctx: Context) {
  const url = posix.join(ctx.config.baseUrl, "chat/open");
  const res = await ctx.http.get(url, {
    headers: { Authorization: ctx.config.apikey },
  });
  return res.data;
}

async function chat(ctx: Context, message: string, chatId: string) {
  const url = posix.join(ctx.config.baseUrl, "../chat_message", chatId);
  const res = await ctx.http.post(
    url,
    { message, stream: false },
    { headers: { Authorization: ctx.config.apikey } }
  );
  return res.data.content;
}

export function apply(ctx: Context) {
  const keyword = new RegExp(ctx.config.keyword);
  ctx.model.extend("maxkb", {
    id: "string",
    chatId: "string",
  });

  ctx.on("message", async (session) => {
    if (
      (session.stripped.atSelf && ctx.config.atTrigger) ||
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
      session.send(await chat(ctx, session.content, chatId));
    }
  });
}
