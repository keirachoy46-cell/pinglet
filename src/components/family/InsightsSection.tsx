import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { BarChart3, Activity } from "lucide-react";

interface InsightsSectionProps {
  elderId: string;
}

type TimeRange = "daily" | "weekly" | "monthly";

interface AdherenceDay {
  date: string;
  done: number;
  missed: number;
  unclear: number;
}

interface MoodDay {
  date: string;
  avgMood: number;
}

export default function InsightsSection({ elderId }: InsightsSectionProps) {
  const [range, setRange] = useState<TimeRange>("daily");
  const [adherenceData, setAdherenceData] = useState<AdherenceDay[]>([]);
  const [moodData, setMoodData] = useState<MoodDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInsights = async () => {
      setLoading(true);

      const now = new Date();
      const start = new Date();
      if (range === "daily") start.setDate(now.getDate() - 7);
      else if (range === "weekly") start.setDate(now.getDate() - 28);
      else start.setDate(now.getDate() - 90);

      const [{ data: instances }, { data: templates }, { data: moods }] = await Promise.all([
        supabase
          .from("notification_instances")
          .select("*")
          .eq("elder_profile_id", elderId)
          .gte("created_at", start.toISOString())
          .order("created_at", { ascending: true }),
        supabase.from("notification_templates").select("*").eq("elder_profile_id", elderId),
        supabase
          .from("mood_entries")
          .select("*")
          .eq("elder_profile_id", elderId)
          .gte("created_at", start.toISOString())
          .order("created_at", { ascending: true }),
      ]);

      const taskTemplateIds = new Set(
        (templates || []).filter((t) => t.category === "task").map((t) => t.id)
      );

      // Adherence by date
      const adherenceMap = new Map<string, AdherenceDay>();
      (instances || []).forEach((inst) => {
        if (!taskTemplateIds.has(inst.template_id)) return;
        const date = new Date(inst.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        if (!adherenceMap.has(date)) adherenceMap.set(date, { date, done: 0, missed: 0, unclear: 0 });
        const entry = adherenceMap.get(date)!;
        if (inst.status === "done") entry.done++;
        else if (inst.status === "missed") entry.missed++;
        else if (inst.status === "unclear") entry.unclear++;
      });
      setAdherenceData(Array.from(adherenceMap.values()));

      // Mood by date
      const moodMap = new Map<string, { total: number; count: number }>();
      (moods || []).forEach((m) => {
        const date = new Date(m.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        if (!moodMap.has(date)) moodMap.set(date, { total: 0, count: 0 });
        const entry = moodMap.get(date)!;
        entry.total += m.mood_score;
        entry.count++;
      });
      setMoodData(
        Array.from(moodMap.entries()).map(([date, { total, count }]) => ({
          date,
          avgMood: Math.round((total / count) * 10) / 10,
        }))
      );

      setLoading(false);
    };

    fetchInsights();
  }, [elderId, range]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-lg">Insights</h2>
        <Select value={range} onValueChange={(v) => setRange(v as TimeRange)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Last 7 days</SelectItem>
            <SelectItem value="weekly">Last 4 weeks</SelectItem>
            <SelectItem value="monthly">Last 3 months</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Adherence Bar Chart */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Task Adherence
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-48 animate-pulse bg-muted rounded-lg" />
          ) : adherenceData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No task data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={adherenceData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Bar dataKey="done" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} name="Done" />
                <Bar dataKey="missed" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} name="Missed" />
                <Bar dataKey="unclear" fill="hsl(var(--muted-foreground))" radius={[3, 3, 0, 0]} name="Unclear" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Mood Line Chart */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <Activity className="h-4 w-4" /> Mood Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-48 animate-pulse bg-muted rounded-lg" />
          ) : moodData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No mood data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={moodData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => [`${value}/5`, "Avg Mood"]}
                />
                <Line
                  type="monotone"
                  dataKey="avgMood"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))", r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Avg Mood"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
