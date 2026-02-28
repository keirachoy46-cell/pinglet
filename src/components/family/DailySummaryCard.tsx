import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, AlertTriangle, TrendingUp, TrendingDown, Minus } from "lucide-react";
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

interface SummaryFacts {
  taskCounts: Record<string, { done: number; missed: number; unclear: number; no_response: number; total: number }>;
  checkinCount: number;
  latestMood: number | null;
  moodTrend: "up" | "down" | "stable" | null;
  daysSinceLastVisit: number | null;
  noResponseToday: boolean;
}

const MOOD_LABELS: Record<number, string> = {
  1: "😢 Very Low",
  2: "😟 Low",
  3: "😐 Okay",
  4: "🙂 Good",
  5: "😊 Great",
};

export default function DailySummaryCard({ elderId, elderName, relationshipLabel, userId }: DailySummaryCardProps) {
  const [facts, setFacts] = useState<SummaryFacts | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const computeSummary = async () => {
      setLoading(true);

      // Record this visit
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
      const daysSinceLastVisit = lastVisit
        ? Math.floor((Date.now() - lastVisit.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      // Time window: today or since last visit
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const windowStart = lastVisit && lastVisit < today ? lastVisit : today;

      // Fetch templates + instances in window
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

      // Compute task counts by type
      const taskCounts: SummaryFacts["taskCounts"] = {};
      const taskTypes = ["medication", "appointment", "exercise"];
      taskTypes.forEach((t) => (taskCounts[t] = { done: 0, missed: 0, unclear: 0, no_response: 0, total: 0 }));

      let checkinCount = 0;
      let noResponseToday = true;

      (instances || []).forEach((inst) => {
        const tpl = tplMap.get(inst.template_id);
        if (!tpl) return;

        if (tpl.category === "checkin") {
          if (inst.status === "done") {
            checkinCount++;
            noResponseToday = false;
          }
        } else if (tpl.category === "task" && taskCounts[tpl.type]) {
          taskCounts[tpl.type].total++;
          const status = inst.status as keyof (typeof taskCounts)[string];
          if (taskCounts[tpl.type][status] !== undefined) {
            taskCounts[tpl.type][status]++;
          }
          if (inst.status !== "no_response" && inst.status !== "pending") {
            noResponseToday = false;
          }
        }
      });

      // Mood
      const latestMood = moods && moods.length > 0 ? moods[0].mood_score : null;
      let moodTrend: SummaryFacts["moodTrend"] = null;
      if (moods && moods.length >= 2) {
        const recent = moods.slice(0, 3).reduce((s, m) => s + m.mood_score, 0) / Math.min(3, moods.length);
        const older = moods.slice(3).reduce((s, m) => s + m.mood_score, 0) / Math.max(1, moods.length - 3);
        if (moods.length > 3) {
          moodTrend = recent > older + 0.3 ? "up" : recent < older - 0.3 ? "down" : "stable";
        }
      }

      setFacts({ taskCounts, checkinCount, latestMood, moodTrend, daysSinceLastVisit, noResponseToday });
      setLoading(false);
    };

    computeSummary();
  }, [elderId, userId]);

  const template = useMemo(() => {
    if (!facts) return null;

    const rel = relationshipLabel || "your loved one";
    const taskSummary = Object.entries(facts.taskCounts)
      .filter(([_, c]) => c.total > 0)
      .map(([type, c]) => `${type}: ${c.done}/${c.total} done`)
      .join(", ");

    const moodStr = facts.latestMood ? MOOD_LABELS[facts.latestMood] || `${facts.latestMood}/5` : "no mood data";
    const trendIcon = facts.moodTrend === "up" ? "↑" : facts.moodTrend === "down" ? "↓" : "";

    // Template C: no-response risk
    if (facts.noResponseToday && facts.daysSinceLastVisit === null) {
      return {
        type: "C" as const,
        text: `${elderName} has not replied to any check-ins today. Consider reaching out personally.`,
        variant: "warning" as const,
      };
    }

    // Template B: multi-day
    if (facts.daysSinceLastVisit && facts.daysSinceLastVisit > 0) {
      return {
        type: "B" as const,
        text: `Since you last checked in (${facts.daysSinceLastVisit} day${facts.daysSinceLastVisit > 1 ? "s" : ""} ago), ${rel} ${elderName} has ${taskSummary || "no task activity"}. Check-ins: ${facts.checkinCount}. Mood: ${moodStr} ${trendIcon}`,
        variant: "default" as const,
      };
    }

    // Template D: compact stats (when there's data)
    if (taskSummary) {
      const parts = Object.entries(facts.taskCounts)
        .filter(([_, c]) => c.total > 0)
        .map(([type, c]) => `${type.charAt(0).toUpperCase() + type.slice(1)} ${c.done}/${c.total}`);
      return {
        type: "D" as const,
        text: `Today: ${parts.join(" • ")} • Check-ins ${facts.checkinCount} • Mood ${moodStr}`,
        variant: "compact" as const,
      };
    }

    // Template A: daily first check (default)
    return {
      type: "A" as const,
      text: `Hi! Today so far, ${rel} ${elderName} has ${taskSummary || "no tasks recorded"}. Check-ins: ${facts.checkinCount}. Mood: ${moodStr}.`,
      variant: "default" as const,
    };
  }, [facts, elderName, relationshipLabel]);

  if (loading) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="p-6">
          <div className="h-16 animate-pulse bg-muted rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (!template) return null;

  return (
    <Card
      className={`border-0 shadow-md ${
        template.variant === "warning"
          ? "border-l-4 border-l-destructive bg-destructive/5"
          : "bg-gradient-to-r from-primary/5 to-accent/5"
      }`}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-display flex items-center gap-2">
          {template.variant === "warning" ? (
            <AlertTriangle className="h-4 w-4 text-destructive" />
          ) : (
            <Sparkles className="h-4 w-4 text-primary" />
          )}
          Daily Summary
          <Badge variant="outline" className="text-[10px] ml-auto">
            Template {template.type}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed text-foreground/80">{template.text}</p>
        {facts?.moodTrend && (
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            {facts.moodTrend === "up" && <TrendingUp className="h-3 w-3 text-green-500" />}
            {facts.moodTrend === "down" && <TrendingDown className="h-3 w-3 text-destructive" />}
            {facts.moodTrend === "stable" && <Minus className="h-3 w-3" />}
            Mood trend: {facts.moodTrend}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
