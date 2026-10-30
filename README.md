# SelStats 🧮

Select text with numbers on any web page and a tiny pill in the bottom-right shows **Count, Sum, Avg, Median, Min, Max**, like a spreadsheet status bar. Click the pill to copy `Sum: … Avg: …` to the clipboard (configurable, see Options).

Understands negatives, decimals, thousands separators (`1,234.5`), `$` / `€`, `%`, and accounting negatives `(12)` = -12. Everything else is ignored. The pill appears only when 2 or more numbers are selected.

## Column mode (new in 1.1.0, fixed in 1.1.1)
Web tables don't let you select just one column. **Alt-click (Option-click on Mac)** any cell and SelStats computes the stats over that whole column. The pill shows `Col <header>:` and the column's cells flash with an outline for 1.2 s. Press **Esc** or make a new selection to dismiss it.

- Works with real `<table>`s (colspan/rowspan are handled, and header rows and `th` cells are skipped), ARIA grids (`role=grid/table/treegrid`, `row`, `cell`/`gridcell`, `columnheader`, as used on Yahoo Finance and similar sites), and plain repeated `<div>` rows.
- Click, don't drag: Alt-drag still selects rows (that's the browser's native table selection). If a single Alt/Option-click is swallowed, use **Alt+double-click**.
- Only the first number in each cell counts. Empty cells and cells with no number are skipped.
- Alt-click on a link inside a cell won't follow or download the link. Alt+drag still selects text as usual.

Only the `storage` permission (for your options), no network, no tracking.

## Range mode (new in 1.2.0)
Want just the top 7 of a sorted column? **Alt-click** the first cell (that shows the whole column and sets it as the *anchor*), then **Alt+Shift-click** (Option+Shift on Mac) another cell in the same column. The stats cover only the rows from the anchor to that cell, inclusive, and the pill shows e.g. `Col Price rows 1–7:` (data-row numbers, 1-based, header rows not counted). Only those cells flash.

- Alt+Shift-click with no anchor, or with the anchor in a different column or table, acts as a plain whole-column Alt-click and sets a new anchor.
- The anchor stays put across range clicks, so you can Alt+Shift-click several end rows in a row. A new plain Alt-click moves it. **Esc** clears it.
- Row numbers count every data row in the range, including empty ones. Only the cells with numbers go into the stats.

## Options (new in 1.3.0)
Open **Manage extension → Details → Extension options**. Choose which stats the pill copies (Count, Sum, Avg, Median, Min, Max; default Sum and Avg) and the format:
- **One line** (default): `Sum: 1,234 Avg: 176.3`
- **Tab-separated for spreadsheets**: a header row plus a value row with raw numbers (no thousands separators), so it pastes into two rows of cells.

Settings save instantly via `chrome.storage.sync`, apply to open tabs right away, and the pill's tooltip shows what it will copy.

## Install in Brave (or Chrome)
1. Open `brave://extensions` (or `chrome://extensions`).
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and pick this `selstats` folder.

## Tests
`node test.js`

## Limitations
- Column mode: ARIA grids that virtualize rows (render only the visible ones) only count the rows currently in the DOM. ARIA `aria-colindex`/spans are ignored (it goes by child position). In plain-div fallback there's no header, and rows must share the same tag and class list. Alt-drag that starts on a link inside a cell won't select, because mousedown is blocked there to stop the Mac Option-click download.
- Doesn't work on `brave://` / `chrome://` pages, the Web Store, or the built-in PDF viewer.
- Text inside `<input>`/`<textarea>` may not be reported by `getSelection()` in every browser.
- `1,2,3` is read as three numbers, and `1,234` as one thousand-style number. European formats (`1.234,5`) aren't supported.
- Clipboard copy needs a focused page. On some strict pages it falls back to `execCommand`.
