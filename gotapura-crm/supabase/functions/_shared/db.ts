// Cliente Supabase com chave de serviço (apenas para Edge Functions).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
export const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
export async function integration(provider: string) {
  const { data } = await db.from("integrations").select("config, active").eq("provider", provider).single();
  if (!data?.active) throw new Error(`Integração "${provider}" inactiva ou não configurada`);
  return data.config as Record<string, string>;
}
export async function findContact(phone: string) {
  const tail = phone.replace(/\D/g, "").slice(-9);
  const { data } = await db.from("contacts").select("id").or(`phone.ilike.%${tail},mobile.ilike.%${tail},whatsapp.ilike.%${tail}`).limit(1);
  return data?.[0]?.id ?? null;
}
