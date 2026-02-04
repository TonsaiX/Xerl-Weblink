import dotenv from "dotenv";
dotenv.config();

import {
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits
} from "discord.js";

const token = process.env.DISCORD_TOKEN;
const appId = process.env.DISCORD_APP_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !appId || !guildId) {
  console.error("❌ Missing DISCORD_TOKEN / DISCORD_APP_ID / DISCORD_GUILD_ID");
  process.exit(1);
}

const commands = [
  /* =========================
     /topic
  ========================= */
  new SlashCommandBuilder()
    .setName("topic")
    .setDescription("สร้าง topic ใหม่")
    .addStringOption(o =>
      o.setName("title").setDescription("ชื่อหัวข้อ").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("link").setDescription("ลิ้งก์").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("image").setDescription("ลิ้งก์รูป หรือพิมพ์ -").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("desc").setDescription("คำอธิบาย").setRequired(false)
    ),

  /* =========================
     /remove
  ========================= */
  new SlashCommandBuilder()
    .setName("remove")
    .setDescription("ลบ topic ด้วย ID")
    .addIntegerOption(o =>
      o.setName("id").setDescription("ID ของ topic").setRequired(true)
    ),

  /* =========================
     /setrole
  ========================= */
  new SlashCommandBuilder()
    .setName("setrole")
    .setDescription("ตั้งค่ายศที่อนุญาตให้ใช้บอท")
    .addRoleOption(o =>
      o.setName("role").setDescription("เลือกยศ").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
];

const rest = new REST({ version: "10" }).setToken(token);

(async () => {
  try {
    console.log("⏳ Registering slash commands...");

    await rest.put(
      Routes.applicationGuildCommands(appId, guildId),
      { body: commands.map(c => c.toJSON()) }
    );

    console.log("✅ Slash commands registered:");
    commands.forEach(c => console.log(" - /" + c.name));
  } catch (err) {
    console.error("❌ Register failed", err);
  }
})();
