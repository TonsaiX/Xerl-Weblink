/**
 * apps/bot/src/index.js
 * -------------------------------------------------------
 * ✅ Fix หลัก: กันปัญหา Discord Interaction ตอบซ้ำ / ตอบช้า
 * - deferReply() ให้เร็วที่สุด (ภายใน 3 วินาที)
 * - หลัง defer แล้ว ใช้ editReply() เท่านั้น
 * -------------------------------------------------------
 * หมายเหตุ:
 * - ไฟล์นี้เป็นตัวอย่าง "ไฟล์เต็ม" ที่พร้อมรันได้
 * - ถ้าโปรเจกต์คุณมี path/ชื่อคำสั่ง/route ไม่ตรง บอกเจ้าวิซ เดี๋ยวปรับให้เข้ากับของจริง
 */

import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder
} from "discord.js";

/* =======================================================
   1) ENV CONFIG
======================================================= */

/**
 * ✅ TOKEN ของบอท
 * - ตั้งใน Railway / .env -> DISCORD_TOKEN=xxxx
 */
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

/**
 * ✅ CLIENT ID ของบอท (Application ID)
 * - ตั้งใน Railway / .env -> DISCORD_CLIENT_ID=xxxx
 */
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;

/**
 * ✅ (แนะนำ) ถ้าจะ register แบบเฉพาะกิลด์ (เร็ว) ให้ใส่
 * - DISCORD_GUILD_ID=xxxx
 * - ถ้าไม่ใส่ จะ register แบบ global (ใช้เวลาทะยอยอัปเดต)
 */
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID || "";

/**
 * ✅ API base ของระบบคุณ (ฝั่ง backend)
 * - ตัวอย่าง: https://xerlbot-api.up.railway.app
 */
const API_BASE = process.env.API_BASE || "";

/**
 * ✅ (สำรอง) ถ้าไม่มีระบบดึง allowed role จาก API
 * ให้ใส่ ID role ที่อนุญาตใช้คำสั่ง /topic /remove
 * - ALLOWED_ROLE_ID=123...
 */
const FALLBACK_ALLOWED_ROLE_ID = process.env.ALLOWED_ROLE_ID || "";

/* =======================================================
   2) BASIC VALIDATION (กันรันแบบงง ๆ)
======================================================= */

if (!DISCORD_TOKEN) {
  throw new Error("Missing env: DISCORD_TOKEN");
}
if (!DISCORD_CLIENT_ID) {
  throw new Error("Missing env: DISCORD_CLIENT_ID");
}

/* =======================================================
   3) DISCORD CLIENT SETUP
======================================================= */

/**
 * ✅ Client intents เท่าที่ใช้จริง
 * - Guilds: สำหรับ slash command
 * - GuildMembers: ถ้าจะเช็ค role ใน member (จำเป็นสำหรับ permission check)
 */
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  partials: [Partials.GuildMember]
});

/* =======================================================
   4) SLASH COMMANDS DEFINITION
   - /setrole: ตั้งค่าบทบาทที่อนุญาต (admin เท่านั้น)
   - /topic: สร้าง topic
   - /remove: ลบ topic
======================================================= */

const commands = [
  new SlashCommandBuilder()
    .setName("setrole")
    .setDescription("ตั้งค่ายศที่อนุญาตให้ใช้คำสั่งระบบ (Admin เท่านั้น)")
    .addRoleOption((opt) =>
      opt.setName("role").setDescription("ยศที่อนุญาต").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("topic")
    .setDescription("สร้าง topic ใหม่")
    .addStringOption((opt) =>
      opt.setName("title").setDescription("หัวข้อ").setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("link")
        .setDescription("ลิงก์ (ใส่ได้ทั้ง https:// หรือโดเมนเปล่า)")
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("image")
        .setDescription('ลิงก์รูป หรือใส่ "-" ถ้าไม่ใช้')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("desc").setDescription("คำอธิบาย (ไม่ใส่ก็ได้)")
    ),

  new SlashCommandBuilder()
    .setName("remove")
    .setDescription("ลบ topic ตาม ID")
    .addIntegerOption((opt) =>
      opt.setName("id").setDescription("ID ของ topic").setRequired(true)
    )
].map((c) => c.toJSON());

/* =======================================================
   5) COMMAND REGISTRATION
======================================================= */

/**
 * ✅ Register commands
 * - ถ้าใส่ DISCORD_GUILD_ID: register แบบ guild (เร็ว)
 * - ไม่ใส่: register global (ช้ากว่า แต่ใช้ทุกเซิร์ฟ)
 */
async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

  if (DISCORD_GUILD_ID) {
    await rest.put(
      Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID),
      { body: commands }
    );
    console.log(`[CMD] Registered GUILD commands for guild=${DISCORD_GUILD_ID}`);
  } else {
    await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID), {
      body: commands
    });
    console.log("[CMD] Registered GLOBAL commands");
  }
}

