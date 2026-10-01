import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Image } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Question = Tables<"questions">;

interface QuestionForm {
  question_text: string;
  option_1: string;
  option_2: string;
  option_3: string;
  option_4: string;
  correct_answer: number;
  negative_marks: number;
  solution: string;
  image_url: string;
}

const emptyForm: QuestionForm = {
  question_text: "", option_1: "", option_2: "", option_3: "", option_4: "",
  correct_answer: 1, negative_marks: 0.25, solution: "", image_url: "",
};

const QuestionManager = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<QuestionForm>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ["adminQuestions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("questions").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Question[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (f: QuestionForm) => {
      const payload = {
        question_text: f.question_text,
        option_1: f.option_1,
        option_2: f.option_2,
        option_3: f.option_3,
        option_4: f.option_4,
        correct_answer: f.correct_answer,
        negative_marks: f.negative_marks,
        solution: f.solution || null,
        image_url: f.image_url || null,
      };
      if (editId) {
        const { error } = await supabase.from("questions").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        if (questions.length >= 500) throw new Error("Maximum 500 questions allowed");
        const { error } = await supabase.from("questions").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminQuestions"] });
      queryClient.invalidateQueries({ queryKey: ["adminStats"] });
      toast.success(editId ? "Question updated" : "Question added");
      resetForm();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("questions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminQuestions"] });
      queryClient.invalidateQueries({ queryKey: ["adminStats"] });
      toast.success("Question deleted");
    },
  });

  const resetForm = () => {
    setForm(emptyForm);
    setEditId(null);
    setOpen(false);
  };

  const openEdit = (q: Question) => {
    setForm({
      question_text: q.question_text,
      option_1: q.option_1,
      option_2: q.option_2,
      option_3: q.option_3,
      option_4: q.option_4,
      correct_answer: q.correct_answer,
      negative_marks: Number(q.negative_marks),
      solution: q.solution || "",
      image_url: q.image_url || "",
    });
    setEditId(q.id);
    setOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("question-images").upload(path, file);
    if (error) {
      toast.error("Upload failed");
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("question-images").getPublicUrl(path);
    setForm((f) => ({ ...f, image_url: data.publicUrl }));
    setUploading(false);
  };

  const updateField = (key: keyof QuestionForm, value: any) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">{questions.length} / 500 questions</p>
        <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); setOpen(v); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="w-4 h-4" /> Add Question</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-heading">{editId ? "Edit Question" : "Add Question"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Question Text</Label>
                <Textarea value={form.question_text} onChange={(e) => updateField("question_text", e.target.value)} className="mt-1" rows={3} />
              </div>
              <div>
                <Label>Image (optional)</Label>
                <div className="mt-1 flex items-center gap-2">
                  <label className="cursor-pointer flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted text-sm text-muted-foreground hover:bg-muted/80">
                    <Image className="w-4 h-4" /> {uploading ? "Uploading..." : "Upload"}
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                  {form.image_url && <img src={form.image_url} alt="" className="w-16 h-16 rounded-lg object-cover" />}
                </div>
              </div>
              {[1, 2, 3, 4].map((n) => (
                <div key={n}>
                  <Label>Option {n}</Label>
                  <Input value={(form as any)[`option_${n}`]} onChange={(e) => updateField(`option_${n}` as keyof QuestionForm, e.target.value)} className="mt-1" />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Correct Answer</Label>
                  <Select value={String(form.correct_answer)} onValueChange={(v) => updateField("correct_answer", Number(v))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4].map((n) => <SelectItem key={n} value={String(n)}>Option {n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Negative Marks</Label>
                  <Input type="number" step="0.25" min="0" value={form.negative_marks} onChange={(e) => updateField("negative_marks", parseFloat(e.target.value) || 0)} className="mt-1" />
                </div>
              </div>
              <div>
                <Label>Solution Explanation</Label>
                <Textarea value={form.solution} onChange={(e) => updateField("solution", e.target.value)} className="mt-1" rows={2} placeholder="Explain the answer..." />
              </div>
              <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending || !form.question_text || !form.option_1 || !form.option_2 || !form.option_3 || !form.option_4} className="w-full">
                {saveMutation.isPending ? "Saving..." : editId ? "Update Question" : "Add Question"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-center py-8">Loading...</p>
      ) : questions.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">No questions yet. Add your first question.</p>
      ) : (
        <div className="space-y-3">
          {questions.map((q, i) => (
            <div key={q.id} className="glass-card rounded-xl p-4 flex items-start gap-3">
              <span className="shrink-0 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                {questions.length - i}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-foreground text-sm font-medium truncate">{q.question_text}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Answer: Option {q.correct_answer} • Neg: -{q.negative_marks}
                  {q.image_url && " • 🖼️"}
                  {q.solution && " • 📝"}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(q)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(q.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default QuestionManager;
