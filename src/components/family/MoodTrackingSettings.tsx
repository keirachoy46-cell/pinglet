import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Smile, Loader2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type MoodSettings = Tables<"mood_settings">;

interface MoodTrackingSettingsProps {
  elderId: string;
}

export default function MoodTrackingSettings({ elderId }: MoodTrackingSettingsProps) {
  const [settings, setSettings] = useState<MoodSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Local form state
  const [isEnabled, setIsEnabled] = useState(false);
  const [frequency, setFrequency] = useState<"once_daily" | "twice_daily">("once_daily");
  const [time1, setTime1] = useState("10:00");
  const [time2, setTime2] = useState("20:00");

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("mood_settings")
        .select("*")
        .eq("elder_profile_id", elderId)
        .single();

      if (data) {
        setSettings(data);
        setIsEnabled(data.is_enabled);
        setFrequency(data.frequency as "once_daily" | "twice_daily");
        setTime1(data.time_1 || "10:00");
        setTime2(data.time_2 || "20:00");
      }
      setLoading(false);
    };
    fetch();
  }, [elderId]);

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      elder_profile_id: elderId,
      is_enabled: isEnabled,
      frequency,
      time_1: time1,
      time_2: frequency === "twice_daily" ? time2 : null,
      updated_at: new Date().toISOString(),
    };

    if (settings) {
      const { error } = await supabase
        .from("mood_settings")
        .update(payload)
        .eq("id", settings.id);
      if (error) { toast.error("Failed to save: " + error.message); }
      else { toast.success("Mood tracking settings saved!"); }
    } else {
      const { error, data } = await supabase
        .from("mood_settings")
        .insert(payload)
        .select()
        .single();
      if (error) { toast.error("Failed to save: " + error.message); }
      else { toast.success("Mood tracking enabled!"); if (data) setSettings(data); }
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="p-6">
          <div className="h-16 animate-pulse bg-muted rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-display flex items-center gap-2">
          <Smile className="h-4 w-4" /> Mood Tracking Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Enable Mood Tracking</Label>
            <p className="text-xs text-muted-foreground">
              Shows a mood check-in button on the elder's screen
            </p>
          </div>
          <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
        </div>

        {isEnabled && (
          <>
            {/* Frequency */}
            <div className="space-y-2">
              <Label className="text-sm">Frequency</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as "once_daily" | "twice_daily")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="once_daily">Once a day</SelectItem>
                  <SelectItem value="twice_daily">Twice a day</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Time 1 */}
            <div className="space-y-2">
              <Label className="text-sm">
                {frequency === "twice_daily" ? "Morning time" : "Check-in time"}
              </Label>
              <Input type="time" value={time1} onChange={(e) => setTime1(e.target.value)} />
              <p className="text-xs text-muted-foreground">In the elder's local timezone</p>
            </div>

            {/* Time 2 */}
            {frequency === "twice_daily" && (
              <div className="space-y-2">
                <Label className="text-sm">Evening time</Label>
                <Input type="time" value={time2} onChange={(e) => setTime2(e.target.value)} />
              </div>
            )}
          </>
        )}

        <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </CardContent>
    </Card>
  );
}
