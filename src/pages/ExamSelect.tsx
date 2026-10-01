import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, FileText, Clock, Award, Lock } from "lucide-react";

/**
 * VISIBILITY RULE:
 *   An exam is "published" (visible to students) when:
 *     total_time_minutes > 0
 *   An exam is a "draft" (hidden from students) when:
 *     total_time_minutes === 0  (set by Save Draft action)
 *
 * This is enforced at query level — drafts are never fetched.
 */
const isPublished = (exam: any) => Number(exam.total_time_minutes) > 0;

const ExamSelect = () => {
  const navigate = useNavigate();
  const studentInfo = JSON.parse(sessionStorage.getItem("studentInfo") || "null");

  const { data: exams = [], isLoading } = useQuery({
    queryKey: ["studentExams"],
    queryFn: async () => {
      // ✅ ONLY fetch published exams (total_time_minutes > 0)
      const { data: examData, error } = await supabase
        .from("exams")
        .select("*")
        .gt("total_time_minutes", 0)   // 🔴 DRAFT FILTER — drafts have total_time_minutes = 0
        .order("mock_number");
      if (error) throw error;

      // Get question data per exam
      const ids = (examData || []).map((e: any) => e.id);
      if (ids.length === 0) return [];

      const { data: questions } = await supabase
        .from("questions")
        .select("exam_id, marks, negative_marks")
        .in("exam_id", ids);

      const examInfo: Record<string, { count: number; totalMarks: number; marks: number; negMarks: number }> = {};
      (questions || []).forEach((q: any) => {
        if (!q.exam_id) return;
        if (!examInfo[q.exam_id]) examInfo[q.exam_id] = { count: 0, totalMarks: 0, marks: Number(q.marks), negMarks: Number(q.negative_marks) };
        examInfo[q.exam_id].count++;
        examInfo[q.exam_id].totalMarks += Number(q.marks);
      });

      return (examData || []).map((e: any) => ({
        ...e,
        questionCount: examInfo[e.id]?.count || 0,
        totalMarks: examInfo[e.id]?.totalMarks || 0,
        marksPerQ: examInfo[e.id]?.marks || 1,
        negMarks: examInfo[e.id]?.negMarks || 0.25,
      }));
    },
  });

  if (!studentInfo) { navigate("/student"); return null; }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-lg mx-auto animate-fade-in">
        <button
          onClick={() => navigate("/student")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="font-heading font-bold text-2xl text-foreground mb-1">Select Exam</h1>
        <p className="text-muted-foreground text-sm mb-6">Welcome, {studentInfo.name}</p>

        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Loading exams...</p>
        ) : exams.length === 0 ? (
          <div className="glass-card rounded-2xl p-8 text-center">
            <Lock className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No exams available yet.</p>
            <p className="text-muted-foreground text-sm mt-1">Please check back later.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {exams.map((e: any) => (
              <button
                key={e.id}
                onClick={() => navigate(`/student/exam/${e.id}`)}
                disabled={e.questionCount === 0}
                className="w-full glass-card rounded-2xl p-6 text-left hover:shadow-lg transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <h3 className="font-heading font-semibold text-lg text-foreground mb-2">{e.name}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {e.questionCount} Qs</div>
                  <div className="flex items-center gap-1"><Award className="w-3.5 h-3.5" /> {e.totalMarks} marks</div>
                  <div className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {e.total_time_minutes} min</div>
                  <div>Neg: -{e.negMarks}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamSelect;
