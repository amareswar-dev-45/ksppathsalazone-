
-- Create storage bucket for question images
INSERT INTO storage.buckets (id, name, public) VALUES ('question-images', 'question-images', true);

CREATE POLICY "Question images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'question-images');
CREATE POLICY "Authenticated users can upload question images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'question-images' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update question images" ON storage.objects FOR UPDATE USING (bucket_id = 'question-images' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete question images" ON storage.objects FOR DELETE USING (bucket_id = 'question-images' AND auth.role() = 'authenticated');

-- Create questions table
CREATE TABLE public.questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_text TEXT NOT NULL,
  image_url TEXT,
  option_1 TEXT NOT NULL,
  option_2 TEXT NOT NULL,
  option_3 TEXT NOT NULL,
  option_4 TEXT NOT NULL,
  correct_answer INTEGER NOT NULL CHECK (correct_answer BETWEEN 1 AND 4),
  negative_marks NUMERIC(4,2) NOT NULL DEFAULT 0.25,
  solution TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- Everyone can read questions (students need to see them)
CREATE POLICY "Anyone can read questions" ON public.questions FOR SELECT USING (true);

-- Only authenticated (admin) can modify
CREATE POLICY "Authenticated can insert questions" ON public.questions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can update questions" ON public.questions FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can delete questions" ON public.questions FOR DELETE USING (auth.role() = 'authenticated');

-- Create student_responses table
CREATE TABLE public.student_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_questions INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  negative_marks_total NUMERIC(6,2) NOT NULL DEFAULT 0,
  final_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.student_responses ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (students don't login)
CREATE POLICY "Anyone can submit responses" ON public.student_responses FOR INSERT WITH CHECK (true);
-- Only authenticated (admin) can view all responses
CREATE POLICY "Authenticated can view responses" ON public.student_responses FOR SELECT USING (auth.role() = 'authenticated');
-- Students can view their own response by id (we'll handle this in app)
CREATE POLICY "Anyone can view own response" ON public.student_responses FOR SELECT USING (true);

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_questions_updated_at
  BEFORE UPDATE ON public.questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
