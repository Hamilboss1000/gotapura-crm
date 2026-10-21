// Gestão de utilizadores pelo administrador: criar, eliminar e definir palavra-passe.
// Deploy: painel Supabase → Edge Functions → Deploy a new function → Via Editor → nome "admin-users" → colar este código.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const auth = req.headers.get("Authorization") ?? "";
    // 1) Quem chama tem de ser administrador
    const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json({ error: "Sessão inválida" }, 401);
    const { data: me } = await caller.from("profiles").select("role").eq("id", user.id).single();
    if (me?.role !== "admin") return json({ error: "Apenas administradores" }, 403);
    // 2) Operação com a chave de serviço
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();
    switch (body.action) {
      case "create": {
        const { email, password, full_name, role, department, extension, phone, job_title } = body;
        if (!email || !password) return json({ error: "E-mail e palavra-passe são obrigatórios" }, 400);
        const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } });
        if (error) return json({ error: error.message }, 400);
        await admin.from("profiles").upsert({ id: data.user.id, email, full_name, role: role ?? "agent", department, extension, phone, job_title, active: true });
        return json({ ok: true, id: data.user.id });
      }
      case "delete": {
        if (body.id === user.id) return json({ error: "Não pode eliminar a sua própria conta" }, 400);
        const { error } = await admin.auth.admin.deleteUser(body.id);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }
      case "set_password": {
        const { error } = await admin.auth.admin.updateUserById(body.id, { password: body.password });
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }
      default: return json({ error: "Acção desconhecida" }, 400);
    }
  } catch (e) { return json({ error: String(e) }, 400); }
});
