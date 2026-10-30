(function (root) {
  const RE = /(\()?\s*([-−]?)\s*([$€]?)\s*([-−]?)(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?|\.\d+)\s*(%?)\s*(\))?/g;
  function parseNumbers(text) {
    const out = [];
    if (!text) return out;
    let m;
    RE.lastIndex = 0;
    while ((m = RE.exec(text))) {
      let v = parseFloat(m[5].replace(/,/g, ""));
      if (!isFinite(v)) continue;
      if (m[2] || m[4]) v = -v;
      if (m[1] && m[7]) v = -Math.abs(v);
      out.push(v);
    }
    return out;
  }
  function stats(nums) {
    const n = nums.length;
    if (!n) return null;
    const s = nums.reduce((a, b) => a + b, 0);
    const sorted = [...nums].sort((a, b) => a - b);
    const mid = n >> 1;
    const median = n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    return { count: n, sum: s, avg: s / n, median, min: sorted[0], max: sorted[n - 1] };
  }
  function fmt(v) {
    return Number(v.toPrecision(15)).toLocaleString(undefined, { maximumFractionDigits: 6 });
  }
  const api = { parseNumbers, stats, fmt };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SelStatsParser = api;
})(typeof globalThis!=="undefined"?globalThis:this);
