// Chatbot público do website: responde a visitantes com base na empresa, produtos e FAQ, e cria leads.
// Deploy: Edge Functions → Deploy a new function → Via Editor → nome "chat-public" → desligar "Verify JWT".
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { session_id, message, language = "pt" } = await req.json();
    const [ai, co, cb, pr] = await Promise.all([
      db.from("integrations").select("config, active").eq("provider", "ai").single(),
      db.from("settings").select("value").eq("key", "company").single(),
      db.from("settings").select("value").eq("key", "chatbot").single(),
      db.from("products").select("name, category, price, currency, description").eq("active", true).limit(40),
    ]);
    if (!cb.data?.value?.enabled) return json({ error: "Chatbot desactivado" }, 400);
    if (!ai.data?.active || !ai.data.config?.api_key) return json({ reply: cb.data.value.greeting });
    let session = session_id ? (await db.from("chat_sessions").select("*").eq("id", session_id).single()).data : null;
    if (!session) session = (await db.from("chat_sessions").insert({ language }).select("*").single()).data;
    const history = [...(session.messages ?? []), { role: "user", content: message }].slice(-16);
    const faq = (cb.data.value.faq ?? []).map((f: any) => `P: ${f.q}\nR: ${f.a}`).join("\n");
    const catalog = (pr.data ?? []).map((p: any) => `- ${p.name} (${p.category}): ${p.price} ${p.currency}${p.description ? " — " + p.description : ""}`).join("\n");
    const system = `És o assistente do website da ${co.data?.value?.name ?? "Gotapura"}. ${cb.data.value.instructions}
Contactos da empresa: ${co.data?.value?.phone ?? ""} ${co.data?.value?.email ?? ""} ${co.data?.value?.address ?? ""}
Perguntas frequentes:\n${faq}\nCatálogo:\n${catalog}
Quando o visitante indicar nome e telefone (ou e-mail), usa a ferramenta create_lead uma única vez. Responde em ${language === "en" ? "inglês" : "português"}; não inventes preços nem prazos.`;
    const tools = [{ name: "create_lead", description: "Regista o visitante como lead no CRM.", input_schema: { type: "object", properties: { name: { type: "string" }, phone: { type: "string" }, email: { type: "string" }, interest: { type: "string" }, notes: { type: "string" } }, required: ["name"] } }];
    let msgs = history;
    let reply = "";
    for (let i = 0; i < 3; i++) {
      const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": ai.data.config.api_key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: ai.data.config.model || "claude-sonnet-4-5", max_tokens: 600, system, tools, messages: msgs }) });
      const out = await r.json();
      if (!r.ok) return json({ reply: "De momento não consigo responder. Contacte-nos por telefone." });
      reply = out.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
      if (out.stop_reason !== "tool_use") break;
      msgs = [...msgs, { role: "assistant", content: out.content }];
      const results = [];
      for (const c of out.content) if (c.type === "tool_use") {
        const { data: lead } = await db.from("leads").insert({ ...c.input, source: "website", notes: `Chatbot: ${c.input.notes ?? ""}` }).select("id").single();
        if (lead) await db.from("chat_sessions").update({ lead_id: lead.id, name: c.input.name, phone: c.input.phone, email: c.input.email }).eq("id", session.id);
        results.push({ type: "tool_result", tool_use_id: c.id, content: JSON.stringify({ ok: true }) });
      }
      msgs = [...msgs, { role: "user", content: results }];
    }
    await db.from("chat_sessions").update({ messages: [...history, { role: "assistant", content: reply }], updated_at: new Date().toISOString() }).eq("id", session.id);
    return json({ reply, session_id: session.id });
  } catch (e) { return json({ error: String(e) }, 400); }
});
