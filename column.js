(function (root) {
  const CELL_ROLES = '[role=cell],[role=gridcell]';
  const text = el => (el.innerText ?? el.textContent ?? "").trim();
  function tableGrid(table) {
    const grid = [], rows = Array.from(table.rows);
    rows.forEach((tr, r) => {
      grid[r] = grid[r] || [];
      let c = 0;
      for (const cell of tr.cells) {
        while (grid[r][c]) c++;
        const cs = Math.max(1, cell.colSpan || 1), rs = Math.max(1, cell.rowSpan || 1);
        for (let i = 0; i < rs && r + i < rows.length; i++) {
          grid[r + i] = grid[r + i] || [];
          for (let j = 0; j < cs; j++) grid[r + i][c + j] = { cell, start: c, top: r };
        }
        c += cs;
      }
    });
    return { rows, grid };
  }
  function fromTable(cell) {
    const table = cell.closest("table");
    const { rows, grid } = tableGrid(table);
    const r = rows.indexOf(cell.parentElement);
    const col = grid[r].find(s => s && s.cell === cell).start;
    const cells = [], seen = new Set();
    let header = null;
    rows.forEach((tr, i) => {
      const s = grid[i][col];
      if (!s || seen.has(s.cell)) return;
      seen.add(s.cell);
      const inHead = tr.parentElement && tr.parentElement.tagName === "THEAD";
      if (s.cell.tagName === "TH" || inHead) { if (!header || inHead) header = s.cell; return; }
      cells.push(s.cell);
    });
    return { cells, header, col, box: table, cell };
  }
  function fromAria(cell) {
    const row = cell.closest("[role=row]");
    if (!row) return null;
    const kids = Array.from(row.children).filter(e => e.matches('[role=cell],[role=gridcell],[role=columnheader],[role=rowheader]'));
    const col = kids.indexOf(cell);
    const grid = row.closest("[role=grid],[role=table],[role=treegrid]") || row.parentElement;
    const cells = []; let header = null;
    for (const r of grid.querySelectorAll("[role=row]")) {
      const k = Array.from(r.children).filter(e => e.matches('[role=cell],[role=gridcell],[role=columnheader],[role=rowheader]'))[col];
      if (!k) continue;
      if (k.matches("[role=columnheader]")) { if (!header) header = k; } else if (k.matches(CELL_ROLES)) cells.push(k);
    }
    return { cells, header, col, box: grid, cell };
  }
  function fromDivs(target) {
    // walk up until el's parent (row) has a sibling row with same tag+class
    for (let cell = target; cell && cell.parentElement && cell.parentElement.parentElement; cell = cell.parentElement) {
      const row = cell.parentElement, gp = row.parentElement;
      const d = row.ownerDocument; if (row === d.body || gp === d.documentElement) break;
      const key = r => r.tagName + "|" + r.className;
      const rows = Array.from(gp.children).filter(r => key(r) === key(row));
      if (rows.length < 2 || row.children.length < 2) continue;
      const col = Array.from(row.children).indexOf(cell);
      const cells = rows.map(r => r.children[col]).filter(Boolean);
      return { cells, header: null, col, box: gp, cell };
    }
    return null;
  }
  function resolve(target) {
    // Accept any descendant: text nodes, spans, fin-streamer and other custom elements,
    // and nodes inside open shadow roots (climb out via the host).
    while (target && !target.closest) target = target.parentElement || target.host || null;
    if (!target) return null;
    while (!target.closest("td,th," + CELL_ROLES + ",[role=columnheader]")) {
      const r = target.getRootNode && target.getRootNode();
      if (!r || !r.host) break;
      target = r.host;
    }
    const td = target.closest("td,th");
    const aria = target.closest(CELL_ROLES + ",[role=columnheader]");
    if (aria && (!td || td.contains(aria))) return fromAria(aria);
    if (td) return fromTable(td);
    return fromDivs(target);
  }
  function build(res, cells, parse) {
    const values = [], used = [];
    for (const c of cells) {
      const n = parse(text(c));
      if (n.length) { values.push(n[0]); used.push(c); }
    }
    let h = res.header ? text(res.header).replace(/\s+/g, " ") : "";
    if (h.length > 20) h = h.slice(0, 19) + "…";
    return { values, cells: used, header: h, col: res.col };
  }
  function getColumn(target, parse) {
    const res = resolve(target);
    return res ? build(res, res.cells, parse) : null;
  }
  // Stats over data rows anchor..end (inclusive, visual order) of one column.
  // Returns null if either target isn't a data cell or they're in different columns/tables.
  // from/to are 1-based data-row numbers (header rows not counted; empty cells counted).
  function getColumnRange(anchorTarget, endTarget, parse) {
    const a = resolve(anchorTarget), b = resolve(endTarget);
    if (!a || !b || a.box !== b.box || a.col !== b.col) return null;
    const i = a.cells.indexOf(a.cell), j = b.cells.indexOf(b.cell);
    if (i < 0 || j < 0) return null;
    const lo = Math.min(i, j), hi = Math.max(i, j);
    const r = build(a, a.cells.slice(lo, hi + 1), parse);
    r.from = lo + 1; r.to = hi + 1;
    return r;
  }
  function inCell(target) {
    while (target && !target.closest) target = target.parentElement || target.host || null;
    while (target) {
      if (target.closest("td,th," + CELL_ROLES + ",[role=columnheader]")) return true;
      const r = target.getRootNode && target.getRootNode();
      target = r && r.host ? r.host : null;
    }
    return false;
  }
  const api = { getColumn, getColumnRange, inCell };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SelStatsColumn = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
