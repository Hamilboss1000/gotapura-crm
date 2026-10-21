// Publica uma entrada nas redes sociais. Chamada pelo botão "Publicar" ou por cron (ver supabase/cron.sql) para posts agendados vencidos.
import { db, json, integration } from "../_shared/db.ts";

async function publish(post: Record<string, string>) {
  const cfg = await integration(post.channel);
  switch (post.channel) {
    case "facebook": {
      const ep = post.media_url ? "photos" : "feed";
      const params = new URLSearchParams({ access_token: cfg.access_token, ...(post.media_url ? { url: post.media_url, caption: post.content } : { message: post.content }) });
      const r = await fetch(`https://graph.facebook.com/v20.0/${cfg.page_id}/${ep}`, { method: "POST", body: params });
      const out = await r.json(); if (!r.ok) throw new Error(out.error?.message); return out.id ?? out.post_id;
    }
    case "instagram": {                                // Instagram exige imagem/vídeo
      if (!post.media_url) throw new Error("Instagram requer imagem ou vídeo");
      const c = await fetch(`https://graph.facebook.com/v20.0/${cfg.account_id}/media`, { method: "POST", body: new URLSearchParams({ access_token: cfg.access_token, image_url: post.media_url, caption: post.content }) }).then((r) => r.json());
      if (!c.id) throw new Error(c.error?.message ?? "Falha ao criar conteúdo");
      const p = await fetch(`https://graph.facebook.com/v20.0/${cfg.account_id}/media_publish`, { method: "POST", body: new URLSearchParams({ access_token: cfg.access_token, creation_id: c.id }) }).then((r) => r.json());
      if (!p.id) throw new Error(p.error?.message ?? "Falha ao publicar"); return p.id;
    }
    case "linkedin": {
      const r = await fetch("https://api.linkedin.com/v2/ugcPosts", { method: "POST", headers: { Authorization: `Bearer ${cfg.access_token}`, "Content-Type": "application/json", "X-Restli-Protocol-Version": "2.0.0" },
        body: JSON.stringify({ author: `urn:li:organization:${cfg.organization_id}`, lifecycleState: "PUBLISHED", specificContent: { "com.linkedin.ugc.ShareContent": { shareCommentary: { text: post.content }, shareMediaCategory: "NONE" } }, visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" } }) });
      if (!r.ok) throw new Error(await r.text()); return r.headers.get("x-restli-id") ?? "ok";
    }
    default: throw new Error(`Canal ${post.channel} ainda não suportado`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({});
  const body = await req.json().catch(() => ({}));
  const q = db.from("social_posts").select("*");
  const { data: posts } = body.id ? await q.eq("id", body.id) : await q.eq("status", "agendada").lte("scheduled_at", new Date().toISOString());
  const results = [];
  for (const p of posts ?? []) {
    try { const external_id = await publish(p); await db.from("social_posts").update({ status: "publicada", published_at: new Date().toISOString(), external_id, error: null }).eq("id", p.id); results.push({ id: p.id, ok: true }); }
    catch (e) { await db.from("social_posts").update({ status: "falhada", error: String(e) }).eq("id", p.id); results.push({ id: p.id, ok: false, error: String(e) }); }
  }
  return json({ results });
});
