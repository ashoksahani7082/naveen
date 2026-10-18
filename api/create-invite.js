export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const redisUrl = process.env.KV_REST_API_URL;
  const redisToken = process.env.KV_REST_API_TOKEN;
  const chatId = "-1003941905407";

  if (!token) {
    return res.status(500).json({ ok: false, error: "TELEGRAM_BOT_TOKEN is not configured" });
  }

  if (!redisUrl || !redisToken) {
    return res.status(500).json({ ok: false, error: "Redis environment variables are not configured" });
  }

  try {
    const body = req.body || {};

    const clean = (value, max = 200) => {
      if (typeof value !== "string") return null;
      const trimmed = value.trim();
      return trimmed ? trimmed.slice(0, max) : null;
    };

    const clickId = crypto.randomUUID().replaceAll("-", "");
    const linkName = `naveen_${clickId.slice(0, 24)}`;

    const attribution = {
      click_id: clickId,
      source: clean(body.source),
      campaign: clean(body.campaign),
      medium: clean(body.medium),
      content: clean(body.content),
      term: clean(body.term),
      landing_referrer: clean(body.landing_referrer, 120),
      landing_url: clean(body.landing_url, 1000),
      fbp: clean(body.fbp, 200),
      fbc: clean(body.fbc, 200),
      user_agent: clean(body.user_agent, 500),
      created_at: new Date().toISOString()
    };

    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${token}/createChatInviteLink`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          name: linkName,
          expire_date: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
          creates_join_request: true
        })
      }
    );

    const telegramData = await telegramResponse.json();

    if (!telegramResponse.ok || !telegramData.ok || !telegramData.result?.invite_link) {
      console.error("Telegram invite creation failed", telegramData);
      return res.status(502).json({
        ok: false,
        error: telegramData.description || "Could not create Telegram invite link"
      });
    }

    const inviteLink = telegramData.result.invite_link;

    const redisResponse = await fetch(redisUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${redisToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify([
        "SET",
        `invite:${inviteLink}`,
        JSON.stringify({
          ...attribution,
          invite_link: inviteLink,
          telegram_link_name: linkName
        }),
        "EX",
        60 * 60 * 24 * 8
      ])
    });

    const redisData = await redisResponse.json();

    if (!redisResponse.ok || redisData.error) {
      console.error("Redis mapping save failed", redisData);
      return res.status(502).json({
        ok: false,
        error: "Could not save attribution mapping"
      });
    }

    return res.status(200).json({
      ok: true,
      invite_link: inviteLink,
      click_id: clickId
    });
  } catch (error) {
    console.error("Create invite error:", error);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
}
