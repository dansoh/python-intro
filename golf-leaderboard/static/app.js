/* Live golf leaderboard: client app.
 * One state object comes from the server (initially and on every change via
 * Server-Sent Events). Everything on screen is derived from it. */
(() => {
  "use strict";

  // The course is 9, 18, 27 or 36 holes: however many pars the host has set. Holes are grouped in nines.
  const MAX_PER_PHONE = 4; // a scorekeeper can keep score for their group, up to a foursome
  const NINE_LABELS = ["Out", "In", "3rd", "4th"];
  const holeCount = () => S.state.tournament.pars.length;
  const nineCount = () => holeCount() / 9;

  // ---------- storage (never trusted to exist) ----------
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
      catch { return fallback; }
    },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} },
    session: {
      get(key) { try { return sessionStorage.getItem(key); } catch { return null; } },
      set(key, v) { try { v == null ? sessionStorage.removeItem(key) : sessionStorage.setItem(key, v); } catch {} },
    },
  };

  const S = {
    state: null,
    connected: false,
    view: null,
    mode: store.get("lb.mode", "gross"),
    expanded: new Set(),
    ranks: new Map(),      // playerId -> last numeric rank, for movement arrows
    moves: new Map(),      // playerId -> +n / -n positions moved on last change
    seen: new Map(),       // playerId -> updatedAt, to flash rows that just changed
    flash: new Set(),
    devicePlayers: store.get("lb.players", []), // [{id, token}]
    active: store.get("lb.active", null),
    pin: store.session.get("lb.pin"),
    play: { hole: null, draft: null, draftPutts: undefined, forPlayer: null },
    adminDirty: new Map(), // "playerId:hole" -> value
    adminNine: 0,          // which nine the score grid shows on phones
    tvPage: 0,
  };

  // ---------- helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const sum = (arr) => arr.reduce((a, b) => a + b, 0);

  function fmtToPar(n, started = true) {
    if (!started) return "–";
    if (n === 0) return "E";
    return n > 0 ? `+${n}` : String(n);
  }
  const toParClass = (n, started = true) => (!started ? "tp-none" : n < 0 ? "tp-under" : n > 0 ? "tp-over" : "tp-even");

  function timeAgo(ts) {
    const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (s < 45) return "just now";
    const m = Math.round(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.round(h / 24)}d ago`;
  }

  function resultName(score, par) {
    if (score === 1) return "Hole in one";
    const d = score - par;
    return ({ "-3": "Albatross", "-2": "Eagle", "-1": "Birdie", 0: "Par", 1: "Bogey", 2: "Double bogey", 3: "Triple bogey" })[d]
      ?? (d < 0 ? `${-d} under` : `+${d}`);
  }

  function shortName(score, par) {
    if (score === 1) return "Ace";
    return ({ "-3": "Albatross", "-2": "Eagle", "-1": "Birdie", 0: "Par", 1: "Bogey", 2: "Dbl", 3: "Triple" })[score - par] ?? "";
  }

  function scoreClass(score, par) {
    if (score == null) return "";
    if (score === 1) return "sc-ace";
    const d = score - par;
    if (d <= -2) return "sc-eagle";
    if (d === -1) return "sc-birdie";
    if (d === 0) return "sc-par";
    if (d === 1) return "sc-bogey";
    return "sc-double";
  }

  // Handicap strokes received on a hole, allocated by stroke index.
  // A handicap is an 18-hole number, so it's scaled to the course length (27 holes = 1.5x the strokes).
  function strokesOn(handicap, si, holes) {
    if (handicap == null) return 0;
    const h = Math.round(handicap * holes / 18);
    if (h >= 0) return Math.floor(h / holes) + (si <= h % holes ? 1 : 0);
    return si > holes + h ? -1 : 0; // plus handicaps give strokes back on the easiest holes
  }

  // Handicaps only count when the host turns on handicap scoring; otherwise they're ignored everywhere.
  const handicapsOn = () => !!S.state?.tournament.handicaps;
  const puttsOn = () => !!S.state?.tournament.putts; // host switch; off keeps score entry to one tap
  const hcp = (p) => (handicapsOn() ? p.handicap : null);
  const hasHandicaps = () => handicapsOn() && S.state.players.some((p) => p.handicap != null);
  const effectiveMode = () => (S.mode === "net" && hasHandicaps() ? "net" : "gross");

  // ---------- teams ----------
  // Format: "individual" ranks players; "scramble" and "bestball" rank teams.
  const fmt = () => S.state?.tournament.format || "individual";
  const teamFormat = () => fmt() !== "individual";
  const teamOf = (p) => (p?.teamId && S.state.teams.find((t) => t.id === p.teamId)) || null;
  const FORMAT_LABELS = { individual: "Individual", bestball: "Best ball", scramble: "Scramble" };

  // A team as a scorecard the board, skins and TV can treat like a player. Scramble: the team's own
  // card. Best ball: the low score on each hole, counted once every teammate who's playing has posted
  // it (or when the board is final).
  function teamUnits(state) {
    const t = state.tournament;
    const n = t.pars.length;
    return state.teams.map((team) => {
      const members = state.players.filter((p) => p.teamId === team.id);
      if (t.format === "scramble") {
        return { id: team.id, name: team.name, scores: team.scores, putts: team.putts, handicap: null, updatedAt: team.updatedAt, isTeam: true, members };
      }
      const playing = members.filter((p) => p.scores.some((x) => x != null));
      const scores = Array.from({ length: n }, (_, i) => {
        const posted = playing.map((p) => p.scores[i]).filter((x) => x != null);
        if (!posted.length || (posted.length < playing.length && !t.locked)) return null;
        return Math.min(...posted);
      });
      const updatedAt = Math.max(team.updatedAt, ...members.map((p) => p.updatedAt));
      return { id: team.id, name: team.name, scores, putts: scores.map(() => null), handicap: null, updatedAt, isTeam: true, members };
    });
  }
  const boardUnits = (state) => ((state.tournament.format || "individual") === "individual" ? state.players : teamUnits(state));

  // Individual format with teams: each team's players added together.
  function teamTotals(state, mode) {
    const rows = computeBoard(state, mode, state.players);
    return state.teams.map((team) => {
      const mine = rows.filter((r) => r.p.teamId === team.id);
      const started = mine.filter((r) => r.thru);
      return {
        team, members: mine.map((r) => r.p), started: started.length,
        toPar: sum(started.map((r) => r.toPar)), strokes: sum(started.map((r) => r.total)), holes: sum(mine.map((r) => r.thru)),
      };
    }).sort((a, b) => (!a.started !== !b.started ? (a.started ? -1 : 1) : a.toPar - b.toPar || a.team.name.localeCompare(b.team.name)));
  }

  // ---------- scoring ----------
  function playerStats(p, t) {
    const { pars, strokeIndex } = t;
    let thru = 0, gross = 0, net = 0, toParG = 0, toParN = 0, putts = 0, puttHoles = 0;
    let birdies = 0;
    const nines = Array.from({ length: pars.length / 9 }, () => null); // strokes per nine, null until one is played
    p.scores.forEach((s, i) => {
      if (s == null) return;
      thru++;
      gross += s;
      const strokes = strokesOn(hcp(p), strokeIndex[i], pars.length);
      net += s - strokes;
      toParG += s - pars[i];
      toParN += s - strokes - pars[i];
      const k = Math.floor(i / 9);
      nines[k] = (nines[k] ?? 0) + s;
      if (s - pars[i] <= -1) birdies++;
      if (puttsOn() && p.putts[i] != null) { putts += p.putts[i]; puttHoles++; }
    });
    return { thru, gross, net, toParG, toParN, nines, putts: puttHoles ? putts : null, birdies };
  }

  function computeBoard(state, mode, units = boardUnits(state)) {
    const t = state.tournament;
    const rows = units.map((p) => {
      const st = playerStats(p, t);
      return { p, ...st, toPar: mode === "net" ? st.toParN : st.toParG, total: mode === "net" ? st.net : st.gross };
    });
    rows.sort((a, b) => {
      if (!a.thru !== !b.thru) return a.thru ? -1 : 1;
      if (!a.thru) return a.p.name.localeCompare(b.p.name);
      return a.toPar - b.toPar || b.thru - a.thru || a.p.name.localeCompare(b.p.name);
    });
    // Positions with ties ("T2").
    rows.forEach((r, i) => {
      if (!r.thru) { r.rank = null; r.pos = "–"; return; }
      const first = rows.findIndex((o) => o.thru && o.toPar === r.toPar);
      r.rank = first + 1;
      const tied = rows.filter((o) => o.thru && o.toPar === r.toPar).length > 1;
      r.pos = (tied ? "T" : "") + r.rank;
    });
    return rows;
  }

  function thruLabel(r) {
    if (!r.thru) return "–";
    if (r.thru === r.p.scores.length) return "F";
    return String(r.thru);
  }

  // ---------- network ----------
  async function api(path, body) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    let data = {};
    try { data = await res.json(); } catch {}
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  function adminApi(action, extra = {}) {
    return api("/api/admin", { pin: S.pin, action, ...extra });
  }

  function connect() {
    let es;
    let pollTimer = null;
    const startPolling = () => {
      if (pollTimer) return;
      pollTimer = setInterval(async () => {
        try {
          const res = await fetch("/api/state", { cache: "no-store" });
          if (res.ok) applyState(await res.json());
        } catch {}
      }, 10000);
    };
    const stopPolling = () => { clearInterval(pollTimer); pollTimer = null; };

    const open = () => {
      es = new EventSource("/api/stream");
      es.onopen = () => { S.connected = true; stopPolling(); renderLive(); };
      es.onmessage = (e) => {
        S.connected = true;
        try { applyState(JSON.parse(e.data)); } catch {}
      };
      es.onerror = () => {
        S.connected = false;
        renderLive();
        startPolling();
        if (es.readyState === EventSource.CLOSED) setTimeout(open, 4000);
      };
    };
    open();
    // Phones suspend background tabs: refresh immediately on return.
    document.addEventListener("visibilitychange", async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/state", { cache: "no-store" });
        if (res.ok) applyState(await res.json());
      } catch {}
    });
  }

  function applyState(next) {
    if (S.state && next.version < S.state.version) return;
    const first = !S.state;
    S.state = next;

    // Movement arrows and flash highlights, always tracked on gross + net separately would be noisy;
    // track them on the currently displayed mode.
    const board = computeBoard(next, effectiveMode());
    if ((next.tournament.format || "individual") !== "individual") board.push(...computeBoard(next, effectiveMode(), next.players));
    S.flash.clear();
    for (const r of board) {
      const prevRank = S.ranks.get(r.p.id);
      if (!first && prevRank != null && r.rank != null && prevRank !== r.rank) S.moves.set(r.p.id, prevRank - r.rank);
      if (r.rank != null) S.ranks.set(r.p.id, r.rank);
      const prevSeen = S.seen.get(r.p.id);
      if (!first && prevSeen != null && prevSeen !== r.p.updatedAt) S.flash.add(r.p.id);
      S.seen.set(r.p.id, r.p.updatedAt);
    }

    // Drop device players the host has removed.
    const ids = new Set(next.players.map((p) => p.id));
    const kept = S.devicePlayers.filter((d) => ids.has(d.id));
    if (kept.length !== S.devicePlayers.length) {
      S.devicePlayers = kept;
      store.set("lb.players", kept);
      if (!kept.some((d) => d.id === S.active)) setActive(kept[0]?.id ?? null);
    }

    renderChrome();
    renderView(false);
  }

  // ---------- routing ----------
  function route() {
    const parts = location.hash.replace(/^#\/?/, "").split("/");
    let view = parts[0] || "board";
    if (view === "claim" && parts[1] && parts[2]) {
      claimPlayer(parts[1], decodeURIComponent(parts[2]));
      history.replaceState(null, "", "#/play");
      view = "play";
    }
    if (!["board", "skins", "play", "join", "admin", "tv"].includes(view)) view = "board";
    if (view === "skins" && S.state && !S.state.tournament.skins) view = "board";
    if (view === "play" && !S.devicePlayers.length) view = "join";
    if (view === "join" && S.devicePlayers.length >= MAX_PER_PHONE) view = "play";
    const changed = view !== S.view;
    S.view = view;
    document.body.classList.toggle("is-tv", view === "tv");
    document.querySelectorAll(".view").forEach((el) => { el.hidden = el.id !== `view-${view}`; });
    document.querySelectorAll(".tabs a").forEach((a) => a.classList.toggle("active", a.dataset.view === view));
    if (changed) window.scrollTo(0, 0);
    if (S.state) renderChrome();
    renderView(true);
  }

  function claimPlayer(id, token) {
    if (!S.devicePlayers.some((d) => d.id === id)) {
      S.devicePlayers.push({ id, token });
      store.set("lb.players", S.devicePlayers);
    }
    setActive(id);
  }

  function setActive(id) {
    S.active = id;
    store.set("lb.active", id);
    S.play = { hole: null, draft: null, draftPutts: undefined, forPlayer: null };
  }

  // ---------- chrome ----------
  function renderChrome() {
    const t = S.state.tournament;
    $("#tournament-name").textContent = t.name;
    $("#tournament-subtitle").textContent = t.subtitle || "Live Tournament Scoring";
    document.title = `${t.name} · Leaderboard`;
    const joinTab = $('.tabs a[data-view="join"]');
    joinTab.textContent = S.devicePlayers.length ? "Add" : "Join";
    joinTab.hidden = S.devicePlayers.length >= MAX_PER_PHONE;
    $('.tabs a[data-view="skins"]').hidden = !t.skins;
    if (S.view === "skins" && !t.skins) location.hash = "#/board";
    renderLive();
  }

  function renderLive() {
    const el = $("#live");
    const label = $("#live-label");
    if (!S.state) { el.dataset.state = "connecting"; label.textContent = "Connecting"; return; }
    el.dataset.state = S.connected ? "live" : "offline";
    label.textContent = S.connected ? "Live" : "Reconnecting";
    el.title = `Last update ${timeAgo(S.state.updatedAt)}`;
  }

  function toast(msg, kind = "") {
    const el = $("#toast");
    el.textContent = msg;
    el.className = `toast show ${kind}`;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { el.className = "toast"; }, 2600);
  }

  // ---------- views ----------
  function renderView(entering) {
    if (!S.state) {
      const el = $(`#view-${S.view}`);
      if (el && !el.innerHTML) el.innerHTML = `<div class="loading"><span class="spinner"></span> Loading the leaderboard…</div>`;
      return;
    }
    ({ board: renderBoard, skins: renderSkins, play: renderPlay, join: renderJoin, admin: renderAdmin, tv: renderTv })[S.view](entering);
  }

  // ----- Leaderboard -----
  function renderBoard() {
    const el = $("#view-board");
    const state = S.state;
    const t = state.tournament;
    const mode = effectiveMode();
    const rows = computeBoard(state, mode);
    const coursePar = sum(t.pars);

    if (!state.players.length && !(teamFormat() && state.teams.length)) {
      el.innerHTML = `
        <div class="empty">
          <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M20 8v48" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M22 9l24 9-24 9z" fill="var(--gold)"/><ellipse cx="20" cy="56" rx="12" ry="3" fill="currentColor" opacity=".25"/></svg>
          <h2>The field is empty</h2>
          <p>Nobody has teed off yet. Be the first name on the board.</p>
          <a class="btn btn-gold" href="#/join">Join the tournament</a>
        </div>`;
      return;
    }

    const teamsFirst = teamFormat();
    const unitWord = teamsFirst ? "team" : "player";
    el.innerHTML = `
      ${renderHighlights(rows, state)}
      ${boardCard({
        title: teamsFirst ? "Teams" : "Leaders",
        meta: `${FORMAT_LABELS[fmt()]} · Course par <strong>${coursePar}</strong> · ${rows.length} ${unitWord}${rows.length === 1 ? "" : "s"}`,
        rows, unitWord, showModes: !teamsFirst,
      })}
      ${fmt() === "bestball" && state.players.length ? boardCard({
        title: "Players", meta: "Every player's own round", rows: computeBoard(state, mode, state.players), unitWord: "player", showModes: true,
      }) : ""}
      ${fmt() === "individual" && state.teams.length ? renderTeamTotals(state, mode) : ""}
      ${renderFeed(state)}
      ${renderLegend()}
    `;

    el.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => {
      S.mode = b.dataset.mode;
      store.set("lb.mode", S.mode);
      S.moves.clear();
      S.ranks = new Map(computeBoard(S.state, effectiveMode()).map((r) => [r.p.id, r.rank]));
      renderBoard();
    }));
    el.querySelectorAll("tr.row").forEach((tr) => {
      const toggle = () => {
        const id = tr.dataset.id;
        S.expanded.has(id) ? S.expanded.delete(id) : S.expanded.add(id);
        renderBoard();
      };
      tr.addEventListener("click", toggle);
      tr.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
    });
    S.flash.clear();
  }

  function boardCard({ title, meta, rows, unitWord, showModes }) {
    const t = S.state.tournament;
    const mode = effectiveMode();
    const coursePar = sum(t.pars);
    const Unit = unitWord[0].toUpperCase() + unitWord.slice(1);
    return `
      <div class="board-card">
        <div class="board-bar">
          <div>
            <h2 class="board-title">${title}</h2>
            <p class="board-meta">${meta}${t.locked ? ' · <span class="pill-locked">Final</span>' : ""}</p>
          </div>
          ${showModes && hasHandicaps() ? `
            <div class="seg" role="group" aria-label="Scoring mode">
              <button type="button" data-mode="gross" aria-pressed="${mode === "gross"}">Gross</button>
              <button type="button" data-mode="net" aria-pressed="${mode === "net"}">Net</button>
            </div>` : ""}
        </div>
        ${rows.length ? `
        <div class="board-scroll">
          <table class="lb${holeCount() > 18 ? " many" : ""}">
            <thead>
              <tr>
                <th class="c-pos" scope="col">Pos</th>
                <th class="c-player" scope="col">${Unit}</th>
                <th class="c-topar" scope="col">To Par</th>
                <th class="c-thru" scope="col">Thru</th>
                ${ninesHtml((k) => `${holeHeads(9 * k, 9 * k + 9)}<th class="hc c-sub" scope="col">${NINE_LABELS[k]}</th>`)}
                <th class="c-tot" scope="col">${mode === "net" && showModes ? "Net" : "Tot"}</th>
                <th class="c-chev" aria-hidden="true"></th>
              </tr>
              <tr class="par-row">
                <td></td><td class="c-player">Par</td><td></td><td></td>
                ${ninesHtml((k) => { const np = t.pars.slice(9 * k, 9 * k + 9); return `${np.map((p) => `<td class="hc">${p}</td>`).join("")}<td class="hc c-sub">${sum(np)}</td>`; })}
                <td class="c-tot">${coursePar}</td><td></td>
              </tr>
            </thead>
            <tbody>
              ${rows.map((r) => boardRow(r, t)).join("")}
            </tbody>
          </table>
        </div>
        <p class="board-hint">Tap a ${unitWord} for the scorecard.</p>` : `<p class="board-hint">${unitWord === "team" ? "No teams yet. The host sets them up on the admin page." : "No players yet."}</p>`}
      </div>`;
  }

  function renderTeamTotals(state, mode) {
    const totals = teamTotals(state, mode);
    return `
      <div class="board-card team-totals">
        <div class="board-bar"><div><h2 class="board-title">Team totals</h2><p class="board-meta">Each team's players added together</p></div></div>
        <table class="lb sk-table">
          <thead><tr><th class="c-pos" scope="col">Pos</th><th class="c-player" scope="col">Team</th><th class="c-topar" scope="col">To Par</th><th class="c-tot" scope="col">Strokes</th></tr></thead>
          <tbody>
            ${totals.map((x, i) => {
              const rank = x.started ? totals.findIndex((o) => o.started && o.toPar === x.toPar) + 1 : null;
              const tied = x.started && totals.filter((o) => o.started && o.toPar === x.toPar).length > 1;
              return `<tr>
                <td class="c-pos">${rank ? (tied ? "T" : "") + rank : "–"}</td>
                <td class="c-player"><span class="pname">${esc(x.team.name)}</span><span class="members">${x.members.map((p) => esc(p.name)).join(", ") || "No players yet"}</span></td>
                <td class="c-topar"><span class="${toParClass(x.toPar, x.started > 0)}">${fmtToPar(x.toPar, x.started > 0)}</span></td>
                <td class="c-tot">${x.started ? x.strokes : ""}</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>`;
  }

  const ninesHtml = (fn) => Array.from({ length: nineCount() }, (_, k) => fn(k)).join("");

  function holeHeads(a, b) {
    let h = "";
    for (let i = a; i < b; i++) h += `<th class="hc${i % 9 === 8 && i < holeCount() - 1 ? " nine" : ""}" scope="col">${i + 1}</th>`;
    return h;
  }

  function boardRow(r, t) {
    const p = r.p;
    const open = S.expanded.has(p.id);
    const move = S.moves.get(p.id);
    const moveHtml = move
      ? `<span class="move ${move > 0 ? "up" : "down"}" title="${move > 0 ? "Up" : "Down"} ${Math.abs(move)}">${move > 0 ? "▲" : "▼"}${Math.abs(move)}</span>`
      : "";
    const mine = S.devicePlayers.some((d) => d.id === p.id || p.members?.some((m) => m.id === d.id));
    const cells = (a, b) => {
      let h = "";
      for (let i = a; i < b; i++) {
        const s = p.scores[i];
        h += `<td class="hc">${s == null ? '<span class="dash"></span>' : `<span class="sc ${scoreClass(s, t.pars[i])}">${s}</span>`}</td>`;
      }
      return h;
    };
    const cols = 4 + holeCount() + nineCount() + 2;
    return `
      <tr class="row${open ? " open" : ""}${S.flash.has(p.id) ? " flash" : ""}${r.thru === holeCount() ? " finished" : ""}" data-id="${p.id}" tabindex="0" aria-expanded="${open}">
        <td class="c-pos">${esc(r.pos)}${moveHtml}</td>
        <td class="c-player">
          <span class="pname">${esc(p.name)}</span>${mine ? '<span class="you">You</span>' : ""}
          ${hcp(p) != null ? `<span class="hcp">${p.handicap}</span>` : ""}
          ${p.isTeam ? `<span class="members">${p.members.map((m) => esc(m.name)).join(", ") || "No players yet"}</span>` : ""}
        </td>
        <td class="c-topar"><span class="${toParClass(r.toPar, r.thru > 0)}">${fmtToPar(r.toPar, r.thru > 0)}</span></td>
        <td class="c-thru">${thruLabel(r)}</td>
        ${ninesHtml((k) => `${cells(9 * k, 9 * k + 9)}<td class="hc c-sub">${r.nines[k] ?? ""}</td>`)}
        <td class="c-tot">${r.thru ? r.total : ""}</td>
        <td class="c-chev" aria-hidden="true"><svg viewBox="0 0 12 12"><path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></td>
      </tr>
      ${open ? `<tr class="detail"><td colspan="${cols}">${scorecard(p, t, r)}</td></tr>` : ""}`;
  }

  function scorecard(p, t, r) {
    const st = r || playerStats(p, t);
    const half = (a, b, label) => {
      const holes = [], pars = [], scores = [], putts = [];
      const showPutts = puttsOn() && p.putts.some((x) => x != null);
      for (let i = a; i < b; i++) {
        holes.push(`<th>${i + 1}</th>`);
        pars.push(`<td>${t.pars[i]}</td>`);
        const s = p.scores[i];
        const dots = strokesOn(hcp(p), t.strokeIndex[i], t.pars.length);
        scores.push(`<td>${s == null ? '<span class="dash"></span>' : `<span class="sc ${scoreClass(s, t.pars[i])}">${s}</span>`}${dots > 0 ? `<i class="dots" title="${dots} handicap stroke${dots > 1 ? "s" : ""}">${"•".repeat(dots)}</i>` : ""}</td>`);
        putts.push(`<td>${p.putts[i] ?? ""}</td>`);
      }
      const played = p.scores.slice(a, b).filter((x) => x != null);
      return `
        <table class="card">
          <tr class="card-hole"><th scope="row">Hole</th>${holes.join("")}<th>${label}</th></tr>
          <tr class="card-par"><th scope="row">Par</th>${pars.join("")}<td>${sum(t.pars.slice(a, b))}</td></tr>
          <tr class="card-score"><th scope="row">Score</th>${scores.join("")}<td><strong>${played.length ? sum(played) : ""}</strong></td></tr>
          ${showPutts ? `<tr class="card-putts"><th scope="row">Putts</th>${putts.join("")}<td>${sum(p.putts.slice(a, b).filter((x) => x != null)) || ""}</td></tr>` : ""}
        </table>`;
    };
    const hcpNote = hcp(p) != null
      ? `<span><b>${fmtToPar(st.toParN, st.thru > 0)}</b> net</span><span><b>${fmtToPar(st.toParG, st.thru > 0)}</b> gross</span>`
      : `<span><b>${fmtToPar(st.toParG, st.thru > 0)}</b> to par</span>`;
    return `
      <div class="scorecard">
        <div class="card-summary">
          ${p.isTeam ? `<span>${fmt() === "bestball" ? "Best ball of" : "Scramble:"} <b>${p.members.map((m) => esc(m.name)).join(", ") || "no players yet"}</b></span>` : ""}
          ${hcpNote}
          <span><b>${st.thru ? st.gross : "–"}</b> strokes</span>
          <span><b>${st.birdies}</b> birdie${st.birdies === 1 ? "" : "s"} or better</span>
          ${st.putts != null ? `<span><b>${st.putts}</b> putts</span>` : ""}
        </div>
        <div class="card-scroll">${ninesHtml((k) => half(9 * k, 9 * k + 9, NINE_LABELS[k]))}</div>
      </div>`;
  }

  function renderHighlights(rows, state) {
    const t = state.tournament;
    const leaders = rows.filter((r) => r.rank === 1);
    const started = rows.filter((r) => r.thru);
    const finished = rows.filter((r) => r.thru === holeCount()).length;
    let birdies = 0, eagles = 0;
    const holeDiff = Array.from({ length: holeCount() }, () => ({ total: 0, n: 0 }));
    for (const p of fmt() === "scramble" ? rows.map((r) => r.p) : state.players) {
      p.scores.forEach((s, i) => {
        if (s == null) return;
        const d = s - t.pars[i];
        if (d === -1) birdies++;
        if (d <= -2) eagles++;
        holeDiff[i].total += d;
        holeDiff[i].n++;
      });
    }
    let toughest = null;
    holeDiff.forEach((h, i) => {
      if (!h.n) return;
      const avg = h.total / h.n;
      if (!toughest || avg > toughest.avg) toughest = { hole: i + 1, avg };
    });
    const leaderText = !started.length
      ? "Waiting to tee off"
      : leaders.length > 1 ? `${leaders.length}-way tie` : esc(leaders[0].p.name);
    return `
      <div class="highlights">
        <div class="hl hl-leader">
          <span class="hl-label">Leader</span>
          <span class="hl-value">${leaderText}</span>
          ${started.length ? `<span class="hl-big ${toParClass(leaders[0].toPar)}">${fmtToPar(leaders[0].toPar)}</span>` : ""}
        </div>
        <div class="hl">
          <span class="hl-label">On course</span>
          <span class="hl-num">${started.length - finished}</span>
          <span class="hl-foot">${finished} finished · ${rows.length - started.length} yet to start</span>
        </div>
        <div class="hl">
          <span class="hl-label">Birdies</span>
          <span class="hl-num tp-under">${birdies}</span>
          <span class="hl-foot">${eagles ? `plus ${eagles} eagle${eagles > 1 ? "s" : ""}` : "across the field"}</span>
        </div>
        <div class="hl">
          <span class="hl-label">Toughest hole</span>
          <span class="hl-num">${toughest ? toughest.hole : "–"}</span>
          <span class="hl-foot">${toughest ? `plays ${toughest.avg >= 0 ? "+" : ""}${toughest.avg.toFixed(2)} to par` : "no scores yet"}</span>
        </div>
      </div>`;
  }

  function renderFeed(state) {
    if (!state.events.length) return "";
    return `
      <div class="feed">
        <h3 class="feed-title">Latest from the course</h3>
        <ol>
          ${state.events.slice(0, 8).map((e) => {
            const d = e.score - e.par;
            const cls = e.score === 1 || d <= -2 ? "ev-great" : d === -1 ? "ev-good" : d >= 2 ? "ev-bad" : "";
            return `<li class="${cls}">
              <span class="feed-mark"><span class="sc ${scoreClass(e.score, e.par)}">${e.score}</span></span>
              <span class="ev-text"><b>${esc(e.name)}</b> ${d === -1 ? "birdied" : d <= -2 || e.score === 1 ? `made ${resultName(e.score, e.par).toLowerCase()} on` : d === 0 ? "parred" : `made ${resultName(e.score, e.par).toLowerCase()} on`} <span class="nowrap">No. ${e.hole + 1}</span></span>
              <time data-ts="${e.ts}">${timeAgo(e.ts)}</time>
            </li>`;
          }).join("")}
        </ol>
      </div>`;
  }

  function renderLegend() {
    return `
      <div class="legend" aria-label="Score key">
        <span><span class="sc sc-eagle">3</span>Eagle or better</span>
        <span><span class="sc sc-birdie">3</span>Birdie</span>
        <span><span class="sc sc-par">4</span>Par</span>
        <span><span class="sc sc-bogey">5</span>Bogey</span>
        <span><span class="sc sc-double">6</span>Double+</span>
      </div>`;
  }

  // ----- Skins -----
  // Lowest score on a hole wins a skin. A hole is settled once everyone playing (anyone with a score)
  // has posted it, or when the host locks the board. Ties either carry the skin to the next hole or
  // give each tied player a skin, per the host's setting. Net scores are used when handicaps are on.
  function computeSkins(state) {
    const t = state.tournament;
    const n = t.pars.length;
    const net = handicapsOn();
    const carryMode = t.skinsTies !== "point";
    const field = boardUnits(state).filter((p) => p.scores.some((x) => x != null));
    const scoreOf = (p, i) => p.scores[i] - (net ? strokesOn(hcp(p), t.strokeIndex[i], n) : 0);
    const totals = new Map(field.map((p) => [p.id, 0]));
    const holes = [];
    let carry = 0;
    let blocked = false; // carry mode: an unsettled hole means later holes' values aren't known yet
    for (let i = 0; i < n; i++) {
      const posted = field.filter((p) => p.scores[i] != null);
      if (!posted.length) {
        holes.push({ i, status: "open", worth: carryMode && !blocked && !t.locked ? 1 + carry : 1 });
        if (carryMode && !t.locked) blocked = true; // once the board is final, unplayed holes don't hold anything up
        continue;
      }
      const low = Math.min(...posted.map((p) => scoreOf(p, i)));
      const leaders = posted.filter((p) => scoreOf(p, i) === low);
      const settled = field.length >= 2 && (posted.length === field.length || t.locked);
      if (!settled) {
        holes.push({ i, status: "live", leaders, low, posted: posted.length, of: field.length, worth: carryMode && !blocked ? 1 + carry : 1 });
        if (carryMode) blocked = true;
        continue;
      }
      if (carryMode && blocked) { holes.push({ i, status: "waiting", leaders, low }); continue; }
      const value = carryMode ? 1 + carry : 1;
      if (leaders.length === 1) {
        totals.set(leaders[0].id, totals.get(leaders[0].id) + value);
        holes.push({ i, status: "won", leaders, low, value });
        carry = 0;
      } else if (carryMode) {
        holes.push({ i, status: "carry", leaders, low, value });
        carry = value;
      } else {
        leaders.forEach((p) => totals.set(p.id, totals.get(p.id) + 1));
        holes.push({ i, status: "split", leaders, low, value: 1 });
      }
    }
    const standings = field
      .map((p) => ({ p, skins: totals.get(p.id) }))
      .sort((a, b) => b.skins - a.skins || a.p.name.localeCompare(b.p.name));
    standings.forEach((r) => { r.rank = standings.findIndex((o) => o.skins === r.skins) + 1; });
    standings.forEach((r) => { r.pos = (standings.filter((o) => o.skins === r.skins).length > 1 ? "T" : "") + r.rank; });
    const settledAll = !blocked && holes.every((h) => h.status !== "open" && h.status !== "live");
    return { holes, standings, carry: carryMode && !blocked ? carry : 0, carryMode, net, field, settledAll };
  }

  const nameList = (ps) => ps.map((p) => `<b>${esc(p.name)}</b>`).join(", ");

  function skinsRules(sk) {
    return `${teamFormat() ? "Team vs team: the lowest team" : "Lowest"} ${sk.net ? "net " : ""}score on a hole wins a skin. ${sk.carryMode
      ? "Ties carry the skin over to the next hole."
      : "Ties: every player tied for the low score gets a skin."} A hole is settled once every ${teamFormat() ? "team" : "player"} playing has posted it.`;
  }

  // Show each played hole, the next unplayed one (with what it's worth), then one line for the rest.
  function skinsHoleRows(sk, holeRow) {
    const firstOpen = sk.holes.findIndex((h) => h.status === "open");
    const restOpen = firstOpen >= 0 && sk.holes.slice(firstOpen + 1).every((h) => h.status === "open");
    if (!restOpen || firstOpen === sk.holes.length - 1) return sk.holes.map(holeRow).join("");
    const rest = sk.holes.length - firstOpen - 1;
    return sk.holes.slice(0, firstOpen + 1).map(holeRow).join("")
      + `<li class="sk-open sk-rest"><span class="sk-text muted-inline">Holes ${firstOpen + 2}–${sk.holes.length} not played yet</span></li>`;
  }

  function renderSkins() {
    const el = $("#view-skins");
    const t = S.state.tournament;
    const sk = computeSkins(S.state);
    if (sk.field.length < 2) {
      el.innerHTML = `
        <div class="empty">
          <h2>Skins</h2>
          <p>${skinsRules(sk)}</p>
          <p>The skins game starts once at least two ${teamFormat() ? "teams" : "players"} have posted a score.</p>
        </div>`;
      return;
    }
    const mine = new Set(S.devicePlayers.map((d) => d.id));
    const isMine = (u) => mine.has(u.id) || (u.members || []).some((m) => mine.has(m.id));
    const holeRow = (h) => {
      const par = t.pars[h.i];
      let text, badge;
      switch (h.status) {
        case "won":
          text = `${nameList(h.leaders)} wins with ${h.low}${h.value > 1 ? ` <span class="muted-inline">(${h.value - 1} carried in)</span>` : ""}`;
          badge = `<span class="sk-badge won">+${h.value}</span>`;
          break;
        case "carry":
          text = `Tied at ${h.low}: ${nameList(h.leaders)}. Carries over.`;
          badge = `<span class="sk-badge carry">${h.value} →</span>`;
          break;
        case "split":
          text = `Tied at ${h.low}: ${nameList(h.leaders)} each get a skin.`;
          badge = `<span class="sk-badge won">+1 each</span>`;
          break;
        case "live":
          text = `${h.leaders.length > 1 ? `Tied at ${h.low} so far: ${nameList(h.leaders)}` : `${nameList(h.leaders)} leads with ${h.low}`} <span class="muted-inline">· ${h.posted} of ${h.of} posted</span>`;
          badge = `<span class="sk-badge live">Live${h.worth > 1 ? ` · ${h.worth}` : ""}</span>`;
          break;
        case "waiting":
          text = `${h.leaders.length > 1 ? `Tied at ${h.low}: ${nameList(h.leaders)}` : `${nameList(h.leaders)} had the low score (${h.low})`} <span class="muted-inline">· settles after earlier holes</span>`;
          badge = `<span class="sk-badge">Waiting</span>`;
          break;
        default:
          text = `<span class="muted-inline">Not played yet</span>`;
          badge = h.worth > 1 ? `<span class="sk-badge carry">Worth ${h.worth}</span>` : "";
      }
      return `<li class="sk-${h.status}"><span class="sk-hole"><b>${h.i + 1}</b><small>Par ${par}</small></span><span class="sk-text">${text}</span>${badge}</li>`;
    };
    el.innerHTML = `
      <div class="skins">
        <div class="board-card">
          <div class="board-bar">
            <div>
              <h2 class="board-title">Skins</h2>
              <p class="board-meta">${sk.carryMode ? "Ties carry over" : "Ties: a skin each"}${sk.net ? " · Net scores" : ""}${t.locked ? ' · <span class="pill-locked">Final</span>' : ""}</p>
            </div>
          </div>
          <table class="lb sk-table">
            <thead><tr><th class="c-pos" scope="col">Pos</th><th class="c-player" scope="col">${teamFormat() ? "Team" : "Player"}</th><th class="c-tot" scope="col">Skins</th></tr></thead>
            <tbody>
              ${sk.standings.map((r) => `
                <tr class="${r.skins ? "" : "sk-zero"}">
                  <td class="c-pos">${r.skins ? esc(r.pos) : "–"}</td>
                  <td class="c-player"><span class="pname">${esc(r.p.name)}</span>${isMine(r.p) ? '<span class="you">You</span>' : ""}</td>
                  <td class="c-tot">${r.skins}</td>
                </tr>`).join("")}
            </tbody>
          </table>
          ${sk.carry ? `<p class="board-hint"><b>${sk.carry} skin${sk.carry > 1 ? "s" : ""}</b> ${t.locked ? "left unclaimed: the last settled hole was tied." : "carrying over to the next hole."}</p>` : ""}
        </div>
        <p class="muted sk-rules">${skinsRules(sk)}</p>
        <h3 class="feed-title">Hole by hole</h3>
        <ol class="sk-holes">${skinsHoleRows(sk, holeRow)}</ol>
      </div>`;
  }

  // ----- My Round -----
  function activePlayer() {
    const id = S.devicePlayers.some((d) => d.id === S.active) ? S.active : S.devicePlayers[0]?.id;
    if (id !== S.active) setActive(id ?? null);
    return S.state.players.find((p) => p.id === id) || null;
  }

  function firstOpenHole(p) {
    let last = -1;
    p.scores.forEach((s, i) => { if (s != null) last = i; });
    const next = (last + 1) % holeCount();
    if (p.scores[next] == null) return next;
    const any = p.scores.findIndex((s) => s == null);
    return any === -1 ? holeCount() - 1 : any;
  }

  function renderPlay() {
    const el = $("#view-play");
    const p = activePlayer();
    if (!p) { location.hash = "#/join"; return; }
    const t = S.state.tournament;
    const team = teamOf(p);
    if ((teamFormat() && !team) || S.play.pickTeam) { renderTeamPicker(el, p, team); return; }
    // In a scramble this phone scores the team's card; otherwise the player's own.
    const scramble = fmt() === "scramble";
    const card = scramble ? teamUnits(S.state).find((u) => u.id === team.id) : p;

    if (S.play.forPlayer !== card.id || S.play.hole == null) {
      S.play = { hole: firstOpenHole(card), draft: null, draftPutts: undefined, forPlayer: card.id };
    }
    const h = S.play.hole;
    const par = t.pars[h];
    const saved = card.scores[h];
    const value = S.play.draft ?? saved ?? par;
    const savedPutts = card.putts[h];
    const putts = S.play.draftPutts !== undefined ? S.play.draftPutts : savedPutts;
    const dirty = (S.play.draft != null && S.play.draft !== saved) || (puttsOn() && S.play.draftPutts !== undefined && S.play.draftPutts !== savedPutts) || saved == null;

    const board = computeBoard(S.state, effectiveMode(), scramble ? teamUnits(S.state) : S.state.players);
    const me = board.find((r) => r.p.id === card.id);
    const teamRow = fmt() === "bestball" && team ? computeBoard(S.state, effectiveMode()).find((r) => r.p.id === team.id) : null;
    const strokes = strokesOn(hcp(card), t.strokeIndex[h], t.pars.length);
    const locked = t.locked;

    // In a scramble, players on the same team share one card, so they share one chip.
    const onPhone = S.devicePlayers.map((d) => S.state.players.find((x) => x.id === d.id)).filter(Boolean);
    const chipFor = scramble
      ? onPhone.filter((pl, i) => !pl.teamId || onPhone.findIndex((o) => o.teamId === pl.teamId) === i)
      : onPhone;
    const chips = chipFor.length > 1 || S.devicePlayers.length > 1 ? `
      <div class="chips" role="tablist" aria-label="Players on this device">
        ${chipFor.map((pl) => {
          const selected = scramble && pl.teamId ? pl.teamId === p.teamId : pl.id === p.id;
          return `<button type="button" role="tab" class="chip" data-player="${pl.id}" aria-selected="${selected}">${esc(scramble && teamOf(pl) ? teamOf(pl).name : pl.name)}</button>`;
        }).join("")}
        ${S.devicePlayers.length < MAX_PER_PHONE ? `<a class="chip chip-add" href="#/join">+ Add</a>` : ""}
      </div>` : "";

    // One tap per score: eagle through triple, plus "More" for anything higher (each tap adds a stroke).
    const quick = [];
    for (let d = -2; d <= 3; d++) {
      const s = par + d;
      if (s < 1) continue;
      quick.push(`<button type="button" class="quick ${scoreClass(s, par).replace("sc-", "r-")}${s === value ? " on" : ""}" data-score="${s}" ${locked ? "disabled" : ""}><b>${s}</b><small>${shortName(s, par)}</small></button>`);
    }
    const high = value > par + 3;
    quick.push(`<button type="button" class="quick r-double${high ? " on" : ""}" data-more ${locked || value >= 20 ? "disabled" : ""} aria-label="${high ? `${value}, tap to add a stroke` : "Higher score"}"><b>${high ? value : `${par + 4}+`}</b><small>${high ? "Tap +1" : "More"}</small></button>`);
    const suggest = saved == null && S.play.draft == null;

    el.innerHTML = `
      <div class="play">
        ${chips}
        <div class="play-head">
          <div>
            <p class="eyebrow">${scramble ? "Scoring for team" : S.devicePlayers.length > 1 ? "Scoring for" : "Playing as"}</p>
            <h2 class="play-name">${esc(card.name)}${hcp(card) != null ? ` <span class="hcp">HCP ${card.handicap}</span>` : ""}</h2>
            ${scramble ? `<p class="team-members">${card.members.map((m) => esc(m.name)).join(", ")}</p>` : team ? `<p class="team-members">Team ${esc(team.name)}</p>` : ""}
          </div>
          <div class="play-links">
            ${S.devicePlayers.length === 1 && !scramble ? `<a class="link-small" href="#/join">Score for your group</a>` : ""}
            ${S.state.teams.length ? `<button type="button" class="link-small" data-change-team>${team ? "Change team" : "Join a team"}</button>` : ""}
          </div>
        </div>

        <div class="stat-row">
          <div class="stat"><span class="stat-label">Position</span><span class="stat-val">${me.thru ? esc(me.pos) : "–"}</span></div>
          <div class="stat"><span class="stat-label">To par${effectiveMode() === "net" ? " (net)" : ""}</span><span class="stat-val ${toParClass(me.toPar, me.thru > 0)}">${fmtToPar(me.toPar, me.thru > 0)}</span></div>
          <div class="stat"><span class="stat-label">Thru</span><span class="stat-val">${thruLabel(me)}</span></div>
        </div>
        ${teamRow ? `<p class="team-line">Team ${esc(team.name)} best ball: <b class="${toParClass(teamRow.toPar, teamRow.thru > 0)}">${fmtToPar(teamRow.toPar, teamRow.thru > 0)}</b>${teamRow.thru ? ` · ${esc(teamRow.pos)} · thru ${thruLabel(teamRow)}` : " · not started"}</p>` : ""}

        <div class="hole-strip" role="tablist" aria-label="Holes" style="--holes: ${t.pars.length}">
          ${t.pars.map((hp, i) => `<button type="button" role="tab" class="hs ${scoreClass(card.scores[i], hp).replace("sc-", "r-")}${i === h ? " current" : ""}${card.scores[i] != null ? " done" : ""}" data-hole="${i}" aria-selected="${i === h}" aria-label="Hole ${i + 1}${card.scores[i] != null ? `, scored ${card.scores[i]}` : ""}">${i + 1}</button>`).join("")}
        </div>

        <div class="hole-card${locked ? " is-locked" : ""}">
          <div class="hole-top">
            <div class="hole-no"><span>Hole</span><b>${h + 1}</b></div>
            <div class="hole-info">
              <span class="hole-par">Par ${par}</span>
              <span class="hole-si">Stroke index ${t.strokeIndex[h]}${strokes > 0 ? ` · <b class="gets">you get ${strokes} stroke${strokes > 1 ? "s" : ""}</b>` : ""}</span>
            </div>
          </div>

          <div class="hero-score${suggest ? " is-suggest" : ""}" aria-live="polite">
            <span class="sc ${scoreClass(value, par)} hero-mark">${value}</span>
            <span class="hero-name">${resultName(value, par)}${suggest ? "<small>Tap your score</small>" : saved != null && S.play.draft == null ? "<small>Saved</small>" : ""}</span>
          </div>

          <div class="quicks" role="group" aria-label="Score">${quick.join("")}</div>

          ${puttsOn() ? `<div class="putts">
            <span class="putts-label">Putts <small>optional</small></span>
            <div class="putt-opts">
              ${[0, 1, 2, 3, 4].map((n) => `<button type="button" class="putt${putts === n ? " on" : ""}" data-putts="${n}" ${locked ? "disabled" : ""}>${n === 4 ? "4+" : n}</button>`).join("")}
            </div>
          </div>` : ""}

          ${locked ? `<p class="locked-note">Scoring is closed. The host has locked the leaderboard.</p>` : ""}

          <div class="play-actions">
            <button type="button" class="btn btn-ghost" data-nav="-1" ${h === 0 ? "disabled" : ""}>← Prev</button>
            <button type="button" class="btn btn-gold btn-save" data-save ${locked ? "disabled" : ""}>
              ${dirty ? (h === holeCount() - 1 ? "Save & finish" : "Save & next") : h === holeCount() - 1 ? "Saved" : "Next →"}
            </button>
          </div>
          ${saved != null && !locked ? `<button type="button" class="link-small clear-hole" data-clear>Clear this hole</button>` : ""}
        </div>

        ${me.thru === holeCount() ? `<div class="done-banner"><b>Round complete.</b> ${scramble ? "Your team" : "You"} finished at <span class="${toParClass(me.toPar)}">${fmtToPar(me.toPar)}</span>. Head to the clubhouse.</div>` : ""}

        <div class="play-card">
          <h3 class="section-title">${scramble ? "Team scorecard" : "Your scorecard"}</h3>
          ${scorecard(card, t, me)}
        </div>
      </div>`;

    centerHoleStrip();
    el.querySelectorAll("[data-player]").forEach((b) => b.addEventListener("click", () => { setActive(b.dataset.player); renderPlay(); }));
    el.querySelector("[data-change-team]")?.addEventListener("click", () => { S.play.pickTeam = true; renderPlay(); });
    el.querySelectorAll("[data-hole]").forEach((b) => b.addEventListener("click", () => gotoHole(+b.dataset.hole)));
    el.querySelector("[data-more]")?.addEventListener("click", () => {
      S.play.draft = Math.min(20, high ? value + 1 : par + 4);
      renderPlay();
    });
    el.querySelectorAll("[data-score]").forEach((b) => b.addEventListener("click", () => {
      if (locked) return;
      S.play.draft = +b.dataset.score;
      renderPlay();
    }));
    el.querySelectorAll("[data-putts]").forEach((b) => b.addEventListener("click", () => {
      const n = +b.dataset.putts;
      S.play.draftPutts = putts === n ? null : n;
      renderPlay();
    }));
    el.querySelector("[data-nav]")?.addEventListener("click", () => gotoHole(h - 1));
    el.querySelector("[data-save]")?.addEventListener("click", async (e) => {
      if (!dirty) { if (h < holeCount() - 1) gotoHole(h + 1); return; }
      await saveHole(p, card, h, value, putts, e.currentTarget);
    });
    el.querySelector("[data-clear]")?.addEventListener("click", async (e) => {
      await saveHole(p, card, h, null, null, e.currentTarget);
    });
  }

  function renderTeamPicker(el, p, team) {
    const teams = S.state.teams;
    const why = fmt() === "scramble"
      ? "In a scramble your team posts one score per hole. Anyone on the team can enter it."
      : fmt() === "bestball"
        ? "Everyone plays their own ball. Your team's score on each hole is its lowest score."
        : "Teams are optional in this format. Your scores also count toward your team's total.";
    el.innerHTML = `
      <div class="play">
        <div class="join-hero">
          <p class="eyebrow">${esc(p.name)}</p>
          <h2>${team ? "Change team" : "Pick your team"}</h2>
          <p>${why}</p>
        </div>
        ${teams.length ? `<div class="team-pick">${teams.map((tm) => {
          const members = S.state.players.filter((x) => x.teamId === tm.id);
          return `<button type="button" class="team-opt${tm.id === p.teamId ? " on" : ""}" data-team="${tm.id}"><b>${esc(tm.name)}</b><small>${members.map((m) => esc(m.name)).join(", ") || "No players yet"}</small></button>`;
        }).join("")}</div>` : `<p class="locked-note">The host hasn't set up teams yet. This page updates as soon as they do.</p>`}
        ${team || !teamFormat() ? `<button type="button" class="link-small" data-cancel>${team ? `Stay on ${esc(team.name)}` : "Skip for now"}</button>` : ""}
      </div>`;
    el.querySelectorAll("[data-team]").forEach((b) => b.addEventListener("click", async () => {
      const cred = S.devicePlayers.find((d) => d.id === p.id);
      try {
        await api("/api/team", { playerId: p.id, token: cred.token, teamId: b.dataset.team });
        const pl = S.state.players.find((x) => x.id === p.id);
        if (pl) pl.teamId = b.dataset.team;
        S.play = { hole: null, draft: null, draftPutts: undefined, forPlayer: null };
        toast(`You're on ${S.state.teams.find((x) => x.id === b.dataset.team)?.name}.`, "good");
        renderPlay();
      } catch (ex) { toast(ex.message, "bad"); }
    }));
    el.querySelector("[data-cancel]")?.addEventListener("click", () => { S.play.pickTeam = false; renderPlay(); });
  }

  // Scroll the strip itself (not the page) so the current hole is visible.
  function centerHoleStrip() {
    const strip = $(".hole-strip");
    const cur = strip?.querySelector(".current");
    if (!cur) return;
    strip.scrollLeft = cur.offsetLeft - strip.clientWidth / 2 + cur.offsetWidth / 2;
  }

  function gotoHole(i) {
    if (i < 0 || i >= holeCount()) return;
    S.play.hole = i;
    S.play.draft = null;
    S.play.draftPutts = undefined;
    renderPlay();
  }

  // Posts as the player on this phone; in a scramble the server puts it on their team's card.
  async function saveHole(p, card, h, score, putts, btn) {
    const cred = S.devicePlayers.find((d) => d.id === p.id);
    if (!cred) return;
    btn.disabled = true;
    btn.classList.add("busy");
    try {
      await api("/api/score", { playerId: p.id, token: cred.token, hole: h, score, putts });
      const par = S.state.tournament.pars[h];
      if (score == null) toast(`Hole ${h + 1} cleared`);
      else {
        const d = score - par;
        const cheer = score === 1 ? "Drinks are on you." : d <= -2 ? "Take a bow." : d === -1 ? "Nice one." : d === 0 ? "Solid." : d === 1 ? "Shake it off." : "On to the next one.";
        toast(`${resultName(score, par)} on ${h + 1}. ${cheer}`, d < 0 ? "good" : "");
      }
      S.play.draft = null;
      S.play.draftPutts = undefined;
      if (score != null && h < holeCount() - 1) S.play.hole = h + 1;
      // The live stream will re-render with the saved score; render now for snappiness too.
      const target = card.isTeam ? S.state.teams.find((x) => x.id === card.id) : S.state.players.find((x) => x.id === p.id);
      if (target) { target.scores[h] = score; target.putts[h] = score == null ? null : putts; }
      renderPlay();
      } catch (err) {
      toast(err.message, "bad");
      btn.disabled = false;
      btn.classList.remove("busy");
    }
  }

  // ----- Join -----
  function renderJoin(entering) {
    const el = $("#view-join");
    if (!entering && el.querySelector(".join")) return; // don't clobber typing on live updates
    const t = S.state.tournament;
    const onDevice = S.devicePlayers
      .map((d) => S.state.players.find((p) => p.id === d.id))
      .filter(Boolean);
    el.innerHTML = `
      <div class="join">
        <div class="join-hero">
          <p class="eyebrow">${esc(t.name)}</p>
          <h2>${onDevice.length ? "Add another player" : "Join the field"}</h2>
          <p>${onDevice.length
            ? `Keeping score for your group? Add up to ${MAX_PER_PHONE} players on this phone and switch between them on My Round. Only this phone can post their scores.`
            : "Put your name on the board. You'll post your own scores hole by hole and everyone sees them live."}</p>
        </div>
        ${t.locked ? `<p class="locked-note">Registration is closed. The host has locked the leaderboard.</p>` : `
        <form class="form" id="join-form" novalidate>
          <label class="field">
            <span>Player name <em>*</em></span>
            <input name="name" autocomplete="name" maxlength="32" required placeholder="e.g. Bobby Jones">
          </label>
          ${t.handicaps ? `<label class="field">
            <span>Handicap <small>optional, for net scoring</small></span>
            <input name="handicap" inputmode="decimal" placeholder="e.g. 12.4">
          </label>` : ""}
          ${S.state.teams.length ? `<label class="field">
            <span>Team ${teamFormat() ? "<em>*</em>" : "<small>optional</small>"}</span>
            <select name="teamId">
              <option value="">${teamFormat() ? "Pick your team" : "No team"}</option>
              ${S.state.teams.map((tm) => `<option value="${tm.id}" ${tm.id === teamOf(onDevice.find((x) => x.id === S.active))?.id ? "selected" : ""}>${esc(tm.name)}</option>`).join("")}
            </select>
          </label>` : ""}
          <p class="form-error" id="join-error" role="alert"></p>
          <button class="btn btn-gold btn-block" type="submit">${onDevice.length ? "Add player" : "Tee it up"}</button>
        </form>`}
        ${onDevice.length ? `
          <div class="on-device">
            <h3 class="section-title">On this phone</h3>
            <ul>${onDevice.map((p) => `<li><span>${esc(p.name)}</span><a class="link-small" href="#/play" data-go="${p.id}">Score</a></li>`).join("")}</ul>
          </div>` : ""}
      </div>`;

    el.querySelectorAll("[data-go]").forEach((a) => a.addEventListener("click", () => setActive(a.dataset.go)));
    const form = $("#join-form", el);
    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const err = $("#join-error", el);
      err.textContent = "";
      const name = String(fd.get("name") || "").trim();
      if (!name) { err.textContent = "Enter a name."; return; }
      const teamId = String(fd.get("teamId") || "");
      if (teamFormat() && S.state.teams.length && !teamId) { err.textContent = "Pick your team."; return; }
      const btn = form.querySelector("button");
      btn.disabled = true;
      try {
        const res = await api("/api/join", { name, handicap: String(fd.get("handicap") || "").trim(), teamId });
        claimPlayer(res.player.id, res.token);
        toast(`Welcome to the field, ${res.player.name}.`, "good");
        location.hash = "#/play";
      } catch (ex) {
        err.textContent = ex.message;
        btn.disabled = false;
      }
    });
  }

  // ----- Admin -----
  function renderAdmin(entering) {
    const el = $("#view-admin");
    if (!S.pin) {
      if (!entering && el.querySelector("#pin-form")) return;
      el.innerHTML = `
        <div class="admin-login">
          <h2>Tournament host</h2>
          <p>Enter the admin PIN shown in the server console when it started.</p>
          <form id="pin-form" class="form" novalidate>
            <label class="field"><span>Admin PIN</span><input name="pin" type="password" inputmode="numeric" autocomplete="current-password" required></label>
            <p class="form-error" role="alert"></p>
            <button class="btn btn-gold btn-block" type="submit">Unlock</button>
          </form>
        </div>`;
      const form = $("#pin-form", el);
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const pin = String(new FormData(form).get("pin") || "");
        try {
          await api("/api/admin", { pin, action: "login" });
          S.pin = pin;
          store.session.set("lb.pin", pin);
          renderAdmin(true);
        } catch (ex) {
          form.querySelector(".form-error").textContent = ex.message;
        }
      });
      return;
    }

    if (entering || !el.querySelector(".admin")) {
      el.innerHTML = `
        <div class="admin">
          <div class="admin-head">
            <h2>Tournament host</h2>
            <button type="button" class="btn btn-ghost btn-sm" id="admin-lock">Lock admin</button>
          </div>
          <div class="admin-grid">
            <section class="panel" id="panel-invite"></section>
            <section class="panel" id="panel-settings"></section>
          </div>
          <section class="panel" id="panel-teams"></section>
          <section class="panel" id="panel-players"></section>
          <section class="panel" id="panel-scores"></section>
          <section class="panel" id="panel-course"></section>
          <section class="panel panel-danger" id="panel-danger"></section>
        </div>`;
      $("#admin-lock", el).addEventListener("click", () => {
        S.pin = null;
        store.session.set("lb.pin", null);
        renderAdmin(true);
      });
      S.adminDirty.clear();
      renderInvite();
      renderSettings();
      renderCourse();
      renderDanger();
    }
    renderTeamsPanel();
    renderPlayersPanel();
    renderScoresPanel();
  }

  function renderTeamsPanel() {
    const el = $("#panel-teams");
    if (!el || (el.contains(document.activeElement) && document.activeElement.tagName === "INPUT")) return;
    const teams = S.state.teams;
    el.innerHTML = `
      <h3 class="section-title">Teams <span class="count">${teams.length}</span></h3>
      <p class="muted">Format: <b>${FORMAT_LABELS[fmt()]}</b> (change it under Tournament). Players pick their team when they join; you can move them in the Players list below.</p>
      <form class="form form-inline team-form" id="team-form" novalidate>
        <label class="field"><span>Team name <em>*</em></span><input name="name" maxlength="32" required placeholder="e.g. Eagles"></label>
        <button class="btn btn-gold" type="submit">Add team</button>
      </form>
      ${teams.length ? `<ul class="plist">${teams.map((tm) => {
        const members = S.state.players.filter((p) => p.teamId === tm.id);
        return `<li data-team="${tm.id}">
          <div class="pl-main"><span class="pname">${esc(tm.name)}</span><span class="muted">${members.map((m) => esc(m.name)).join(", ") || "No players yet"}</span></div>
          <div class="pl-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-act="rename">Rename</button>
            <button type="button" class="btn btn-danger btn-sm" data-act="remove">Remove</button>
          </div>
        </li>`;
      }).join("")}</ul>` : `<p class="muted">No teams yet.</p>`}`;
    const form = $("#team-form", el);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = String(new FormData(form).get("name") || "").trim();
      if (!name) { toast("Enter a team name", "bad"); return; }
      try { await adminApi("addTeam", { name }); form.reset(); document.activeElement?.blur(); toast(`${name} added`, "good"); }
      catch (ex) { adminError(ex); }
    });
    el.querySelectorAll("li[data-team]").forEach((li) => {
      const tm = S.state.teams.find((x) => x.id === li.dataset.team);
      li.querySelector('[data-act="rename"]').addEventListener("click", async () => {
        const name = prompt("Team name", tm.name);
        if (!name || name.trim() === tm.name) return;
        try { await adminApi("renameTeam", { teamId: tm.id, name }); toast("Team renamed", "good"); } catch (ex) { adminError(ex); }
      });
      li.querySelector('[data-act="remove"]').addEventListener("click", async () => {
        if (!confirm(`Remove ${tm.name}? Its players stay on the board without a team${fmt() === "scramble" ? ", and the team's scramble scores are deleted" : ""}.`)) return;
        try { await adminApi("removeTeam", { teamId: tm.id }); toast(`${tm.name} removed`); } catch (ex) { adminError(ex); }
      });
    });
  }

  const siteUrl = () => `${location.origin}/`;

  function renderInvite() {
    const el = $("#panel-invite");
    el.innerHTML = `
      <h3 class="section-title">Invite players</h3>
      <p class="muted">Share this link or put the QR code on the first tee.</p>
      <div class="invite">
        <div class="qr" id="qr" aria-label="QR code for the leaderboard"></div>
        <div class="invite-side">
          <code class="url">${esc(siteUrl())}</code>
          <div class="btn-row">
            <button type="button" class="btn btn-gold btn-sm" id="copy-url">Copy link</button>
            <a class="btn btn-ghost btn-sm" href="#/tv">Clubhouse TV</a>
          </div>
        </div>
      </div>`;
    $("#copy-url", el).addEventListener("click", () => copy(siteUrl(), "Link copied"));
    drawQr($("#qr", el), siteUrl());
  }

  function drawQr(target, text) {
    const draw = () => {
      if (typeof window.qrcode !== "function") { target.hidden = true; return; }
      const qr = window.qrcode(0, "M");
      qr.addData(text);
      qr.make();
      target.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    };
    if (typeof window.qrcode === "function") draw();
    else window.addEventListener("load", draw, { once: true });
  }

  async function copy(text, msg) {
    try { await navigator.clipboard.writeText(text); toast(msg, "good"); }
    catch { window.prompt("Copy this:", text); }
  }

  function renderSettings() {
    const t = S.state.tournament;
    const el = $("#panel-settings");
    el.innerHTML = `
      <h3 class="section-title">Tournament</h3>
      <form class="form" id="settings-form">
        <label class="field"><span>Name</span><input name="name" maxlength="48" value="${esc(t.name)}"></label>
        <label class="field"><span>Subtitle</span><input name="subtitle" maxlength="64" value="${esc(t.subtitle)}"></label>
        <label class="switch">
          <input type="checkbox" name="locked" ${t.locked ? "checked" : ""}>
          <span class="switch-ui" aria-hidden="true"></span>
          <span>Lock scoring <small>marks the board final; players can no longer post</small></span>
        </label>
        <label class="switch">
          <input type="checkbox" name="handicaps" ${t.handicaps ? "checked" : ""}>
          <span class="switch-ui" aria-hidden="true"></span>
          <span>Handicap scoring <small>adds net scores and asks players for a handicap; off means handicaps are ignored</small></span>
        </label>
        <label class="switch">
          <input type="checkbox" name="putts" ${t.putts ? "checked" : ""}>
          <span class="switch-ui" aria-hidden="true"></span>
          <span>Track putts <small>adds optional putt buttons to score entry and putts to scorecards</small></span>
        </label>
        <fieldset class="radio-group">
          <legend>Format</legend>
          <label><input type="radio" name="format" value="individual" ${fmt() === "individual" ? "checked" : ""}> <span>Individual <small>everyone plays their own ball; teams (if any) get a total</small></span></label>
          <label><input type="radio" name="format" value="bestball" ${fmt() === "bestball" ? "checked" : ""}> <span>Best ball <small>own ball; a team's score on each hole is its lowest</small></span></label>
          <label><input type="radio" name="format" value="scramble" ${fmt() === "scramble" ? "checked" : ""}> <span>Scramble <small>each team posts one score per hole</small></span></label>
        </fieldset>
        <label class="switch">
          <input type="checkbox" name="skins" ${t.skins ? "checked" : ""}>
          <span class="switch-ui" aria-hidden="true"></span>
          <span>Skins game <small>adds a Skins page: lowest score on each hole wins a skin (team vs team in Best ball and Scramble)</small></span>
        </label>
        <fieldset class="radio-group">
          <legend>Skins ties</legend>
          <label><input type="radio" name="skinsTies" value="carry" ${t.skinsTies !== "point" ? "checked" : ""}> <span>Carry over <small>the skin rolls to the next hole</small></span></label>
          <label><input type="radio" name="skinsTies" value="point" ${t.skinsTies === "point" ? "checked" : ""}> <span>Point each <small>every tied player gets a skin</small></span></label>
        </fieldset>
        <button class="btn btn-gold btn-sm" type="submit">Save</button>
      </form>`;
    const form = $("#settings-form", el);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      try {
        await adminApi("setSettings", { name: fd.get("name"), subtitle: fd.get("subtitle"), locked: fd.get("locked") === "on", handicaps: fd.get("handicaps") === "on", putts: fd.get("putts") === "on", skins: fd.get("skins") === "on", skinsTies: fd.get("skinsTies"), format: fd.get("format") });
        toast("Tournament saved", "good");
      } catch (ex) { adminError(ex); }
    });
  }

  function adminError(ex) {
    toast(ex.message, "bad");
    if (/PIN/i.test(ex.message)) { S.pin = null; store.session.set("lb.pin", null); renderAdmin(true); }
  }

  function renderPlayersPanel() {
    const el = $("#panel-players");
    if (!el || el.contains(document.activeElement) && document.activeElement.tagName === "INPUT") return;
    const t = S.state.tournament;
    const players = [...S.state.players].sort((a, b) => a.name.localeCompare(b.name));
    el.innerHTML = `
      <h3 class="section-title">Players <span class="count">${players.length}</span></h3>
      <form class="form form-inline" id="add-form" novalidate>
        <label class="field"><span>Player name <em>*</em></span><input name="name" maxlength="32" required></label>
        <label class="field field-sm"><span>Handicap</span><input name="handicap" inputmode="decimal"></label>
        <button class="btn btn-gold" type="submit">Add player</button>
      </form>
      ${players.length ? `
      <ul class="plist">
        ${players.map((p) => {
          const st = playerStats(p, t);
          return `<li data-id="${p.id}">
            <div class="pl-main">
              <span class="pname">${esc(p.name)}</span>
              <span class="muted">${p.handicap != null ? `HCP ${p.handicap} · ` : ""}${st.thru ? `thru ${st.thru}, ${fmtToPar(st.toParG)}` : "not started"}</span>
            </div>
            <div class="pl-actions">
              ${S.state.teams.length ? `<select class="team-select" data-act="team" aria-label="Team for ${esc(p.name)}">
                <option value="">No team</option>
                ${S.state.teams.map((tm) => `<option value="${tm.id}" ${tm.id === p.teamId ? "selected" : ""}>${esc(tm.name)}</option>`).join("")}
              </select>` : ""}
              <button type="button" class="btn btn-ghost btn-sm" data-act="edit">Edit</button>
              <button type="button" class="btn btn-ghost btn-sm" data-act="link" title="Copy a link that lets a phone post scores for this player">Phone link</button>
              <button type="button" class="btn btn-danger btn-sm" data-act="remove">Remove</button>
            </div>
          </li>`;
        }).join("")}
      </ul>` : `<p class="muted">No players yet. Add them here or have them join from their phones.</p>`}`;

    const form = $("#add-form", el);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const name = String(fd.get("name") || "").trim();
      if (!name) { toast("Enter a name", "bad"); return; }
      try {
        await adminApi("addPlayer", { name, handicap: String(fd.get("handicap") || "").trim() });
        form.reset();
        document.activeElement?.blur();
        toast(`${name} added`, "good");
      } catch (ex) { adminError(ex); }
    });

    el.querySelectorAll(".plist li").forEach((li) => {
      const p = S.state.players.find((x) => x.id === li.dataset.id);
      li.querySelector('[data-act="team"]')?.addEventListener("change", async (e) => {
        try { await adminApi("setPlayerTeam", { playerId: p.id, teamId: e.target.value }); toast(`${p.name} moved`, "good"); }
        catch (ex) { adminError(ex); }
      });
      li.querySelector('[data-act="remove"]').addEventListener("click", async () => {
        if (!confirm(`Remove ${p.name} and all their scores?`)) return;
        try { await adminApi("removePlayer", { playerId: p.id }); toast(`${p.name} removed`); } catch (ex) { adminError(ex); }
      });
      li.querySelector('[data-act="link"]').addEventListener("click", async () => {
        try {
          const { token } = await adminApi("playerLink", { playerId: p.id });
          copy(`${siteUrl()}#/claim/${p.id}/${encodeURIComponent(token)}`, `Scoring link for ${p.name} copied`);
        } catch (ex) { adminError(ex); }
      });
      li.querySelector('[data-act="edit"]').addEventListener("click", () => {
        li.innerHTML = `
          <form class="form form-inline edit-form">
            <label class="field"><span>Name</span><input name="name" maxlength="32" value="${esc(p.name)}"></label>
            <label class="field field-sm"><span>Handicap</span><input name="handicap" inputmode="decimal" value="${p.handicap ?? ""}"></label>
            <button class="btn btn-gold btn-sm" type="submit">Save</button>
            <button class="btn btn-ghost btn-sm" type="button" data-cancel>Cancel</button>
          </form>`;
        const f = li.querySelector("form");
        f.querySelector("input").focus();
        f.querySelector("[data-cancel]").addEventListener("click", () => { document.activeElement?.blur(); renderPlayersPanel(); });
        f.addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(f);
          try {
            await adminApi("updatePlayer", { playerId: p.id, name: fd.get("name"), handicap: String(fd.get("handicap") || "").trim() });
            document.activeElement?.blur();
            toast("Player updated", "good");
            renderPlayersPanel();
          } catch (ex) { adminError(ex); }
        });
      });
    });
  }

  function renderScoresPanel() {
    const el = $("#panel-scores");
    if (!el) return;
    if (S.adminDirty.size || (el.contains(document.activeElement) && document.activeElement.tagName === "INPUT")) {
      // Keep the host's in-progress edits; just flag that fresh scores arrived.
      const note = $("#grid-status", el);
      if (note && S.adminDirty.size) note.textContent = `${S.adminDirty.size} unsaved change${S.adminDirty.size > 1 ? "s" : ""}. New scores arrived; saving keeps everyone else's.`;
      return;
    }
    const t = S.state.tournament;
    if (S.adminNine >= nineCount()) S.adminNine = 0;
    // In a scramble the scores live on the team cards, so that's what the host edits.
    const kind = fmt() === "scramble" ? "team" : "player";
    const players = [...(kind === "team" ? S.state.teams : S.state.players)].sort((a, b) => a.name.localeCompare(b.name));
    el.innerHTML = `
      <div class="panel-bar">
        <h3 class="section-title">Edit ${kind === "team" ? "team " : ""}scores</h3>
        ${players.length ? `<div class="seg half-toggle" role="group" aria-label="Holes shown">
          ${ninesHtml((k) => `<button type="button" data-nine="${k}" aria-pressed="${S.adminNine === k}">${9 * k + 1}–${9 * k + 9}</button>`)}
        </div>` : ""}
      </div>
      ${!players.length && kind === "team" ? `<p class="muted">Add teams to edit their scramble scores.</p>` : ""}
      ${players.length ? `
      <div class="grid-scroll" data-nine="${S.adminNine}">
        <table class="grid">
          <thead><tr><th class="g-name">${kind === "team" ? "Team" : "Player"}</th>${t.pars.map((_, i) => `<th class="n${Math.floor(i / 9)}">${i + 1}</th>`).join("")}</tr>
          <tr class="par-row"><td class="g-name">Par</td>${t.pars.map((p, i) => `<td class="n${Math.floor(i / 9)}">${p}</td>`).join("")}</tr></thead>
          <tbody>
            ${players.map((p) => `<tr><th class="g-name" scope="row">${esc(p.name)}</th>${p.scores.map((s, i) =>
              `<td class="n${Math.floor(i / 9)}"><input class="gcell" inputmode="numeric" maxlength="2" data-kind="${kind}" data-pid="${p.id}" data-hole="${i}" value="${s ?? ""}" aria-label="${esc(p.name)} hole ${i + 1}"></td>`).join("")}</tr>`).join("")}
          </tbody>
        </table>
      </div>
      <div class="grid-foot">
        <span class="muted" id="grid-status">No unsaved changes.</span>
        <button type="button" class="btn btn-gold" id="grid-save" disabled>Save scores</button>
      </div>` : `<p class="muted">Add players to edit their scores.</p>`}`;

    el.querySelectorAll("button[data-nine]").forEach((btn) => btn.addEventListener("click", () => {
      S.adminNine = +btn.dataset.nine;
      el.querySelector(".grid-scroll").dataset.nine = S.adminNine;
      el.querySelectorAll("button[data-nine]").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    }));
    el.querySelectorAll(".gcell").forEach((inp) => {
      inp.addEventListener("input", () => {
        inp.value = inp.value.replace(/\D/g, "").slice(0, 2);
        const key = `${inp.dataset.kind}:${inp.dataset.pid}:${inp.dataset.hole}`;
        const p = (inp.dataset.kind === "team" ? S.state.teams : S.state.players).find((x) => x.id === inp.dataset.pid);
        const orig = p?.scores[+inp.dataset.hole];
        const val = inp.value === "" ? null : +inp.value;
        if (val === (orig ?? null)) S.adminDirty.delete(key); else S.adminDirty.set(key, val);
        inp.classList.toggle("dirty", S.adminDirty.has(key));
        const n = S.adminDirty.size;
        $("#grid-status", el).textContent = n ? `${n} unsaved change${n > 1 ? "s" : ""}.` : "No unsaved changes.";
        $("#grid-save", el).disabled = !n;
      });
      inp.addEventListener("keydown", (e) => {
        const moves = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0], Enter: [1, 0] };
        const m = moves[e.key];
        if (!m) return;
        const cells = [...el.querySelectorAll(".gcell")];
        const idx = cells.indexOf(inp);
        const target = cells[idx + m[0] * holeCount() + m[1]];
        if (target) { e.preventDefault(); target.focus(); target.select(); }
      });
      inp.addEventListener("focus", () => inp.select());
    });
    $("#grid-save", el)?.addEventListener("click", async () => {
      const changes = [...S.adminDirty].map(([k, score]) => {
        const [kind, id, hole] = k.split(":");
        return kind === "team" ? { teamId: id, hole: +hole, score } : { playerId: id, hole: +hole, score };
      });
      try {
        await adminApi("setScores", { changes });
        S.adminDirty.clear();
        document.activeElement?.blur();
        toast(`Saved ${changes.length} score${changes.length > 1 ? "s" : ""}`, "good");
        renderScoresPanel();
      } catch (ex) { adminError(ex); }
    });
  }

  // Default stroke index for a course of n holes: keeps the first nine's order of difficulty and
  // spreads the hardest holes evenly across the nines.
  function spreadIndex(n, si) {
    const first = si.slice(0, 9);
    const rank = first.map((v) => first.filter((x) => x < v).length); // 0 = hardest of the nine
    const nines = n / 9;
    return Array.from({ length: n }, (_, i) => rank[i % 9] * nines + Math.floor(i / 9) + 1);
  }

  function renderCourse(draft) {
    const t = S.state.tournament;
    const pars = draft?.pars ?? t.pars;
    const si = draft?.strokeIndex ?? t.strokeIndex;
    const n = pars.length;
    const el = $("#panel-course");
    el.innerHTML = `
      <div class="panel-bar">
        <h3 class="section-title">Course</h3>
        <div class="seg holes-toggle" role="group" aria-label="Number of holes">
          ${[9, 18, 27, 36].map((c) => `<button type="button" data-holes="${c}" aria-pressed="${c === n}">${c}</button>`).join("")}
        </div>
      </div>
      <p class="muted">${n} holes. Pars set the scoring. ${n > 18 ? "Holes past 18 start with the same pars as the first nine; change any that differ. " : ""}Stroke index (1 = hardest hole) is only used for handicap scoring.</p>
      ${draft ? `<p class="locked-note">Not saved yet. Check the pars below, then tap Save course.</p>` : ""}
      <form id="course-form">
        <div class="grid-scroll">
          <table class="grid course">
            <thead><tr><th class="g-name">Hole</th>${pars.map((_, i) => `<th>${i + 1}</th>`).join("")}<th>Tot</th></tr></thead>
            <tbody>
              <tr><th class="g-name" scope="row">Par</th>${pars.map((p, i) => `<td><input class="gcell" name="par${i}" inputmode="numeric" maxlength="1" value="${p}" aria-label="Par hole ${i + 1}"></td>`).join("")}<td class="course-tot" id="par-total">${sum(pars)}</td></tr>
              <tr><th class="g-name" scope="row">Index</th>${si.map((x, i) => `<td><input class="gcell" name="si${i}" inputmode="numeric" maxlength="2" value="${x}" aria-label="Stroke index hole ${i + 1}"></td>`).join("")}<td></td></tr>
            </tbody>
          </table>
        </div>
        ${n > 9 ? `<button type="button" class="btn btn-ghost btn-sm copy-nine" id="copy-nine">Same 9 holes each loop: copy holes 1–9 to every nine</button>` : ""}
        <div class="grid-foot">
          <span class="muted" id="nine-totals"></span>
          <button class="btn btn-gold" type="submit">Save course</button>
        </div>
      </form>`;
    const form = $("#course-form", el);
    const read = (prefix) => Array.from({ length: n }, (_, i) => form[`${prefix}${i}`].value);
    const totals = () => {
      const ps = read("par").map((v) => +v || 0);
      $("#par-total", el).textContent = sum(ps);
      $("#nine-totals", el).textContent = Array.from({ length: n / 9 }, (_, k) => `${NINE_LABELS[k]} ${sum(ps.slice(9 * k, 9 * k + 9))}`).join(" · ");
    };
    totals();
    form.addEventListener("input", totals);
    // For a 9-hole course played several times: every nine gets the same pars and difficulty order.
    $("#copy-nine", el)?.addEventListener("click", () => {
      const first = read("par").slice(0, 9);
      renderCourse({
        pars: Array.from({ length: n }, (_, i) => first[i % 9]),
        strokeIndex: spreadIndex(n, read("si").map(Number)),
      });
    });
    el.querySelectorAll("[data-holes]").forEach((b) => b.addEventListener("click", () => {
      const c = +b.dataset.holes;
      if (c === n) return;
      const cur = read("par").map((v) => +v || 4);
      renderCourse({
        pars: Array.from({ length: c }, (_, i) => cur[i] ?? cur[i % cur.length]),
        strokeIndex: c === t.pars.length ? t.strokeIndex : spreadIndex(c, read("si").map(Number)),
      });
    }));
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const lost = S.state.players.filter((p) => p.scores.slice(n).some((x) => x != null)).length;
      if (lost && !confirm(`Shortening the course to ${n} holes deletes scores past hole ${n} for ${lost} player${lost > 1 ? "s" : ""}. Continue?`)) return;
      try {
        await adminApi("setCourse", { pars: read("par"), strokeIndex: read("si") });
        toast(`Course saved: ${n} holes`, "good");
        renderCourse();
      } catch (ex) { adminError(ex); }
    });
  }

  function renderDanger() {
    const el = $("#panel-danger");
    el.innerHTML = `
      <h3 class="section-title">Start over</h3>
      <div class="danger-row">
        <div><b>Clear all scores</b><p class="muted">Keeps players and course. Use between rounds.</p></div>
        <button type="button" class="btn btn-danger" id="reset-scores">Clear scores</button>
      </div>
      <div class="danger-row">
        <div><b>Reset tournament</b><p class="muted">Removes every player, score and setting.</p></div>
        <button type="button" class="btn btn-danger" id="reset-all">Reset everything</button>
      </div>`;
    $("#reset-scores", el).addEventListener("click", async () => {
      if (!confirm("Clear every score for every player?")) return;
      try { await adminApi("resetScores"); toast("Scores cleared"); } catch (ex) { adminError(ex); }
    });
    $("#reset-all", el).addEventListener("click", async () => {
      if (prompt('This deletes everything. Type RESET to confirm.') !== "RESET") return;
      try {
        await adminApi("resetAll");
        toast("Tournament reset");
        renderAdmin(true);
      } catch (ex) { adminError(ex); }
    });
  }

  // ----- Clubhouse TV -----
  function renderTv() {
    const el = $("#view-tv");
    const state = S.state;
    const t = state.tournament;
    const mode = effectiveMode();
    const rows = computeBoard(state, mode);
    const perPage = Math.max(4, Math.floor((window.innerHeight - 260) / 64));
    const boardPages = Math.max(1, Math.ceil(rows.length / perPage));
    const sk = t.skins ? computeSkins(state) : null;
    const pages = boardPages + (sk && sk.field.length >= 2 ? 1 : 0);
    S.tvPage %= pages;
    const pageRows = rows.slice(S.tvPage * perPage, (S.tvPage + 1) * perPage);
    const skinsPage = S.tvPage === boardPages;

    el.innerHTML = `
      <div class="tv">
        <div class="tv-head">
          <div>
            <h1>${esc(t.name)}</h1>
            <p>${esc(t.subtitle || "")}${mode === "net" ? " · Net scores" : ""}${t.locked ? " · Final" : ""}</p>
          </div>
          <div class="tv-join">
            <div class="qr" id="tv-qr"></div>
            <span>Scan to follow<br>or post scores</span>
          </div>
        </div>
        <div class="tv-body">
          ${skinsPage ? `
          <table class="lb tv-lb sk-table">
            <thead><tr><th class="c-pos">Pos</th><th class="c-player">Skins${sk.carryMode ? " · ties carry over" : " · ties: a skin each"}</th><th class="c-tot">Skins</th></tr></thead>
            <tbody>
              ${sk.standings.slice(0, perPage).map((r) => `
                <tr><td class="c-pos">${r.skins ? esc(r.pos) : "–"}</td><td class="c-player"><span class="pname">${esc(r.p.name)}</span></td><td class="c-tot">${r.skins}</td></tr>`).join("")}
            </tbody>
          </table>
          ${sk.carry ? `<p class="tv-empty">${sk.carry} skin${sk.carry > 1 ? "s" : ""} carrying over</p>` : ""}` : `
          <table class="lb tv-lb">
            <thead>
              <tr><th class="c-pos">Pos</th><th class="c-player">${teamFormat() ? "Team" : "Player"}</th><th class="c-topar">To Par</th><th class="c-thru">Thru</th>
                ${holeHeads(0, holeCount())}<th class="c-tot">${mode === "net" ? "Net" : "Tot"}</th></tr>
            </thead>
            <tbody>
              ${pageRows.map((r) => `
                <tr class="row${S.flash.has(r.p.id) ? " flash" : ""}">
                  <td class="c-pos">${esc(r.pos)}</td>
                  <td class="c-player"><span class="pname">${esc(r.p.name)}</span></td>
                  <td class="c-topar"><span class="${toParClass(r.toPar, r.thru > 0)}">${fmtToPar(r.toPar, r.thru > 0)}</span></td>
                  <td class="c-thru">${thruLabel(r)}</td>
                  ${r.p.scores.map((s, i) => `<td class="hc${i % 9 === 8 && i < holeCount() - 1 ? " nine" : ""}">${s == null ? "" : `<span class="sc ${scoreClass(s, t.pars[i])}">${s}</span>`}</td>`).join("")}
                  <td class="c-tot">${r.thru ? r.total : ""}</td>
                </tr>`).join("")}
            </tbody>
          </table>
          ${!rows.length ? `<p class="tv-empty">Waiting for the field to tee off…</p>` : ""}`}
        </div>
        <div class="tv-foot">
          ${pages > 1 ? `<span>${skinsPage ? "Skins" : `Leaderboard${boardPages > 1 ? ` ${S.tvPage + 1} of ${boardPages}` : ""}`}</span>` : "<span></span>"}
          <a href="#/board">Exit TV mode</a>
        </div>
      </div>`;
    drawQr($("#tv-qr", el), siteUrl());
    S.flash.clear();
  }

  setInterval(() => {
    if (S.view === "tv" && S.state) { S.tvPage++; renderTv(); }
  }, 12000);

  // Keep relative times fresh.
  setInterval(() => {
    document.querySelectorAll("time[data-ts]").forEach((t) => { t.textContent = timeAgo(+t.dataset.ts); });
    if (S.state) renderLive();
  }, 20000);

  window.addEventListener("hashchange", route);
  let resizeT;
  window.addEventListener("resize", () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => { if (S.view === "tv" && S.state) renderTv(); }, 200);
  });

  route();
  connect();
})();
