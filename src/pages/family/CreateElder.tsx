import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, UserPlus } from "lucide-react";

const LANGUAGES = [
  "English", "Russian", "Korean", "Spanish", "French", "German",
  "Chinese", "Japanese", "Hindi", "Arabic", "Portuguese", "Turkish",
];

const TIMEZONES = [
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Moscow",
  "America/New_York", "America/Chicago", "America/Los_Angeles",
  "Asia/Tokyo", "Asia/Seoul", "Asia/Shanghai", "Asia/Kolkata", "Asia/Almaty",
  "Australia/Sydney", "Pacific/Auckland",
];

export default function CreateElder() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [language, setLanguage] = useState("English");
  const [timezone, setTimezone] = useState("Europe/London");
  const [relationship, setRelationship] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    const { data: elder, error: elderError } = await supabase
      .from("elder_profiles")
      .insert({
        display_name: displayName,
        preferred_language: language,
        timezone,
        relationship_label: relationship || null,
        age: age ? parseInt(age) : null,
        gender: gender || null,
        created_by_user_id: user.id,
      })
      .select()
      .single();

    if (elderError || !elder) {
      toast.error("Failed to create profile: " + elderError?.message);
      setLoading(false);
      return;
    }

    const { error: linkError } = await supabase
      .from("family_links")
      .insert({ family_user_id: user.id, elder_profile_id: elder.id });

    if (linkError) {
      toast.error("Profile created but linking failed: " + linkError.message);
    } else {
      toast.success(`Profile for ${displayName} created!`);
      navigate("/family");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-lg mx-auto space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/family")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Button>

        <Card className="border-0 shadow-lg shadow-primary/5">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <UserPlus className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="font-display">Create Elder Profile</CardTitle>
                <CardDescription>Set up a profile for your loved one</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name">Display Name *</Label>
                <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Grandma Mary" required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Preferred Language</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((l) => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz} value={tz}>{tz.replace("_", " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="relationship">Relationship Label</Label>
                <Input id="relationship" value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder="e.g. grandma, grandpa, mum" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="age">Age</Label>
                  <Input id="age" type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="e.g. 78" min={1} max={120} />
                </div>
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating..." : "Create Profile"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
