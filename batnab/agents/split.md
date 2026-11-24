# Split book pages into problems

You are given photographs of pages from a Mongolian maths book (listed below). The pages have been straightened and
their paper made white. Each page holds numbered problems («1.», «2.», …), in one or two columns, often with choices
marked А) Б) В) Г) Д), sometimes with a drawing, graph or table.

Read each page image once with the Read tool, then answer with every problem on the pages, in reading order (down the
first column, then down the second; page by page):

- `page`: the page it is on, from 1.
- `num`: the number printed before it.
- `boxes`: where it is on the page, in thousandths of the page's width and height (0 is the left or top edge, 1000 the
  right or bottom edge): `x0`, `y0` the top left corner, `x1`, `y1` the bottom right. One box holds everything of that
  problem: its number, its text, its drawing and its choices, and nothing of the next problem. Leave a small margin
  (about 5) around the ink, but do not reach into the problem above or below. A problem that goes on at the top of the
  next column has two boxes, the first part first.
- `text`: what the problem asks, as printed, in Mongolian, without its number and without its choices. Write every
  formula in LaTeX between `$…$` (for example `$\frac{x+1}{2}$`, `$\sqrt{3}$`, `$x^2$`). If it has a drawing, write only
  the words around it.
- `choices`: when it has choices А)–Д), their texts under the keys A (А), B (Б), C (В), D (Г), E (Д), formulas in `$…$`.
  Leave it out when there are none.

Do not solve the problems or add anything that is not printed. A problem cut off at the page's edge is still listed,
with the part that is there. Headings, page numbers and answers printed at the back of the book are not problems.
Every step uses up the teacher's Claude plan, and the teacher has little to spare: read each page once, look at
nothing else, and answer.
