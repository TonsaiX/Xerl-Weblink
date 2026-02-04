/**
 * apps/bot/src/index.js
 * -------------------------------------------------------
 * ✅ Fix intents: ใช้แค่ Guilds (กัน disallowed intents / ไม่ต้องเปิด Message Content)
 * ✅ Fix interactions: deferReply ให้เร็ว และตอบด้วย editReply เท่านั้น (กัน Unknown interaction / ack ซ้ำ)
 * ✅ Fix API error debug: log URL + status + response body แยก field ชัดเจน
 * ✅ Configurable API endpoint: API_SETROLE_PATH
 * ✅ Support API auth: API_KEY / API_TOKEN ส่งเป็น Bearer
 * ✅ Fallback: ถ้า API save ไม่ได้ -> ตั้งค่า role แบบ in-memory ใช้งานได้ทันที
 * ✅ Add /topic: ตั้ง topic ของห้อง (ต้องมี Manage Channels)
 */

import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits,
} from "discord.js";

/* =======================================================
   1) ENV CONFIG
======================================================= */

// ✅ Discord credentials
const DISCORD_TOKEN = (process.env.DISCORD_TOKEN || "").trim();
const DISCORD_CLIENT_ID = (process.env.DISCORD_CLIENT_ID || "").trim();
const DISCORD_GUILD_ID = (process.env.DISCORD_GUILD_ID || "").trim();

// ✅ API base (รองรับ 2 ชื่อ) + trim กันช่องว่าง
const API_BASE_RAW = (process.env.API_BASE || process.env.API_BASE_URL || "").trim();

// ✅ ปรับให้ไม่มี / ท้าย เพื่อกัน `//` ตอนต่อ path
const API_BASE = API_BASE_RAW.replace(/\/+$/, "");

// ✅ เส้นทาง endpoint สำหรับบันทึก role (ปรับได้ตาม API คุณ)
const API_SETROLE_PATH = (process.env.API_SETROLE_PATH || "/roles").trim();

// ✅ auth token สำหรับยิง API (ถ้ามี)
const API_TOKEN = (process.env.API_TOKEN || process.env.API_KEY || "").trim();

// ✅ fallback role id จาก env (ถ้ามี)
const FALLBACK_ALLOWED_ROLE_ID = (process.env.ALLOWED_ROLE_ID || "").trim();

// ✅ runtime role (ตั้งด้วย /setrole ได้แม้ API ล้มเหลว)
let runtimeAllowedRoleId = "";

// ✅ runtime map per guild (ถ้าคุณอยากรองรับหลายกิลด์)
const runtimeAllowedRoleByGuild = new Map();

/* =======================================================
   2) BASIC VALIDATION + BOOT LOG
======================================================= */

if (!DISCORD_TOKEN) throw new Error("Missing env: DISCORD_TOKEN");
if (!DISCORD_CLIENT_ID) throw new Error("Missing env: DISCORD_CLIENT_ID");

// ✅ log สำคัญ: จะได้รู้ว่าตอนรันจริง env คืออะไร
console.log("[BOOT] DISCORD_GUILD_ID =", DISCORD_GUILD_ID || "(not set)");
console.log("[BOOT] API_BASE =", API_BASE || "(not set)");
console.log("[BOOT] API_SETROLE_PATH =", API_SETROLE_PATH);
console.log("[BOOT] API_TOKEN =", API_TOKEN ? "(set)" : "(not set)");
console.log("[BOOT] ALLOWED_ROLE_ID =", FALLBACK_ALLOWED_ROLE_ID || "(not set)");

/* =======================================================
   3) HELPERS
======================================================= */

/**
 * ✅ รวม role ที่ “ควรใช้จริง” ตามลำดับความสำคัญ:
 * 1) runtimeByGuild
 * 2) runtimeAllowedRoleId
 * 3) FALLBACK_ALLOWED_ROLE_ID
 */
