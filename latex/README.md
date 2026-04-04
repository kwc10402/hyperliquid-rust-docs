# LaTeX Papers

This directory holds typeset paper sources for the public docs set.

Current documents:

- `whitepaper.tex` — narrative architecture white paper

Build with one of:

```bash
tectonic whitepaper.tex
```

or:

```bash
pdflatex whitepaper.tex
pdflatex whitepaper.tex
```

From the repo root, use:

```bash
tools/build_latex_docs.sh
```

That helper will use `tectonic`, `pdflatex`, or `lualatex` when available and
print a clear error if no TeX toolchain is installed locally.
