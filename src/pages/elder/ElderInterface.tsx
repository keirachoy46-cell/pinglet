import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Mic, MicOff, MessageCircle, Smile, Loader2, Volume2 } from "lucide-react";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import type { Tables } from "@/integrations/supabase/types";

type ElderProfile = Tables<"elder_profiles">;
type NotificationInstance = Tables<"notification_instances">;
type NotificationTemplate = Tables<"notification_templates">;
type MoodSettings = Tables<"mood_settings">;

type ActiveView = "home" | "reply" | "ask" | "mood";

const MOOD_EMOJIS = [
  { score: 1, emoji: "😢", label: "Very Low" },
  { score: 2, emoji: "😟", label: "Low" },
  { score: 3, emoji: "😐", label: "Okay" },
  { score: 4, emoji: "😊", label: "Good" },
  { score: 5, emoji: "😄", label: "Great" },
];

const MOOD_TAGS = ["Tired", "Lonely", "Happy", "Anxious", "Grateful", "Pain", "Calm", "Bored"];

export default function ElderInterface() {
  const { elderProfileId } = useParams<{ elderProfileId: string }>();
  const [elder, setElder] = useState<ElderProfile | null>(null);
  const [pendingInstance, setPendingInstance] = useState<(NotificationInstance & { template?: NotificationTemplate }) | null>(null);
  const [moodSettings, setMoodSettings] = useState<MoodSettings | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>("home");
  const [loading, setLoading] = useState(true);

  // Reply flow state
  const [replyStep, setReplyStep] = useState<"listen" | "record" | "processing" | "done">("listen");
  const [isPlayingTTS, setIsPlayingTTS] = useState(false);

  // Ask flow state
  const [askStep, setAskStep] = useState<"record" | "processing" | "answer">("record");
  const [answerText, setAnswerText] = useState("");

  // Mood flow state
  const [moodStep, setMoodStep] = useState<"score" | "tags" | "voice" | "processing" | "ack">("score");
  const [selectedMoodScore, setSelectedMoodScore] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [ackText, setAckText] = useState("");

  // Processing states
  const [processingLabel, setProcessingLabel] = useState("");

  const recorder = useVoiceRecorder();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch elder profile + pending instance + mood settings
  useEffect(() => {
    if (!elderProfileId) return;
    const fetchData = async () => {
      const [{ data: elderData }, { data: instData }, { data: moodData }] = await Promise.all([
        supabase.from("elder_profiles").select("*").eq("id", elderProfileId).single(),
        supabase
          .from("notification_instances")
          .select("*")
          .eq("elder_profile_id", elderProfileId)
          .eq("status", "pending")
          .order("scheduled_at", { ascending: true })
          .limit(1),
        supabase.from("mood_settings").select("*").eq("elder_profile_id", elderProfileId).single(),
      ]);

      if (elderData) setElder(elderData);
      if (moodData) setMoodSettings(moodData);

      if (instData && instData.length > 0) {
        // Fetch template for the pending instance
        const { data: tpl } = await supabase
          .from("notification_templates")
          .select("*")
          .eq("id", instData[0].template_id)
          .single();
        setPendingInstance({ ...instData[0], template: tpl || undefined });
      }
      setLoading(false);
    };
    fetchData();
  }, [elderProfileId]);

  // --- AUDIO HELPERS ---
  const playBase64Audio = useCallback((base64: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const audio = new Audio(`data:audio/mp3;base64,${base64}`);
      audioRef.current = audio;
      setIsPlayingTTS(true);
      audio.onended = () => { setIsPlayingTTS(false); resolve(); };
      audio.onerror = (e) => { setIsPlayingTTS(false); reject(e); };
      audio.play();
    });
  }, []);

  const generateAndPlayTTS = useCallback(async (text: string, language: string) => {
    const { data, error } = await supabase.functions.invoke("tts-generate", {
      body: { text, language },
    });
    if (error || !data?.audioContent) throw new Error("TTS failed");
    await playBase64Audio(data.audioContent);
  }, [playBase64Audio]);

  const transcribeAudio = useCallback(async (blob: Blob, language: string): Promise<string> => {
    const formData = new FormData();
    formData.append("audio", blob, "recording.webm");
    formData.append("language", language);

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe`,
      {
        method: "POST",
        headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: formData,
      }
    );
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Transcription failed");
    return result.transcript;
  }, []);

  // --- REPLY FLOW ---
  const startReplyFlow = useCallback(async () => {
    if (!pendingInstance?.template || !elder) return;
    setActiveView("reply");
    setReplyStep("listen");

    try {
      // Play TTS of the notification message
      const tpl = pendingInstance.template;
      if (tpl.voice_mode === "family_recorded" && tpl.family_voice_audio_url) {
        // Play family recorded audio from storage
        const { data: urlData } = supabase.storage.from("voice-recordings").getPublicUrl(tpl.family_voice_audio_url);
        const audio = new Audio(urlData.publicUrl);
        audioRef.current = audio;
        setIsPlayingTTS(true);
        await new Promise<void>((resolve) => {
          audio.onended = () => { setIsPlayingTTS(false); resolve(); };
          audio.play();
        });
      } else {
        await generateAndPlayTTS(tpl.message_text, elder.preferred_language);
      }
      setReplyStep("record");
    } catch (err) {
      console.error("TTS playback error:", err);
      setReplyStep("record");
    }
  }, [pendingInstance, elder, generateAndPlayTTS]);

  const handleReplyRecord = useCallback(async () => {
    if (recorder.isRecording) {
      const blob = await recorder.stopRecording();
      if (!blob || !pendingInstance || !elder) return;

      setReplyStep("processing");
      setProcessingLabel("Transcribing your reply...");

      try {
        const transcript = await transcribeAudio(blob, elder.preferred_language);
        setProcessingLabel("Understanding your reply...");

        const tpl = pendingInstance.template;
        const isTask = tpl?.category === "task";

        let classLabel = "done";
        if (isTask) {
          const { data: classData } = await supabase.functions.invoke("classify-reply", {
            body: {
              taskType: tpl?.type || "general",
              messageText: tpl?.message_text || "",
              transcript,
            },
          });
          classLabel = classData?.classification || "unclear";
        }

        // Update notification instance
        await supabase
          .from("notification_instances")
          .update({
            status: classLabel,
            reply_transcript: isTask && classLabel !== "unclear" ? null : transcript,
            classification_label: isTask ? classLabel : null,
          })
          .eq("id", pendingInstance.id);

        setReplyStep("done");

        // Play thank you
        try {
          await generateAndPlayTTS(
            elder.preferred_language === "Hindi" ? "धन्यवाद!" : "Thank you!",
            elder.preferred_language
          );
        } catch { /* ignore TTS error for thank you */ }

        // Refresh after delay
        setTimeout(() => {
          setActiveView("home");
          setPendingInstance(null);
        }, 3000);
      } catch (err) {
        console.error("Reply processing error:", err);
        toast.error("Something went wrong. Please try again.");
        setReplyStep("record");
      }
    } else {
      await recorder.startRecording();
    }
  }, [recorder, pendingInstance, elder, transcribeAudio, generateAndPlayTTS]);

  // --- ASK A QUESTION FLOW ---
  const handleAskRecord = useCallback(async () => {
    if (recorder.isRecording) {
      const blob = await recorder.stopRecording();
      if (!blob || !elder) return;

      setAskStep("processing");
      setProcessingLabel("Listening to your question...");

      try {
        const transcript = await transcribeAudio(blob, elder.preferred_language);
        setProcessingLabel("Thinking of an answer...");

        const { data: qaData } = await supabase.functions.invoke("qa-answer", {
          body: { questionTranscript: transcript, preferredLanguage: elder.preferred_language },
        });

        const answer = qaData?.answer || "I'm sorry, I couldn't understand that.";
        setAnswerText(answer);
        setAskStep("answer");

        // Save Q&A interaction
        await supabase.from("qa_interactions").insert({
          elder_profile_id: elder.id,
          question_transcript: transcript,
          answer_text: answer,
          language_used: elder.preferred_language,
        });

        // Play answer via TTS
        try {
          await generateAndPlayTTS(answer, elder.preferred_language);
        } catch { /* ignore */ }
      } catch (err) {
        console.error("Q&A error:", err);
        toast.error("Something went wrong. Please try again.");
        setAskStep("record");
      }
    } else {
      await recorder.startRecording();
    }
  }, [recorder, elder, transcribeAudio, generateAndPlayTTS]);

  // --- MOOD FLOW ---
  const handleMoodScore = (score: number) => {
    setSelectedMoodScore(score);
    setMoodStep("tags");
  };

  const handleMoodTagsDone = () => {
    setMoodStep("voice");
  };

  const processMoodEntry = useCallback(async (voiceBlob: Blob | null) => {
    if (!elder || selectedMoodScore === null) return;
    setMoodStep("processing");
    setProcessingLabel("Saving your mood...");

    try {
      let transcript: string | null = null;
      if (voiceBlob) {
        transcript = await transcribeAudio(voiceBlob, elder.preferred_language);
      }

      setProcessingLabel("Preparing a warm message...");

      const { data: ackData } = await supabase.functions.invoke("mood-ack", {
        body: {
          moodScore: selectedMoodScore,
          tags: selectedTags,
          transcript,
          preferredLanguage: elder.preferred_language,
        },
      });

      const ack = ackData?.acknowledgement || "Thank you for sharing how you feel.";
      setAckText(ack);

      // Save mood entry
      await supabase.from("mood_entries").insert({
        elder_profile_id: elder.id,
        mood_score: selectedMoodScore,
        selected_tags: selectedTags.length > 0 ? selectedTags : null,
        mood_transcript: transcript,
        acknowledgement_text: ack,
      });

      setMoodStep("ack");

      // Play acknowledgement
      try {
        await generateAndPlayTTS(ack, elder.preferred_language);
      } catch { /* ignore */ }
    } catch (err) {
      console.error("Mood entry error:", err);
      toast.error("Something went wrong.");
      setMoodStep("score");
    }
  }, [elder, selectedMoodScore, selectedTags, transcribeAudio, generateAndPlayTTS]);

  const handleMoodVoice = useCallback(async (skipVoice: boolean) => {
    if (!skipVoice && recorder.isRecording) {
      const blob = await recorder.stopRecording();
      await processMoodEntry(blob);
    } else if (!skipVoice) {
      await recorder.startRecording();
      return;
    } else {
      await processMoodEntry(null);
    }
  }, [recorder, processMoodEntry]);

  const resetToHome = () => {
    setActiveView("home");
    setAskStep("record");
    setMoodStep("score");
    setSelectedMoodScore(null);
    setSelectedTags([]);
    setAnswerText("");
    setAckText("");
    recorder.reset();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!elder) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-8">
        <p className="text-2xl text-muted-foreground text-center">Profile not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-primary text-primary-foreground px-6 py-8">
        <h1 className="text-4xl md:text-5xl font-display font-bold">
          Hi, {elder.display_name} 👋
        </h1>
        {activeView !== "home" && (
          <Button
            variant="ghost"
            className="mt-3 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10 text-lg"
            onClick={resetToHome}
          >
            ← Back
          </Button>
        )}
      </header>

      <main className="flex-1 px-4 md:px-8 py-6 max-w-2xl mx-auto w-full space-y-6">
        {/* HOME VIEW */}
        {activeView === "home" && (
          <>
            {/* Pending Reminder */}
            {pendingInstance ? (
              <Card className="border-2 border-primary/30 shadow-lg">
                <CardContent className="p-6 md:p-8 space-y-5">
                  <div className="flex items-center gap-3">
                    <Volume2 className="h-7 w-7 text-primary shrink-0" />
                    <h2 className="text-2xl md:text-3xl font-display font-semibold text-foreground">
                      You have a reminder
                    </h2>
                  </div>
                  <p className="text-xl md:text-2xl text-foreground/80 leading-relaxed">
                    {pendingInstance.template?.message_text || "You have a pending notification."}
                  </p>
                  <Button
                    size="lg"
                    className="w-full h-16 text-xl md:text-2xl font-display font-semibold gap-3"
                    onClick={startReplyFlow}
                  >
                    <Mic className="h-6 w-6" /> Reply Now
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-0 shadow-md">
                <CardContent className="p-6 md:p-8 text-center">
                  <p className="text-2xl md:text-3xl text-muted-foreground font-display">
                    No reminders right now ✨
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Ask a Question Button */}
            <Button
              variant="outline"
              size="lg"
              className="w-full h-16 text-xl md:text-2xl font-display font-semibold gap-3 border-2"
              onClick={() => { setActiveView("ask"); setAskStep("record"); recorder.reset(); }}
            >
              <MessageCircle className="h-6 w-6" /> Ask a Question
            </Button>

            {/* Mood Check-in Button */}
            {moodSettings?.is_enabled && (
              <Button
                variant="outline"
                size="lg"
                className="w-full h-16 text-xl md:text-2xl font-display font-semibold gap-3 border-2 border-accent/50 text-accent hover:bg-accent hover:text-accent-foreground"
                onClick={() => { setActiveView("mood"); setMoodStep("score"); setSelectedMoodScore(null); setSelectedTags([]); recorder.reset(); }}
              >
                <Smile className="h-6 w-6" /> How are you feeling?
              </Button>
            )}
          </>
        )}

        {/* REPLY VIEW */}
        {activeView === "reply" && (
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6 md:p-8 space-y-6 text-center">
              {replyStep === "listen" && (
                <>
                  <Volume2 className="h-16 w-16 text-primary mx-auto animate-pulse-gentle" />
                  <p className="text-2xl font-display text-foreground">
                    {isPlayingTTS ? "Listening to your reminder..." : "Preparing audio..."}
                  </p>
                  <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                </>
              )}

              {replyStep === "record" && (
                <>
                  <p className="text-2xl font-display text-foreground">
                    {recorder.isRecording ? "Recording... Tap to stop" : "Tap to record your reply"}
                  </p>
                  <Button
                    size="lg"
                    variant={recorder.isRecording ? "destructive" : "default"}
                    className="w-32 h-32 rounded-full text-3xl mx-auto flex items-center justify-center"
                    onClick={handleReplyRecord}
                  >
                    {recorder.isRecording ? <MicOff className="h-12 w-12" /> : <Mic className="h-12 w-12" />}
                  </Button>
                </>
              )}

              {replyStep === "processing" && (
                <>
                  <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto" />
                  <p className="text-2xl font-display text-foreground">{processingLabel}</p>
                </>
              )}

              {replyStep === "done" && (
                <>
                  <div className="text-6xl">✅</div>
                  <p className="text-3xl font-display text-foreground font-semibold">Thank you!</p>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* ASK A QUESTION VIEW */}
        {activeView === "ask" && (
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6 md:p-8 space-y-6 text-center">
              {askStep === "record" && (
                <>
                  <p className="text-2xl font-display text-foreground">
                    {recorder.isRecording ? "Listening... Tap when done" : "Tap to ask your question"}
                  </p>
                  <Button
                    size="lg"
                    variant={recorder.isRecording ? "destructive" : "default"}
                    className="w-32 h-32 rounded-full text-3xl mx-auto flex items-center justify-center"
                    onClick={handleAskRecord}
                  >
                    {recorder.isRecording ? <MicOff className="h-12 w-12" /> : <Mic className="h-12 w-12" />}
                  </Button>
                </>
              )}

              {askStep === "processing" && (
                <>
                  <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto" />
                  <p className="text-2xl font-display text-foreground">{processingLabel}</p>
                </>
              )}

              {askStep === "answer" && (
                <>
                  <div className="text-5xl mb-2">💬</div>
                  <p className="text-xl md:text-2xl text-foreground leading-relaxed text-left">
                    {answerText}
                  </p>
                  {isPlayingTTS && (
                    <div className="flex items-center justify-center gap-2 text-primary">
                      <Volume2 className="h-5 w-5 animate-pulse-gentle" />
                      <span className="text-sm">Playing answer...</span>
                    </div>
                  )}
                  <div className="flex gap-3 pt-4">
                    <Button
                      size="lg"
                      variant="outline"
                      className="flex-1 h-14 text-lg font-display"
                      onClick={resetToHome}
                    >
                      Done
                    </Button>
                    <Button
                      size="lg"
                      className="flex-1 h-14 text-lg font-display gap-2"
                      onClick={() => { setAskStep("record"); recorder.reset(); }}
                    >
                      <Mic className="h-5 w-5" /> Ask Another
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* MOOD VIEW */}
        {activeView === "mood" && (
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6 md:p-8 space-y-6">
              {moodStep === "score" && (
                <div className="text-center space-y-6">
                  <p className="text-2xl md:text-3xl font-display text-foreground font-semibold">
                    How are you feeling?
                  </p>
                  <div className="flex justify-center gap-3 md:gap-5 flex-wrap">
                    {MOOD_EMOJIS.map((m) => (
                      <button
                        key={m.score}
                        className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-muted/50 transition-colors"
                        onClick={() => handleMoodScore(m.score)}
                      >
                        <span className="text-5xl md:text-6xl">{m.emoji}</span>
                        <span className="text-sm md:text-base text-muted-foreground font-medium">{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {moodStep === "tags" && (
                <div className="space-y-5">
                  <p className="text-2xl font-display text-foreground text-center font-semibold">
                    What best describes how you feel?
                  </p>
                  <div className="flex flex-wrap justify-center gap-3">
                    {MOOD_TAGS.map((tag) => (
                      <Button
                        key={tag}
                        variant={selectedTags.includes(tag) ? "default" : "outline"}
                        size="lg"
                        className="text-lg px-6"
                        onClick={() =>
                          setSelectedTags((prev) =>
                            prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                          )
                        }
                      >
                        {tag}
                      </Button>
                    ))}
                  </div>
                  <Button
                    size="lg"
                    className="w-full h-14 text-xl font-display"
                    onClick={handleMoodTagsDone}
                  >
                    Continue
                  </Button>
                </div>
              )}

              {moodStep === "voice" && (
                <div className="text-center space-y-6">
                  <p className="text-2xl font-display text-foreground font-semibold">
                    Want to say more? (optional)
                  </p>
                  <Button
                    size="lg"
                    variant={recorder.isRecording ? "destructive" : "default"}
                    className="w-28 h-28 rounded-full text-3xl mx-auto flex items-center justify-center"
                    onClick={() => handleMoodVoice(false)}
                  >
                    {recorder.isRecording ? <MicOff className="h-10 w-10" /> : <Mic className="h-10 w-10" />}
                  </Button>
                  <p className="text-base text-muted-foreground">
                    {recorder.isRecording ? "Tap to stop recording" : "Tap to record"}
                  </p>
                  <Button
                    variant="ghost"
                    size="lg"
                    className="text-lg text-muted-foreground"
                    onClick={() => handleMoodVoice(true)}
                  >
                    Skip →
                  </Button>
                </div>
              )}

              {moodStep === "processing" && (
                <div className="text-center space-y-4">
                  <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto" />
                  <p className="text-2xl font-display text-foreground">{processingLabel}</p>
                </div>
              )}

              {moodStep === "ack" && (
                <div className="text-center space-y-5">
                  <div className="text-5xl">
                    {MOOD_EMOJIS.find((m) => m.score === selectedMoodScore)?.emoji || "😊"}
                  </div>
                  <p className="text-xl md:text-2xl text-foreground leading-relaxed">
                    {ackText}
                  </p>
                  {isPlayingTTS && (
                    <div className="flex items-center justify-center gap-2 text-primary">
                      <Volume2 className="h-5 w-5 animate-pulse-gentle" />
                      <span className="text-sm">Playing message...</span>
                    </div>
                  )}
                  <Button
                    size="lg"
                    className="w-full h-14 text-xl font-display"
                    onClick={resetToHome}
                  >
                    Done
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
