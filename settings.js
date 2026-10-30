(function (root) {
  const KEYS = ["count", "sum", "avg", "median", "min", "max"];
  const LABELS = { count: "Count", sum: "Sum", avg: "Avg", median: "Median", min: "Min", max: "Max" };
  const DEFAULTS = { fields: ["sum", "avg"], format: "line" };
  function normalize(o) {
    o = o || {};
    let fields = Array.isArray(o.fields) ? KEYS.filter(k => o.fields.includes(k)) : DEFAULTS.fields.slice();
    if (!fields.length) fields = DEFAULTS.fields.slice();
    return { fields, format: o.format === "tsv" ? "tsv" : "line" };
  }
  const raw = v => String(Number(v.toPrecision(15)));
  const pretty = (k, v) => k === "count" ? v.toLocaleString()
    : Number(v.toPrecision(15)).toLocaleString(undefined, { maximumFractionDigits: 6 });
  function buildCopyText(st, opts) {
    const o = normalize(opts);
    if (o.format === "tsv") return o.fields.map(k => LABELS[k]).join("\t") + "\n" + o.fields.map(k => raw(st[k])).join("\t");
    return o.fields.map(k => `${LABELS[k]}: ${pretty(k, st[k])}`).join(" ");
  }
  function describe(opts) {
    const o = normalize(opts), names = o.fields.map(k => LABELS[k]);
    const list = names.length > 1 ? names.slice(0, -1).join(", ") + " & " + names[names.length - 1] : names[0];
    return `Click to copy ${list}${o.format === "tsv" ? " (tab-separated)" : ""}`;
  }
  const api = { KEYS, LABELS, DEFAULTS, normalize, buildCopyText, describe };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SelStatsSettings = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
