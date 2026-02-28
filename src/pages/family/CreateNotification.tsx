import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Mic, Square, Play, Check, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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

export default function CreateNotification() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const elderProfileId = searchParams.get("elderId");

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: Category
  const [category, setCategory] = useState<"task" | "checkin">("task");

  // Step 2: Type + Title
  const [type, setType] = useState("medication");
  const [title, setTitle] = useState("");

  // Step 3: Schedule + Frequency
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [frequency, setFrequency] = useState("daily");
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(undefined);

  // Step 4: Voice mode
  const [voiceMode, setVoiceMode] = useState<"tts_default" | "family_recorded">("tts_default");
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Step 5: Message text
  const [messageText, setMessageText] = useState("");

  useEffect(() => {
    if (category === "task") setType("medication");
    else setType("how_are_you");
  }, [category]);

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

  const handleSubmit = async () => {
    if (!user || !elderProfileId) return;
    setLoading(true);

    let familyVoiceAudioUrl: string | null = null;

    if (voiceMode === "family_recorded" && audioBlob) {
      const fileName = `family-voice/${elderProfileId}/${Date.now()}.webm`;
      const { error: uploadError } = await supabase.storage
        .from("voice-recordings")
        .upload(fileName, audioBlob, { contentType: "audio/webm" });

      if (uploadError) {
        toast.error("Failed to upload voice recording");
        setLoading(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("voice-recordings")
        .getPublicUrl(fileName);
      familyVoiceAudioUrl = urlData.publicUrl;
    }

    const { error } = await supabase.from("notification_templates").insert({
      elder_profile_id: elderProfileId,
      category,
      type,
      title: title || type,
      schedule_time: scheduleTime,
      frequency,
      voice_mode: voiceMode,
      message_text: messageText,
      family_voice_audio_url: familyVoiceAudioUrl,
    });

    if (error) {
      toast.error("Failed to create: " + error.message);
    } else {
      toast.success("Notification template created!");
      navigate("/family");
    }
    setLoading(false);
  };

  const types = category === "task" ? TASK_TYPES : CHECKIN_TYPES;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-lg mx-auto space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/family")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        {/* Progress */}
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                s <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <Card className="border-0 shadow-lg shadow-primary/5">
          <CardHeader>
            <CardTitle className="font-display">
              {step === 1 && "What type of notification?"}
              {step === 2 && "Details"}
              {step === 3 && "Schedule"}
              {step === 4 && "Voice Mode"}
              {step === 5 && "Message"}
            </CardTitle>
            <CardDescription>Step {step} of 5</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {step === 1 && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCategory("task")}
                  className={`p-6 rounded-xl border-2 text-center transition-all ${
                    category === "task"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <span className="text-2xl block mb-2">📋</span>
                  <span className="font-medium text-sm">Task Reminder</span>
                  <p className="text-xs text-muted-foreground mt-1">Medication, appointments, exercise</p>
                </button>
                <button
                  type="button"
                  onClick={() => setCategory("checkin")}
                  className={`p-6 rounded-xl border-2 text-center transition-all ${
                    category === "checkin"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <span className="text-2xl block mb-2">💬</span>
                  <span className="font-medium text-sm">Daily Check-in</span>
                  <p className="text-xs text-muted-foreground mt-1">How are you, sleep, custom</p>
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
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
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Morning pills" />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Time (elder's local time)</Label>
                  <Input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select value={frequency} onValueChange={setFrequency}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="twice_daily">Twice Daily</SelectItem>
                      <SelectItem value="once">One-time (pick date)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {frequency === "once" && (
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !scheduleDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {scheduleDate ? format(scheduleDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={scheduleDate}
                          onSelect={setScheduleDate}
                          disabled={(date) => date < new Date()}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setVoiceMode("family_recorded")}
                    className={`p-5 rounded-xl border-2 text-center transition-all ${
                      voiceMode === "family_recorded"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <Mic className="h-6 w-6 mx-auto mb-2 text-primary" />
                    <span className="font-medium text-sm block">Record Your Voice</span>
                    <p className="text-xs text-muted-foreground mt-1">Personal touch</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVoiceMode("tts_default")}
                    className={`p-5 rounded-xl border-2 text-center transition-all ${
                      voiceMode === "tts_default"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <span className="text-2xl block mb-2">🤖</span>
                    <span className="font-medium text-sm block">AI Voice</span>
                    <p className="text-xs text-muted-foreground mt-1">Text-to-speech</p>
                  </button>
                </div>

                {voiceMode === "family_recorded" && (
                  <div className="space-y-3 p-4 bg-muted/50 rounded-xl">
                    <div className="flex items-center gap-3">
                      {!isRecording && !audioUrl && (
                        <Button onClick={startRecording} variant="outline" className="gap-2">
                          <Mic className="h-4 w-4" /> Start Recording
                        </Button>
                      )}
                      {isRecording && (
                        <Button onClick={stopRecording} variant="destructive" className="gap-2">
                          <Square className="h-4 w-4" /> Stop
                        </Button>
                      )}
                      {isRecording && (
                        <span className="text-sm text-destructive animate-pulse-gentle">● Recording...</span>
                      )}
                    </div>
                    {audioUrl && (
                      <div className="space-y-2">
                        <audio src={audioUrl} controls className="w-full" />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setAudioBlob(null); setAudioUrl(null); }}
                        >
                          Re-record
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {step === 5 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Message Text</Label>
                  <p className="text-xs text-muted-foreground">
                    Write in the elder's preferred language. This will be spoken or displayed.
                  </p>
                  <Textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="e.g. Hi grandma, it's time to take your morning pills!"
                    rows={4}
                  />
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-2">
              <Button
                variant="ghost"
                onClick={() => setStep(step - 1)}
                disabled={step === 1}
              >
                Back
              </Button>
              {step < 5 ? (
                <Button onClick={() => setStep(step + 1)} className="gap-2">
                  Next <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={loading || !messageText} className="gap-2">
                  {loading ? "Creating..." : <>Create <Check className="h-4 w-4" /></>}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
