import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ChevronRight, Send, BookOpen, MoreVertical, Filter, X, Lock } from "lucide-react";
import { toast } from "sonner";

const TestInterface = () => {
  const navigate = useNavigate();
  const studentInfo = JSON.parse(sessionStorage.getItem("studentInfo") || "null");
  const examId = sessionStorage.getItem("currentExamId");
  const menuRef = useRef<HTMLDivElement>(null);

  const { data: exam } = useQuery({
    queryKey: ["testExam", examId],
    queryFn: async () => {
      const { data, error } = await supabase.from("exams").select("*").eq("id", examId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!examId,
  });

  const { data: allQuestions = [], isLoading } = useQuery({
    queryKey: ["testQuestions", examId],
    queryFn: async () => {
      const { data, error } = await supabase.from("questions").select("*").eq("exam_id", examId!).order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!examId,
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [timeLeft, setTimeLeft] = useState(-1);
  const [submitted, setSubmitted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSubject, setActiveSubject] = useState<string | null>(null);

  // Derived: unique subjects in exam
  const subjects = Array.from(new Set((allQuestions as any[]).map(q => q.subject).filter(Boolean)));

  // Filtered questions based on active subject
  const questions = activeSubject
    ? (allQuestions as any[]).filter(q => q.subject === activeSubject)
    : (allQuestions as any[]);

  // Reset currentIndex when filter changes
  useEffect(() => { setCurrentIndex(0); }, [activeSubject]);

  // Close menu on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (exam && timeLeft === -1) setTimeLeft(exam.total_time_minutes * 60);
  }, [exam, timeLeft]);

  const submitTest = useCallback(async () => {
    if (submitted || allQuestions.length === 0) return;
    setSubmitted(true);

    let correct = 0, wrong = 0, negTotal = 0, totalScore = 0;
    const answerArray: { questionId: string; selected: number | null; correct: number }[] = [];

    (allQuestions as any[]).forEach((q: any) => {
      const selected = answers[q.id] ?? null;
      answerArray.push({ questionId: q.id, selected, correct: q.correct_answer });
      if (selected === q.correct_answer) { correct++; totalScore += Number(q.marks); }
      else if (selected !== null) { wrong++; negTotal += Number(q.negative_marks); }
    });

    const finalScore = totalScore - negTotal;

    const { data, error } = await supabase.from("student_responses").insert({
      name: studentInfo.name,
      email: studentInfo.email,
      phone: studentInfo.district || studentInfo.phone || "",
      exam_id: examId,
      answers: answerArray,
      total_questions: allQuestions.length,
      correct_count: correct,
      wrong_count: wrong,
      negative_marks_total: negTotal,
      final_score: finalScore,
    }).select("id").single();

    if (error) { toast.error("Failed to submit test"); setSubmitted(false); return; }
    navigate(`/student/result/${data.id}`);
  }, [submitted, allQuestions, answers, studentInfo, examId, navigate]);

  useEffect(() => {
    if (timeLeft < 0) return;
    if (timeLeft === 0 && allQuestions.length > 0 && !submitted) { submitTest(); return; }
    if (timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, allQuestions.length, submitted, submitTest]);

  if (!studentInfo) { navigate("/student"); return null; }
  if (!examId) { navigate("/student/start"); return null; }
  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Loading questions...</p></div>;

  // 🔒 SECURITY GATE — block access if exam is still a draft
  if (exam && Number(exam.total_time_minutes) === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <Lock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="font-heading font-bold text-xl text-foreground mb-2">Exam Not Available</h2>
          <p className="text-muted-foreground text-sm mb-6">This exam has not been published yet.</p>
          <Button variant="outline" onClick={() => navigate("/student/start")}>← Back to Exams</Button>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIndex] as any;
  const minutes = Math.floor(Math.max(0, timeLeft) / 60);
  const seconds = Math.max(0, timeLeft) % 60;
  const isUrgent = timeLeft >= 0 && timeLeft < 60;
  const currentSubject = currentQ?.subject || null;

  // Count answered in full set
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Top Header ── */}
      <div className="border-b border-border bg-card px-4 py-2.5 sticky top-0 z-20">
        <div className="flex items-center justify-between gap-2">
          {/* Left: Exam + Subject */}
          <div className="min-w-0 flex-1">
            {exam && (
              <p className="text-xs font-bold text-primary truncate">Exam: {exam.name}</p>
            )}
            {currentSubject && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <BookOpen className="w-3 h-3 shrink-0" />
                <span className="font-medium text-foreground">{currentSubject}</span>
              </p>
            )}
          </div>

          {/* Right: timer + submit + 3-dot menu */}
          <div className="flex items-center gap-2 shrink-0">
            <div className={`font-heading font-bold text-base px-3 py-1 rounded-full ${isUrgent ? "bg-destructive/10 text-destructive animate-pulse" : "bg-primary/10 text-primary"}`}>
              {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </div>
            <Button size="sm" variant="destructive" onClick={submitTest} disabled={submitted} className="gap-1">
              <Send className="w-3 h-3" /> Submit
            </Button>

            {/* 3-dot menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-10 w-52 bg-card border border-border rounded-xl shadow-xl z-30 p-2 animate-fade-in">
                  <p className="text-xs font-semibold text-muted-foreground px-2 pt-1 pb-2 flex items-center gap-1.5">
                    <Filter className="w-3 h-3" /> Filter by Subject
                  </p>
                  <button
                    onClick={() => { setActiveSubject(null); setMenuOpen(false); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      activeSubject === null ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted"
                    }`}
                  >
                    All Subjects ({allQuestions.length})
                  </button>
                  {subjects.map(s => (
                    <button
                      key={s}
                      onClick={() => { setActiveSubject(s); setMenuOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        activeSubject === s ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted"
                      }`}
                    >
                      {s} ({(allQuestions as any[]).filter(q => q.subject === s).length})
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Active filter pill + Q counter */}
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-muted-foreground">
            Q {currentIndex + 1} / {questions.length}
            {activeSubject && <span className="ml-1 text-primary font-medium">• filtered</span>}
            <span className="ml-2 text-muted-foreground">({answeredCount}/{allQuestions.length} answered)</span>
          </p>
          {activeSubject && (
            <button
              onClick={() => setActiveSubject(null)}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <X className="w-3 h-3" /> Clear filter
            </button>
          )}
        </div>
      </div>

      {/* Question nav pills */}
      <div className="border-b border-border bg-card px-4 py-2 overflow-x-auto">
        <div className="flex gap-1.5 min-w-max">
          {questions.map((q: any, i: number) => (
            <button
              key={q.id}
              onClick={() => setCurrentIndex(i)}
              className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${
                i === currentIndex
                  ? "gradient-primary text-primary-foreground"
                  : answers[q.id]
                  ? "bg-secondary/20 text-secondary border border-secondary/30"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Question body */}
      <div className="flex-1 p-4 max-w-3xl mx-auto w-full animate-fade-in" key={`${activeSubject}-${currentIndex}`}>
        {currentQ ? (
          <>
            {/* Question header info */}
            {currentSubject && (
              <div className="flex flex-wrap items-center gap-3 mb-4 text-xs text-muted-foreground">
                <span>
                  <span className="font-medium text-foreground">Subject:</span> {currentSubject}
                </span>
                <span>
                  <span className="font-medium text-foreground">Marks:</span> +{Number(currentQ?.marks ?? 0)}
                </span>
                <span>
                  <span className="font-medium text-foreground">Negative:</span> -{Number(currentQ?.negative_marks ?? 0)}
                </span>
              </div>
            )}

            <div className="glass-card rounded-2xl p-6 mb-5">
              <p className="text-foreground font-medium text-lg leading-relaxed">{currentQ.question_text}</p>
              {currentQ.image_url && (
                <img src={currentQ.image_url} alt="Question" className="mt-4 rounded-xl max-h-60 object-contain w-full" />
              )}
            </div>

            <div className="space-y-3">
              {[currentQ.option_1, currentQ.option_2, currentQ.option_3, currentQ.option_4].map((opt: string, i: number) => {
                const optNum = i + 1;
                const isSelected = answers[currentQ.id] === optNum;
                return (
                  <button
                    key={i}
                    onClick={() => setAnswers(prev => ({ ...prev, [currentQ.id]: optNum }))}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      isSelected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"
                    }`}
                  >
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full mr-3 text-sm font-medium ${
                      isSelected ? "gradient-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}>
                      {String.fromCharCode(64 + optNum)}
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <p className="text-center text-muted-foreground py-12">No questions match the selected filter.</p>
        )}
      </div>

      {/* Footer navigation – Next only (as per requirement) */}
      <div className="border-t border-border bg-card px-4 py-3 flex justify-between sticky bottom-0">
        <Button
          variant="outline"
          onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
          className="gap-1"
        >
          <ChevronRight className="w-4 h-4 rotate-180" /> Previous
        </Button>
        <Button
          onClick={() => setCurrentIndex(i => Math.min(questions.length - 1, i + 1))}
          disabled={currentIndex === questions.length - 1}
          className="gap-1"
        >
          Save & Next <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default TestInterface;
