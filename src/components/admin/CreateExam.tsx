import { useState, useCallback } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Send, Plus, Image, Save, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const SUBJECTS = [
  "Math", "Reasoning", "Odia", "English", "Computer",
  "General Awareness", "DI", "Physics", "Chemistry", "Biology",
  "Part A", "Part B", "Part C", "Part D", "Part E",
];

const MAX_QUESTIONS = 2000;

interface QuestionForm {
  subject: string;
  question_text: string;
  option_1: string;
  option_2: string;
  option_3: string;
  option_4: string;
  correct_answer: number;
  marks: number;
  negative_marks: number;
  solution: string;
  image_url: string;
  // for edit mode: existing DB id
  _id?: string;
}

const emptyQuestion = (): QuestionForm => ({
  subject: "", question_text: "", option_1: "", option_2: "", option_3: "", option_4: "",
  correct_answer: 1, marks: 1, negative_marks: 0.25, solution: "", image_url: "",
});

type Step = "name" | "mock" | "questions" | "time";

interface CreateExamProps {
  /** If provided, we are editing an existing draft exam */
  editExamId?: string;
  onEditDone?: () => void;
}

const CreateExam = ({ editExamId, onEditDone }: CreateExamProps) => {
  const queryClient = useQueryClient();

  // ── Edit mode bootstrap ──────────────────────────────────────────────────
  const { isLoading: loadingEdit } = useQuery({
    queryKey: ["editExamLoad", editExamId],
    enabled: !!editExamId,
    queryFn: async () => {
      const { data: exam } = await supabase.from("exams").select("*").eq("id", editExamId!).single();
      const { data: qs } = await supabase.from("questions").select("*").eq("exam_id", editExamId!).order("created_at");
      if (exam) {
        setExamName(exam.name);
        setMockNumber(exam.mock_number);
        setExistingExamId(editExamId!);
        setStep("questions");
      }
      if (qs && qs.length > 0) {
        setQuestions(qs.map((q: any) => ({
          _id: q.id,
          subject: q.subject || "",
          question_text: q.question_text,
          option_1: q.option_1,
          option_2: q.option_2,
          option_3: q.option_3,
          option_4: q.option_4,
          correct_answer: q.correct_answer,
          marks: q.marks,
          negative_marks: q.negative_marks,
          solution: q.solution || "",
          image_url: q.image_url || "",
        })));
        setCurrentQ(0);
      }
      return exam;
    },
  });

  // ── State ────────────────────────────────────────────────────────────────
  // When editing an existing exam, start directly on "questions" so admin actions
  // (Save/Add Question/Submit & Make Live) are always visible.
  const [step, setStep] = useState<Step>(editExamId ? "questions" : "name");
  const [examName, setExamName] = useState("");
  const [mockNumber, setMockNumber] = useState<number>(1);
  const [questions, setQuestions] = useState<QuestionForm[]>([emptyQuestion()]);
  const [currentQ, setCurrentQ] = useState(0);
  const [totalTime, setTotalTime] = useState(60);
  const [uploading, setUploading] = useState(false);
  const [existingExamId, setExistingExamId] = useState<string | null>(editExamId || null);
  const [deletingQuestion, setDeletingQuestion] = useState(false);

  const updateQuestion = useCallback((key: keyof QuestionForm, value: any) => {
    setQuestions(prev => {
      const updated = [...prev];
      updated[currentQ] = { ...updated[currentQ], [key]: value };
      return updated;
    });
  }, [currentQ]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("question-images").upload(path, file);
    if (error) { toast.error("Upload failed"); setUploading(false); return; }
    const { data } = supabase.storage.from("question-images").getPublicUrl(path);
    updateQuestion("image_url", data.publicUrl);
    setUploading(false);
  };

  const addNextQuestion = () => {
    if (questions.length >= MAX_QUESTIONS) {
      toast.error(`Maximum ${MAX_QUESTIONS} questions allowed per exam`);
      return;
    }
    setQuestions(prev => [...prev, emptyQuestion()]);
    setCurrentQ(questions.length);
  };

  const isCurrentValid = () => {
    const q = questions[currentQ];
    return q.question_text && q.option_1 && q.option_2 && q.option_3 && q.option_4 && q.subject;
  };

  const deleteCurrentQuestion = async () => {
    const q = questions[currentQ];
    if (!q) return;

    const ok = confirm("Are you sure you want to delete this question?");
    if (!ok) return;

    try {
      setDeletingQuestion(true);

      // If it already exists in DB, delete it permanently.
      if (q._id) {
        const { error } = await supabase.from("questions").delete().eq("id", q._id);
        if (error) throw error;
      }

      // Remove from local UI list. If this was the last question, show an empty block.
      const nextQuestions = questions.filter((_, idx) => idx !== currentQ);
      const normalized = nextQuestions.length > 0 ? nextQuestions : [emptyQuestion()];
      setQuestions(normalized);
      setCurrentQ(Math.min(currentQ, normalized.length - 1));
      toast.success("Question deleted");
    } catch (e) {
      const message = e instanceof Error ? e.message : undefined;
      toast.error(message ?? "Failed to delete question");
    } finally {
      setDeletingQuestion(false);
    }
  };

  // ── Save draft (not visible to students) ─────────────────────────────────
  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      let examId = existingExamId;

      if (!examId) {
        // Create exam as draft (total_time_minutes = 0 means draft/not-live)
        const { data: exam, error: examError } = await supabase.from("exams").insert({
          name: examName,
          mock_number: mockNumber,
          total_time_minutes: 0, // 0 = draft signal; students won't see exams without questions anyway
        }).select("id").single();
        if (examError) throw examError;
        examId = exam.id;
        setExistingExamId(examId);
      } else {
        // Update exam meta
        await supabase.from("exams").update({ name: examName, mock_number: mockNumber }).eq("id", examId!);
      }

      // Upsert questions (batch in chunks of 100 for performance)
      const CHUNK = 100;
      for (let i = 0; i < questions.length; i += CHUNK) {
        const chunk = questions.slice(i, i + CHUNK);
        for (const q of chunk) {
          const payload = {
            exam_id: examId!,
            subject: q.subject,
            question_text: q.question_text,
            option_1: q.option_1,
            option_2: q.option_2,
            option_3: q.option_3,
            option_4: q.option_4,
            correct_answer: q.correct_answer,
            marks: q.marks,
            negative_marks: q.negative_marks,
            solution: q.solution || null,
            image_url: q.image_url || null,
          };
          if (q._id) {
            await supabase.from("questions").update(payload).eq("id", q._id);
          } else {
            const { data: newQ } = await supabase.from("questions").insert(payload).select("id").single();
            if (newQ) q._id = newQ.id;
          }
        }
      }
      return examId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminStats"] });
      queryClient.invalidateQueries({ queryKey: ["adminExams"] });
      toast.success(`Draft saved! ${questions.length} question(s) saved. Not visible to students yet.`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Final submit (makes exam live) ───────────────────────────────────────
  const submitMutation = useMutation({
    mutationFn: async () => {
      let examId = existingExamId;

      if (!examId) {
        const { data: exam, error: examError } = await supabase.from("exams").insert({
          name: examName,
          mock_number: mockNumber,
          total_time_minutes: totalTime,
        }).select("id").single();
        if (examError) throw examError;
        examId = exam.id;
      } else {
        await supabase.from("exams").update({ total_time_minutes: totalTime, name: examName, mock_number: mockNumber }).eq("id", examId!);
      }

      const CHUNK = 100;
      for (let i = 0; i < questions.length; i += CHUNK) {
        const chunk = questions.slice(i, i + CHUNK);
        for (const q of chunk) {
          const payload = {
            exam_id: examId!,
            subject: q.subject,
            question_text: q.question_text,
            option_1: q.option_1,
            option_2: q.option_2,
            option_3: q.option_3,
            option_4: q.option_4,
            correct_answer: q.correct_answer,
            marks: q.marks,
            negative_marks: q.negative_marks,
            solution: q.solution || null,
            image_url: q.image_url || null,
          };
          if (q._id) {
            await supabase.from("questions").update(payload).eq("id", q._id);
          } else {
            await supabase.from("questions").insert(payload);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminStats"] });
      queryClient.invalidateQueries({ queryKey: ["adminExams"] });
      toast.success(`🚀 Exam "${examName}" is now LIVE with ${questions.length} questions!`);
      resetForm();
      if (onEditDone) onEditDone();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetForm = () => {
    setStep("name");
    setExamName("");
    setMockNumber(1);
    setQuestions([emptyQuestion()]);
    setCurrentQ(0);
    setTotalTime(60);
    setExistingExamId(null);
  };

  // ── STEP: Name ───────────────────────────────────────────────────────────
  if (step === "name") {
    return (
      <div className="glass-card rounded-2xl p-8 max-w-md mx-auto mt-6">
        <h2 className="font-heading font-bold text-xl text-foreground mb-4">Create Exam</h2>
        <Label>Exam Name</Label>
        <Input value={examName} onChange={e => setExamName(e.target.value)} placeholder="e.g., Mock Test, Final Test" className="mt-1 mb-4" />
        <Button onClick={() => setStep("mock")} disabled={!examName.trim()} className="w-full gap-2">
          Next <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  // ── STEP: Mock ───────────────────────────────────────────────────────────
  if (step === "mock") {
    return (
      <div className="glass-card rounded-2xl p-8 max-w-md mx-auto mt-6">
        <h2 className="font-heading font-bold text-xl text-foreground mb-4">Select Mock</h2>
        <p className="text-sm text-muted-foreground mb-4">Exam: {examName}</p>
        <div className="grid grid-cols-5 gap-3 mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
            <button
              key={n}
              onClick={() => setMockNumber(n)}
              className={`p-3 rounded-xl text-sm font-medium transition-all ${
                mockNumber === n
                  ? "gradient-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Mock {n}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setStep("name")} className="flex-1">Back</Button>
          <Button onClick={() => setStep("questions")} className="flex-1 gap-2">
            Next <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  // ── STEP: Time (final before making live) ────────────────────────────────
  if (step === "time") {
    const validCount = questions.filter(qq => qq.question_text && qq.option_1 && qq.subject).length;
    return (
      <div className="glass-card rounded-2xl p-8 max-w-md mx-auto mt-6">
        <h2 className="font-heading font-bold text-xl text-foreground mb-2">🚀 Make Exam Live</h2>
        <p className="text-sm text-muted-foreground mb-1">{examName} • Mock {mockNumber}</p>
        <p className="text-sm text-muted-foreground mb-6">{validCount} valid questions ready</p>
        <Label>Total Exam Time (in minutes)</Label>
        <Input
          type="number" min={1} value={totalTime}
          onChange={e => setTotalTime(parseInt(e.target.value) || 60)}
          className="mt-1 mb-6"
        />
        <p className="text-xs text-amber-500 mb-4">⚠️ After submitting, the exam becomes visible to all students.</p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setStep("questions")} className="flex-1">Back</Button>
          <Button
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending}
            className="flex-1 gap-2 gradient-primary border-0 text-primary-foreground"
          >
            <Send className="w-4 h-4" />
            {submitMutation.isPending ? "Publishing..." : "Submit & Make Live"}
          </Button>
        </div>
      </div>
    );
  }

  // ── STEP: Questions ──────────────────────────────────────────────────────
  // Note: In edit mode we avoid blocking the UI while data loads, so admin
  // actions (Save/Add Question/Submit & Make Live) remain visible.

  const q = questions[currentQ];
  const filledCount = questions.filter(qq => !!qq.question_text).length;
  const allValid = questions.every(qq => qq.question_text && qq.option_1 && qq.option_2 && qq.option_3 && qq.option_4 && qq.subject);

  return (
    <div className="max-w-2xl mx-auto mt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h2 className="font-heading font-bold text-lg text-foreground">{examName} • Mock {mockNumber}</h2>
          <p className="text-sm text-muted-foreground">
            Question {currentQ + 1} of {questions.length}
            {questions.length >= MAX_QUESTIONS && <span className="ml-2 text-amber-500 font-medium">Max limit reached</span>}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {!editExamId && <Button variant="outline" size="sm" onClick={() => setStep("mock")}>Back</Button>}
          {onEditDone && <Button variant="outline" size="sm" onClick={onEditDone}>Cancel</Button>}
          <Button
            variant="outline"
            size="sm"
            onClick={() => saveDraftMutation.mutate()}
            disabled={saveDraftMutation.isPending}
            className="gap-1 border-amber-500/40 text-amber-500 hover:bg-amber-500/10"
          >
            <Save className="w-3.5 h-3.5" />
            {saveDraftMutation.isPending ? "Saving..." : `Save (${filledCount})`}
          </Button>
        </div>
      </div>

      {/* Question navigation pills (chunked for performance) */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-2 scrollbar-thin">
        {questions.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentQ(i)}
            className={`w-7 h-7 rounded-md text-xs font-medium shrink-0 transition-colors ${
              i === currentQ ? "gradient-primary text-primary-foreground"
              : questions[i].question_text ? "bg-secondary/20 text-secondary border border-secondary/30"
              : "bg-muted text-muted-foreground"
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* Question form */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        {/* Subject Dropdown */}
        <div>
          <Label>Subject <span className="text-destructive">*</span></Label>
          <Select value={q.subject} onValueChange={v => updateQuestion("subject", v)}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select subject..." />
            </SelectTrigger>
            <SelectContent>
              {SUBJECTS.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Question */}
        <div>
          <Label>Question <span className="text-destructive">*</span></Label>
          <Textarea value={q.question_text} onChange={e => updateQuestion("question_text", e.target.value)} className="mt-1" rows={3} placeholder="Type your question here..." />
        </div>

        {/* Image upload */}
        <div>
          <Label>Image (optional)</Label>
          <div className="mt-1 flex items-center gap-2">
            <label className="cursor-pointer flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted text-sm text-muted-foreground hover:bg-muted/80">
              <Image className="w-4 h-4" /> {uploading ? "Uploading..." : "Upload Image"}
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
            {q.image_url && <img src={q.image_url} alt="" className="w-16 h-16 rounded-lg object-cover" />}
          </div>
        </div>

        {/* Options */}
        {[1, 2, 3, 4].map(n => (
          <div key={n}>
            <Label>Option {n} <span className="text-destructive">*</span></Label>
            <Input
              value={(q as any)[`option_${n}`]}
              onChange={e => updateQuestion(`option_${n}` as keyof QuestionForm, e.target.value)}
              placeholder={`Option ${n}`}
              className="mt-1"
            />
          </div>
        ))}

        {/* Correct Answer + Marks + Negative */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Correct Answer</Label>
            <Select value={String(q.correct_answer)} onValueChange={v => updateQuestion("correct_answer", Number(v))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4].map(n => <SelectItem key={n} value={String(n)}>Option {n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Marks</Label>
            <Input type="number" min={1} value={q.marks} onChange={e => updateQuestion("marks", parseInt(e.target.value) || 1)} className="mt-1" />
          </div>
          <div>
            <Label>Negative Marks</Label>
            <Input type="number" step="0.25" min={0} value={q.negative_marks} onChange={e => updateQuestion("negative_marks", parseFloat(e.target.value) || 0)} className="mt-1" />
          </div>
        </div>

        {/* Solution */}
        <div>
          <Label>Solution / Explanation</Label>
          <Textarea value={q.solution} onChange={e => updateQuestion("solution", e.target.value)} className="mt-1" rows={2} placeholder="Explain the correct answer..." />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between mt-4 gap-3 flex-wrap">
        <Button
          variant="outline"
          onClick={addNextQuestion}
          disabled={!isCurrentValid() || questions.length >= MAX_QUESTIONS}
          className="gap-2"
        >
          <Plus className="w-4 h-4" /> Add Question ({questions.length}/{MAX_QUESTIONS})
        </Button>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => saveDraftMutation.mutate()}
            disabled={saveDraftMutation.isPending}
            className="gap-2 border-amber-500/40 text-amber-500 hover:bg-amber-500/10"
          >
            <Save className="w-4 h-4" />
            {saveDraftMutation.isPending ? "Saving..." : "Save"}
          </Button>
          <Button
            variant="outline"
            onClick={deleteCurrentQuestion}
            disabled={deletingQuestion}
            className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="w-4 h-4" />
            {deletingQuestion ? "Deleting..." : "Delete"}
          </Button>
          <Button
            onClick={() => setStep("time")}
            disabled={!allValid || questions.length === 0}
            className="gap-2 gradient-primary border-0 text-primary-foreground"
          >
            <Send className="w-4 h-4" /> Submit & Make Live
          </Button>
        </div>
      </div>

      {currentQ < questions.length - 1 && (
        <div className="flex justify-end mt-2">
          <Button variant="ghost" size="sm" onClick={() => setCurrentQ(currentQ + 1)} className="gap-1">
            Next Question <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default CreateExam;
