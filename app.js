import { Bot } from "grammy";
import fs from "fs";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const bot = new Bot(process.env.BOT_TOKEN);

const questions = JSON.parse(fs.readFileSync("question.json", "utf-8"));
let userData = loadData();
let runningUsers = {};

function loadData() {
  try {
    return JSON.parse(fs.readFileSync("data.json", "utf-8"));
  } catch {
    return {};
  }
}

function saveData() {
  fs.writeFileSync("data.json", JSON.stringify(userData, null, 2));
}

async function sendChatRequest(apiKey, question) {
  try {
    const res = await axios.post("https://api.hyperbolic.xyz/v1/chat/completions", {
      messages: [{ role: "user", content: question }],
      model: "meta-llama/Meta-Llama-3.1-8B-Instruct",
      max_tokens: 2048,
      temperature: 0.7,
      top_p: 0.9
    }, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      }
    });
    return res.data.choices[0].message.content;
  } catch {
    return null;
  }
}

function startNode(userId) {
  const stats = runningUsers[userId];
  const run = async () => {
    while (stats.running) {
      const question = questions[Math.floor(Math.random() * questions.length)];
      await sendChatRequest(stats.key, question);
      stats.count++;
      await new Promise(r => setTimeout(r, stats.gap * 1000));
    }
  };
  run();
}

bot.command("start", async (ctx) => {
  await ctx.reply("Welcome to the AI Node Bot! Use /help to begin.");
});

bot.command("help", async (ctx) => {
  const userId = ctx.from?.id.toString() || "";
  if (runningUsers[userId]?.running) {
    await ctx.reply("Node is running, only /node stop or /node stats allowed.");
    return;
  }
  await ctx.reply(
`Commands:
/node_key <API Key>
/node run
/node stop
/node stats
/node gap <seconds>
/help`);
});

bot.command("node_key", async (ctx) => {
  const userId = ctx.from?.id.toString() || "";
  const args = ctx.message?.text?.split(" ");
  if (!args || args.length < 2) return ctx.reply("Usage: /node_key <API_KEY>");
  if (runningUsers[userId]?.running) return ctx.reply("Node is running. Stop it before changing key.");
  userData[userId] = args[1];
  saveData();
  await ctx.reply("API key saved.");
});

bot.command("node", async (ctx) => {
  const userId = ctx.from?.id.toString() || "";
  const args = ctx.message?.text?.split(" ");
  const sub = args[1];

  if (sub === "run") {
    if (!userData[userId]) return ctx.reply("Set your key first using /node_key");
    if (runningUsers[userId]?.running) return ctx.reply("Already running!");
    runningUsers[userId] = {
      key: userData[userId],
      count: 0,
      start: new Date().toLocaleString(),
      gap: 20,
      running: true
    };
    startNode(userId);
    return ctx.reply("Node started!");
  }

  if (sub === "stop") {
    if (runningUsers[userId]) {
      runningUsers[userId].running = false;
      return ctx.reply("Node stopped.");
    }
    return ctx.reply("No running node.");
  }

  if (sub === "stats") {
    const stats = runningUsers[userId];
    if (!stats) return ctx.reply("No stats available.");
    return ctx.reply(
`Telegram UID: ${userId}
Questions Sent: ${stats.count}
Start Time: ${stats.start}
Gap: ${stats.gap}s
Running: ${stats.running}`);
  }

  if (sub === "gap") {
    const gap = parseInt(args[2]);
    if (isNaN(gap) || gap < 10 || gap > 60) return ctx.reply("Gap must be 10-60 seconds.");
    if (!runningUsers[userId]) return ctx.reply("Run node first.");
    runningUsers[userId].gap = gap;
    return ctx.reply("Gap updated.");
  }

  return ctx.reply("Unknown command. Use /help");
});

bot.on("message", async (ctx) => {
  const userId = ctx.from?.id.toString() || "";
  const msg = ctx.message?.text || "";
  if (msg.startsWith("/node") && runningUsers[userId]?.running) {
    if (!msg.includes("stats") && !msg.includes("stop")) {
      return ctx.reply("Node is running. Only /node stop or /node stats allowed.");
    }
  }
});

bot.start();
