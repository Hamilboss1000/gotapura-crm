// Envia uma mensagem de texto pelo WhatsApp Business (Cloud API) e regista-a no CRM.
import { db, json, integration, findContact } from "../_shared/db.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({});
  try {
    const { to, text } = await req.json();
    const cfg = await integration("whatsapp");
    const r = await fetch(`https://graph.facebook.com/v20.0/${cfg.phone_number_id}/messages`, {
      method: "POST", headers: { Authorization: `Bearer ${cfg.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: to.replace(/\D/g, ""), type: "text", text: { body: text } }),
    });
    const out = await r.json();
    if (!r.ok) return json({ error: out.error?.message ?? "Falha no envio" }, 400);
    await db.from("messages").insert({ channel: "whatsapp", direction: "saida", to_number: to, from_number: cfg.phone_number_id, contact_id: await findContact(to), body: text, external_id: out.messages?.[0]?.id, status: "enviada" });
    return json({ ok: true });
  } catch (e) { return json({ error: String(e) }, 400); }
});
