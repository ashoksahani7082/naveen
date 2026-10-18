export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Use POST" });
  }

  const expectedSecret = process.env.WEBHOOK_SETUP_SECRET;
  const suppliedSecret = req.headers["x-setup-secret"];

  if (!expectedSecret || !suppliedSecret || suppliedSecret !== expectedSecret) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return res.status(500).json({ ok: false, error: "TELEGRAM_BOT_TOKEN is not configured" });
  }

  const webhookUrl = "https://naveen-nine-mu.vercel.app/api/telegram";

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["chat_join_request"],
        drop_pending_updates: false
      })
    });

    const data = await response.json();
    if (!response.ok || !data.ok) {
      console.error("Telegram setWebhook failed", data);
      return res.status(502).json({ ok: false, error: data.description || "Telegram setWebhook failed" });
    }

    return res.status(200).json({
      ok: true,
      webhook_url: webhookUrl,
      allowed_updates: ["chat_join_request"],
      telegram_result: data.result
    });
  } catch (error) {
    console.error("Webhook registration error:", error.message);
    return res.status(500).json({ ok: false, error: "Webhook registration failed" });
  }
}
