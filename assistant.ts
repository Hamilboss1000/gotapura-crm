// Assistente interno com IA (Anthropic Claude) com acesso de leitura/escrita controlado ao CRM.
// Deploy: Edge Functions → Deploy a new function → Via Editor → nome "assistant". Chave em Integrações → Assistente de IA.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const TOOLS = [
  { name: "search_records", description: "Pesquisa contactos, organizações, leads ou oportunidades por nome, e-mail ou telefone.", input_schema: { type: "object", properties: { table: { type: "string", enum: ["contacts", "organizations", "leads", "opportunities"] }, query: { type: "string" } }, required: ["table", "query"] } },
  { name: "list_tasks", description: "Lista tarefas pendentes do utilizador actual ou de todos (scope=all), opcionalmente só as de hoje/atrasadas.", input_schema: { type: "object", properties: { scope: { type: "string", enum: ["mine", "all"] }, only_due: { type: "boolean" } } } },
  { name: "pipeline_summary", description: "Resumo das oportunidades abertas por fase (contagem e valor) e leads dos últimos 30 dias.", input_schema: { type: "object", properties: {} } },
  { name: "create_task", description: "Cria uma tarefa para o utilizador actual.", input_schema: { type: "object", properties: { title: { type: "string" }, due_date: { type: "string", description: "YYYY-MM-DD" }, priority: { type: "string", enum: ["baixa", "normal", "alta", "urgente"] }, description: { type: "string" } }, required: ["title"] } },
  { name: "create_lead", description: "Cria um lead.", input_schema: { type: "object", properties: { name: { type: "string" }, phone: { type: "string" }, email: { type: "string" }, organization_name: { type: "string" }, interest: { type: "string" }, notes: { type: "string" } }, required: ["name"] } },
  { name: "add_note", description: "Adiciona uma nota à cronologia de um registo (id obtido com search_records).", input_schema: { type: "object", properties: { table: { type: "string" }, id: { type: "string" }, note: { type: "string" } }, required: ["table", "id", "note"] } },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json({ error: "Sessão inválida" }, 401);
    const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: ai } = await db.from("integrations").select("config, active").eq("provider", "ai").single();
    if (!ai?.active || !ai.config?.api_key) return json({ error: "Configure a chave da Anthropic em Integrações → Assistente de IA" }, 400);
    const { messages, language = "pt" } = await req.json();
    const { data: me } = await db.from("profiles").select("full_name, role").eq("id", user.id).single();

    const run = async (name: string, input: any) => {
      switch (name) {
        case "search_records": {
          const cols = { contacts: "id, first_name, last_name, email, phone, mobile, city", organizations: "id, name, email, phone, city, category", leads: "id, name, phone, email, status, interest", opportunities: "id, name, value, currency, status, expected_close" }[input.table as string];
          const fields = { contacts: ["first_name", "last_name", "email", "phone", "mobile"], organizations: ["name", "email", "phone"], leads: ["name", "email", "phone"], opportunities: ["name"] }[input.table as string] as string[];
          const { data } = await db.from(input.table).select(cols).or(fields.map((f) => `${f}.ilike.%${input.query}%`).join(",")).limit(10);
          return data;
        }
        case "list_tasks": {
          let q = db.from("tasks").select("id, title, due_date, priority, status, profiles:assigned_to(full_name)").in("status", ["pendente", "em curso"]).order("due_date").limit(30);
          if (input.scope !== "all") q = q.eq("assigned_to", user.id);
          if (input.only_due) q = q.lte("due_date", new Date().toISOString().slice(0, 10));
          return (await q).data;
        }
        case "pipeline_summary": {
          const [o, s, l] = await Promise.all([db.from("opportunities").select("value, currency, stage_id").eq("status", "aberta"), db.from("stages").select("id, name"), db.from("leads").select("id, status").gte("created_at", new Date(Date.now() - 30 * 864e5).toISOString())]);
          const by: Record<string, { n: number; value: number }> = {};
          (o.data ?? []).forEach((x: any) => { const n = (s.data ?? []).find((y: any) => y.id === x.stage_id)?.name ?? "?"; by[n] = by[n] ?? { n: 0, value: 0 }; by[n].n++; by[n].value += Number(x.value || 0); });
          return { open_by_stage: by, leads_30d: l.data?.length ?? 0 };
        }
        case "create_task": { const { data, error } = await db.from("tasks").insert({ ...input, assigned_to: user.id, created_by: user.id }).select("id, title, due_date").single(); return error ? { error: error.message } : data; }
        case "create_lead": { const { data, error } = await db.from("leads").insert({ ...input, source: "outro", owner_id: user.id }).select("id, name").single(); return error ? { error: error.message } : data; }
        case "add_note": { const { error } = await db.from("activities").insert({ kind: "nota", body: input.note, linked_table: input.table, linked_id: input.id, user_id: user.id }); return error ? { error: error.message } : { ok: true }; }
      }
    };

    const system = `És o assistente do Gotapura CRM (empresa angolana de tratamento de água). Utilizador: ${me?.full_name} (${me?.role}). Data: ${new Date().toISOString().slice(0, 10)}. Responde em ${language === "en" ? "inglês" : "português de Portugal"}, de forma curta e útil. Usa as ferramentas para consultar ou registar dados; confirma o que criaste. Nunca inventes registos.`;
    let msgs = messages.slice(-20);
    for (let i = 0; i < 6; i++) {
      const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": ai.config.api_key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: ai.config.model || "claude-sonnet-4-5", max_tokens: 1200, system, tools: TOOLS, messages: msgs }) });
      const out = await r.json();
      if (!r.ok) return json({ error: out.error?.message ?? "Erro na API" }, 400);
      msgs = [...msgs, { role: "assistant", content: out.content }];
      if (out.stop_reason !== "tool_use") return json({ reply: out.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n") });
      const results = [];
      for (const c of out.content) if (c.type === "tool_use") results.push({ type: "tool_result", tool_use_id: c.id, content: JSON.stringify(await run(c.name, c.input)) });
      msgs = [...msgs, { role: "user", content: results }];
    }
    return json({ reply: "Não consegui concluir o pedido." });
  } catch (e) { return json({ error: String(e) }, 400); }
});
