# QBar web demo

A small browser demo for rendering scale ticks from a probability distribution rather than from a fixed linear grid.

**Live demo:** https://khoda81.github.io/qbar/

The experiment works in quantile space: candidate tick positions come from a distribution's inverse CDF, while local spacing and density determine which labels remain visually useful at the current scale. The demo includes numerical implementations for several distributions and lets you interactively tune the minimum tick spacing and opacity drop-off.

## Included distributions

The current standalone implementation includes quantile/PDF helpers for distributions such as:

- Normal
- Exponential
- Uniform
- Logistic
- Beta

## Run locally

There is no build step:

```bash
git clone https://github.com/khoda81/qbar-web.git
cd qbar-web
```

Open `index.html` in a browser.

## Why this exists

Traditional axes choose "nice" values in data coordinates. QBar explores the complementary idea of choosing visual structure in **probability coordinates**, so the display can devote resolution to regions where a distribution says distinctions matter.
