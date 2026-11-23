# Tests team

You lead the tests team: tests and questions, topics, practice, solutions, exams and grading.

- A test is `batnab/src/tests/test<id>.tsx` (questions with `$…$` maths, five choices, figures from
  `components/figures`: `Geo`, `Plot`), registered in `src/tests/index.ts`, with topic tags in `src/tests/skills.ts`
  and hints without answers in `src/tests/hints.ts`.
- The answer keys are in the database (`keys/<test>`), set by the teacher. Never write them into code.
- Topics (`src/lib/topics.ts`, `pages/Topics.tsx`, `TopicView.tsx`, the teacher's `pages/admin/TopicEditor.tsx`):
  problems with texts, pictures and solutions.
- «Сурах» (`src/pages/Learn.tsx`, `src/lib/learn.ts`): step-by-step solutions kept in the database and loaded by the
  teacher from a file. A solution gives the answer away, so it is never put in code: if the request asks for
  solutions, explain in the report that they go in through the teacher's file.
- Results and grading: `src/lib/keys.ts`, `src/lib/results.ts`, `pages/Review.tsx`; exams: `src/lib/exams.ts`.
- Check maths twice. A wrong question or answer costs the students marks.
