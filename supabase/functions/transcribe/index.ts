import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const languageMap: Record<string, string> = {
  english: "en",
  spanish: "es",
  french: "fr",
  german: "de",
  italian: "it",
  portuguese: "pt",
  dutch: "nl",
  russian: "ru",
  chinese: "zh",
  japanese: "ja",
  korean: "ko",
  arabic: "ar",
  hindi: "hi",
  turkish: "tr",
  polish: "pl",
  swedish: "sv",
  danish: "da",
  norwegian: "no",
  finnish: "fi",
  greek: "el",
  hebrew: "he",
  thai: "th",
  vietnamese: "vi",
  indonesian: "id",
  malay: "ms",
  tagalog: "tl",
  czech: "cs",
  romanian: "ro",
  hungarian: "hu",
  ukrainian: "uk",
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function parseOpenAIError(errorText: string): { type?: string; code?: string; message?: string } {
  try {
    const parsed = JSON.parse(errorText);
    return {
      type: parsed?.error?.type,
      code: parsed?.error?.code,
      message: parsed?.error?.message,
    };
  } catch {
    return {};
  }
}

function normalizeLanguageCode(languageHint: string | null): string | null {
  if (!languageHint) return null;
  const normalized = languageHint.trim().toLowerCase();
  if (!normalized) return null;

  if (normalized.length === 2) return normalized;
  return languageMap[normalized] || normalized.slice(0, 2);
}

function buildWhisperForm(audioFile: File, languageCode: string | null) {
  const form = new FormData();
  form.append("file", audioFile, audioFile.name || "recording.webm");
  form.append("model", "whisper-1");
  if (languageCode) {
    form.append("language", languageCode);
  }
  return form;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;
    const languageHint = formData.get("language") as string | null;

    if (!audioFile) {
      return new Response(JSON.stringify({ error: "No audio file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const languageCode = normalizeLanguageCode(languageHint);

    const maxRetries = 3;
    let delayMs = 2000;
    let finalResponse: Response | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      finalResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: buildWhisperForm(audioFile, languageCode),
      });

      if (finalResponse.status !== 429) break;

      const rateLimitText = await finalResponse.text();
      const parsedRateError = parseOpenAIError(rateLimitText);
      const isQuotaError = parsedRateError.type === "insufficient_quota" || parsedRateError.code === "insufficient_quota";

      if (isQuotaError) {
        return new Response(
          JSON.stringify({ error: "OpenAI quota exceeded. Please update billing or use a different key." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (attempt === maxRetries) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const retryAfter = Number(finalResponse.headers.get("retry-after"));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : delayMs;

      await sleep(waitMs);
      delayMs = Math.min(delayMs * 2, 15000);
    }

    if (!finalResponse) {
      throw new Error("Transcription request did not complete");
    }

    if (!finalResponse.ok) {
      const errorText = await finalResponse.text();
      const parsedError = parseOpenAIError(errorText);
      console.error("Whisper API error:", finalResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: parsedError.message || "Transcription failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const result = await finalResponse.json();
    const transcript = typeof result?.text === "string" ? result.text.trim() : "";

    return new Response(JSON.stringify({ transcript }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("transcribe error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
