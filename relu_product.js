"use strict";

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const { generateTicks, drawTicks } = window.QBar;

const inputs = {
  mu_x: document.getElementById("mu_x"),
  logvar_x: document.getElementById("logvar_x"),
  mu_y: document.getElementById("mu_y"),
  logvar_y: document.getElementById("logvar_y"),
  min_dist: document.getElementById("min_dist"),
  drop_off: document.getElementById("drop_off"),
};

const SAMPLE_COUNT = 60000;
const qx = new Float64Array(SAMPLE_COUNT);
const qy = new Float64Array(SAMPLE_COUNT);
let dist = null;
let atomStart = 0;
let atomEnd = 0;
let redrawQueued = false;

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fillNormals() {
  const random = mulberry32(0x51424152);
  for (let i = 0; i < SAMPLE_COUNT; i += 2) {
    const u1 = Math.max(random(), 1e-12);
    const u2 = random();
    const r = Math.sqrt(-2 * Math.log(u1));
    const a = 2 * Math.PI * u2;
    qx[i] = r * Math.cos(a);
    if (i + 1 < SAMPLE_COUNT) qx[i + 1] = r * Math.sin(a);

    const v1 = Math.max(random(), 1e-12);
    const v2 = random();
    const rr = Math.sqrt(-2 * Math.log(v1));
    const aa = 2 * Math.PI * v2;
    qy[i] = rr * Math.cos(aa);
    if (i + 1 < SAMPLE_COUNT) qy[i + 1] = rr * Math.sin(aa);
  }
}

function erf(x) {
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-x * x);
  return sign * y;
}

function normalCdf(x) {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

function formatNumber(x) {
  if (!Number.isFinite(x)) return "—";
  if (Math.abs(x) < 1e-12) return "0";
  if (Math.abs(x) >= 1e4 || Math.abs(x) < 1e-4) return x.toExponential(3);
  return Number(x.toPrecision(5)).toString();
}

class EmpiricalDistribution {
  constructor(samples) {
    this.samples = samples;
    this.n = samples.length;
  }

  icdf(p) {
    if (p <= 0) return this.samples[0];
    if (p >= 1) return this.samples[this.n - 1];
    const t = p * (this.n - 1);
    const i = Math.floor(t);
    const f = t - i;
    const a = this.samples[i];
    const b = this.samples[Math.min(i + 1, this.n - 1)];
    return a + (b - a) * f;
  }

  qdf(p) {
    const center = Math.max(0, Math.min(this.n - 1, Math.round(p * (this.n - 1))));
    const radius = 48;
    const lo = Math.max(0, center - radius);
    const hi = Math.min(this.n - 1, center + radius);
    if (hi <= lo) return 0;
    const dx = this.samples[hi] - this.samples[lo];
    const dp = (hi - lo) / (this.n - 1);
    return dx / dp;
  }
}

function rebuildDistribution() {
  const muX = parseFloat(inputs.mu_x.value);
  const muY = parseFloat(inputs.mu_y.value);
  const logvarX = parseFloat(inputs.logvar_x.value);
  const logvarY = parseFloat(inputs.logvar_y.value);
  const sigmaX = Math.exp(0.5 * logvarX);
  const sigmaY = Math.exp(0.5 * logvarY);

  const samples = new Array(SAMPLE_COUNT);
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const x = muX + sigmaX * qx[i];
    const y = muY + sigmaY * qy[i];
    samples[i] = x * Math.max(0, y);
  }
  samples.sort((a, b) => a - b);
  dist = new EmpiricalDistribution(samples);

  const atomMass = normalCdf(-muY / sigmaY);
  const pXNeg = normalCdf(-muX / sigmaX);
  atomStart = pXNeg * (1 - atomMass);
  atomEnd = atomStart + atomMass;

  document.getElementById("val_mu_x").innerText = muX.toFixed(2);
  document.getElementById("val_logvar_x").innerText = logvarX.toFixed(2);
  document.getElementById("val_sigma_x").innerText = sigmaX.toFixed(3);
  document.getElementById("val_mu_y").innerText = muY.toFixed(2);
  document.getElementById("val_logvar_y").innerText = logvarY.toFixed(2);
  document.getElementById("val_sigma_y").innerText = sigmaY.toFixed(3);
  document.getElementById("val_min_dist").innerText = inputs.min_dist.value;
  document.getElementById("val_drop_off").innerText = Number(inputs.drop_off.value).toFixed(1);
  document.getElementById("stat_atom").innerText = atomMass.toFixed(4);
  document.getElementById("stat_q05").innerText = formatNumber(dist.icdf(0.05));
  document.getElementById("stat_q50").innerText = formatNumber(dist.icdf(0.50));
  document.getElementById("stat_q95").innerText = formatNumber(dist.icdf(0.95));
}

function draw() {
  if (!dist) return;

  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(width * dpr));
  canvas.height = Math.max(1, Math.round(height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const yPos = height * 0.43;
  const x0 = atomStart * (width - 1);
  const x1 = atomEnd * (width - 1);

  ctx.fillStyle = "rgba(255, 209, 102, 0.14)";
  ctx.fillRect(x0, yPos - 28, Math.max(1, x1 - x0), 56);
  if (x1 - x0 > 55) {
    ctx.fillStyle = "rgba(255, 209, 102, 0.9)";
    ctx.font = "13px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("Z = 0", (x0 + x1) / 2, yPos - 32);
  }

  ctx.font = "14px monospace";
  const ticks = generateTicks(dist, Math.max(1, Math.floor((width - 1) * 4)));
  drawTicks(ctx, ticks, yPos, "135, 206, 235", {
    min_dist: parseFloat(inputs.min_dist.value),
    drop_off: parseFloat(inputs.drop_off.value),
    width,
  });

  ctx.fillStyle = "rgba(220, 220, 220, 0.55)";
  ctx.font = "12px monospace";
  ctx.textBaseline = "top";
  for (const p of [0.25, 0.5, 0.75]) {
    const x = p * (width - 1);
    ctx.textAlign = "center";
    ctx.fillText(`p=${p.toFixed(2)}`, x, height - 24);
  }
}

function update({ rebuild = true } = {}) {
  if (rebuild) rebuildDistribution();
  else {
    document.getElementById("val_min_dist").innerText = inputs.min_dist.value;
    document.getElementById("val_drop_off").innerText = Number(inputs.drop_off.value).toFixed(1);
  }
  draw();
}

function queueUpdate(rebuild) {
  if (redrawQueued) return;
  redrawQueued = true;
  requestAnimationFrame(() => {
    redrawQueued = false;
    update({ rebuild });
  });
}

for (const key of ["mu_x", "logvar_x", "mu_y", "logvar_y"]) {
  inputs[key].addEventListener("input", () => queueUpdate(true));
}
for (const key of ["min_dist", "drop_off"]) {
  inputs[key].addEventListener("input", () => queueUpdate(false));
}

document.getElementById("reset").addEventListener("click", () => {
  inputs.mu_x.value = 0;
  inputs.logvar_x.value = 0;
  inputs.mu_y.value = 0;
  inputs.logvar_y.value = 0;
  inputs.min_dist.value = 128;
  inputs.drop_off.value = 2.0;
  update({ rebuild: true });
});

window.addEventListener("resize", () => queueUpdate(false));

fillNormals();
update({ rebuild: true });
