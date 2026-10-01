import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Trash2, FileText, Clock, Pencil, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import CreateExam from "./CreateExam";

const ExamList = () => {
  const queryClient = useQueryClient();
  const [editingExamId, setEditingExamId] = useState<string | null>(null);

  const { data: exams = [], isLoading } = useQuery({
    queryKey: ["adminExams"],
    queryFn: async () => {
      const { data, error } = await supabase.from("exams").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const { data: questions } = await supabase.from("questions").select("exam_id");
      const counts: Record<string, number> = {};
      (questions || []).forEach((q: any) => { if (q.exam_id) counts[q.exam_id] = (counts[q.exam_id] || 0) + 1; });
      return (data || []).map((e: any) => ({ ...e, questionCount: counts[e.id] || 0 }));
    },
  });

  const handleDelete = async (id: string, name: string) => {
    if (!confirm("Delete this exam and all its questions?")) return;
    const { error } = await supabase.from("exams").delete().eq("id", id);
    if (error) { toast.error("Failed to delete"); return; }
    toast.success("Exam deleted");
    queryClient.invalidateQueries({ queryKey: ["adminExams"] });
    queryClient.invalidateQueries({ queryKey: ["adminStats"] });
  };

  if (isLoading) return <p className="text-muted-foreground text-center py-8">Loading...</p>;
  if (exams.length === 0) return <p className="text-muted-foreground text-center py-8">No exams created yet.</p>;

  // If editing, render the CreateExam in edit mode
  if (editingExamId) {
    return (
      <div className="mt-4">
        <CreateExam
          editExamId={editingExamId}
          onEditDone={() => {
            setEditingExamId(null);
            queryClient.invalidateQueries({ queryKey: ["adminExams"] });
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3 mt-2">
      {exams.map((e: any) => {
        const isDraft = !e.total_time_minutes || e.total_time_minutes === 0;
        return (
          <div key={e.id} className="glass-card rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-foreground font-medium">{e.name}</p>
                  {isDraft ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30 font-medium">
                      💾 Draft
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary/15 text-secondary border border-secondary/30 font-medium">
                      🚀 Live
                    </span>
                  )}
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground mt-1 flex-wrap">
                  <span>Mock {e.mock_number}</span>
                  <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {e.questionCount} questions</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {isDraft ? "Not published" : `${e.total_time_minutes} min`}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-primary hover:text-primary hover:bg-primary/10"
                  onClick={() => setEditingExamId(e.id)}
                  title="Edit exam"
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-2"
                  onClick={() => handleDelete(e.id, e.name)}
                  title="Delete exam"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Exam
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ExamList;
