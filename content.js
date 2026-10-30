(() => {
  if (window.__selstats) return; window.__selstats = 1;
  const { parseNumbers, stats, fmt } = window.SelStatsParser;
  const { getColumn, getColumnRange, inCell } = window.SelStatsColumn;
  const S = window.SelStatsSettings;
  let opts = S.normalize(S.DEFAULTS);
  const setTip = () => { if (box) box.title = S.describe(opts); };
  try {
    chrome.storage.sync.get(S.DEFAULTS, o => { opts = S.normalize(o); setTip(); });
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area !== "sync") return;
      const n = {}; for (const k in ch) n[k] = ch[k].newValue;
      opts = S.normalize(Object.assign({}, opts, n)); setTip();
    });
  } catch {}
  let anchor = null; // target of the last whole-column Alt-click (RANGE mode start)
  let host, box, label, current, timer, hideT, colUntil = 0, colMode = false, down = null;
  function ensure() {
    if (host) return;
    host = document.createElement("selstats-pill");
    host.style.cssText = "all:initial;position:fixed;right:12px;bottom:12px;z-index:2147483647;";
    const sh = host.attachShadow({ mode: "closed" });
    sh.innerHTML = `<style>
      .p{font:12px/1.4 system-ui,-apple-system,Segoe UI,sans-serif;background:#fff;color:#222;border-radius:999px;
      padding:6px 14px;box-shadow:0 4px 16px rgba(0,0,0,.18);cursor:pointer;user-select:none;white-space:nowrap;
      animation:f .18s ease-out;border:1px solid rgba(0,0,0,.08)}
      .p:hover{transform:translateY(-1px)} b{font-weight:600;margin-right:2px} span{margin-right:10px}
      @keyframes f{from{opacity:0;transform:translateY(6px)}to{opacity:1}}
      @media (prefers-color-scheme:dark){.p{background:#2b2d31;color:#eee;border-color:rgba(255,255,255,.1)}}
    </style><div class="p"></div>`;
    box = sh.querySelector(".p"); setTip();
    box.addEventListener("mousedown", e => e.preventDefault());
    box.addEventListener("click", copy);
  }
  function render(st, prefix) {
    ensure();
    const items = [["Count", st.count.toLocaleString()], ["Sum", fmt(st.sum)], ["Avg", fmt(st.avg)],
      ["Median", fmt(st.median)], ["Min", fmt(st.min)], ["Max", fmt(st.max)]];
    box.innerHTML = "🧮 " + (prefix || "") + items.map(([k, v]) => `<span><b>${k}:</b> ${v}</span>`).join("");
    label = box.innerHTML;
    if (!host.isConnected) (document.body || document.documentElement).appendChild(host);
  }
  function hide() { current = null; colMode = false; if (host && host.isConnected) host.remove(); }
  const esc = s => s.replace(/[&<>"]/g, c => "&#" + c.charCodeAt(0) + ";");
  function flash(cells) {
    const old = cells.map(c => [c, c.style.outline, c.style.outlineOffset]);
    for (const c of cells) { c.style.outline = "2px solid #4a90e2"; c.style.outlineOffset = "-2px"; }
    setTimeout(() => { for (const [c, o, f] of old) { c.style.outline = o; c.style.outlineOffset = f; } }, 1200);
  }
  function column(target, range) {
    let r = range && anchor ? getColumnRange(anchor, target, parseNumbers) : null;
    const isRange = !!r;
    if (!r) r = getColumn(target, parseNumbers);
    if (!r || !r.values.length) return false;
    if (!isRange) anchor = target;
    current = stats(r.values); colMode = true; colUntil = Date.now() + 400;
    const rows = isRange ? ` rows ${r.from}\u2013${r.to}` : "";
    render(current, `<span><b>Col${r.header ? " " + esc(r.header) : ""}${rows}:</b></span>`);
    flash(r.cells); return true;
  }
  function update() {
    if (colMode) { if (Date.now() < colUntil) return; colMode = false; }
    const sel = window.getSelection();
    const txt = sel ? sel.toString() : "";
    const nums = txt.trim() ? parseNumbers(txt) : [];
    if (nums.length < 2) return hide();
    current = stats(nums); render(current);
  }
  async function copy() {
    if (!current) return;
    const line = S.buildCopyText(current, opts);
    try { await navigator.clipboard.writeText(line); }
    catch { const t = document.createElement("textarea"); t.value = line; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); }
    box.textContent = "🧮 Copied!";
    clearTimeout(hideT); hideT = setTimeout(() => { if (box) box.innerHTML = label; }, 900);
  }
  const own = e => host && e.composedPath().includes(host);
  // Real target even inside open shadow roots / custom elements (fin-streamer etc.).
  const tgt = e => { const p = e.composedPath ? e.composedPath() : []; let t = p[0] || e.target; if (t && t.nodeType === 3) t = t.parentElement; return t; };
  // Alt state read from the event itself; also tracked from key events as a fallback for
  // pages/OSes where the modifier flag on mouse events is lost (some Mac setups).
  let altHeld = false;
  const alt = e => e.altKey || altHeld;
  // Listen on window in capture phase so page handlers (Yahoo's React root, analytics)
  // can't stopPropagation before we see the event.
  const on = (type, fn) => window.addEventListener(type, fn, { capture: true });
  on("keydown", e => { if (e.key === "Alt") altHeld = true; });
  on("keyup", e => { if (e.key === "Alt") altHeld = false; });
  on("blur", () => { altHeld = false; });
  const onDown = e => {
    if (e.button !== 0 || own(e)) return;
    if (!alt(e)) { if (e.type === "mousedown") down = null; return; }
    const t = tgt(e);
    down = { x: e.clientX, y: e.clientY, t };
    // Only block mousedown on links (Mac Option-click download); elsewhere it would kill drag-selection.
    if (e.type === "mousedown" && inCell(t) && t.closest && t.closest("a[href]")) e.preventDefault();
  };
  on("pointerdown", onDown);
  on("mousedown", onDown);
  let lastCol = 0;
  function tryColumn(e) {
    const t = tgt(e), d = down; down = null;
    // If mousedown was swallowed we have no start point; accept the click anyway.
    if (d && (Math.abs(e.clientX - d.x) > 4 || Math.abs(e.clientY - d.y) > 4)) return false; // a real Alt-drag
    const s = window.getSelection(); if (s && !s.isCollapsed) s.removeAllRanges();
    if (column(t, e.type === "click" && e.shiftKey)) { lastCol = Date.now(); return true; }
    return false;
  }
  on("click", e => {
    if (e.button !== 0 || own(e) || !alt(e)) return;
    const t = tgt(e), cell = inCell(t);
    if (cell) { e.preventDefault(); e.stopPropagation(); }
    if (tryColumn(e) && !cell) { e.preventDefault(); e.stopPropagation(); }
  });
  // Alt+Shift-click = RANGE from the anchor (see column()). Fallback trigger: Alt+double-click,
  // for setups where a single Option-click is eaten by the OS or the page.
  on("dblclick", e => {
    if (own(e) || !alt(e)) return;
    if (Date.now() - lastCol < 600) { e.preventDefault(); e.stopPropagation(); return; }
    if (tryColumn(e)) { e.preventDefault(); e.stopPropagation(); }
  });
  on("keydown", e => { if (e.key !== "Escape") return; anchor = null; if (current) hide(); });
  document.addEventListener("selectionchange", () => { clearTimeout(timer); timer = setTimeout(update, 120); });
  on("mouseup", e => { if (own(e) || (colMode && Date.now() < colUntil)) return; setTimeout(update, 0); });
})();
