import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Users, HelpCircle, BarChart3 } from "lucide-react";
import CreateExam from "@/components/admin/CreateExam";
import ExamList from "@/components/admin/ExamList";
import StudentResponses from "@/components/admin/StudentResponses";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      if (mounted) {
        setSession(s);
        setLoading(false);
        if (!s) navigate("/admin/login");
      }
    });

    // Check initial session
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setLoading(false);
        if (!data.session) navigate("/admin/login");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  const { data: stats } = useQuery({
    queryKey: ["adminStats"],
    queryFn: async () => {
      const [eRes, qRes, sRes] = await Promise.all([
        supabase.from("exams").select("*", { count: "exact", head: true }),
        supabase.from("questions").select("*", { count: "exact", head: true }),
        supabase.from("student_responses").select("final_score"),
      ]);
      const scores = sRes.data || [];
      const avg = scores.length > 0 ? scores.reduce((s, r) => s + Number(r.final_score), 0) / scores.length : 0;
      return { exams: eRes.count || 0, questions: qRes.count || 0, students: scores.length, avgScore: avg.toFixed(1) };
    },
    enabled: !!session,
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <h1 className="font-heading font-bold text-lg text-foreground">Admin Dashboard</h1>
        <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2">
          <LogOut className="w-4 h-4" /> Logout
        </Button>
      </header>

      <div className="max-w-6xl mx-auto p-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="glass-card rounded-xl p-4 text-center">
            <HelpCircle className="w-6 h-6 text-primary mx-auto mb-1" />
            <p className="text-2xl font-heading font-bold text-foreground">{stats?.exams ?? "-"}</p>
            <p className="text-xs text-muted-foreground">Exams</p>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <Users className="w-6 h-6 text-secondary mx-auto mb-1" />
            <p className="text-2xl font-heading font-bold text-foreground">{stats?.students ?? "-"}</p>
            <p className="text-xs text-muted-foreground">Attempts</p>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <BarChart3 className="w-6 h-6 text-accent mx-auto mb-1" />
            <p className="text-2xl font-heading font-bold text-foreground">{stats?.avgScore ?? "-"}</p>
            <p className="text-xs text-muted-foreground">Avg Score</p>
          </div>
        </div>

        <Tabs defaultValue="create">
          <TabsList className="w-full">
            <TabsTrigger value="create" className="flex-1">Create Exam</TabsTrigger>
            <TabsTrigger value="exams" className="flex-1">Exams</TabsTrigger>
            <TabsTrigger value="responses" className="flex-1">Student Responses</TabsTrigger>
          </TabsList>
          <TabsContent value="create">
            <CreateExam />
          </TabsContent>
          <TabsContent value="exams">
            <ExamList />
          </TabsContent>
          <TabsContent value="responses">
            <StudentResponses />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;
