import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus, UserPlus, Play, AlertTriangle,
  LogOut, Clock, CheckCircle2, XCircle, HelpCircle, MessageSquare, PiggyBank } from
"lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import DailySummaryCard from "@/components/family/DailySummaryCard";
import InsightsSection from "@/components/family/InsightsSection";

type ElderProfile = Tables<"elder_profiles">;
type NotificationInstance = Tables<"notification_instances">;
type NotificationTemplate = Tables<"notification_templates">;

const STATUS_CONFIG: Record<string, {label: string;variant: "default" | "secondary" | "destructive" | "outline";icon: React.ReactNode;}> = {
  pending: { label: "Pending", variant: "outline", icon: <Clock className="h-3 w-3" /> },
  done: { label: "Done", variant: "default", icon: <CheckCircle2 className="h-3 w-3" /> },
  missed: { label: "Missed", variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
  unclear: { label: "Unclear", variant: "secondary", icon: <HelpCircle className="h-3 w-3" /> },
  no_response: { label: "No Response", variant: "secondary", icon: <AlertTriangle className="h-3 w-3" /> }
};

export default function FamilyDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [elders, setElders] = useState<ElderProfile[]>([]);
  const [selectedElderId, setSelectedElderId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [instances, setInstances] = useState<(NotificationInstance & {template?: NotificationTemplate;})[]>([]);
  const [loading, setLoading] = useState(true);

  const selectedElder = elders.find((e) => e.id === selectedElderId);

  // Fetch linked elders
  useEffect(() => {
    if (!user) return;
    const fetchElders = async () => {
      const { data: links } = await supabase.
      from("family_links").
      select("elder_profile_id").
      eq("family_user_id", user.id);

      if (links && links.length > 0) {
        const elderIds = links.map((l) => l.elder_profile_id);
        const { data: elderData } = await supabase.
        from("elder_profiles").
        select("*").
        in("id", elderIds);

        if (elderData) {
          setElders(elderData);
          if (!selectedElderId && elderData.length > 0) {
            setSelectedElderId(elderData[0].id);
          }
        }
      }
      setLoading(false);
    };
    fetchElders();
  }, [user]);

  // Fetch templates + instances when elder changes
  useEffect(() => {
    if (!selectedElderId) return;
    const fetchData = async () => {
      const [{ data: tplData }, { data: instData }] = await Promise.all([
      supabase.from("notification_templates").select("*").eq("elder_profile_id", selectedElderId),
      supabase.
      from("notification_instances").
      select("*").
      eq("elder_profile_id", selectedElderId).
      order("created_at", { ascending: false }).
      limit(10)]
      );

      setTemplates(tplData || []);

      // Join template info
      const enriched = (instData || []).map((inst) => ({
        ...inst,
        template: (tplData || []).find((t) => t.id === inst.template_id)
      }));
      setInstances(enriched);
    };
    fetchData();
  }, [selectedElderId]);

  const triggerDemoReminder = async (templateId?: string) => {
    if (!selectedElderId || templates.length === 0) {
      toast.error("Create a notification template first!");
      return;
    }
    const template = templateId ? templates.find(t => t.id === templateId) : templates[0];
    if (!template) { toast.error("Template not found"); return; }
    
    const { error } = await supabase.from("notification_instances").insert({
      template_id: template.id,
      elder_profile_id: selectedElderId,
      status: "pending"
    });
    if (error) { toast.error("Failed: " + error.message); return; }
    
    toast.success(`Reminder "${template.title}" triggered!`);
    const { data } = await supabase
      .from("notification_instances")
      .select("*")
      .eq("elder_profile_id", selectedElderId)
      .order("created_at", { ascending: false })
      .limit(10);
    const enriched = (data || []).map((inst) => ({
      ...inst,
      template: templates.find((t) => t.id === inst.template_id)
    }));
    setInstances(enriched);
  };

  const runDailyCheck = async () => {
    if (!selectedElderId) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data } = await supabase.
    from("notification_instances").
    select("*, notification_templates!inner(category)").
    eq("elder_profile_id", selectedElderId).
    eq("notification_templates.category", "checkin").
    eq("status", "done").
    gte("created_at", today.toISOString());

    if (!data || data.length === 0) {
      toast.warning(
        `${selectedElder?.display_name || "Elder"} hasn't checked in today. Consider personally checking in on them.`,
        { duration: 8000 }
      );
    } else {
      toast.success(`${selectedElder?.display_name} has ${data.length} check-in(s) today.`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>);

  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <PiggyBank className="h-5 w-5 text-primary" />
            </div>
            <h1 className="font-display font-bold text-xl">Pinglet</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut} className="gap-2">
            <LogOut className="h-4 w-4" /> Sign Out
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Elder Selector */}
        <div className="flex items-center gap-3">
          {elders.length > 0 ?
          <Select value={selectedElderId || ""} onValueChange={setSelectedElderId}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select elder..." />
              </SelectTrigger>
              <SelectContent>
                {elders.map((e) =>
              <SelectItem key={e.id} value={e.id}>
                    {e.display_name} {e.relationship_label ? `(${e.relationship_label})` : ""}
                  </SelectItem>
              )}
              </SelectContent>
            </Select> :

          <p className="text-muted-foreground text-sm">No elder profiles yet.</p>
          }
          <Button variant="outline" size="sm" onClick={() => navigate("/family/create-elder")} className="gap-2">
            <UserPlus className="h-4 w-4" /> Create Profile
          </Button>
          {selectedElderId &&
          <Button variant="default" size="sm" onClick={() => navigate(`/elder/${selectedElderId}`)} className="gap-2">
              <Play className="h-4 w-4" /> Open Elder View
            </Button>
          }
        </div>

        {selectedElderId && user &&
        <>
            {/* Daily Summary Card */}
            <DailySummaryCard
            elderId={selectedElderId}
            elderName={selectedElder?.display_name || ""}
            relationshipLabel={selectedElder?.relationship_label}
            userId={user.id} />


            {/* Quick Actions */}
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-display">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/family/create-notification?elderId=${selectedElderId}`)}
                  className="gap-2">

                    <Plus className="h-4 w-4" /> Create Notification
                  </Button>
                  {templates.length > 0 ? (
                    templates.map((tpl) => (
                      <Button key={tpl.id} variant="outline" size="sm" onClick={() => triggerDemoReminder(tpl.id)} className="gap-2">
                        <Play className="h-4 w-4" /> Trigger "{tpl.title}"
                      </Button>
                    ))
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => triggerDemoReminder()} className="gap-2" disabled>
                      <Play className="h-4 w-4" /> Trigger Reminder
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={runDailyCheck} className="gap-2">
                    <AlertTriangle className="h-4 w-4" /> Run Daily Check
                  </Button>
                </div>

                {/* Elder link for demo */}
                <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Elder Interface Link (for demo):</p>
                  <code className="text-xs text-primary break-all">
                    {window.location.origin}/elder/{selectedElderId}
                  </code>
                </div>
              </CardContent>
            </Card>

            {/* Live Status Panel */}
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-display flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {instances.length === 0 ?
              <p className="text-sm text-muted-foreground py-4 text-center">
                    No activity yet. Create a notification and trigger a demo reminder.
                  </p> :

              <div className="space-y-3">
                    {instances.map((inst) => {
                  const cfg = STATUS_CONFIG[inst.status] || STATUS_CONFIG.pending;
                  return (
                    <div key={inst.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="text-lg">
                              {inst.template?.category === "task" ? "📋" : "💬"}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {inst.template?.title || inst.template?.type || "Notification"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(inst.created_at).toLocaleString()}
                              </p>
                              {/* Show transcript for check-ins */}
                              {inst.template?.category === "checkin" && inst.reply_transcript &&
                          <p className="text-xs mt-1 text-foreground/70 italic">"{inst.reply_transcript}"</p>
                          }
                              {/* Show classification for unclear tasks */}
                              {inst.template?.category === "task" && inst.classification_label === "unclear" && inst.reply_transcript &&
                          <p className="text-xs mt-1 text-warning italic">"{inst.reply_transcript}"</p>
                          }
                            </div>
                          </div>
                          <Badge variant={cfg.variant} className="gap-1 shrink-0">
                            {cfg.icon} {cfg.label}
                          </Badge>
                        </div>);

                })}
                  </div>
              }
              </CardContent>
            </Card>

            {/* Insights Section */}
            <InsightsSection elderId={selectedElderId} />
          </>
        }
      </main>
    </div>);

}