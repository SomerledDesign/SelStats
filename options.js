(() => {
  const S = window.SelStatsSettings, box = document.getElementById("fields"), status = document.getElementById("status");
  box.innerHTML = S.KEYS.map(k => `<label class="chip"><input type="checkbox" value="${k}">${S.LABELS[k]}</label>`).join("");
  const boxes = [...box.querySelectorAll("input")], radios = [...document.querySelectorAll("input[name=format]")];
  function show(o) {
    o = S.normalize(o);
    boxes.forEach(b => b.checked = o.fields.includes(b.value));
    radios.forEach(r => r.checked = r.value === o.format);
  }
  chrome.storage.sync.get(S.DEFAULTS, show);
  let t;
  function save() {
    const fields = boxes.filter(b => b.checked).map(b => b.value);
    if (!fields.length) { status.textContent = "Pick at least one stat 🙂"; return; }
    const format = (radios.find(r => r.checked) || {}).value || "line";
    chrome.storage.sync.set({ fields, format }, () => {
      status.textContent = "Saved ✓"; clearTimeout(t); t = setTimeout(() => status.textContent = "", 1200);
    });
  }
  [...boxes, ...radios].forEach(i => i.addEventListener("change", save));
})();
