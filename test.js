const assert = require("assert");
const { parseNumbers: p, stats, fmt } = require("./parser.js");
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log("ok  ", name); } catch (e) { fail++; console.log("FAIL", name, e.message); } }
t("ints", () => assert.deepStrictEqual(p("1 2 3"), [1, 2, 3]));
t("negatives", () => assert.deepStrictEqual(p("-5 and -2.5"), [-5, -2.5]));
t("decimals", () => assert.deepStrictEqual(p("3.14, .5"), [3.14, 0.5]));
t("thousands", () => assert.deepStrictEqual(p("1,234.5 and 1,000,000"), [1234.5, 1000000]));
t("comma lists", () => assert.deepStrictEqual(p("1,2,3"), [1, 2, 3]));
t("currency", () => assert.deepStrictEqual(p("$1,200 €3.50 -$4 $-5"), [1200, 3.5, -4, -5]));
t("percent", () => assert.deepStrictEqual(p("12% 7.5 %"), [12, 7.5]));
t("parens", () => assert.deepStrictEqual(p("(12) ($1,000.25) ( 3 )"), [-12, -1000.25, -3]));
t("ignore words", () => assert.deepStrictEqual(p("hello world, no numbers"), []));
t("table text", () => assert.deepStrictEqual(p("Apples\t$1.20\nPears\t(0.20)\nTotal\t1.00"), [1.2, -0.2, 1]));
t("empty", () => assert.deepStrictEqual(p(""), []));
t("stats", () => { const s = stats([1, 2, 3, 4]); assert.deepStrictEqual(s, { count: 4, sum: 10, avg: 2.5, median: 2.5, min: 1, max: 4 }); });
t("median odd", () => assert.strictEqual(stats([5, 1, 3]).median, 3));
t("fmt float noise", () => assert.strictEqual(fmt(0.1 + 0.2), (0.3).toLocaleString()));
t("fmt 6 decimals", () => assert.strictEqual(fmt(1 / 3), (0.333333).toLocaleString(undefined, { maximumFractionDigits: 6 })));

const { buildCopyText: B, describe } = require("./settings.js");
const st = stats([1000, 234, 0.5, 100]);
t("copy default sum+avg", () => assert.strictEqual(B(st), `Sum: ${fmt(1334.5)} Avg: ${fmt(333.625)}`));
t("copy line chosen order fixed", () => assert.strictEqual(B(st, { fields: ["max", "count"] }), `Count: 4 Max: ${fmt(1000)}`));
t("copy tsv raw", () => assert.strictEqual(B(st, { fields: ["count", "sum", "avg", "median", "min", "max"], format: "tsv" }),
  "Count\tSum\tAvg\tMedian\tMin\tMax\n4\t1334.5\t333.625\t167\t0.5\t1000"));
t("copy tsv float noise", () => assert.strictEqual(B(stats([0.1, 0.2]), { fields: ["sum"], format: "tsv" }), "Sum\n0.3"));
t("copy empty fields -> defaults", () => assert.strictEqual(B(st, { fields: [], format: "bogus" }), B(st)));
t("tooltip", () => { assert.strictEqual(describe(), "Click to copy Sum & Avg"); assert.strictEqual(describe({ fields: ["count", "min", "max"], format: "tsv" }), "Click to copy Count, Min & Max (tab-separated)"); });

