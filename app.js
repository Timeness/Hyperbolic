import { Bot } from "grammy";
import fs from "fs";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const bot = new Bot(process.env.BOT_TOKEN);
const ownerId = "7875591067";
const questions = JSON.parse(fs.readFileSync("question.json", "utf-8"));

let userData = {};
let approvedUsers = [];
let runningUsers = {};
let botStartTime = Date.now();

try {
  userData = JSON.parse(fs.readFileSync("data.json", "utf-8"));
} catch {
  userData = {};
}

try {
  approvedUsers = JSON.parse(fs.readFileSync("approved.json", "utf-8"));
} catch {
  approvedUsers = [];
}

function saveData() {
  fs.writeFileSync("data.json", JSON.stringify(userData, null, 2));
}

function saveApproved() {
  fs.writeFileSync("approved.json", JSON.stringify(approvedUsers, null, 2));
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
    return res.data.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error("API Error:", err.message);
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
      await new Promise(r => setTimeout(r, 3500));
    }
  };
  run();
}

bot.command("start", async (ctx) => {
  await ctx.reply("Welcome to Hyperbolic AI Node. Use /help to continue.");
});

bot.command("help", async (ctx) => {
  const userId = ctx.from?.id.toString();
  if (runningUsers[userId]?.running) return ctx.reply("Node running. Only /node stop or /node stats allowed.");
  await ctx.reply("Commands :\n/node_key {API Key} - Add Hyperbolic AI Key\n/node run - Run your Hyperbolic AI Node\n/node stop - Stop your Running Node\n/node stats - Check your Hyperbolic Node stats\n\n/help - See again");
});

bot.command("node_key", async (ctx) => {
  const userId = ctx.from?.id.toString();
  const args = ctx.message?.text?.split(" ");
  if (!args || args.length < 2) return ctx.reply("Usage: /node_key {API_KEY}");
  if (userData[userId]) return ctx.reply("Key already added. Contact owner to reset.");
  if (!approvedUsers.includes(userId)) return ctx.reply("You are not approved to run a node. Contact owner.");
  userData[userId] = args[1];
  saveData();
  await ctx.reply("API key saved.");
});

bot.command("node", async (ctx) => {
  const userId = ctx.from?.id.toString();
  const args = ctx.message?.text?.split(" ");
  const sub = args[1];

  if (sub === "run") {
    if (!userData[userId]) return ctx.reply("Set your key first using /node_key");
    if (runningUsers[userId]?.running) return ctx.reply("Already running!");
    runningUsers[userId] = {
      key: userData[userId],
      count: 0,
      start: new Date().toLocaleString(),
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
    return ctx.reply(`Telegram UID: ${userId}\nQuestions Sent: ${stats.count}\nStart Time: ${stats.start}\nRunning: ${stats.running}`);
  }

  await ctx.reply("Unknown command. Use /help");
});

bot.command("stats", async (ctx) => {
  const id = ctx.from?.id.toString();
  if (id !== ownerId) return;

  const totalUsers = Object.keys(userData).length;
  const running = Object.values(runningUsers).filter(x => x.running).length;
  const offline = approvedUsers.filter(uid => !runningUsers[uid]?.running).length;
  const uptime = formatUptime(Date.now() - botStartTime);
  const totalSent = Object.values(runningUsers).reduce((acc, x) => acc + x.count, 0);

  await ctx.reply(
`\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\u26C5\uFE0F Hyperbolic AI Node [None:0:2025]\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n
Users : ${totalUsers}
Running Nodes : ${running}
Offline Nodes : ${offline}
Key Added Users : ${totalUsers}
Hyperbolic Uptime : ${uptime}
Total Questions Sent : ${totalSent}
\nHyperbolic Running Smoothly!`);
});

bot.command("add_node", async (ctx) => {
  const id = ctx.from?.id.toString();
  const args = ctx.message?.text?.split(" ");
  if (id !== ownerId || !args[1]) return;
  if (!approvedUsers.includes(args[1])) {
    approvedUsers.push(args[1]);
    saveApproved();
    await ctx.reply(`Approved ${args[1]} to run node.`);
  } else {
    await ctx.reply(`Already approved.`);
  }
});

bot.command("reset", async (ctx) => {
  const id = ctx.from?.id.toString();
  const args = ctx.message?.text?.split(" ");
  if (id !== ownerId || !args[1]) return;
  delete userData[args[1]];
  if (runningUsers[args[1]]) runningUsers[args[1]].running = false;
  if (!approvedUsers.includes(args[1])) approvedUsers.push(args[1]);
  saveData();
  saveApproved();
  await ctx.reply(`User ${args[1]} has been reset and re-approved.`);
});

function formatUptime(ms) {
  const sec = Math.floor(ms / 1000) % 60;
  const min = Math.floor(ms / 60000) % 60;
  const hr = Math.floor(ms / 3600000) % 24;
  const day = Math.floor(ms / 86400000);
  return `${day}d:${hr}h:${min}m:${sec}s`;
}

bot.on("message", async (ctx) => {
  const userId = ctx.from?.id.toString();
  const msg = ctx.message?.text || "";
  if (msg.startsWith("/node") && runningUsers[userId]?.running) {
    if (!msg.includes("stats") && !msg.includes("stop")) {
      return ctx.reply("Node is running. Only /node stop or /node stats allowed.");
    }
  }
});

bot.start();
