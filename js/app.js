/* Lidex Academy - single-page app: routing, lab panels, graded exercises, challenges, progress. */
(function () {
  "use strict";
  const K = window.LidexContent;
  const LABS = window.LIDEX_LABS;
  const C = window.LidexCrypto;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const STORE = "lidex.academy.v1";
  const ALL_LESSONS = K.COURSES.flatMap(c => c.lessons.map(l => ({ course: c, lesson: l })));

  /* ---------- Progress (localStorage; starts empty) ---------- */
  function loadState() {
    try { return Object.assign({ done: {}, xp: 0, labsRun: {}, mined: false, challenges: {} }, JSON.parse(localStorage.getItem(STORE) || "{}")); }
    catch (e) { return { done: {}, xp: 0, labsRun: {}, mined: false, challenges: {} }; }
  }
  let state = loadState();
  const save = () => localStorage.setItem(STORE, JSON.stringify(state));
  function awardXp(n) { state.xp += n; save(); }
  function markLabRun(id) {
    if (!state.labsRun[id]) { state.labsRun[id] = true; awardXp(5); }
  }

  /* ---------- Shared UI helpers ---------- */
  function fieldHtml(input, value, prefix) {
    const id = prefix + input.id;
    const v = value === undefined ? input.value : value;
    if (input.type === "select") {
      return `<label>${esc(input.label)}<select id="${id}" data-input="${input.id}">${input.options.map(([val, lab]) => `<option value="${esc(val)}" ${String(val) === String(v) ? "selected" : ""}>${esc(lab)}</option>`).join("")}</select></label>`;
    }
    const t = input.type === "text" ? "text" : "number";
    return `<label>${esc(input.label)}<input id="${id}" data-input="${input.id}" type="${t}" ${t === "number" ? `step="${input.step || "any"}"` : ""} value="${esc(v)}" autocomplete="off"></label>`;
  }
  const readInputs = (lab, host) => {
    const out = {};
    for (const i of lab.inputs) {
      const el = host.querySelector(`[data-input="${i.id}"]`);
      out[i.id] = i.type === "number" ? (el.value === "" ? NaN : Number(el.value)) : el.value;
    }
    return out;
  };

  /* ---------- Lab simulator panel ---------- */
  function renderLab(host, labId, preset = {}) {
    const lab = LABS[labId];
    const pre = prefixId();
    host.innerHTML = `
      <div class="lab">
        <div class="lab-head"><span class="chip">Lab simulator</span><h3>${esc(lab.title)}</h3><p class="muted">${esc(lab.summary)}</p></div>
        <div class="lab-grid">
          <div class="lab-inputs">
            ${lab.inputs.map(i => fieldHtml(i, preset[i.id], pre)).join("")}
            <button class="btn primary" data-run>Run simulation</button>
            ${labId === "hash-pow" ? `
              <div class="mine">
                <h4>Mine a nonce</h4>
                <label>Difficulty (leading zero bits, max 16)
                  <select data-diff>${[8, 10, 12, 14, 16].map(b => `<option value="${b}" ${b === 12 ? "selected" : ""}>${b} bits</option>`).join("")}</select>
                </label>
                <button class="btn" data-mine>Mine</button>
                <span class="muted" data-mine-status></span>
              </div>` : ""}
          </div>
          <div class="lab-out"><div data-out class="muted">Running…</div></div>
        </div>
      </div>`;
    const out = host.querySelector("[data-out]");
    let timer = null;
    const run = async () => {
      let res;
      try {
        res = await lab.compute(readInputs(lab, host));
      } catch (e) {
        out.innerHTML = `<div class="err">⚠ ${esc(e.message)}</div>`;
        return;
      }
      markLabRun(labId);
      out.innerHTML = `<table class="rows">${res.rows.map(r => `<tr><th>${esc(r.label)}</th><td class="${r.mono ? "mono" : ""}">${esc(r.value)}</td></tr>`).join("")}</table>` +
        (res.levels ? `<details><summary>Tree levels (${res.levels.length})</summary>${res.levels.map((l, i) => `<div class="lvl"><b>Level ${i}</b>${l.map(h => `<code>${esc(h.slice(0, 14))}…</code>`).join(" ")}</div>`).join("")}</details>` : "");
    };
    const schedule = () => { clearTimeout(timer); timer = setTimeout(run, 150); };
    host.querySelectorAll("[data-input]").forEach(el => el.addEventListener("input", schedule));
    host.querySelector("[data-run]").addEventListener("click", run);
    if (labId === "hash-pow") {
      const mineBtn = host.querySelector("[data-mine]"), status = host.querySelector("[data-mine-status]");
      mineBtn.addEventListener("click", async () => {
        mineBtn.disabled = true;
        const v = readInputs(lab, host), bits = Number(host.querySelector("[data-diff]").value);
        status.textContent = "Searching…";
        try {
          const r = await lab.mine(v, bits, (t) => { status.textContent = "Tried " + t.toLocaleString("en-US") + " nonces…"; });
          host.querySelector(`[data-input="nonce"]`).value = r.nonce;
          status.textContent = `Found nonce ${r.nonce} after ${r.tries.toLocaleString("en-US")} tries.`;
          state.mined = true; save();
          run();
        } catch (e) { status.textContent = "⚠ " + e.message; }
        mineBtn.disabled = false;
      });
    }
    run();
  }
  let pidCounter = 0;
  const prefixId = () => "p" + (++pidCounter) + "-";

  /* ---------- Exercise (graded by real computation) ---------- */
  function renderExercise(host, lesson, onPass) {
    const ex = lesson.exercise;
    const already = !!state.done[lesson.id];
    host.innerHTML = `
      <div class="exercise">
        <span class="chip">Challenge</span>
        <p>${esc(ex.prompt)}</p>
        <div class="fields">${ex.fields.map(f => `<label>${esc(f.label)}<input data-f="${f.id}" type="${f.kind === "number" ? "number" : "text"}" step="any" autocomplete="off"></label>`).join("")}</div>
        <button class="btn primary" data-check>Check answer</button>
        <div class="result" data-result>${already ? '<span class="ok">✓ Completed earlier</span>' : ""}</div>
      </div>`;
    host.querySelector("[data-check]").addEventListener("click", async () => {
      const ans = {};
      host.querySelectorAll("[data-f]").forEach(el => ans[el.dataset.f] = el.value);
      const resEl = host.querySelector("[data-result]");
      resEl.textContent = "Checking…";
      let r;
      try { r = await ex.check(ans); } catch (e) { r = { ok: false, msg: "⚠ " + e.message }; }
      if (r.ok) {
        if (!state.done[lesson.id]) {
          state.done[lesson.id] = { at: new Date().toISOString().slice(0, 10) };
          awardXp(25);
          onPass && onPass();
        }
        resEl.innerHTML = `<span class="ok">✓ ${esc(r.msg)}</span>`;
      } else {
        resEl.innerHTML = `<span class="bad">✗ ${esc(r.msg)}</span>`;
      }
      save();
    });
  }

  /* ---------- Coding challenge (sandboxed Worker, timed) ---------- */
  const BLOCKED = /importScripts|\bfetch\s*\(|XMLHttpRequest|WebSocket|\bself\b|\bglobalThis\b|\bwindow\b|\bdocument\b|\beval\s*\(|\bFunction\s*\(|\bpostMessage\b/;
  function runInWorker(code, fn, tests) {
    return new Promise((resolve) => {
      const src = `
        self.onmessage = (e) => {
          const { code, fn, tests } = e.data;
          try {
            const f = new Function(code + "\\n;return " + fn + ";")();
            const results = tests.map(t => {
              try {
                const r = f(...t.args.map(a => BigInt(a)));
                return { ok: String(r) === t.expected, got: String(r) };
              } catch (err) { return { ok: false, got: "error: " + err.message }; }
            });
            self.postMessage({ results });
          } catch (err) { self.postMessage({ error: err.message }); }
        };`;
      const url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
      const w = new Worker(url);
      const done = (payload) => { clearTimeout(t); w.terminate(); URL.revokeObjectURL(url); resolve(payload); };
      const t = setTimeout(() => done({ timeout: true }), 3000);
      w.onmessage = (e) => done(e.data);
      w.onerror = (e) => done({ error: e.message || "worker error" });
      w.postMessage({ code, fn, tests });
    });
  }
  function renderChallenge(host, lesson, onPass) {
    const ch = lesson.challenge;
    const key = lesson.id;
    host.innerHTML = `
      <div class="exercise">
        <span class="chip">Coding challenge</span>
        <p>${esc(ch.prompt)}</p>
        <textarea class="code" spellcheck="false" data-code>${esc(state.challenges[key] || ch.starter)}</textarea>
        <div class="row"><button class="btn primary" data-test>Run tests</button><button class="btn" data-reset>Reset</button></div>
        <ul class="tests" data-tests></ul>
      </div>`;
    const codeEl = host.querySelector("[data-code]"), list = host.querySelector("[data-tests]");
    codeEl.addEventListener("input", () => { state.challenges[key] = codeEl.value; save(); });
    host.querySelector("[data-reset]").addEventListener("click", () => { codeEl.value = ch.starter; state.challenges[key] = ch.starter; save(); });
    host.querySelector("[data-test]").addEventListener("click", async () => {
      const code = codeEl.value;
      if (BLOCKED.test(code)) { list.innerHTML = `<li class="bad">✗ Blocked: this runner does not allow network, DOM, or dynamic-code APIs.</li>`; return; }
      list.innerHTML = `<li class="muted">Running in a sandboxed worker…</li>`;
      const res = await runInWorker(code, ch.fn, ch.tests);
      if (res.timeout) { list.innerHTML = `<li class="bad">✗ Timed out after 3 s (possible infinite loop).</li>`; return; }
      if (res.error) { list.innerHTML = `<li class="bad">✗ ${esc(res.error)}</li>`; return; }
      const passed = res.results.filter(r => r.ok).length;
      list.innerHTML = res.results.map((r, i) => `<li class="${r.ok ? "ok" : "bad"}">${r.ok ? "✓" : "✗"} case ${i + 1}: input (${ch.tests[i].args.join(", ")}) → got ${esc(r.got)}, expected ${esc(ch.tests[i].expected)}</li>`).join("") +
        `<li><b>${passed}/${res.results.length} passed</b></li>`;
      if (passed === res.results.length && !state.challenges[key + ":passed"]) {
        state.challenges[key + ":passed"] = true; awardXp(25); save(); onPass && onPass();
      }
    });
  }

  /* ---------- Views ---------- */
  function sourcesHtml(ids) {
    return K.sourceMeta(ids).map(s => `
      <li><a href="${esc(s.url)}" ${s.url.startsWith("http") ? 'target="_blank" rel="noopener"' : ""}>${esc(s.title)}</a>
        — ${esc(s.publisher)} <span class="muted">· accessed ${s.accessed}${s.linkCheckedAt ? " · link checked " + s.linkCheckedAt : ""}</span></li>`).join("");
  }
  const pathProgress = (pathId) => {
    const lessons = ALL_LESSONS.filter(x => x.course.path === pathId);
    const done = lessons.filter(x => state.done[x.lesson.id]).length;
    return { done, total: lessons.length };
  };

  function viewHome() {
    const totalDone = Object.keys(state.done).length;
    return `
      <section class="hero">
        <img class="hero-logo" src="assets/lidex-logo.jpg" alt="Lidex">
        <h1>Lidex Academy</h1>
        <p class="tagline">Learn Web3. Build the future.</p>
        <p class="lead">Learn how blockchains, DEXs, lending markets and tokenomics really compute, then prove it in lab simulators where every number is calculated, not scripted.</p>
        <div class="row"><a class="btn primary" href="#/path/blockchain-bitcoin">Start with Blockchain &amp; Bitcoin</a><a class="btn" href="#/labs">Open the labs</a></div>
      </section>
      <section class="stats">
        <div><b>${K.PATHS.length}</b><span>learning paths</span></div>
        <div><b>${K.COURSES.length}</b><span>courses</span></div>
        <div><b>${ALL_LESSONS.length}</b><span>lessons</span></div>
        <div><b>${Object.keys(LABS).length}</b><span>lab simulators</span></div>
        <div><b>${totalDone}</b><span>lessons you completed</span></div>
      </section>
      <section>
        <h2>How a lesson works</h2>
        <div class="flow"><div>Learn</div><div>Practice (lab)</div><div>Challenge (graded)</div><div>XP &amp; progress</div></div>
        <p class="muted">Quizzes, build projects, certificates and the automated course engine are not part of this build yet. See the note on the dashboard.</p>
      </section>
      <section><h2>Learning paths</h2>${pathCards()}</section>`;
  }
  function pathCards() {
    return `<div class="cards">${K.PATHS.map(p => {
      const pr = pathProgress(p.id);
      return `<a class="card" href="#/path/${p.id}"><h3>${esc(p.title)}</h3><p class="muted">${esc(p.blurb)}</p><div class="bar"><i style="width:${pr.total ? (pr.done / pr.total) * 100 : 0}%"></i></div><small>${pr.done}/${pr.total} lessons</small></a>`;
    }).join("")}</div>`;
  }
  function viewPaths() { return `<h1>Learning paths</h1><p class="muted">Only paths with published, lab-backed courses are listed.</p>${pathCards()}`; }
  function viewPath(id) {
    const p = K.PATHS.find(x => x.id === id);
    if (!p) return notFound();
    const courses = K.COURSES.filter(c => c.path === id);
    return `<h1>${esc(p.title)}</h1><p class="muted">${esc(p.blurb)}</p>
      ${courses.map(c => `<div class="panel"><h2>${esc(c.title)}</h2><p class="muted">${esc(c.description)}</p>
        <ol class="lesson-list">${c.lessons.map(l => `<li><a href="#/lesson/${c.id}/${l.id}">${state.done[l.id] ? "✓ " : ""}${esc(l.title)}</a> <span class="chip">${esc(LABS[l.labId].title)}</span></li>`).join("")}</ol></div>`).join("")}`;
  }
  function sidebarHtml(course, lessonId) {
    const courseDone = course.lessons.filter(l => state.done[l.id]).length;
    return `<aside class="sidebar" id="side">
          <div class="side-title">${esc(course.title)}</div>
          <div class="bar"><i style="width:${(courseDone / course.lessons.length) * 100}%"></i></div>
          <small class="muted">${courseDone}/${course.lessons.length} complete</small>
          <ol>${course.lessons.map(l => `<li class="${l.id === lessonId ? "active" : ""}"><a href="#/lesson/${course.id}/${l.id}">${state.done[l.id] ? "✓ " : ""}${esc(l.title)}</a></li>`).join("")}</ol>
        </aside>`;
  }
  function pagerHtml(idx) {
    const { lesson } = ALL_LESSONS[idx];
    const prev = ALL_LESSONS[idx - 1], next = ALL_LESSONS[idx + 1];
    const nextBtn = next && state.done[lesson.id] ? `<a class="btn primary" href="#/lesson/${next.course.id}/${next.lesson.id}">Next: ${esc(next.lesson.title)} →</a>`
      : next ? `<span class="muted">Pass the challenge to unlock the next lesson</span>`
      : `<a class="btn primary" href="#/dashboard">Finish course →</a>`;
    return `<div class="pager" id="pager">${prev ? `<a class="btn" href="#/lesson/${prev.course.id}/${prev.lesson.id}">← ${esc(prev.lesson.title)}</a>` : "<span></span>"}${nextBtn}</div>`;
  }
  function viewLessonPage(courseId, lessonId) {
    const idx = ALL_LESSONS.findIndex(x => x.course.id === courseId && x.lesson.id === lessonId);
    if (idx < 0) return notFound();
    const { course, lesson } = ALL_LESSONS[idx];
    return `
      <div class="lesson-layout">
        ${sidebarHtml(course, lessonId)}
        <article class="lesson">
          <div class="crumbs"><a href="#/path/${course.path}">${esc(K.PATHS.find(p => p.id === course.path).title)}</a> / ${esc(course.title)}</div>
          <h1>${esc(lesson.title)}</h1>
          <h3>Learn</h3>
          ${lesson.body.map(p => `<p>${esc(p)}</p>`).join("")}
          ${lesson.formula ? `<pre class="formula">${esc(lesson.formula)}</pre>` : ""}
          <h3>Practice</h3>
          <div id="lab-host"></div>
          <h3>Challenge</h3>
          <div id="ex-host"></div>
          ${lesson.challenge ? `<h3>Coding challenge</h3><div id="ch-host"></div>` : ""}
          ${pagerHtml(idx)}
          <h3>Sources</h3>
          <p class="muted">Explanations are original writing based on these references. Link check run ${K.CHECKED}; content review is not automated yet.</p>
          <ul class="sources">${sourcesHtml(lesson.sources)}</ul>
        </article>
      </div>`;
  }
  function attachLesson(courseId, lessonId) {
    const idx = ALL_LESSONS.findIndex(x => x.course.id === courseId && x.lesson.id === lessonId);
    if (idx < 0) return;
    const { course, lesson } = ALL_LESSONS[idx];
    // On pass, refresh only the sidebar and pager so the feedback message stays visible.
    const refresh = () => {
      const s = $("#side"), p = $("#pager");
      if (s) s.outerHTML = sidebarHtml(course, lessonId);
      if (p) p.outerHTML = pagerHtml(idx);
    };
    renderLab($("#lab-host"), lesson.labId, lesson.preset);
    renderExercise($("#ex-host"), lesson, refresh);
    if (lesson.challenge) renderChallenge($("#ch-host"), lesson, refresh);
  }

  function viewLabs() {
    return `<h1>Lab simulators</h1><p class="muted">Each lab is real computation. Lessons link to the lab they use.</p>
      <div class="cards">${Object.values(LABS).map(l => `<div class="card"><h3>${esc(l.title)}</h3><p class="muted">${esc(l.summary)}</p>
        <small>Used in: ${ALL_LESSONS.filter(x => x.lesson.labId === l.id).map(x => `<a href="#/lesson/${x.course.id}/${x.lesson.id}">${esc(x.lesson.title)}</a>`).join(", ")}</small></div>`).join("")}</div>`;
  }
  function viewLabPage(id) {
    if (!LABS[id]) return notFound();
    return `<div id="standalone-lab"></div>`;
  }
  function viewGlossary() {
    return `<h1>Web3 glossary</h1><dl class="glossary">${K.GLOSSARY.map(g => `<dt>${esc(g.term)}</dt><dd>${esc(g.def)}</dd>`).join("")}</dl>`;
  }
  function viewDashboard() {
    const done = Object.keys(state.done).length;
    const achievements = [
      ["First lab run", !!Object.keys(state.labsRun).length],
      ["Miner: found a nonce with the lab miner", state.mined],
      ["First exercise passed", done >= 1],
      ["Five exercises passed", done >= 5],
      ["All lessons in one path", K.PATHS.some(p => { const pr = pathProgress(p.id); return pr.total && pr.done === pr.total; })],
      ["Every lesson completed", done === ALL_LESSONS.length],
    ];
    return `<h1>Student dashboard</h1>
      <div class="stats">
        <div><b>${state.xp}</b><span>XP</span></div>
        <div><b>${done}/${ALL_LESSONS.length}</b><span>lessons completed</span></div>
        <div><b>${Object.keys(state.labsRun).length}/${Object.keys(LABS).length}</b><span>labs run</span></div>
      </div>
      <h2>Paths</h2>${pathCards()}
      <h2>Achievements</h2>
      <ul class="achievements">${achievements.map(([n, ok]) => `<li class="${ok ? "ok" : ""}">${ok ? "🏅" : "○"} ${esc(n)}</li>`).join("")}</ul>
      <h2>Not in this build</h2>
      <p class="muted">Certificates are not issued yet, because no assessment or verification flow exists. The automated course engine (source monitoring, regeneration and validation) is not running. Progress shown here is stored only in this browser.</p>
      <button class="btn" id="reset">Reset local progress</button>`;
  }
  function viewSearch(q) {
    const s = q.trim().toLowerCase();
    if (!s) return `<h1>Search</h1><p class="muted">Type in the search box to search lessons, labs and glossary terms.</p>`;
    const hit = (t) => t.toLowerCase().includes(s);
    const lessons = ALL_LESSONS.filter(x => hit(x.lesson.title) || x.lesson.body.some(hit) || hit(x.course.title));
    const labs = Object.values(LABS).filter(l => hit(l.title) || hit(l.summary));
    const gl = K.GLOSSARY.filter(g => hit(g.term) || hit(g.def));
    const section = (title, items) => items.length ? `<h2>${title}</h2><ul>${items.join("")}</ul>` : "";
    return `<h1>Search: “${esc(q)}”</h1>` +
      section("Lessons", lessons.map(x => `<li><a href="#/lesson/${x.course.id}/${x.lesson.id}">${esc(x.lesson.title)}</a> <span class="muted">${esc(x.course.title)}</span></li>`)) +
      section("Labs", labs.map(l => `<li><a href="#/lab/${l.id}">${esc(l.title)}</a></li>`)) +
      section("Glossary", gl.map(g => `<li><b>${esc(g.term)}</b>: ${esc(g.def)}</li>`)) +
      (!lessons.length && !labs.length && !gl.length ? `<p class="muted">No results.</p>` : "");
  }
  function notFound() { return `<h1>Not found</h1><p><a href="#/">Back to home</a></p>`; }

  /* ---------- Router ---------- */
  function route() {
    const raw = location.hash.replace(/^#/, "") || "/";
    const [pathPart, query = ""] = raw.split("?");
    const parts = pathPart.split("/").filter(Boolean).map(decodeURIComponent);
    const app = $("#app");
    let html = "", after = null;
    const [a, b, c] = parts;
    if (!a) html = viewHome();
    else if (a === "paths") html = viewPaths();
    else if (a === "path") html = viewPath(b);
    else if (a === "lesson") { html = viewLessonPage(b, c); after = () => attachLesson(b, c); }
    else if (a === "labs") html = viewLabs();
    else if (a === "lab") { html = viewLabPage(b); after = () => LABS[b] && renderLab($("#standalone-lab"), b, {}); }
    else if (a === "glossary") html = viewGlossary();
    else if (a === "dashboard") { html = viewDashboard(); after = () => { const r = $("#reset"); r && r.addEventListener("click", () => { if (confirm("Reset all local progress and XP?")) { state = { done: {}, xp: 0, labsRun: {}, mined: false, challenges: {} }; save(); route(); } }); }; }
    else if (a === "search") html = viewSearch(new URLSearchParams(query).get("q") || "");
    else html = notFound();
    app.innerHTML = `<div class="page">${html}</div>`;
    if (after) after();
    document.querySelectorAll(".nav a").forEach(el => el.classList.toggle("on", el.getAttribute("href") === "#/" + (a || "") || (a === "path" && el.getAttribute("href") === "#/paths")));
    window.scrollTo(0, 0);
  }

  // Search box
  $("#search").addEventListener("keydown", (e) => {
    if (e.key === "Enter") location.hash = "#/search?q=" + encodeURIComponent(e.target.value);
  });
  window.addEventListener("hashchange", route);
  route();
})();