function getAllowedRoleId(guildId) {
  return (
    runtimeAllowedRoleByGuild.get(guildId) ||
    runtimeAllowedRoleId ||
    FALLBACK_ALLOWED_ROLE_ID ||
    ""
  );
}

/**
 * ✅ ต่อ URL ให้ปลอดภัย
 */
function buildApiUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

/**
 * ✅ fetch แบบมี timeout + debug error ให้ละเอียด
 */
async function apiFetch(url, options = {}) {
  const controller = new AbortController();
  const timeoutMs = Number(process.env.API_TIMEOUT_MS || 15000);
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };

    // ✅ ใส่ Bearer ถ้ามี API_TOKEN
    if (API_TOKEN) headers.Authorization = `Bearer ${API_TOKEN}`;

    const res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    const text = await res.text().catch(() => "");

    if (!res.ok) {
      const err = new Error(`API request failed`);
      err.status = res.status;
      err.statusText = res.statusText;
      err.url = url;
      err.body = text;
      throw err;
    }

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      try {
        return JSON.parse(text || "{}");
      } catch {
        return {};
      }
    }

    return text;
  } finally {
    clearTimeout(t);
  }
}

/**
 * ✅ บันทึก role ไป API (ถ้าตั้ง API_BASE)
 * - ถ้า API ของคุณต้องการรูปแบบอื่น ให้แก้ payload/endpoint ตรงนี้
 */
async function saveRoleToApi({ guildId, roleId }) {
  if (!API_BASE) {
    const err = new Error("API_BASE not set");
    err.status = 0;
    err.url = "(no url)";
    err.body = "API_BASE is empty";
    throw err;
  }

  const url = buildApiUrl(API_SETROLE_PATH);

  return apiFetch(url, {
    method: "POST",
    body: JSON.stringify({ guildId, roleId }),
  });
}

/* =======================================================
   4) DISCORD CLIENT
======================================================= */

const client = new Client({
  intents: [
    // ✅ Slash commands อย่างเดียว ใช้แค่นี้พอ (กัน disallowed intents)
    GatewayIntentBits.Guilds,
  ],
});

/* =======================================================
   5) SLASH COMMANDS REGISTER
======================================================= */

const commands = [
  new SlashCommandBuilder()
    .setName("setrole")
    .setDescription("ตั้งค่ายศที่จะให้กับผู้ใช้ (บันทึกผ่าน API ถ้ามี)")
    .addRoleOption((opt) =>
      opt.setName("role").setDescription("เลือกยศที่จะใช้").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("showrole")
    .setDescription("ดูว่ายศที่ตั้งไว้ตอนนี้คืออะไร"),

  // ✅ เพิ่ม /topic (สาเหตุที่หาย เพราะเดิมไม่มีใน commands)
  new SlashCommandBuilder()
    .setName("topic")
    .setDescription("ตั้งหัวข้อ (topic) ของห้องนี้")
    .addStringOption((opt) =>
      opt
        .setName("text")
        .setDescription("ข้อความหัวข้อ (ปล่อยว่างเพื่อเคลียร์)")
        .setRequired(false)
    )
    // แนะนำ: ให้เฉพาะคนมีสิทธิ Manage Channels ใช้ได้
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
].map((c) => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

  if (DISCORD_GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID), {
      body: commands,
    });
    console.log(`[CMD] Registered GUILD commands for guild=${DISCORD_GUILD_ID}`);
    return;
  }

  await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID), {
    body: commands,
  });
  console.log("[CMD] Registered GLOBAL commands");
}

/* =======================================================
   6) EVENTS
======================================================= */