/* =======================================================
   6) HELPERS
======================================================= */

/**
 * ✅ normalizeUrl
 * - ถ้าผู้ใช้ใส่ "example.com" จะเติม https:// ให้
 * - ถ้าเป็น "-" ให้คืน "-"
 */
function normalizeUrl(input) {
  const raw = String(input || "").trim();

  // ✅ allow dash as "no value"
  if (raw === "-") return "-";

  // ✅ if already has protocol
  if (/^https?:\/\//i.test(raw)) return raw;

  // ✅ otherwise prepend https://
  return `https://${raw}`;
}

/**
 * ✅ hasAllowedRole
 * - เช็คว่า member มียศที่อนุญาตไหม
 * - ถ้า allowedRoleId ว่าง: ถือว่าไม่ผ่าน
 */
function hasAllowedRole(member, allowedRoleId) {
  if (!allowedRoleId) return false;
  if (!member?.roles?.cache) return false;
  return member.roles.cache.has(allowedRoleId);
}

/**
 * ✅ getAllowedRoleId
 * - ถ้ามี API_BASE: ดึงจาก backend (แนะนำ)
 * - ถ้าไม่มี: ใช้ FALLBACK_ALLOWED_ROLE_ID จาก ENV
 */
async function getAllowedRoleId() {
  // ✅ มี API ให้ดึงค่าจริง
  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/internal/config.getRole`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      });

      // ✅ ถ้า API ตอบไม่โอเค ให้ fallback
      if (!res.ok) return FALLBACK_ALLOWED_ROLE_ID;

      const data = await res.json();
      // ✅ คาดหวังรูปแบบ { ok: true, roleId: "123" }
      if (data?.ok && data?.roleId) return String(data.roleId);

      return FALLBACK_ALLOWED_ROLE_ID;
    } catch (err) {
      // ✅ network error -> fallback
      console.error("[getAllowedRoleId] fetch error:", err);
      return FALLBACK_ALLOWED_ROLE_ID;
    }
  }

  // ✅ ไม่มี API -> ใช้ ENV
  return FALLBACK_ALLOWED_ROLE_ID;
}

/**
 * ✅ safeJson
 * - อ่าน JSON แบบกันพัง ถ้า response ไม่ใช่ JSON
 */
async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/* =======================================================
   7) READY EVENT
======================================================= */

client.once("ready", () => {
  console.log(`[BOT] Logged in as ${client.user?.tag || "unknown"}`);
});

/* =======================================================
   8) INTERACTION HANDLER (แก้ Unknown interaction/ack ซ้ำ)
======================================================= */

client.on("interactionCreate", async (interaction) => {
  // ✅ เราจัดการเฉพาะ Slash Commands
  if (!interaction.isChatInputCommand()) return;

  // ✅ actor info (เผื่อส่งไป backend เพื่อทำ audit)
  const actor = {
    userId: interaction.user.id,
    tag: interaction.user.tag
  };

  try {
    /**
     * ✅ สำคัญสุด: deferReply ทันที (กัน timeout 3 วิ)
     * - ephemeral true ให้ตอบเฉพาะคนกดคำสั่ง
     */
    await interaction.deferReply({ ephemeral: true });

    /* -------------------------------
       /setrole
       - ใช้สำหรับตั้งค่ายศ allowed
       - (แนะนำ) จำกัดให้เฉพาะ admin / manage guild
    -------------------------------- */
    if (interaction.commandName === "setrole") {
      // ✅ permission check เบื้องต้น: ต้องมีสิทธิ Manage Guild
      const perms = interaction.memberPermissions;
      if (!perms || !perms.has("ManageGuild")) {
        return interaction.editReply("⛔ คำสั่งนี้สำหรับผู้ดูแล (Manage Server) เท่านั้น");
      }

      const role = interaction.options.getRole("role", true);

      // ✅ ถ้าไม่มี API_BASE ก็แจ้งชัด ๆ
      if (!API_BASE) {
        return interaction.editReply(
          "❌ ยังไม่ได้ตั้งค่า API_BASE ใน ENV จึงไม่สามารถบันทึก role ได้\n" +
            "ให้ตั้ง API_BASE หรือใช้ ALLOWED_ROLE_ID แบบ fallback"
        );
      }

      const res = await fetch(`${API_BASE}/internal/config.setRole`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId: role.id, actor })
      });

      const data = await safeJson(res);

      if (!res.ok || !data?.ok) {
        return interaction.editReply("❌ ตั้งค่ายศไม่สำเร็จ (API error)");
      }

      return interaction.editReply(`✅ ตั้งค่ายศที่อนุญาตแล้ว: <@&${role.id}>`);
    }

    /* -------------------------------
       Permission gate
       - /topic, /remove ต้องมียศ allowed
    -------------------------------- */
    const allowedRoleId = await getAllowedRoleId();
    if (!hasAllowedRole(interaction.member, allowedRoleId)) {
      return interaction.editReply(
        "⛔ คุณไม่มีสิทธิใช้คำสั่งนี้\n" +
          (allowedRoleId
            ? `ต้องมียศ: <@&${allowedRoleId}>`
            : "ยังไม่ได้ตั้งค่ายศที่อนุญาต")
      );
    }

    /* -------------------------------
       /topic
    -------------------------------- */
    if (interaction.commandName === "topic") {
      const title = interaction.options.getString("title", true);
      const linkRaw = interaction.options.getString("link", true);
      const imageRaw = interaction.options.getString("image", true);
      const desc = interaction.options.getString("desc") || "";

      const url = normalizeUrl(linkRaw);
      const image_url = normalizeUrl(imageRaw);

      // ✅ ถ้าไม่มี API_BASE ก็แจ้งชัด ๆ
      if (!API_BASE) {
        return interaction.editReply("❌ ยังไม่ได้ตั้งค่า API_BASE ใน ENV จึงสร้าง topic ไม่ได้");
      }

      const res = await fetch(`${API_BASE}/internal/topic.create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          url,
          description: desc,
          image_url,
          actor
        })
      });

      const data = await safeJson(res);

      if (!res.ok || !data?.ok) {
        return interaction.editReply("❌ สร้าง topic ไม่สำเร็จ (API error)");
      }

      return interaction.editReply(`✅ สร้าง topic สำเร็จ\nID: **${data.topicId}**`);
    }

    /* -------------------------------
       /remove
    -------------------------------- */
    if (interaction.commandName === "remove") {
      const id = interaction.options.getInteger("id", true);

      // ✅ ถ้าไม่มี API_BASE ก็แจ้งชัด ๆ
      if (!API_BASE) {
        return interaction.editReply("❌ ยังไม่ได้ตั้งค่า API_BASE ใน ENV จึงลบ topic ไม่ได้");
      }

      const res = await fetch(`${API_BASE}/internal/topic.remove`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, actor })
      });

      const data = await safeJson(res);

      if (!res.ok || !data?.ok) {
        return interaction.editReply("❌ ลบ topic ไม่สำเร็จ (API error)");
      }

      // ✅ คาดหวัง { ok: true, removed: true/false }
      return interaction.editReply(
        data.removed
          ? `🗑️ ลบ topic ID **${id}** เรียบร้อย`
          : `⚠️ ไม่พบ topic ID **${id}**`
      );
    }

    // ✅ fallback เผื่อมีคำสั่งใหม่แต่ยังไม่ handle
    return interaction.editReply("❓ ไม่รู้จักคำสั่งนี้");
  } catch (err) {
    // ✅ log error
    console.error("[interactionCreate] error:", err);

    /**
     * ✅ กันบอท crash และกันตอบซ้ำ
     * - ถ้า defer/replied แล้ว ให้ใช้ editReply อย่างเดียว
     */
    try {
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply("❌ เกิดข้อผิดพลาดภายในบอท");
      }
    } catch (e) {
      // ✅ ถ้าตอบไม่ได้จริง ๆ ก็ปล่อย (กัน error ซ้อน)
      console.error("[interactionCreate] failed to respond:", e);
    }
  }
});

/* =======================================================
   9) BOOTSTRAP
======================================================= */

async function main() {
  // ✅ register commands ก่อน login (แนะนำ)
  await registerCommands();

  // ✅ login bot
  await client.login(DISCORD_TOKEN);
}

main().catch((err) => {
  console.error("[BOOT] fatal:", err);
  process.exit(1);
});
