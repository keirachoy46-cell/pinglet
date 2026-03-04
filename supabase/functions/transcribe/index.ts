import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

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

async function transcribeWithLovableFallback(audioFile: File, languageHint: string | null): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("Fallback unavailable: LOVABLE_API_KEY is not configured");
  }

  const arrayBuffer = await audioFile.arrayBuffer();
  const base64Audio = base64Encode(arrayBuffer);
  const mimeType = audioFile.type || "audio/webm";

  const languageInstruction = languageHint
    ? `The audio is likely in ${languageHint}. `
    : "";

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `You are a speech-to-text transcription assistant. ${languageInstruction}Transcribe the audio exactly as spoken. Output ONLY the transcribed text, nothing else. If the audio is silent or unintelligible, output an empty string.`,
        },
        {
          role: "user",
          content: [
            {
              type: "input_audio",
              input_audio: {
                data: base64Audio,
                format: mimeType.includes("wav") ? "wav" : mimeType.includes("mp3") ? "mp3" : "wav",
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Fallback transcription failed (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  return typeof result?.choices?.[0]?.message?.content === "string"
    ? result.choices[0].message.content.trim()
    : "";
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
      const transcript = await transcribeWithLovableFallback(audioFile, languageHint);
      return new Response(JSON.stringify({ transcript, provider: "lovable_fallback" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const languageCode = normalizeLanguageCode(languageHint);

    const maxRetries = 3;
    let delayMs = 2000;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const openAIResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: buildWhisperForm(audioFile, languageCode),
      });

      if (openAIResponse.ok) {
        const result = await openAIResponse.json();
        const transcript = typeof result?.text === "string" ? result.text.trim() : "";

        return new Response(JSON.stringify({ transcript, provider: "openai_whisper" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (openAIResponse.status === 429) {
        const rateLimitText = await openAIResponse.text();
        const parsedRateError = parseOpenAIError(rateLimitText);
        const isQuotaError = parsedRateError.type === "insufficient_quota" || parsedRateError.code === "insufficient_quota";

        if (isQuotaError || attempt === maxRetries) {
          try {
            const transcript = await transcribeWithLovableFallback(audioFile, languageHint);
            return new Response(JSON.stringify({ transcript, provider: "lovable_fallback" }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          } catch (fallbackErr) {
            return new Response(
              JSON.stringify({
                error: isQuotaError
                  ? "OpenAI quota exceeded and fallback transcription is unavailable."
                  : "Rate limit exceeded and fallback transcription is unavailable.",
                details: fallbackErr instanceof Error ? fallbackErr.message : "Unknown fallback error",
              }),
              { status: isQuotaError ? 402 : 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
        }

        const retryAfter = Number(openAIResponse.headers.get("retry-after"));
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : delayMs;

        await sleep(waitMs);
        delayMs = Math.min(delayMs * 2, 15000);
        continue;
      }

      const errorText = await openAIResponse.text();
      const parsedError = parseOpenAIError(errorText);
      console.error("Whisper API error:", openAIResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: parsedError.message || "Transcription failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: "Transcription failed after retries." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("transcribe error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
