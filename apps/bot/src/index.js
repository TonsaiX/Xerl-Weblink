import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags
} from "discord.js";

/* ===== ENV ===== */
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;

const API_BASE = process.env.API_BASE;
const API_TOPIC_CREATE = "/internal/topic.create";
const API_TOPIC_REMOVE = "/internal/topic.remove";

/**
 * REQUIRED ROLES (comma-separated)
 * Example: "123,456"
 */
const DISCORD_REQUIRED_ROLE_IDS = (process.env.DISCORD_REQUIRED_ROLE_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/* ===== GUARDS ===== */
function assertEnv() {
  const missing = [];
  if (!DISCORD_TOKEN) missing.push("DISCORD_TOKEN");
  if (!DISCORD_CLIENT_ID) missing.push("DISCORD_CLIENT_ID");
  if (!DISCORD_GUILD_ID) missing.push("DISCORD_GUILD_ID");
  if (!API_BASE) missing.push("API_BASE");

  if (missing.length) {
    throw new Error(`[ENV] Missing: ${missing.join(", ")}`);
  }

  // ถ้าพี่อยาก "บังคับต้องตั้ง role" จริง ๆ ให้เปิดเช็คนี้
  if (DISCORD_REQUIRED_ROLE_IDS.length === 0) {
    console.warn(
      "[WARN] DISCORD_REQUIRED_ROLE_IDS is empty -> ทุกคนจะสามารถใช้คำสั่งได้ (ไม่มีการบังคับยศ)"
    );
  }
}

function isValidUrl(value) {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (!v) return false;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function hasRequiredRole(member) {
  // ถ้าไม่ได้ตั้ง ENV roles ไว้ -> อนุญาตทั้งหมด (ตาม warn ด้านบน)
  if (DISCORD_REQUIRED_ROLE_IDS.length === 0) return true;
  if (!member) return false;
  return DISCORD_REQUIRED_ROLE_IDS.some((roleId) => member.roles.cache.has(roleId));
}

/* ===== CLIENT ===== */
assertEnv();

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

/* ===== COMMANDS ===== */
const commands = [
  new SlashCommandBuilder()
    .setName("topic")
    .setDescription("สร้าง Web Topic")
    .addStringOption((o) => o.setName("title").setDescription("หัวข้อ").setRequired(true))
    .addStringOption((o) => o.setName("url").setDescription("ลิงก์").setRequired(true))
    .addStringOption((o) => o.setName("image").setDescription("ลิงก์รูป หรือ -").setRequired(false))
    .addStringOption((o) => o.setName("description").setDescription("คำอธิบาย").setRequired(false)),

  new SlashCommandBuilder()
    .setName("remove")
    .setDescription("ลบ topic")
    .addIntegerOption((o) => o.setName("id").setDescription("ID").setRequired(true))
].map((c) => c.toJSON());

/* ===== REGISTER ===== */
const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

await rest.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID), {
  body: commands
});

/* ===== SAFETY: prevent crash ===== */
process.on("unhandledRejection", (err) => {
  console.error("[unhandledRejection]", err);
});

process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});

client.on("error", (err) => {
  console.error("[client.error]", err);
});

/* ===== EVENTS ===== */
client.on("interactionCreate", async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;

    // บังคับให้เป็นใน guild เท่านั้น (กัน DM แล้ว member เป็น null)
    if (!interaction.inGuild()) {
      return interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: "❌ คำสั่งนี้ใช้ได้เฉพาะในเซิร์ฟเวอร์เท่านั้น"
      });
    }

    // Defer reply
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // เช็คยศก่อนใช้งาน
    const member = interaction.member; // GuildMember
    if (!hasRequiredRole(member)) {
      return interaction.editReply(
        "⛔ คุณไม่มีสิทธิ์ใช้คำสั่งนี้ (ต้องมียศที่กำหนดในระบบ)"
      );
    }

    if (interaction.commandName === "topic") {
      const title = interaction.options.getString("title");
      const urlRaw = interaction.options.getString("url");
      const imageRaw = interaction.options.getString("image") || "-";
      const description = interaction.options.getString("description") || "";

      // ✅ validate URL กันบอทล้ม
      if (!isValidUrl(urlRaw)) {
        return interaction.editReply("❌ URL ไม่ถูกต้อง (ต้องขึ้นต้นด้วย http/https)");
      }

      const url = urlRaw.trim();
      const image = typeof imageRaw === "string" ? imageRaw.trim() : "-";

      // ✅ ถ้ามีรูป ให้เช็คว่าเป็น URL จริงก่อน
      const imageOk = image !== "-" && isValidUrl(image);

      // Call API + เช็คผลลัพธ์
      const resp = await fetch(API_BASE + API_TOPIC_CREATE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          url,
          description,
          image_url: imageOk ? image : "-",
          actor: {
            userId: interaction.user.id,
            tag: interaction.user.tag
          }
        })
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        console.error("[topic.create] API error", resp.status, text);
        return interaction.editReply("❌ API ทำงานผิดพลาด (สร้าง Topic ไม่สำเร็จ)");
      }

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setURL(url) // ✅ ตอนนี้มั่นใจว่าเป็น URL จริง
        .setDescription(description || null)
        .setTimestamp();

      if (imageOk) {
        embed.setImage(image);
      }

      // กันกรณี channel เป็น null
      if (!interaction.channel) {
        return interaction.editReply("❌ ไม่พบช่องทางส่งข้อความ (channel ไม่พร้อมใช้งาน)");
      }

      await interaction.channel.send({ embeds: [embed] });
      return interaction.editReply("✅ สร้าง Topic เรียบร้อย");
    }

    if (interaction.commandName === "remove") {
      const id = interaction.options.getInteger("id");

      const resp = await fetch(API_BASE + API_TOPIC_REMOVE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          actor: { userId: interaction.user.id }
        })
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        console.error("[topic.remove] API error", resp.status, text);
        return interaction.editReply("❌ API ทำงานผิดพลาด (ลบไม่สำเร็จ)");
      }

      const data = await resp.json().catch(() => null);
      if (data && data.ok && data.removed === false) {
        return interaction.editReply("⚠️ ไม่พบ topic นี้ หรือถูกลบไปแล้ว");
      }

      return interaction.editReply("🗑️ ลบเรียบร้อย");
    }
  } catch (err) {
    console.error("[interactionCreate] error", err);

    // พยายามตอบกลับแบบไม่พัง
    if (interaction.isRepliable()) {
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply("❌ เกิดข้อผิดพลาดในบอท");
        } else {
          await interaction.reply({
            flags: MessageFlags.Ephemeral,
            content: "❌ เกิดข้อผิดพลาดในบอท"
          });
        }
      } catch (e) {
        console.error("[interactionCreate] failed to reply", e);
      }
    }
  }
});

client.login(DISCORD_TOKEN);
