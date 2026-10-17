# Maia 2 UCI engine

A UCI wrapper that runs [Maia 2](https://github.com/CSSLab/maia2), the
human-like chess model from the University of Toronto CSSLab, inside any UCI
chess GUI — including En Croissant (see issue
[#607](https://github.com/franciscoBSalgueiro/en-croissant/issues/607)).

Maia 2 is a transformer trained on human games that predicts moves conditioned
on Elo. Unlike a classical engine it performs no search: every `go` runs one
forward pass over the policy and, per reported line, one forward pass on the
resulting position for the evaluation a player of the configured level would
achieve. Moves come out human-plausible (e.g. after `1.e4 e5 2.Nf3`-type
positions it likes `Qe7`/`Be7` at lower Elo), not engine-optimal.

## Files

- `maia2` — launcher script. On first use it creates a Python 3.10–3.12
  virtual environment next to itself (`.venv/`, ~200 MB with PyTorch — only
  requirement: some `python3.10`–`python3.12` on the PATH, or [`uv`](https://docs.astral.sh/uv/)
  which can fetch Python itself) and prints a static UCI banner meanwhile so
  GUI configuration probes return instantly. The build is guarded by a lock
  and a readiness marker, so interrupted or concurrent setups recover.
- `maia2_uci.py` — the engine itself, pure Python on top of the official
  `maia2` package. Model weights (280 MB, from the official distribution
  point) download on first `isready` into `models/`.

## UCI options

| Option            | Meaning                                               |
| ----------------- | ----------------------------------------------------- |
| `MaiaElo`         | Elo the model conditions on (1100–1900, steps of 100) |
| `ModelType`       | checkpoint flavour: `rapid` or `blitz`                |
| `MultiPV`         | number of candidate human moves to report (1–20)      |
| `Threads`, `Hash` | accepted for GUI compatibility, no effect             |

`MaiaElo` and `ModelType` can be changed from En Croissant's engine settings
like any other UCI option, giving one engine for every strength.

## Standalone usage

```sh
./maia2
# then speak UCI on stdin:
# uci / isready / position startpos / go nodes 1
```

To use in En Croissant without the built-in catalog entry: Engines → Add New →
Local tab → pick the `maia2` script.

## Notes

- Evaluation is derived from Maia 2's value head (White-perspective expected
  score; the wrapper converts it to the mover's point of view). Maia 2's
  opening priors are known to be idiosyncratic — the official web analysis
  supplements them with an opening book, this wrapper does not.
- The catalog entry in `src/utils/builtinEngines.ts` points at these files on
  the repository's default branch, so it starts working once this change is
  merged and can be disabled by removing the entry.
- Windows is not offered in the catalog yet: the launcher is a POSIX shell
  script. The engine script itself runs anywhere Python does.
