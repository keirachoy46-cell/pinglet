import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { taskType, messageText, transcript } = await req.json();

    if (!transcript) {
      return new Response(JSON.stringify({ error: "No transcript provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const systemPrompt = `You are a classification assistant for an elderly care notification system.
You must classify the elder's voice reply to a task reminder.

Task type: ${taskType || "general"}
Original reminder message: "${messageText || ""}"
Elder's reply transcript: "${transcript}"

Classify the reply as EXACTLY one of these labels:
- "done" — the elder clearly confirms they completed the task (e.g., "yes I took it", "already done", "finished")
- "missed" — the elder clearly says they did NOT do it or refuses (e.g., "no", "I forgot", "not yet", "I don't want to")
- "unclear" — the reply is ambiguous, off-topic, or doesn't clearly indicate done or missed

Respond with ONLY the classification label, nothing else. Output must be exactly one of: done, missed, unclear`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: transcript },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("OpenAI error:", response.status, errorText);
      throw new Error("Classification failed");
    }

    const result = await response.json();
    const label = (result.choices?.[0]?.message?.content || "unclear").trim().toLowerCase();

    const validLabels = ["done", "missed", "unclear"];
    const classification = validLabels.includes(label) ? label : "unclear";

    return new Response(JSON.stringify({ classification }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("classify-reply error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
