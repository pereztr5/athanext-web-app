import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const { data: isAdmin, error: roleError } = await userClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (roleError || !isAdmin) return json({ error: "Only an admin can manage accounts" }, 403);

    const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const body = await req.json();
    const action = body?.action;

    if (action === "search") {
      const { data, error } = await userClient.rpc("admin_search_users", {
        p_query: body?.query ?? "",
      });
      if (error) return json({ error: error.message }, 400);
      return json({ users: data ?? [] });
    }

    const userId = body?.user_id;
    if (typeof userId !== "string" || !userId) {
      return json({ error: "user_id is required" }, 400);
    }

    if (action === "update") {
      const { error } = await userClient.rpc("admin_update_account", {
        p_user_id: userId,
        p_name: body?.name ?? "",
        p_email: body?.email ?? "",
        p_persona: body?.persona ?? "",
      });
      if (error) return json({ error: error.message }, 400);

      const { data: existing, error: lookupError } = await service.auth.admin.getUserById(userId);
      if (lookupError) return json({ error: lookupError.message }, 400);

      const { error: authUpdateError } = await service.auth.admin.updateUserById(userId, {
        email: String(body?.email ?? "").trim().toLowerCase(),
        email_confirm: true,
        user_metadata: {
          ...(existing.user?.user_metadata ?? {}),
          name: String(body?.name ?? "").trim(),
          persona_type: String(body?.persona ?? "").trim().toLowerCase(),
        },
      });
      if (authUpdateError) return json({ error: authUpdateError.message }, 400);
      return json({ ok: true });
    }

    if (action === "deactivate" || action === "reactivate") {
      const active = action === "reactivate";
      const { error } = await userClient.rpc("admin_set_account_active", {
        p_user_id: userId,
        p_active: active,
      });
      if (error) return json({ error: error.message }, 400);

      const { error: banError } = await service.auth.admin.updateUserById(userId, {
        ban_duration: active ? "none" : "876000h",
      });
      if (banError) return json({ error: banError.message }, 400);
      return json({ ok: true });
    }

    if (action === "delete") {
      const { error } = await userClient.rpc("admin_prepare_account_deletion", {
        p_user_id: userId,
      });
      if (error) return json({ error: error.message }, 400);

      const { error: deleteError } = await service.auth.admin.deleteUser(userId);
      if (deleteError && !/not found/i.test(deleteError.message)) {
        return json({ error: deleteError.message }, 400);
      }

      const { error: profileError } = await service.from("user_profiles").delete().eq("id", userId);
      if (profileError) return json({ error: profileError.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Account update failed";
    return json({ error: message }, 500);
  }
});
