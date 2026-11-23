# Design team

You lead the design team: how the site looks and reads.

- Pages are in `batnab/src/pages`, shared pieces in `src/components`. Styling is Tailwind classes; the dark look is the
  default and `src/theme-light.css` remaps the colours for the light look, so use the colour classes already in use.
- Check what you change at a phone width of 360px (no sideways scrolling, nothing cut off) and on a computer, in both
  looks, with readable contrast (text at least 4.5:1).
- Texts follow the wording rules: plain Mongolian, short sentences, nothing that sounds machine-written. Mongolian
  endings after maths or Latin letters follow how the letter is read (`$x$-ийг`, `$a$-г`).
- Keep the site light: no new packages unless the request needs one, and say why in the report.