let JSDOM;
try { ({ JSDOM } = require("jsdom")); } catch { try { ({ JSDOM } = require("/workspace/selstats-dev/node_modules/jsdom")); } catch {} }
if (!JSDOM) console.log("skip column tests (jsdom not found; npm i jsdom in ../selstats-dev)");
else {
  const { getColumn, getColumnRange, inCell } = require("./column.js");
  const doc = html => new JSDOM(html).window.document;
  const col = (d, sel) => getColumn(d.querySelector(sel), p);
  t("table basic + header + thead skip", () => {
    const d = doc(`<table><thead><tr><th>Name</th><th>Price</th></tr></thead><tbody>
      <tr><td>A</td><td id=x><a href=#>$1.50</a></td></tr><tr><td>B</td><td>2 (x3)</td></tr><tr><td>C</td><td></td></tr><tr><td>D</td><td>n/a</td></tr></tbody></table>`);
    const r = col(d, "#x a"); assert.deepStrictEqual(r.values, [1.5, 2]); assert.strictEqual(r.header, "Price"); assert.strictEqual(r.cells.length, 2);
  });
  t("table colspan visual index", () => {
    const d = doc(`<table><tr><th colspan=2>Group</th><th>Vol</th></tr>
      <tr><td colspan=2>10</td><td id=x>5</td></tr><tr><td>1</td><td>2</td><td>7</td></tr></table>`);
    const r = col(d, "#x"); assert.deepStrictEqual(r.values, [5, 7]); assert.strictEqual(r.header, "Vol"); assert.strictEqual(r.col, 2);
    assert.deepStrictEqual(col(d, "tr:nth-child(3) td:nth-child(2)").values, [10, 2]);
  });
  t("table rowspan", () => {
    const d = doc(`<table><tr><td rowspan=2>X</td><td>1</td></tr><tr><td id=x>2</td></tr></table>`);
    assert.deepStrictEqual(col(d, "#x").values, [1, 2]);
  });
  t("nested table uses inner", () => {
    const d = doc(`<table><tr><td><table><tr><td id=x>3</td></tr><tr><td>4</td></tr></table></td><td>99</td></tr></table>`);
    assert.deepStrictEqual(col(d, "#x").values, [3, 4]);
  });
  t("aria grid", () => {
    const d = doc(`<div role=grid><div role=row><span role=columnheader>Symbol</span><span role=columnheader>Last Price Very Long Header</span></div>
      <div role=row><div role=gridcell>AAPL</div><div role=gridcell><b id=x>189.2</b></div></div>
      <div role=row><div role=gridcell>MSFT</div><div role=gridcell>(1,000.5)</div></div></div>`);
    const r = col(d, "#x"); assert.deepStrictEqual(r.values, [189.2, -1000.5]); assert.strictEqual(r.header.length, 20); assert.ok(r.header.endsWith("…"));
  });
  t("plain div rows", () => {
    const d = doc(`<div id=l><div class="r a"><span>A</span><span id=x>1</span></div><div class="r a"><span>B</span><span>2</span></div><div class="r b"><span>C</span><span>9</span></div></div>`);
    assert.deepStrictEqual(col(d, "#x").values, [1, 2]);
  });
  t("real Yahoo Finance most-active table (td > div > span / fin-streamer)", () => {
    const fs = require("fs"), path = require("path");
    const d = doc(fs.readFileSync(path.join(__dirname, "fixtures/yahoo-most-active.html"), "utf8"));
    const td = d.querySelector('tbody td[data-testid-cell="intradayprice"]');
    const want = Array.from(d.querySelectorAll('tbody td[data-testid-cell="intradayprice"] span[data-testid=change]')).map(s => parseFloat(s.textContent.replace(/,/g, "")));
    assert.strictEqual(want.length, 4);
    for (const el of [td, td.querySelector("span"), td.querySelector("fin-streamer"), td.querySelector("fin-streamer").firstChild]) {
      const r = getColumn(el, p); assert.deepStrictEqual(r.values, want); assert.strictEqual(r.header, "Price");
      assert.ok(inCell(el));
    }
    const ticker = d.querySelector('tbody a[data-testid=table-cell-ticker]');
    assert.ok(inCell(ticker));
  });
  t("cell content inside open shadow root", () => {
    const d = doc(`<table><tr><th>V</th></tr><tr><td><fin-streamer id=x></fin-streamer></td></tr><tr><td>4</td></tr></table>`);
    const h = d.querySelector("#x"); const sr = h.attachShadow({ mode: "open" }); sr.innerHTML = "<span>3</span>";
    assert.deepStrictEqual(getColumn(sr.querySelector("span"), p).values, [4]);
    assert.ok(inCell(sr.querySelector("span")));
  });
  t("getColumnRange basic, reversed, header, other column/table", () => {
    const d = doc(`<table id=t><thead><tr><th>N</th><th id=h>Price</th></tr></thead><tbody>
      ${[1,2,3,4,5,6,7,8].map(i => `<tr><td>r${i}</td><td id=p${i}><span>${i === 3 ? "" : i * 10}</span></td></tr>`).join("")}</tbody></table>
      <table><tr><td id=o>5</td></tr><tr><td>6</td></tr></table>`);
    const q = s => d.querySelector(s);
    let r = getColumnRange(q("#p1"), q("#p7 span"), p);
    assert.deepStrictEqual(r.values, [10, 20, 40, 50, 60, 70]); assert.strictEqual(r.from, 1); assert.strictEqual(r.to, 7);
    assert.strictEqual(r.header, "Price"); assert.strictEqual(r.cells.length, 6);
    r = getColumnRange(q("#p6"), q("#p2"), p); assert.deepStrictEqual(r.values, [20, 40, 50, 60]); assert.strictEqual(r.from, 2); assert.strictEqual(r.to, 6);
    assert.deepStrictEqual(getColumnRange(q("#p4"), q("#p4"), p).values, [40]);
    assert.strictEqual(getColumnRange(q("#p1"), q("#p2").previousElementSibling, p), null);
    assert.strictEqual(getColumnRange(q("#p1"), q("#o"), p), null);
    assert.strictEqual(getColumnRange(q("#h"), q("#p2"), p), null);
    assert.strictEqual(getColumnRange(null, q("#p2"), p), null);
  });
  t("getColumnRange aria grid + divs", () => {
    const d = doc(`<div role=grid><div role=row><span role=columnheader>V</span></div>
      ${[1,2,3,4].map(i => `<div role=row><div role=gridcell id=g${i}>${i}</div></div>`).join("")}</div>
      <div><div class=r><i>a</i><i id=d1>1</i></div><div class=r><i>b</i><i>2</i></div><div class=r><i>c</i><i id=d3>3</i></div></div>`);
    const r = getColumnRange(d.querySelector("#g2"), d.querySelector("#g4"), p); assert.deepStrictEqual(r.values, [2, 3, 4]); assert.strictEqual(r.from, 2);
    assert.deepStrictEqual(getColumnRange(d.querySelector("#d1"), d.querySelector("#d3"), p).values, [1, 2, 3]);
  });
  t("getColumnRange on Yahoo fixture", () => {
    const fs = require("fs"), path = require("path");
    const d = doc(fs.readFileSync(path.join(__dirname, "fixtures/yahoo-most-active.html"), "utf8"));
    const tds = Array.from(d.querySelectorAll('tbody td[data-testid-cell="intradayprice"]'));
    const want = tds.map(td => parseFloat(td.querySelector("span[data-testid=change]").textContent.replace(/,/g, "")));
    const r = getColumnRange(tds[0].querySelector("fin-streamer").firstChild, tds[2].querySelector("span"), p);
    assert.deepStrictEqual(r.values, want.slice(0, 3)); assert.strictEqual(r.from, 1); assert.strictEqual(r.to, 3); assert.strictEqual(r.header, "Price");
    const r2 = getColumnRange(tds[3], tds[1], p); assert.deepStrictEqual(r2.values, want.slice(1, 4)); assert.strictEqual(r2.from, 2);
    const other = tds[0].parentElement.querySelector('a[data-testid=table-cell-ticker]');
    assert.strictEqual(getColumnRange(tds[0], other, p), null);
  });
  t("inCell", () => {
    const d = doc(`<table><tr><td id=a>1</td></tr></table><p id=b>x</p>`);
    assert.ok(inCell(d.querySelector("#a").firstChild)); assert.ok(!inCell(d.querySelector("#b")));
  });
}
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
