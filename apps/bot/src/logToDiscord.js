import fetch from "node-fetch";

/**
 * ส่ง Log ไป Discord ผ่าน Webhook
 * อ่าน env ตอนเรียกใช้งานจริง (แก้ ESM issue)
 */
export async function sendLogEmbed(embed) {
  const WEBHOOK_URL = process.env.DISCORD_LOG_WEBHOOK_URL;

  if (!WEBHOOK_URL) {
    console.warn("[LOG] DISCORD_LOG_WEBHOOK_URL missing");
    return;
  }

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] })
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[LOG] Webhook error:", res.status, text);
    }
  } catch (err) {
    console.error("[LOG] Send failed:", err);
  }
}