client.once("ready", async () => {
  console.log(`[BOT] Logged in as ${client.user?.tag}`);

  try {
    await registerCommands();
  } catch (e) {
    console.error("[CMD] Register failed:", e?.message || e);
  }
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;

    // ✅ กัน interaction timeout: defer ไว้ก่อน
    await interaction.deferReply({ ephemeral: true });

    if (interaction.commandName === "showrole") {
      const current = getAllowedRoleId(interaction.guildId);
      return interaction.editReply({
        content: current ? `✅ ยศที่ตั้งไว้ตอนนี้: <@&${current}>` : "⚠️ ตอนนี้ยังไม่มีการตั้งค่า role",
      });
    }

    if (interaction.commandName === "setrole") {
      const role = interaction.options.getRole("role", true);

      // ✅ ตั้งค่า runtime ก่อน (ให้ใช้งานได้ทันที)
      runtimeAllowedRoleId = role.id;
      if (interaction.guildId) runtimeAllowedRoleByGuild.set(interaction.guildId, role.id);

      if (!API_BASE) {
        return interaction.editReply({
          content:
            `⚠️ ตั้งค่า role สำเร็จแบบชั่วคราว: <@&${role.id}>\n` +
            `แต่ยังไม่ได้บันทึกถาวร เพราะไม่มี API_BASE`,
        });
      }

      try {
        await saveRoleToApi({ guildId: interaction.guildId, roleId: role.id });

        return interaction.editReply({
          content: `✅ ตั้งค่ายศสำเร็จและบันทึกแล้ว: <@&${role.id}>`,
        });
      } catch (err) {
        // ✅ log แบบจัดเต็ม (แยก field ชัด ๆ)
        console.error("[API] Save role failed");
        console.error("  url   :", err?.url);
        console.error("  status:", err?.status, err?.statusText || "");
        console.error("  body  :", err?.body);

        return interaction.editReply({
          content:
            `❌ ตั้งค่ายศไม่สำเร็จ (API error)\n` +
            `แต่ผมตั้งค่าให้ใช้งานได้แบบชั่วคราวแล้ว: <@&${role.id}>\n\n` +
            `🔎 ดูรายละเอียดใน Logs: url/status/body`,
        });
      }
    }

    if (interaction.commandName === "topic") {
      // ✅ เช็คว่าอยู่ในกิลด์ + เป็นห้องข้อความที่ตั้ง topic ได้
      if (!interaction.guildId) {
        return interaction.editReply({ content: "⚠️ คำสั่งนี้ใช้ได้เฉพาะในเซิร์ฟเวอร์ (guild) เท่านั้น" });
      }

      const ch = interaction.channel;
      const canSetTopic =
        ch &&
        (ch.type === ChannelType.GuildText ||
          ch.type === ChannelType.GuildAnnouncement ||
          ch.type === ChannelType.GuildForum);

      if (!canSetTopic || typeof ch?.setTopic !== "function") {
        return interaction.editReply({ content: "⚠️ ห้องนี้ไม่รองรับการตั้ง topic" });
      }

      const text = interaction.options.getString("text") ?? "";

      try {
        await ch.setTopic(text);
        return interaction.editReply({
          content: text ? `✅ ตั้ง topic แล้ว:\n${text}` : "✅ เคลียร์ topic แล้ว",
        });
      } catch (err) {
        console.error("[TOPIC] setTopic failed:", err?.message || err);
        return interaction.editReply({
          content:
            "❌ ตั้ง topic ไม่สำเร็จ\n" +
            "เช็คว่า บอทมีสิทธิ Manage Channels ในห้องนี้ไหม",
        });
      }
    }

    return interaction.editReply({ content: "⚠️ คำสั่งไม่รองรับ" });
  } catch (err) {
    console.error("[INT] interactionCreate error:", err?.message || err);

    // ✅ ถ้า deferReply ไม่สำเร็จ อย่าพยายาม reply ซ้ำ
    if (interaction?.deferred || interaction?.replied) {
      try {
        await interaction.editReply({ content: "❌ เกิดข้อผิดพลาดภายในระบบ" });
      } catch {
        // เงียบไว้
      }
    }
  }
});

/* =======================================================
   7) START
======================================================= */

client.login(DISCORD_TOKEN);
