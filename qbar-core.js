(function (global) {
  "use strict";

  function smoothstep(edge0, edge1, x) {
    if (edge1 <= edge0) return x <= edge0 ? 0 : 1;
    x = Math.max(0, Math.min(edge1, x) - edge0) / (edge1 - edge0);
    return x * x * (3 - 2 * x);
  }

  function findBiggestNiceStep(start, end) {
    const maxVal = Math.max(Math.abs(start), Math.abs(end));
    if (!isFinite(maxVal)) return { expon: Infinity, mant: 1 };
    if (maxVal === 0) return { expon: 0, mant: 1 };
    let expon = Math.floor(Math.log10(maxVal));
    const multipliers = [5, 1];
    const start_step = 10 ** expon;
    start /= start_step;
    end /= start_step;
    while (start < end) {
      for (let mant of multipliers) {
        if (Math.ceil(start / mant) < end / mant) return { expon, mant };
      }
      expon--;
      start *= 10.0;
      end *= 10.0;
    }
    return { expon, mant: 1.0 };
  }

  function formatSci({ mant, expon }) {
    let s = mant.toString();
    if (expon === 0) return s;
    if (expon > 0) return s + "0".repeat(expon);

    const absExpon = Math.abs(expon);
    const sign = s.startsWith("-") ? "-" : "";
    const digits = sign ? s.slice(1) : s;
    if (absExpon < digits.length) {
      const dotIndex = digits.length - absExpon;
      return `${sign}${digits.slice(0, dotIndex)}.${digits.slice(dotIndex)}`;
    }
    return `${sign}0.${"0".repeat(absExpon - digits.length)}${digits}`;
  }

  function generateTicks(dist, n) {
    const ticks = [];
    let prev_bound = dist.icdf(0.0);

    for (let idx = 0; idx <= n; idx++) {
      const p = idx / n;
      const next_bound = dist.icdf(p);
      if (prev_bound === next_bound) continue;
      const { expon, mant } = findBiggestNiceStep(prev_bound, next_bound);
      const ik = 10 ** -expon / mant;

      const tick = {
        mant: Math.floor(next_bound * ik) * mant,
        expon,
        p,
        inv_density: dist.qdf(p) * ik,
      };
      if (prev_bound < 0 && 0 <= next_bound) {
        tick.mant = 0;
        tick.expon = 0;
        tick.inv_density = 0;
      }
      if (isFinite(tick.expon)) ticks.push(tick);
      prev_bound = next_bound;
    }
    return ticks;
  }

  function drawTicks(ctx, ticks, yPos, colorRgb, params) {
    const { min_dist, drop_off, width } = params;
    ctx.beginPath();
    ctx.moveTo(0, yPos);
    ctx.lineTo(width, yPos);
    ctx.strokeStyle = `rgba(${colorRgb}, 0.3)`;
    ctx.lineWidth = 1;
    ctx.stroke();

    for (const tick of ticks) {
      const final_opacity = smoothstep(
        min_dist,
        min_dist * drop_off,
        width / tick.inv_density,
      );
      if (final_opacity * 256 <= 1) continue;
      const x = tick.p * (width - 1);
      const color = `rgba(${colorRgb}, ${final_opacity})`;

      ctx.beginPath();
      ctx.moveTo(x, yPos - 8);
      ctx.lineTo(x, yPos + 8);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.save();
      ctx.fillStyle = color;
      ctx.translate(x, yPos + 12);
      ctx.rotate(Math.PI / 2);
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(formatSci(tick), 0, 0);
      ctx.restore();
    }
  }

  global.QBar = {
    smoothstep,
    findBiggestNiceStep,
    formatSci,
    generateTicks,
    drawTicks,
  };
})(window);
