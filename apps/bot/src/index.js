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

/* ===== CLIENT ===== */
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

/* ===== COMMANDS ===== */
const commands = [
  new SlashCommandBuilder()
    .setName("topic")
    .setDescription("สร้าง Web Topic")
    .addStringOption(o => o.setName("title").setDescription("หัวข้อ").setRequired(true))
    .addStringOption(o => o.setName("url").setDescription("ลิงก์").setRequired(true))
    .addStringOption(o => o.setName("image").setDescription("ลิงก์รูป หรือ -").setRequired(false))
    .addStringOption(o => o.setName("description").setDescription("คำอธิบาย").setRequired(false)),

  new SlashCommandBuilder()
    .setName("remove")
    .setDescription("ลบ topic")
    .addIntegerOption(o => o.setName("id").setDescription("ID").setRequired(true))
].map(c => c.toJSON());

/* ===== REGISTER ===== */
const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

await rest.put(
  Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID),
  { body: commands }
);

/* ===== EVENTS ===== */
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (interaction.commandName === "topic") {
    const title = interaction.options.getString("title");
    const url = interaction.options.getString("url");
    const image = interaction.options.getString("image") || "-";
    const description = interaction.options.getString("description") || "";

    await fetch(API_BASE + API_TOPIC_CREATE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        url,
        description,
        image_url: image,
        actor: {
          userId: interaction.user.id,
          tag: interaction.user.tag
        }
      })
    });

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setURL(url)
      .setDescription(description)
      .setTimestamp();

    if (image !== "-" && image.startsWith("http")) {
      embed.setImage(image);
    }

    await interaction.channel.send({ embeds: [embed] });
    return interaction.editReply("✅ สร้าง Topic เรียบร้อย");
  }

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

    return interaction.editReply("🗑️ ลบเรียบร้อย");
  }
});

client.login(DISCORD_TOKEN);
