import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, AlertTriangle } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type NotificationInstance = Tables<"notification_instances">;
type NotificationTemplate = Tables<"notification_templates">;
type MoodEntry = Tables<"mood_entries">;

interface DailySummaryCardProps {
  elderId: string;
  elderName: string;
  relationshipLabel?: string | null;
  userId: string;
}

const MOOD_EMOJI: Record<number, string> = { 1: "😢", 2: "😟", 3: "😐", 4: "🙂", 5: "😊" };

export default function DailySummaryCard({ elderId, elderName, relationshipLabel, userId }: DailySummaryCardProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [isWarning, setIsWarning] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const computeSummary = async () => {
      setLoading(true);

      // Record visit
      await supabase.from("family_dashboard_visits").insert({
        family_user_id: userId,
        elder_profile_id: elderId,
      });

      // Get last visit before this one
      const { data: visits } = await supabase
        .from("family_dashboard_visits")
        .select("visited_at")
        .eq("family_user_id", userId)
        .eq("elder_profile_id", elderId)
        .order("visited_at", { ascending: false })
        .limit(2);

      const lastVisit = visits && visits.length > 1 ? new Date(visits[1].visited_at) : null;
      const daysSince = lastVisit
        ? Math.floor((Date.now() - lastVisit.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const windowStart = lastVisit && lastVisit < today ? lastVisit : today;

      const [{ data: templates }, { data: instances }, { data: moods }] = await Promise.all([
        supabase.from("notification_templates").select("*").eq("elder_profile_id", elderId),
        supabase
          .from("notification_instances")
          .select("*")
          .eq("elder_profile_id", elderId)
          .gte("created_at", windowStart.toISOString()),
        supabase
          .from("mood_entries")
          .select("*")
          .eq("elder_profile_id", elderId)
          .order("created_at", { ascending: false })
          .limit(7),
      ]);

      const tplMap = new Map<string, NotificationTemplate>();
      (templates || []).forEach((t) => tplMap.set(t.id, t));

      // Build natural language
      const rel = relationshipLabel || "your loved one";
      const name = elderName;
      const sentences: string[] = [];

      // Greeting with time context
      if (daysSince && daysSince > 0) {
        sentences.push(`It's been ${daysSince} day${daysSince > 1 ? "s" : ""} since you last checked in.`);
      }

      // Task summary in natural language
      const taskResults: Record<string, { done: number; total: number }> = {};
      let checkins = 0;
      let anyResponse = false;

      (instances || []).forEach((inst) => {
        const tpl = tplMap.get(inst.template_id);
        if (!tpl) return;
        if (tpl.category === "checkin") {
          if (inst.status === "done") { checkins++; anyResponse = true; }
        } else if (tpl.category === "task") {
          if (!taskResults[tpl.type]) taskResults[tpl.type] = { done: 0, total: 0 };
          taskResults[tpl.type].total++;
          if (inst.status === "done") taskResults[tpl.type].done++;
          if (inst.status !== "no_response" && inst.status !== "pending") anyResponse = true;
        }
      });

      const taskEntries = Object.entries(taskResults).filter(([_, c]) => c.total > 0);

      if (taskEntries.length > 0) {
        const parts = taskEntries.map(([type, c]) => {
          if (c.done === c.total) return `completed all ${type} reminders`;
          if (c.done === 0) return `hasn't responded to any ${type} reminders yet`;
          return `completed ${c.done} out of ${c.total} ${type} reminders`;
        });
        sentences.push(`${name} has ${parts.join(", and ")}.`);
      }

      if (checkins > 0) {
        sentences.push(`${checkins} check-in${checkins > 1 ? "s" : ""} ${checkins > 1 ? "were" : "was"} completed.`);
      }

      // Mood in natural language
      const latestMood = moods && moods.length > 0 ? moods[0] : null;
      if (latestMood) {
        const emoji = MOOD_EMOJI[latestMood.mood_score] || "";
        const tags = latestMood.selected_tags;
        let moodSentence = `Their latest mood was ${emoji}`;
        if (tags && tags.length > 0) {
          moodSentence += ` — feeling ${tags.join(", ")}`;
        }
        moodSentence += ".";
        sentences.push(moodSentence);

        // Mood trend
        if (moods && moods.length >= 4) {
          const recent = moods.slice(0, 3).reduce((s, m) => s + m.mood_score, 0) / 3;
          const older = moods.slice(3).reduce((s, m) => s + m.mood_score, 0) / (moods.length - 3);
          if (recent > older + 0.3) sentences.push("Their mood has been trending upward recently.");
          else if (recent < older - 0.3) sentences.push("Their mood seems to be dipping — you might want to reach out.");
        }
      }

      // No response warning
      if (!anyResponse && taskEntries.length > 0) {
        setIsWarning(true);
        sentences.push(`${name} hasn't replied to anything today. Consider giving them a call.`);
      } else {
        setIsWarning(false);
      }

      // Fallback
      if (sentences.length === 0) {
        sentences.push(`No activity recorded for ${name} yet today.`);
      }

      // Compose greeting
      const greeting = daysSince && daysSince > 0
        ? `Here's what's happened with ${rel} ${name} since your last visit.`
        : `Here's how ${rel} ${name} is doing today.`;

      setSummary(`${greeting} ${sentences.join(" ")}`);
      setLoading(false);
    };

    computeSummary();
  }, [elderId, userId]);

  if (loading) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="p-6">
          <div className="h-16 animate-pulse bg-muted rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (!summary) return null;

  return (
    <Card
      className={`border-0 shadow-md ${
        isWarning
          ? "border-l-4 border-l-destructive bg-destructive/5"
          : "bg-gradient-to-r from-primary/5 to-accent/5"
      }`}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-display flex items-center gap-2">
          {isWarning ? (
            <AlertTriangle className="h-4 w-4 text-destructive" />
          ) : (
            <Sparkles className="h-4 w-4 text-primary" />
          )}
          Daily Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed text-foreground/80">{summary}</p>
      </CardContent>
    </Card>
  );
}
