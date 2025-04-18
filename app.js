import { Bot } from "grammy";
import fs from "fs";
import axios from "axios";

const bot = new Bot("8086347655:AAGXmyMQ6HyMa0aV2C-rSaCtsYhipz-3Tkk");;

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
    const response = await axios.post("https://api.hyperbolic.xyz/v1/chat/completions", {
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
    return response.data.choices[0].message.content;
  } catch {
    return null;
  }
}

function startNode(userId, ctx) {
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

bot.command("help", async (ctx) => {
  const userId = ctx.from?.id.toString() || "";
  if (runningUsers[userId]?.running) {
    await ctx.reply("Node is running, you can't use this command right now!");
    return;
  }
  await ctx.reply(
`Commands:
/node_key <API Key> - Set your Hyperbolic API key
/node run - Start your AI node
/node stop - Stop your node
/node stats - Show current session stats
/node gap <seconds> - Set gap between requests (10-60)
/help - Show this help message`);
});

bot.command("node_key", async (ctx) => {
  const userId = ctx.from?.id.toString() || "";
  if (runningUsers[userId]?.running) {
    await ctx.reply("Node is running, you can't change the key now.");
    return;
  }
  const args = ctx.message?.text?.split(" ");
  if (!args || args.length < 2) {
    await ctx.reply("Usage: /node_key <API Key>");
    return;
  }
  userData[userId] = args[1];
  saveData();
  await ctx.reply("API Key saved successfully!");
});

bot.command("node", async (ctx) => {
  const userId = ctx.from?.id.toString() || "";
  const text = ctx.message?.text || "";
  const args = text.split(" ");
  const subCmd = args[1];

  if (subCmd === "run") {
    if (!userData[userId]) {
      await ctx.reply("You need to setup your API key using /node_key");
      return;
    }
    if (runningUsers[userId]?.running) {
      await ctx.reply("Your node is already running!");
      return;
    }
    runningUsers[userId] = {
      key: userData[userId],
      count: 0,
      start: new Date().toLocaleString(),
      gap: 20,
      running: true
    };
    startNode(userId, ctx);
    await ctx.reply("Your AI node has started!");
  }

  else if (subCmd === "stop") {
    if (runningUsers[userId]) {
      runningUsers[userId].running = false;
      await ctx.reply("Your AI node has been stopped.");
    } else {
      await ctx.reply("No active node to stop.");
    }
  }

  else if (subCmd === "stats") {
    if (runningUsers[userId]) {
      const stats = runningUsers[userId];
      await ctx.reply(
`Telegram UID: ${userId}
Question Number: ${stats.count}
Starting Time: ${stats.start}
Gap: ${stats.gap} seconds
Running: ${stats.running}`
      );
    } else {
      await ctx.reply("No active session or stats available.");
    }
  }

  else if (subCmd === "gap") {
    const gapSec = parseInt(args[2]);
    if (isNaN(gapSec) || gapSec < 10 || gapSec > 60) {
      await ctx.reply("Please provide a valid number between 10 and 60.");
      return;
    }
    if (!runningUsers[userId]) {
      await ctx.reply("Start your node first using /node run.");
      return;
    }
    runningUsers[userId].gap = gapSec;
    await ctx.reply(`Gap has been updated to ${gapSec} seconds.`);
  }

  else {
    await ctx.reply("Unknown subcommand. Use /help to see available options.");
  }
});

bot.command("start", async (ctx) => {
  await ctx.reply("Welcome! Use /help to get started.");
});

bot.on("message", async (ctx) => {
  const userId = ctx.from?.id.toString() || "";
  const msg = ctx.message?.text || "";
  if (msg.startsWith("/node") && runningUsers[userId]?.running) {
    if (!msg.includes("stats") && !msg.includes("stop")) {
      await ctx.reply("Node is running, only /node stats and /node stop are allowed.");
    }
  }
});

bot.start();
