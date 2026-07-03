# DESIGN.md — Plotline (plotline.pro aesthetic)

Pulled from https://www.plotline.pro/ on 2026-07-03 via live computed styles +
screenshots. This captures the LOOK (roles, values, patterns) for reuse on our
own products — never copy Plotline's wordmark, copy text, or imagery.

## Brand & voice
For working film editors. The feeling in 3 words: editorial, darkroom, precise.
Writing sounds like a confident editor: short declarative lines, craft words
("assembly", "beats", "the cut"), no hype. Feature statements are serif
sentences where the *payoff word* is italic and red.

## Colour
Everything is warm-dark; neutrals are tinted, never pure black/white.

- surface/page:        #161618  (near-black, slightly cool)
- surface/deep:        #0b0b0c  (inset wells: waveforms, media strips)
- surface/card:        #131315  (panels; darker than page, never lighter)
- surface/tint:        rgba(245,242,236,0.04)  (soft raised block on card)
- text/primary:        #f5f2ec  (warm off-white — NOT #fff)
- text/secondary:      rgba(245,242,236,0.78)
- text/muted:          rgba(245,242,236,0.6)
- text/faint:          rgba(245,242,236,0.35)  (micro-labels, ghost numerals)
- border/hairline:     rgba(245,242,236,0.1)
- border/faint:        rgba(245,242,236,0.06)
- accent/primary:      #e94a47  (the red — CTAs, italic payoff words, markers,
                        waveform bars, selected states, red dot bullets)
- accent/amber:        #c99d4a  (sparse: selected secondary chips, highlighted
                        transcript words, warm annotation text on 10% tint bg)
- accent/rust:         #b86f4a  (rare: long-form annotation blocks)
- status/ready:        muted sage green, small dot + tiny caps label only

Red is used with total confidence but low frequency: one CTA, one italic word,
markers/dots. The page never turns red.

## Typography
- Headings: "Instrument Serif", serif — weight 400 ONLY, tight (-0.5px
  letter-spacing), line-height ~1.0. Scale jump is dramatic: hero 72px,
  section statements ~48-56px, panel titles ~20px.
- The signature move: one word or clause per heading set in ITALIC + red
  (#e94a47). Also: italic serif for file/project names inside UI.
- Body/UI: "Geist", sans (fallback "Inter Tight", system-ui) — 13-15px body,
  weight 400/500. Buttons 15px/500.
- Micro-labels: 10-12px Geist, UPPERCASE, letter-spaced (~0.08-0.15em), muted.
  Used constantly: eyebrows, stat labels, status chips, field labels.
- Eyebrow pattern: small red dot • + letterspaced caps label, above headings.
- Numbers (stats, timecodes) big in Geist over a tiny caps label.

## Spacing & layout
- Very generous section air on marketing surfaces (100px+); product panels are
  dense but breathe via 20-24px padding and hairline dividers.
- Panel internals: 16-24px padding; rows separated by border/faint dividers,
  not boxes-in-boxes.
- Section numbering motif: giant ghost serif numeral (01/02/03) at ~0.06
  opacity behind/beside the section + a thin red horizontal rule.
- Left-aligned hero; centered serif statements for method sections.

## Shape & elevation
- Radius: 10px cards/panels, 8px inner cards, 4-6px buttons/chips.
- Depth = flat surfaces + 1px hairline borders. NO box-shadows, NO glass/blur,
  NO gradients on surfaces. Layering is done purely with the 4 surface tones.

## Motion
- Subtle and purposeful: soft fades/short translate-ups on scroll; waveform
  bars animate; playhead line moves. Nothing bounces, nothing floats forever.
- Hover: border brightens (0.1 → ~0.2 alpha) or bg tint rises; no scale jumps
  bigger than ~1.02.

## Components
- Primary button: solid #e94a47, white text, radius 4-6px, 15px/500, generous
  x-padding (22px); may carry a ⌘-key chip (dark tint pill) at right.
- Secondary button: transparent, hairline border, text/primary; hover = border
  brightens.
- Tertiary/in-card action: outline pill with red text ("+ Add Audio").
- Segmented picker: row of outline pills; SELECTED = red text + red border +
  red 10% tint bg (amber variant for secondary pickers).
- Status chip: tiny dot + 10-11px caps letterspaced label (red=action,
  sage=ready/transcribed, muted=neutral tag).
- Stat tile: hairline-bordered box, tiny caps label above a large numeral.
- File/media card: #131315, hairline border, radius 10; header row (name +
  status chip), inset #0b0b0c waveform strip (bars in red), stat row below.
- Transcript block: caps speaker name + red timecode; quote text below;
  active/pull-quote gets a thin warm left rule; key words highlighted amber.
- Speaker list: dark circle avatar with initials, "Name · Role", tiny stats.
- Toggle: red when on.
- Input: dark well, hairline border, radius 6-8px; focus = red border.

## Bans (what this brand never does)
- Pure #000 or #fff anywhere
- Box-shadows, glassmorphism, backdrop-blur panels
- Gradient text, gradient buttons, gradient surfaces
- Purple/violet/gold "premium" palettes
- More than one italic-red payoff per heading
- Bouncy/springy motion, floating blobs, ambient glow orbs
- Rounded-full pill buttons for primary CTAs (radius stays 4-6px)
- Serif in bold weights (Instrument Serif stays at 400)
