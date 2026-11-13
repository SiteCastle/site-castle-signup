(function () {
  var form = document.querySelector("form[data-intake]");
  if (!form) return;
  var key = "sc-" + form.getAttribute("name");
  var btn = form.querySelector("button[type=submit]");
  var ok = document.getElementById("result-ok");
  var err = document.getElementById("result-err");
  var saved = document.getElementById("saved");

  function fields() {
    return Array.prototype.filter.call(form.elements, function (el) {
      return el.name && el.name !== "form-name" && el.name !== "bot-field" && el.type !== "hidden" && el.type !== "submit";
    });
  }
  function setValue(el, v) {
    if (el.type === "checkbox" || el.type === "radio") { el.checked = (el.value === v) || (el.type === "checkbox" && v === true); }
    else { el.value = v; }
  }
  // 1) prefill from the link (only fields marked data-prefill: public business facts)
  try {
    var q = new URLSearchParams(location.search);
    fields().forEach(function (el) {
      if (el.hasAttribute("data-prefill") && q.has(el.name) && !el.value) { el.value = q.get(el.name); }
    });
  } catch (e) {}
  // 2) restore an unsent draft from this browser
  try {
    var d = JSON.parse(localStorage.getItem(key) || "{}");
    fields().forEach(function (el) {
      var v = d[el.name + (el.type === "radio" || el.type === "checkbox" ? ":" + el.value : "")];
      if (v !== undefined && v !== "") setValue(el, v);
    });
  } catch (e) {}
  // 3) save as they type
  var t;
  form.addEventListener("input", function () {
    clearTimeout(t);
    t = setTimeout(function () {
      var d = {};
      fields().forEach(function (el) {
        if (el.type === "radio" || el.type === "checkbox") { if (el.checked) d[el.name + ":" + el.value] = true; }
        else d[el.name] = el.value;
      });
      try { localStorage.setItem(key, JSON.stringify(d)); if (saved) saved.textContent = "Saved on this device. You can close this page and finish later."; } catch (e) {}
    }, 400);
  });
  // 4) send
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    ok.classList.remove("show"); err.classList.remove("show");
    if (!form.checkValidity()) { form.reportValidity(); return; }
    btn.disabled = true;
    fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(new FormData(form)).toString()
    }).then(function (r) {
      if (!r.ok) throw new Error("bad status " + r.status);
      try { localStorage.removeItem(key); } catch (e2) {}
      form.querySelectorAll("fieldset, button[type=submit], .saved").forEach(function (n) { n.hidden = true; });
      ok.classList.add("show");
      ok.scrollIntoView({ behavior: "smooth", block: "start" });
    }).catch(function () { err.classList.add("show"); btn.disabled = false; });
  });
})();
