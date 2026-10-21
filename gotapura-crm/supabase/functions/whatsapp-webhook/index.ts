// Recebe mensagens do WhatsApp Business (Meta Cloud API). Configurar o URL desta função como webhook na app Meta.
import { db, json, integration, findContact } from "../_shared/db.ts";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET") {                       // verificação do webhook pela Meta
    const cfg = await integration("whatsapp").catch(() => ({ verify_token: "" }));
    if (url.searchParams.get("hub.verify_token") === cfg.verify_token) return new Response(url.searchParams.get("hub.challenge"));
    return new Response("forbidden", { status: 403 });
  }
  const body = await req.json();
  for (const entry of body.entry ?? []) for (const ch of entry.changes ?? []) {
    const v = ch.value ?? {};
    for (const m of v.messages ?? []) {
      const from = m.from;
      const text = m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? `[${m.type}]`;
      const contact_id = await findContact(from);
      let lead_id: string | null = null;
      if (!contact_id) {                               // número desconhecido → cria lead automaticamente
        const name = v.contacts?.[0]?.profile?.name ?? from;
        const { data: lead } = await db.from("leads").insert({ name, phone: from, whatsapp: from, source: "whatsapp", notes: text }).select("id").single();
        lead_id = lead?.id ?? null;
      }
      await db.from("messages").upsert({ channel: "whatsapp", direction: "entrada", from_number: from, to_number: v.metadata?.display_phone_number, contact_id, lead_id, body: text, external_id: m.id, status: "recebida" }, { onConflict: "external_id" });
    }
    for (const s of v.statuses ?? []) await db.from("messages").update({ status: s.status === "read" ? "lida" : s.status === "delivered" ? "entregue" : s.status === "failed" ? "falhada" : "enviada" }).eq("external_id", s.id);
  }
  return json({ ok: true });
});
