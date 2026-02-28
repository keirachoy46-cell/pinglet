import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Mic, Square, Save } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type NotificationTemplate = Tables<"notification_templates">;

const TASK_TYPES = [
  { value: "medication", label: "💊 Medication" },
  { value: "appointment", label: "📅 Appointment" },
  { value: "exercise", label: "🏃 Exercise" },
];

const CHECKIN_TYPES = [
  { value: "how_are_you", label: "👋 How are you?" },
  { value: "sleep", label: "😴 Sleep check" },
  { value: "custom", label: "✏️ Custom" },
];

export default function EditNotification() {
  const { templateId } = useParams<{ templateId: string }>();
  const [searchParams] = useSearchParams();
  const elderProfileId = searchParams.get("elderId");
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [template, setTemplate] = useState<NotificationTemplate | null>(null);

  const [category, setCategory] = useState<"task" | "checkin">("task");
  const [type, setType] = useState("medication");
  const [title, setTitle] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [frequency, setFrequency] = useState("daily");
  const [voiceMode, setVoiceMode] = useState<"tts_default" | "family_recorded">("tts_default");
  const [messageText, setMessageText] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [existingAudioUrl, setExistingAudioUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!templateId) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("notification_templates")
        .select("*")
        .eq("id", templateId)
        .single();
      if (data) {
        setTemplate(data);
        setCategory(data.category as "task" | "checkin");
        setType(data.type);
        setTitle(data.title);
        setScheduleTime(data.schedule_time);
        setFrequency(data.frequency);
        setVoiceMode(data.voice_mode as "tts_default" | "family_recorded");
        setMessageText(data.message_text);
        setExistingAudioUrl(data.family_voice_audio_url);
      }
      setLoading(false);
    };
    fetch();
  }, [templateId]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      toast.error("Microphone access denied");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const handleSave = async () => {
    if (!templateId || !elderProfileId) return;
    setSaving(true);

    let familyVoiceAudioUrl = existingAudioUrl;

    if (voiceMode === "family_recorded" && audioBlob) {
      const fileName = `family-voice/${elderProfileId}/${Date.now()}.webm`;
      const { error: uploadError } = await supabase.storage
        .from("voice-recordings")
        .upload(fileName, audioBlob, { contentType: "audio/webm" });
      if (uploadError) {
        toast.error("Failed to upload voice recording");
        setSaving(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("voice-recordings").getPublicUrl(fileName);
      familyVoiceAudioUrl = urlData.publicUrl;
    }

    const { error } = await supabase
      .from("notification_templates")
      .update({
        category,
        type,
        title: title || type,
        schedule_time: scheduleTime,
        frequency,
        voice_mode: voiceMode,
        message_text: messageText,
        family_voice_audio_url: voiceMode === "family_recorded" ? familyVoiceAudioUrl : null,
      })
      .eq("id", templateId);

    if (error) {
      toast.error("Failed to update: " + error.message);
    } else {
      toast.success("Notification updated!");
      navigate("/family");
    }
    setSaving(false);
  };

  const types = category === "task" ? TASK_TYPES : CHECKIN_TYPES;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-lg mx-auto space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/family")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        <Card className="border-0 shadow-lg shadow-primary/5">
          <CardHeader>
            <CardTitle className="font-display">Edit Notification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as "task" | "checkin")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="task">📋 Task Reminder</SelectItem>
                  <SelectItem value="checkin">💬 Daily Check-in</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {types.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Time</Label>
              <Input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="twice_daily">Twice Daily</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Voice Mode</Label>
              <Select value={voiceMode} onValueChange={(v) => setVoiceMode(v as "tts_default" | "family_recorded")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="family_recorded">🎙️ Record Your Voice</SelectItem>
                  <SelectItem value="tts_default">🤖 AI Voice</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {voiceMode === "family_recorded" && (
              <div className="space-y-3 p-4 bg-muted/50 rounded-xl">
                {existingAudioUrl && !audioUrl && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Current recording:</p>
                    <audio src={existingAudioUrl} controls className="w-full" />
                  </div>
                )}
                <div className="flex items-center gap-3">
                  {!isRecording && !audioUrl && (
                    <Button onClick={startRecording} variant="outline" className="gap-2">
                      <Mic className="h-4 w-4" /> {existingAudioUrl ? "Re-record" : "Start Recording"}
                    </Button>
                  )}
                  {isRecording && (
                    <Button onClick={stopRecording} variant="destructive" className="gap-2">
                      <Square className="h-4 w-4" /> Stop
                    </Button>
                  )}
                  {isRecording && (
                    <span className="text-sm text-destructive animate-pulse">● Recording...</span>
                  )}
                </div>
                {audioUrl && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">New recording:</p>
                    <audio src={audioUrl} controls className="w-full" />
                    <Button variant="ghost" size="sm" onClick={() => { setAudioBlob(null); setAudioUrl(null); }}>
                      Discard
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Message Text</Label>
              <Textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                rows={4}
              />
            </div>

            <Button onClick={handleSave} disabled={saving || !messageText} className="w-full gap-2">
              {saving ? "Saving..." : <><Save className="h-4 w-4" /> Save Changes</>}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
