import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
  WebhookClient
} from "discord.js";

/* ===== ENV ===== */
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;

const API_BASE = process.env.API_BASE;
const API_TOPIC_CREATE = "/internal/topic.create";
const API_TOPIC_REMOVE = "/internal/topic.remove";

const DISCORD_LOG_WEBHOOK_URL = process.env.DISCORD_LOG_WEBHOOK_URL;

/* ===== REQUIRED ROLES ===== */
const DISCORD_REQUIRED_ROLE_IDS = (process.env.DISCORD_REQUIRED_ROLE_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/* ===== WEBHOOK ===== */
const logWebhook = DISCORD_LOG_WEBHOOK_URL
  ? new WebhookClient({ url: DISCORD_LOG_WEBHOOK_URL })
  : null;

/* ===== UTILS ===== */
function isValidUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function hasRequiredRole(member) {
  if (DISCORD_REQUIRED_ROLE_IDS.length === 0) return true;
  return DISCORD_REQUIRED_ROLE_IDS.some((id) =>
    member.roles.cache.has(id)
  );
}

async function sendLogEmbed({ title, color, fields }) {
  if (!logWebhook) return;

  try {
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor(color)
      .addFields(fields)
      .setTimestamp();

    await logWebhook.send({ embeds: [embed] });
  } catch (err) {
    console.error("[LOG WEBHOOK ERROR]", err);
  }
}

/* ===== CLIENT ===== */
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
    .addStringOption((o) => o.setName("image").setDescription("ลิงก์รูป หรือ -"))
    .addStringOption((o) => o.setName("description").setDescription("คำอธิบาย")),

  new SlashCommandBuilder()
    .setName("remove")
    .setDescription("ลบ topic")
    .addIntegerOption((o) => o.setName("id").setDescription("ID").setRequired(true))
].map((c) => c.toJSON());

/* ===== REGISTER ===== */
const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
await rest.put(
  Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID),
  { body: commands }
);

/* ===== EVENTS ===== */
client.on("interactionCreate", async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.inGuild()) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!hasRequiredRole(interaction.member)) {
      return interaction.editReply("⛔ คุณไม่มีสิทธิ์ใช้คำสั่งนี้");
    }

    /* ===== CREATE TOPIC ===== */
    if (interaction.commandName === "topic") {
      const title = interaction.options.getString("title");
      const url = interaction.options.getString("url");
      const image = interaction.options.getString("image") || "-";
      const description = interaction.options.getString("description") || "";

      if (!isValidUrl(url)) {
        return interaction.editReply("❌ URL ไม่ถูกต้อง");
      }

      await fetch(API_BASE + API_TOPIC_CREATE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          url,
          description,
          image_url: isValidUrl(image) ? image : "-",
          actor: {
            userId: interaction.user.id,
            tag: interaction.user.tag
          }
        })
      });

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setURL(url)
        .setDescription(description || null)
        .setTimestamp();

      if (isValidUrl(image)) embed.setImage(image);

      await interaction.channel.send({ embeds: [embed] });
      await interaction.editReply("✅ สร้าง Topic เรียบร้อย");

      /* ===== LOG ===== */
      await sendLogEmbed({
        title: "📌 Topic Created",
        color: 0x2ecc71,
        fields: [
          { name: "Title", value: title, inline: false },
          { name: "URL", value: url, inline: false },
          {
            name: "By",
            value: `${interaction.user.tag} (${interaction.user.id})`,
            inline: false
          }
        ]
      });
    }

    /* ===== REMOVE TOPIC ===== */
    if (interaction.commandName === "remove") {
      const id = interaction.options.getInteger("id");

      await fetch(API_BASE + API_TOPIC_REMOVE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          actor: { userId: interaction.user.id }
        })
      });

      await interaction.editReply("🗑️ ลบเรียบร้อย");

      /* ===== LOG ===== */
      await sendLogEmbed({
        title: "🗑️ Topic Removed",
        color: 0xe74c3c,
        fields: [
          { name: "Topic ID", value: String(id), inline: true },
          {
            name: "By",
            value: `${interaction.user.tag} (${interaction.user.id})`,
            inline: true
          }
        ]
      });
    }
  } catch (err) {
    console.error(err);

    await sendLogEmbed({
      title: "❌ Bot Error",
      color: 0xe74c3c,
      fields: [
        { name: "Error", value: `\`\`\`${err.message}\`\`\`` }
      ]
    });

    if (interaction.deferred) {
      await interaction.editReply("❌ เกิดข้อผิดพลาดในระบบ");
    }
  }
});

client.login(DISCORD_TOKEN);
