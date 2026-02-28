import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MOOD_LABELS: Record<number, string> = {
  1: "very low",
  2: "low",
  3: "okay",
  4: "good",
  5: "great",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { moodScore, tags, transcript, preferredLanguage } = await req.json();

    if (moodScore === undefined) {
      return new Response(JSON.stringify({ error: "No mood score provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const lang = preferredLanguage || "English";
    const moodLabel = MOOD_LABELS[moodScore] || "okay";
    const tagsList = tags && tags.length > 0 ? tags.join(", ") : "none selected";

    const systemPrompt = `You are a warm, caring companion for an elderly person. They just shared how they're feeling.

Their mood: ${moodLabel} (${moodScore}/5)
Tags they selected: ${tagsList}
${transcript ? `They also said: "${transcript}"` : ""}

Generate a warm, empathetic acknowledgement in ${lang}. Follow these rules:
- Write exactly 2 short, warm sentences acknowledging their feelings
- Add a brief closing line (e.g., "Take care" or "I'm here for you")
- Be genuinely caring, not clinical or formal
- If mood is low (1-2), be extra gentle and comforting
- If mood is good (4-5), share in their positivity
- Never give medical advice
- Keep it simple and heartfelt`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `My mood is ${moodLabel}. Tags: ${tagsList}.${transcript ? ` I said: "${transcript}"` : ""}` },
          ],
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted, please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Mood acknowledgement failed");
    }

    const result = await response.json();
    const acknowledgement = result.choices?.[0]?.message?.content || "Thank you for sharing how you feel. Take care.";

    return new Response(JSON.stringify({ acknowledgement }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("mood-ack error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
