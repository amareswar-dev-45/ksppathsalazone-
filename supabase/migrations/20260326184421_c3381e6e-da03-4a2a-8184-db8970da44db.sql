
-- Create exams table
CREATE TABLE public.exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  mock_number integer NOT NULL CHECK (mock_number >= 1 AND mock_number <= 10),
  total_time_minutes integer NOT NULL DEFAULT 60,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read exams" ON public.exams FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated can insert exams" ON public.exams FOR INSERT TO public WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can update exams" ON public.exams FOR UPDATE TO public USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can delete exams" ON public.exams FOR DELETE TO public USING (auth.role() = 'authenticated');

-- Add exam_id, subject, marks to questions
ALTER TABLE public.questions ADD COLUMN exam_id uuid REFERENCES public.exams(id) ON DELETE CASCADE;
ALTER TABLE public.questions ADD COLUMN subject text NOT NULL DEFAULT '';
ALTER TABLE public.questions ADD COLUMN marks numeric NOT NULL DEFAULT 1;

-- Add exam_id to student_responses
ALTER TABLE public.student_responses ADD COLUMN exam_id uuid REFERENCES public.exams(id) ON DELETE SET NULL;
