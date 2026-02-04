/* =====================================================
   LOAD ENV FIRST (สำคัญมาก)
===================================================== */
import dotenv from "dotenv";
dotenv.config();

/* =====================================================
   IMPORTS
===================================================== */
import fetch from "node-fetch";
import {
  Client,
  GatewayIntentBits,
  EmbedBuilder
} from "discord.js";
import { hasAllowedRole } from "./permissions.js";
import { sendLogEmbed } from "./logToDiscord.js";

/* =====================================================
   CONFIG
===================================================== */
const token = process.env.DISCORD_TOKEN;
const apiBase =
  process.env.API_BASE_URL || "http://localhost:8080";


if (!token) {
  console.error("❌ Missing DISCORD_TOKEN in .env");
  process.exit(1);
}

/* =====================================================
   DISCORD CLIENT
===================================================== */
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

/* =====================================================
   HELPERS
===================================================== */
async function getAllowedRoleId() {
  try {
    const res = await fetch(`${apiBase}/internal/config.get`);
    const data = await res.json();
    return (
      data?.allowed_role_id ||
      process.env.DEFAULT_ALLOWED_ROLE_ID ||
      null
    );
  } catch {
    return process.env.DEFAULT_ALLOWED_ROLE_ID || null;
  }
}

function normalizeUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  if (!/^https?:\/\//i.test(raw)) return `https://${raw}`;
  return raw;
}

/* =====================================================
   READY
===================================================== */
client.once("ready", async () => {
  console.log(`[BOT] Logged in as ${client.user.tag}`);

  // 🔔 Test webhook ตอนบอทออนไลน์
  await sendLogEmbed(
    new EmbedBuilder()
      .setColor(0xffa500)
      .setTitle("✅ WEBHOOK TEST")
      .setDescription("Bot started. Logging is active.")
      .setTimestamp()
      .toJSON()
  );
});

/* =====================================================
   INTERACTION HANDLER
===================================================== */
client.on("interactionCreate", async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;

    const actor = {
      userId: interaction.user.id,
      tag: interaction.user.tag
    };

    /* ===============================
       /setrole
    =============================== */
    if (interaction.commandName === "setrole") {
      await interaction.deferReply({ ephemeral: true });

      const role = interaction.options.getRole("role", true);

      const res = await fetch(`${apiBase}/internal/config.setRole`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleId: role.id,
          actor
        })
      });

      if (!res.ok) {
        return interaction.editReply("❌ ตั้งค่ายศไม่สำเร็จ");
      }

      await sendLogEmbed(
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("🔐 CONFIG SET ROLE")
          .addFields(
            {
              name: "ตั้งโดย",
              value: `<@${actor.userId}> (${actor.tag})`
            },
            {
              name: "Role",
              value: `<@&${role.id}>`
            }
          )
          .setTimestamp()
          .toJSON()
      );

      return interaction.editReply(
        `✅ ตั้งค่ายศที่อนุญาตแล้ว: <@&${role.id}>`
      );
    }

    /* ===============================
       CHECK ROLE PERMISSION
    =============================== */
    const allowedRoleId = await getAllowedRoleId();
    if (!hasAllowedRole(interaction.member, allowedRoleId)) {
      return interaction.reply({
        ephemeral: true,
        content: "⛔ คุณไม่มีสิทธิใช้คำสั่งนี้"
      });
    }

    /* ===============================
       /topic  (CREATE)
    =============================== */
    if (interaction.commandName === "topic") {
      await interaction.deferReply({ ephemeral: true });

      const title = interaction.options.getString("title", true);
      const linkRaw = interaction.options.getString("link", true);
      const imageRaw = interaction.options.getString("image", true);
      const desc = interaction.options.getString("desc") || "";

      const url = normalizeUrl(linkRaw);
      const image_url =
        imageRaw === "-" ? "-" : normalizeUrl(imageRaw);

      if (!url) {
        return interaction.editReply("❌ ลิ้งก์ไม่ถูกต้อง");
      }

      const res = await fetch(`${apiBase}/internal/topic.create`, {
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

      const data = await res.json();
      if (!data.ok) {
        return interaction.editReply("❌ สร้าง topic ไม่สำเร็จ");
      }

      // 🔔 Log
      await sendLogEmbed(
        new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle("✅ TOPIC CREATED")
          .addFields(
            { name: "ID", value: String(data.topicId), inline: true },
            { name: "Title", value: title, inline: true },
            { name: "URL", value: url },
            {
              name: "Image",
              value: image_url === "-" ? "-" : image_url
            },
            {
              name: "By",
              value: `<@${actor.userId}> (${actor.tag})`
            }
          )
          .setTimestamp()
          .toJSON()
      );

      return interaction.editReply(
        `✅ สร้าง topic สำเร็จ\nID: **${data.topicId}**`
      );
    }

    /* ===============================
       /remove  (DELETE)
    =============================== */
    if (interaction.commandName === "remove") {
      await interaction.deferReply({ ephemeral: true });

      const id = interaction.options.getInteger("id", true);

      const res = await fetch(`${apiBase}/internal/topic.remove`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, actor })
      });

      const data = await res.json();
      if (!data.ok) {
        return interaction.editReply("❌ ลบ topic ไม่สำเร็จ");
      }

      await sendLogEmbed(
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle("🗑️ TOPIC REMOVED")
          .addFields(
            { name: "ID", value: String(id), inline: true },
            {
              name: "By",
              value: `<@${actor.userId}> (${actor.tag})`
            },
            {
              name: "Result",
              value: data.removed
                ? "ลบสำเร็จ"
                : "ไม่พบ / ถูกลบไปแล้ว"
            }
          )
          .setTimestamp()
          .toJSON()
      );

      return interaction.editReply(
        data.removed
          ? `🗑️ ลบ topic ID **${id}** เรียบร้อย`
          : `⚠️ ไม่พบ topic ID **${id}**`
      );
    }
  } catch (err) {
    console.error(err);

    if (interaction.deferred || interaction.replied) {
      return interaction.editReply("❌ เกิดข้อผิดพลาดภายในบอท");
    }
    return interaction.reply({
      ephemeral: true,
      content: "❌ เกิดข้อผิดพลาดภายในบอท"
    });
  }
});

/* =====================================================
   LOGIN
===================================================== */
client.login(token);
