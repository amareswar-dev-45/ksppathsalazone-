# Memory: index.md
Updated: now

Online Test Management System (KSP Pathsala) - admin email: ksppathsalatest@gmail.com, design: navy primary + teal secondary + amber accent, Space Grotesk headings + Inter body.

## Architecture
- questions table: stores MCQs with images, solutions, negative marks
- student_responses table: stores test results with answer details
- Storage bucket: question-images (public)
- Admin auth: Supabase email/password, signup disabled
- Students: no auth, sessionStorage for info during test flow

## Routes
- / Landing page
- /student → /student/start → /student/test → /student/result/:id
- /admin/login → /admin/dashboard
