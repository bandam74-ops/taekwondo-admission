(function () {
  "use strict";

  const D = window.TKD_DATA || { fouryear: [], college: [], creditbank: { overview: null, institutions: [] } };
  const SCHOOLS = [
    ...(D.fouryear || []),
    ...(D.college || []),
    ...((D.creditbank && D.creditbank.institutions) || []),
  ];
  const BY_ID = Object.fromEntries(SCHOOLS.map((s) => [s.id, s]));

  const TYPE_LABEL = { "4year": "4년제 대학", college: "전문대학", creditbank: "학점은행" };
  const TYPE_SHORT = { "4year": "4년제", college: "전문대", creditbank: "학점은행" };
  const REGIONS = ["서울", "경기", "인천", "강원", "충북", "충남", "대전", "세종", "전북", "전남", "광주", "경북", "경남", "대구", "부산", "울산", "제주", "온라인"];
  const CATEGORIES = ["실기위주", "학생부교과", "학생부종합", "수능위주", "특기자", "면접위주", "서류", "서류·면접", "서류·실기", "기타"];
  const EVENTS = ["겨루기", "품새", "시범", "격파"];
  const CAREERS = ["지도자", "사범", "경호", "교사", "선수", "시범", "해외", "경찰"];

  const app = document.getElementById("app");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
  };

  /* ---------- Compare state ---------- */
  let compare = store.get("tkd.compare", []).filter((id) => BY_ID[id]);
  function toggleCompare(id) {
    if (compare.includes(id)) compare = compare.filter((x) => x !== id);
    else {
      if (compare.length >= 4) { alert("비교는 최대 4개까지 가능합니다."); return false; }
      compare.push(id);
    }
    store.set("tkd.compare", compare);
    updateCompareBadge();
    return true;
  }
  function updateCompareBadge() {
    const b = document.getElementById("compareCount");
    b.textContent = compare.length;
    b.hidden = compare.length === 0;
  }

  /* ---------- Shared render helpers ---------- */
  function typeTag(t) { return `<span class="tag tag-${t}">${TYPE_SHORT[t] || t}</span>`; }

  function weightBar(adm, withLegend = true) {
    const els = window.TKDAnalyzer.normElements(adm);
    const total = els.reduce((s, [, v]) => s + v, 0) || 1;
    const known = ["학생부", "실기", "수능", "면접", "서류", "실적"];
    const estimated = !Object.values(adm.elements || {}).some((v) => v > 0);
    const bar = els.map(([k, v]) => `<span class="w-${known.includes(k) ? k : "기타"}" style="width:${(v / total) * 100}%" title="${esc(k)} ${v}%"></span>`).join("");
    const legend = withLegend
      ? `<div class="legend">${els.map(([k, v]) => `<span><i class="w-${known.includes(k) ? k : "기타"}"></i>${esc(k)} ${v}%</span>`).join("")}${estimated ? '<span class="muted">(전형 유형 기준 추정)</span>' : ""}</div>`
      : "";
    return `<div class="wbar" role="img" aria-label="반영비율 ${els.map(([k, v]) => k + " " + v + "%").join(", ")}">${bar}</div>${legend}`;
  }

  function compareCheckbox(id) {
    return `<label class="check"><input type="checkbox" data-compare="${esc(id)}" ${compare.includes(id) ? "checked" : ""}/> 비교</label>`;
  }

  function schoolCard(s) {
    const adms = s.admissions || [];
    const mini = adms.slice(0, 3).map((a) => `<li>· <b>${esc(a.round)}</b> ${esc(a.name)}${a.quota ? ` <span class="muted">(${a.quota}명)</span>` : ""}</li>`).join("");
    return `<article class="card school-card">
      <div class="top">
        <div>
          <h3><a href="#/school/${encodeURIComponent(s.id)}">${esc(s.university)}</a></h3>
          <div class="dept">${esc(s.department)}</div>
        </div>
        ${typeTag(s.type)}
      </div>
      <div class="meta">${esc(s.region)}${s.city ? " · " + esc(s.city) : ""}${s.establishment ? " · " + esc(s.establishment) : ""}${s.years ? ` · ${s.years}년제` : ""}${s.mode ? " · " + esc(s.mode) : ""}</div>
      ${(s.tracks || []).length ? `<div class="tags">${s.tracks.slice(0, 5).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>` : ""}
      ${mini ? `<div class="mini-adm"><ul>${mini}</ul>${adms.length > 3 ? `<span class="muted small">외 ${adms.length - 3}개 전형</span>` : ""}</div>` : '<div class="muted small">전형 정보 준비 중</div>'}
      <div class="foot">
        ${compareCheckbox(s.id)}
        <a class="btn btn-outline btn-sm" href="#/school/${encodeURIComponent(s.id)}">상세 보기</a>
      </div>
    </article>`;
  }

  function bindCompareBoxes(root = app) {
    root.querySelectorAll("[data-compare]").forEach((el) => {
      el.addEventListener("change", () => {
        const ok = toggleCompare(el.dataset.compare);
        if (!ok) el.checked = false;
      });
    });
  }

  /* ---------- Views ---------- */
  function viewHome() {
    const counts = { "4year": 0, college: 0, creditbank: 0 };
    SCHOOLS.forEach((s) => counts[s.type]++);
    const admCount = SCHOOLS.reduce((n, s) => n + (s.admissions || []).length, 0);
    const icon = { "4year": ["4", "var(--blue-soft)", "var(--blue)"], college: ["2·3", "var(--green-soft)", "var(--green)"], creditbank: ["B", "var(--violet-soft)", "var(--violet)"] };
    const desc = {
      "4year": "학사학위 · 수시 6회 + 정시 지원. 태권도학과·태권도경기지도학과 등",
      college: "2~3년제 · 수시 지원 횟수 제한 없음. 전공심화로 학사 취득 가능",
      creditbank: "평생교육원 등에서 학점을 쌓아 학사·전문학사 취득. 상시 모집",
    };
    app.innerHTML = `
      <section class="hero">
        <h1>태권도학과 입시,<br/>버튼 몇 번으로 한눈에.</h1>
        <p>전국 4년제 대학 · 전문대학 · 학점은행의 태권도 관련 학과 <b>${SCHOOLS.length}곳</b>, 입시전형 <b>${admCount}개</b>를 정리했습니다. 내 내신·수능·품단·대회 실적을 입력하면 맞는 전형을 찾아드립니다.</p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="#/analyze">내 입시 분석 시작 →</a>
          <a class="btn btn-ghost" href="#/list">대학 리스트 보기</a>
        </div>
      </section>

      <section class="section">
        <div class="section-head"><h2>어디로 갈 수 있을까?</h2><span class="muted small">유형을 눌러 바로 리스트로</span></div>
        <div class="grid grid-3">
          ${["4year", "college", "creditbank"].map((t) => `
            <a class="card type-card" href="#/list?type=${t}">
              <div class="type-icon" style="background:${icon[t][1]};color:${icon[t][2]}">${icon[t][0]}</div>
              <h3>${TYPE_LABEL[t]}</h3>
              <div class="count">${counts[t]}<small>곳</small></div>
              <div class="muted small">${desc[t]}</div>
            </a>`).join("")}
        </div>
      </section>

      <section class="section">
        <div class="section-head"><h2>입시 분석은 이렇게 진행돼요</h2></div>
        <div class="steps-strip">
          <div class="card"><h3>희망 조건</h3><p class="muted small">학교 유형 · 지역 · 수시/정시</p></div>
          <div class="card"><h3>성적 입력</h3><p class="muted small">내신 평균 등급 · 수능 응시 여부와 백분위</p></div>
          <div class="card"><h3>태권도 경력</h3><p class="muted small">품/단 · 주종목 · 수련 기간 · 대회 실적</p></div>
          <div class="card"><h3>맞춤 결과</h3><p class="muted small">전형별 적합도 · 안정/적정/소신/도전 · 원서 전략</p></div>
        </div>
      </section>

      <section class="section">
        <div class="section-head"><h2>지역별 학과</h2></div>
        <div class="chip-group">
          ${REGIONS.map((r) => { const n = SCHOOLS.filter((s) => s.region === r).length; return n ? `<a class="chip" href="#/list?region=${encodeURIComponent(r)}">${r} <b>${n}</b></a>` : ""; }).join("")}
        </div>
      </section>`;
  }

  function parseQuery() {
    const q = location.hash.split("?")[1] || "";
    return Object.fromEntries(new URLSearchParams(q));
  }

  const listState = { type: "all", regions: [], cats: [], rounds: [], q: "", sort: "name" };

  function viewList() {
    const q = parseQuery();
    if (q.type) listState.type = q.type;
    if (q.region) listState.regions = [q.region];
    if (q.type || q.region) history.replaceState(null, "", "#/list");

    const tabCounts = { all: SCHOOLS.length, "4year": 0, college: 0, creditbank: 0 };
    SCHOOLS.forEach((s) => tabCounts[s.type]++);
    const usedRegions = REGIONS.filter((r) => SCHOOLS.some((s) => s.region === r));
    const usedCats = CATEGORIES.filter((c) => SCHOOLS.some((s) => (s.admissions || []).some((a) => a.category === c)));

    app.innerHTML = `
      <h1>대학 찾기</h1>
      <p class="muted">유형 → 지역 → 전형 순으로 골라보세요. 체크박스로 최대 4곳을 비교할 수 있습니다.</p>
      <div class="card filters">
        <div class="tabs" role="tablist">
          ${["all", "4year", "college", "creditbank"].map((t) => `<button class="tab" role="tab" data-type="${t}" aria-selected="${listState.type === t}">${t === "all" ? "전체" : TYPE_LABEL[t]}<span class="n">${tabCounts[t]}</span></button>`).join("")}
        </div>
        <input class="search" type="search" id="q" placeholder="대학명·학과명·진로 검색 (예: 경호, 품새, 용인)" value="${esc(listState.q)}" />
        <div class="filter-row"><span class="filter-label">지역</span><div class="chip-group" id="fRegion">
          ${usedRegions.map((r) => `<button class="chip" data-v="${r}" aria-pressed="${listState.regions.includes(r)}">${r}</button>`).join("")}
        </div></div>
        <div class="filter-row"><span class="filter-label">전형 유형</span><div class="chip-group" id="fCat">
          ${usedCats.map((c) => `<button class="chip" data-v="${c}" aria-pressed="${listState.cats.includes(c)}">${c}</button>`).join("")}
        </div></div>
        <div class="filter-row"><span class="filter-label">모집 시기</span><div class="chip-group" id="fRound">
          ${["수시", "정시", "상시"].map((c) => `<button class="chip" data-v="${c}" aria-pressed="${listState.rounds.includes(c)}">${c}</button>`).join("")}
        </div></div>
      </div>
      <div class="result-meta">
        <strong id="resultCount"></strong>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn btn-outline btn-sm" id="reset">필터 초기화</button>
          <select id="sort" aria-label="정렬">
            <option value="name">이름순</option>
            <option value="region">지역순</option>
            <option value="adm">전형 많은 순</option>
          </select>
        </div>
      </div>
      <div class="grid grid-3" id="results"></div>`;

    const sortEl = app.querySelector("#sort");
    sortEl.value = listState.sort;

    function render() {
      const term = listState.q.trim().toLowerCase();
      let rows = SCHOOLS.filter((s) => {
        if (listState.type !== "all" && s.type !== listState.type) return false;
        if (listState.regions.length && !listState.regions.includes(s.region)) return false;
        const adms = s.admissions || [];
        if (listState.cats.length && !adms.some((a) => listState.cats.includes(a.category))) return false;
        if (listState.rounds.length && !adms.some((a) => listState.rounds.some((r) => (a.round || "").includes(r)))) return false;
        if (term) {
          const hay = [s.university, s.department, s.college, s.region, s.city, ...(s.tracks || []), ...(s.careers || []), s.highlights].join(" ").toLowerCase();
          if (!hay.includes(term)) return false;
        }
        return true;
      });
      const typeOrder = { "4year": 0, college: 1, creditbank: 2 };
      rows.sort((a, b) => {
        if (listState.sort === "region") return REGIONS.indexOf(a.region) - REGIONS.indexOf(b.region) || a.university.localeCompare(b.university, "ko");
        if (listState.sort === "adm") return (b.admissions || []).length - (a.admissions || []).length;
        return typeOrder[a.type] - typeOrder[b.type] || a.university.localeCompare(b.university, "ko");
      });
      app.querySelector("#resultCount").textContent = `검색 결과 ${rows.length}곳`;
      const box = app.querySelector("#results");
      box.innerHTML = rows.length ? rows.map(schoolCard).join("") : '<div class="empty" style="grid-column:1/-1">조건에 맞는 학과가 없습니다. 필터를 줄여보세요.</div>';
      bindCompareBoxes(box);
    }

    app.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => {
      listState.type = b.dataset.type;
      app.querySelectorAll(".tab").forEach((x) => x.setAttribute("aria-selected", x === b));
      render();
    }));
    const bindChips = (sel, key) => app.querySelectorAll(`${sel} .chip`).forEach((c) => c.addEventListener("click", () => {
      const v = c.dataset.v; const arr = listState[key];
      const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v);
      c.setAttribute("aria-pressed", i < 0);
      render();
    }));
    bindChips("#fRegion", "regions"); bindChips("#fCat", "cats"); bindChips("#fRound", "rounds");
    app.querySelector("#q").addEventListener("input", (e) => { listState.q = e.target.value; render(); });
    sortEl.addEventListener("change", () => { listState.sort = sortEl.value; render(); });
    app.querySelector("#reset").addEventListener("click", () => {
      Object.assign(listState, { type: "all", regions: [], cats: [], rounds: [], q: "" });
      viewList();
    });
    render();
  }

  function admissionBlock(a) {
    const rows = [
      ["모집 시기", a.period],
      ["모집인원", a.quota ? a.quota + "명" : null],
      ["실기 종목", a.practical],
      ["지원 자격", a.requirements],
      ["수능 최저", a.csatMinimum],
      ["경쟁률", typeof a.competitionRate === "number" ? a.competitionRate + " : 1" : null],
      ["참고 내신", typeof a.gradeCut === "number" ? a.gradeCut + "등급" : null],
      ["참고 수능", typeof a.csatCut === "number" ? "백분위 " + a.csatCut : null],
      ["학비", a.tuition],
    ].filter(([, v]) => v !== null && v !== undefined && v !== "");
    return `<div class="adm">
      <div class="adm-top">
        <h4><span class="tag tag-red">${esc(a.round)}</span> ${esc(a.name)}</h4>
        <span class="tag">${esc(a.category || "기타")}</span>
      </div>
      ${weightBar(a)}
      ${rows.length ? `<div class="adm-grid">${rows.map(([k, v]) => `<div><b>${k}</b>${esc(v)}</div>`).join("")}</div>` : ""}
      ${a.notes ? `<p class="note">${esc(a.notes)}</p>` : ""}
    </div>`;
  }

  function viewSchool(id) {
    const s = BY_ID[id];
    if (!s) { app.innerHTML = '<div class="empty">학과 정보를 찾을 수 없습니다. <a href="#/list">리스트로</a></div>'; return; }
    const kv = [
      ["유형", TYPE_LABEL[s.type]],
      ["지역", [s.region, s.city].filter(Boolean).join(" ")],
      ["설립", s.establishment],
      ["소속", s.college],
      ["수업연한", s.years ? s.years + "년" : null],
      ["취득 학위", s.degree],
      ["수업 방식", s.mode],
      ["기준 학년도", s.year ? s.year + "학년도" : null],
    ].filter(([, v]) => v);
    app.innerHTML = `
      <div class="breadcrumb"><a href="#/list">대학 찾기</a> › ${esc(TYPE_LABEL[s.type])} › ${esc(s.university)}</div>
      <section class="card">
        <div class="detail-head">
          <div>
            <div class="tags" style="margin-bottom:8px">${typeTag(s.type)}${s.verified ? '<span class="tag tag-college">공식자료 확인</span>' : '<span class="tag tag-warn">일부 정보 확인 필요</span>'}</div>
            <h1>${esc(s.university)}</h1>
            <div class="dept" style="font-size:1.1rem;font-weight:700;color:var(--ink-2)">${esc(s.department)}</div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${compareCheckbox(s.id)}
            ${s.admissionsUrl ? `<a class="btn btn-blue btn-sm" href="${esc(s.admissionsUrl)}" target="_blank" rel="noopener">입학처 바로가기</a>` : ""}
            ${s.website ? `<a class="btn btn-outline btn-sm" href="${esc(s.website)}" target="_blank" rel="noopener">학과 홈페이지</a>` : ""}
          </div>
        </div>
        ${s.highlights ? `<p style="margin:14px 0 0">${esc(s.highlights)}</p>` : ""}
        <dl class="kv">${kv.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
        ${(s.tracks || []).length ? `<div style="margin-top:14px"><span class="filter-label">특화 분야</span><div class="tags" style="margin-top:4px">${s.tracks.map((t) => `<span class="tag tag-4year">${esc(t)}</span>`).join("")}</div></div>` : ""}
        ${(s.careers || []).length ? `<div style="margin-top:10px"><span class="filter-label">졸업 후 진로</span><div class="tags" style="margin-top:4px">${s.careers.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div></div>` : ""}
      </section>

      <section class="section">
        <div class="section-head"><h2>입시 전형 (${(s.admissions || []).length})</h2><a class="btn btn-primary btn-sm" href="#/analyze">내 조건으로 분석하기</a></div>
        <div class="adm-list">${(s.admissions || []).map(admissionBlock).join("") || '<div class="empty card">전형 정보를 수집 중입니다. 입학처를 확인하세요.</div>'}</div>
      </section>

      <section class="section">
        <p class="notice">반영비율·모집인원·실기종목은 매년 변경됩니다. 최종 지원 전 반드시 ${s.admissionsUrl ? `<a href="${esc(s.admissionsUrl)}" target="_blank" rel="noopener">입학처 모집요강</a>` : "입학처 모집요강"}을 확인하세요. 최종 확인일: ${esc(s.lastChecked || "-")}</p>
        ${(s.sources || []).length ? `<h3 style="margin-top:16px;font-size:1rem">출처</h3><ul class="sources">${s.sources.map((u) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a></li>`).join("")}</ul>` : ""}
      </section>`;
    bindCompareBoxes();
    window.scrollTo(0, 0);
  }

  /* ---------- Wizard ---------- */
  const DEFAULT_PROFILE = {
    types: ["4year", "college"], regions: [], rounds: ["수시", "정시"],
    grade: 5.0, csatTaken: false, csatPercentile: 50,
    dan: 1, event: "겨루기", years: 5, award: 0, careers: [], special: false,
  };
  let profile = Object.assign({}, DEFAULT_PROFILE, store.get("tkd.profile", {}));
  let step = 0;
  const STEPS = ["희망 조건", "성적", "태권도 경력", "희망 진로"];

  function optionBtns(name, items, selected, multi) {
    return `<div class="options" data-opt="${name}" data-multi="${multi ? 1 : 0}">
      ${items.map(([v, label, sub]) => {
        const on = multi ? selected.includes(v) : selected === v;
        return `<button type="button" class="option" data-v="${esc(v)}" aria-pressed="${on}"><strong>${esc(label)}</strong>${sub ? `<small>${esc(sub)}</small>` : ""}</button>`;
      }).join("")}
    </div>`;
  }

  function stepBody() {
    const A = window.TKDAnalyzer;
    if (step === 0) {
      return `
        <div class="question"><span class="q">어떤 학교를 생각하고 있나요? <span class="muted small">(복수 선택)</span></span>
          ${optionBtns("types", [["4year", "4년제 대학", "학사 · 수시6+정시"], ["college", "전문대학", "2~3년제"], ["creditbank", "학점은행", "평생교육원 등"]], profile.types, true)}
        </div>
        <div class="question"><span class="q">희망 지역 <span class="muted small">(선택 안 하면 전국)</span></span>
          ${optionBtns("regions", REGIONS.filter((r) => SCHOOLS.some((s) => s.region === r) && r !== "온라인").map((r) => [r, r]), profile.regions, true)}
        </div>
        <div class="question"><span class="q">지원 시기</span>
          ${optionBtns("rounds", [["수시", "수시", "9월 원서"], ["정시", "정시", "12~1월 원서"]], profile.rounds, true)}
        </div>
        <div class="question"><span class="q">특별전형 대상자인가요?</span>
          <p class="hint">농어촌·기회균형(저소득)·특수교육대상자·특성화고·재외국민 등 정원외/특별 자격</p>
          ${optionBtns("special", [["no", "해당 없음"], ["yes", "해당됨", "특별전형도 함께 분석"]], profile.special ? "yes" : "no", false)}
        </div>`;
    }
    if (step === 1) {
      return `
        <div class="question"><label for="grade">내신 평균 등급</label>
          <p class="hint">전 과목 평균 등급(9등급제 기준). 모르면 대략적인 값으로 입력하세요.</p>
          <div class="range-wrap"><input type="range" id="grade" min="1" max="9" step="0.1" value="${profile.grade}"/><span class="range-val" id="gradeVal">${profile.grade.toFixed(1)}등급</span></div>
        </div>
        <div class="question"><span class="q">수능 응시 여부</span>
          ${optionBtns("csatTaken", [["yes", "응시함 / 응시 예정"], ["no", "응시 안 함"]], profile.csatTaken ? "yes" : "no", false)}
        </div>
        <div class="question" id="csatBox" ${profile.csatTaken ? "" : "hidden"}><label for="csat">수능(또는 모의고사) 평균 백분위</label>
          <p class="hint">국어·수학·영어·탐구 중 반영 과목 평균 백분위. 대략 3등급 ≈ 77, 4등급 ≈ 60, 5등급 ≈ 40, 6등급 ≈ 23</p>
          <div class="range-wrap"><input type="range" id="csat" min="0" max="100" step="1" value="${profile.csatPercentile}"/><span class="range-val" id="csatVal">${profile.csatPercentile}</span></div>
        </div>`;
    }
    if (step === 2) {
      return `
        <div class="question"><span class="q">보유 품/단</span>
          ${optionBtns("dan", A.DAN_LABELS.map((l, i) => [String(i), l]), String(profile.dan), false)}
        </div>
        <div class="question"><span class="q">주 종목</span>
          ${optionBtns("event", EVENTS.map((e) => [e, e]), profile.event, false)}
        </div>
        <div class="question"><label for="years">수련 기간</label>
          <div class="range-wrap"><input type="range" id="years" min="0" max="15" step="1" value="${profile.years}"/><span class="range-val" id="yearsVal">${profile.years}년${profile.years >= 15 ? "+" : ""}</span></div>
        </div>
        <div class="question"><span class="q">최고 대회 실적</span>
          ${optionBtns("award", A.AWARD_LABELS.map((l, i) => [String(i), l]), String(profile.award), false)}
        </div>`;
    }
    return `
      <div class="question"><span class="q">관심 있는 진로 <span class="muted small">(복수 선택 · 결과 정렬에 반영)</span></span>
        ${optionBtns("careers", [["지도자", "태권도 지도자·사범"], ["경호", "경호·경찰·보안"], ["교사", "체육교사"], ["선수", "선수·실업팀"], ["시범", "시범단·공연"], ["해외", "해외 사범·국제교류"]], profile.careers, true)}
      </div>
      <div class="card" style="background:var(--surface-2);box-shadow:none">
        <b>입력 요약</b>
        <p class="small" style="margin:6px 0 0">${profile.types.map((t) => TYPE_SHORT[t]).join("·") || "전체 유형"} / ${profile.regions.join("·") || "전국"} / 내신 ${profile.grade.toFixed(1)}등급 / 수능 ${profile.csatTaken ? "백분위 " + profile.csatPercentile : "미응시"} / ${A.DAN_LABELS[profile.dan]} · ${profile.event} · ${profile.years}년 / 실적: ${A.AWARD_LABELS[profile.award]}</p>
      </div>`;
  }

  function viewAnalyze() {
    const q = parseQuery();
    if (q.result === "1") return viewResult();
    app.innerHTML = `
      <div class="wizard">
        <h1>나의 입시 분석</h1>
        <p class="muted">4단계만 입력하면 지원 가능한 태권도 관련 학과와 전형별 적합도를 보여드립니다. 입력값은 이 브라우저에만 저장됩니다.</p>
        <div class="progress">${STEPS.map((_, i) => `<span class="${i <= step ? "on" : ""}"></span>`).join("")}</div>
        <div class="card">
          <div class="step-title">STEP ${step + 1} / ${STEPS.length}</div>
          <h2>${STEPS[step]}</h2>
          <div id="stepBody">${stepBody()}</div>
          <div class="wizard-nav">
            <button class="btn btn-outline" id="prev" ${step === 0 ? "disabled" : ""}>← 이전</button>
            ${step < STEPS.length - 1 ? '<button class="btn btn-blue" id="next">다음 →</button>' : '<button class="btn btn-primary" id="go">분석 결과 보기</button>'}
          </div>
        </div>
      </div>`;

    app.querySelectorAll("[data-opt]").forEach((group) => {
      const name = group.dataset.opt; const multi = group.dataset.multi === "1";
      group.querySelectorAll(".option").forEach((b) => b.addEventListener("click", () => {
        const v = b.dataset.v;
        if (multi) {
          const arr = profile[name]; const i = arr.indexOf(v);
          if (i >= 0) arr.splice(i, 1); else arr.push(v);
          b.setAttribute("aria-pressed", i < 0);
        } else {
          group.querySelectorAll(".option").forEach((x) => x.setAttribute("aria-pressed", x === b));
          if (name === "csatTaken") { profile.csatTaken = v === "yes"; app.querySelector("#csatBox").hidden = !profile.csatTaken; }
          else if (name === "dan" || name === "award") profile[name] = Number(v);
          else if (name === "special") profile.special = v === "yes";
          else profile[name] = v;
        }
        store.set("tkd.profile", profile);
      }));
    });
    const bindRange = (id, key, fmt) => {
      const el = app.querySelector("#" + id); if (!el) return;
      el.addEventListener("input", () => { profile[key] = Number(el.value); app.querySelector("#" + id + "Val").textContent = fmt(profile[key]); store.set("tkd.profile", profile); });
    };
    bindRange("grade", "grade", (v) => v.toFixed(1) + "등급");
    bindRange("csat", "csatPercentile", (v) => String(v));
    bindRange("years", "years", (v) => v + "년" + (v >= 15 ? "+" : ""));

    app.querySelector("#prev").addEventListener("click", () => { step--; viewAnalyze(); });
    const next = app.querySelector("#next");
    if (next) next.addEventListener("click", () => {
      if (step === 0 && !profile.types.length) { alert("학교 유형을 하나 이상 선택하세요."); return; }
      if (step === 0 && !profile.rounds.length) { alert("지원 시기를 하나 이상 선택하세요."); return; }
      step++; viewAnalyze();
    });
    const go = app.querySelector("#go");
    if (go) go.addEventListener("click", () => { store.set("tkd.profile", profile); location.hash = "#/analyze?result=1"; });
  }

  function viewResult() {
    const A = window.TKDAnalyzer;
    const { abilities: ab, results, strategy } = A.analyze(SCHOOLS, profile);
    const groups = ["안정", "적정", "소신", "도전", "지원불가"];
    const levelDesc = {
      "안정": "내 역량이 전형 요구 수준보다 여유 있게 높음",
      "적정": "내 역량과 전형 요구 수준이 비슷함",
      "소신": "조금 높지만 충분히 도전해볼 만함",
      "도전": "현재 기준으로는 쉽지 않음 — 실기·실적 보완 필요",
      "지원불가": "수능 미응시 등으로 현재 조건에선 지원 어려움",
    };
    const meter = (label, v) => `<div class="stat"><b>${label}</b><span>${Math.round(v)}</span><div class="meter"><i style="width:${v}%"></i></div></div>`;
    const levelFilter = store.get("tkd.levelFilter", []);

    app.innerHTML = `
      <div class="breadcrumb"><a href="#/analyze">입시 분석</a> › 결과</div>
      <div class="section-head"><h1 style="margin:0">분석 결과</h1>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn btn-outline btn-sm" href="#/analyze" id="edit">조건 수정</a><button class="btn btn-outline btn-sm" onclick="window.print()">인쇄 / PDF</button></div>
      </div>
      <section class="card">
        <h3>나의 역량 지표 <span class="muted small">(100점 환산 · 참고용)</span></h3>
        <div class="profile-summary">
          ${meter("내신(학생부)", ab.academic)}${meter("실기 역량", ab.practical)}${meter("대회 실적", ab.achievement)}${profile.csatTaken ? meter("수능", ab.csat) : ""}${meter("면접(추정)", ab.interview)}
        </div>
      </section>
      <section class="section card">
        <h3>맞춤 원서 전략</h3>
        <ul class="strategy">${strategy.map((t) => `<li>${t}</li>`).join("")}</ul>
      </section>
      <section class="section">
        <div class="section-head"><h2>추천 학과 ${results.length}곳</h2>
          <div class="chip-group" id="lvFilter">${groups.map((g) => { const n = results.filter((r) => r.best.level === g).length; return n ? `<button class="chip" data-v="${g}" aria-pressed="${levelFilter.includes(g)}">${g} ${n}</button>` : ""; }).join("")}</div>
        </div>
        <div id="resultGroups"></div>
      </section>
      <p class="notice">적합도는 입력한 정보와 전형 반영비율·공개된 경쟁률/입결을 단순 비교한 참고 지표입니다. 실기 실력·당일 컨디션·지원자 풀에 따라 결과는 크게 달라질 수 있으니 반드시 학교 모집요강과 담당 선생님 상담을 함께 활용하세요.</p>`;

    function renderGroups() {
      const sel = store.get("tkd.levelFilter", []);
      const box = app.querySelector("#resultGroups");
      if (!results.length) { box.innerHTML = '<div class="empty card">조건에 맞는 학과가 없습니다. 지역이나 유형을 넓혀보세요.</div>'; return; }
      box.innerHTML = groups.filter((g) => !sel.length || sel.includes(g)).map((g) => {
        const rs = results.filter((r) => r.best.level === g);
        if (!rs.length) return "";
        return `<div class="card section">
          <div class="group-head"><span class="level lv-${g}">${g}</span><span class="muted small">${levelDesc[g]}</span></div>
          ${rs.map((r) => {
            const b = r.best; const s = r.school;
            return `<div class="result-item">
              <div>
                <div class="tags" style="margin-bottom:4px">${typeTag(s.type)}<span class="tag">${esc(s.region)}</span>${r.careerMatch ? '<span class="tag tag-red">희망 진로 일치</span>' : ""}${b.hasData ? "" : '<span class="tag tag-warn">입결 미공개·추정</span>'}</div>
                <h4><a href="#/school/${encodeURIComponent(s.id)}">${esc(s.university)} ${esc(s.department)}</a></h4>
                <div class="small" style="margin-top:2px"><b>추천 전형:</b> ${esc(b.adm.round)} ${esc(b.adm.name)} <span class="muted">(${esc(b.adm.category || "")})</span></div>
                <div style="max-width:360px;margin-top:6px">${weightBar(b.adm, false)}</div>
              </div>
              <div class="fit"><div class="score">${b.fit}<span class="muted small">점</span></div><div class="muted small">전형 적합도</div></div>
              <p class="why">${b.reasons.map(esc).join(" · ")}${b.warnings.length ? `<br/><span style="color:var(--amber)">⚠ ${b.warnings.map(esc).join(" / ")}</span>` : ""}${r.all.length > 1 ? `<br/><span class="muted">다른 전형: ${r.all.filter((x) => x !== b).map((x) => `${esc(x.adm.name)}(${x.level})`).join(", ")}</span>` : ""}</p>
              <div style="grid-column:1/-1">${compareCheckbox(s.id)}</div>
            </div>`;
          }).join("")}
        </div>`;
      }).join("");
      bindCompareBoxes(box);
    }
    app.querySelectorAll("#lvFilter .chip").forEach((c) => c.addEventListener("click", () => {
      const sel = store.get("tkd.levelFilter", []); const v = c.dataset.v; const i = sel.indexOf(v);
      if (i >= 0) sel.splice(i, 1); else sel.push(v);
      store.set("tkd.levelFilter", sel); c.setAttribute("aria-pressed", i < 0); renderGroups();
    }));
    app.querySelector("#edit").addEventListener("click", () => { step = 0; });
    renderGroups();
    window.scrollTo(0, 0);
  }

  function viewCompare() {
    const list = compare.map((id) => BY_ID[id]).filter(Boolean);
    if (!list.length) {
      app.innerHTML = `<h1>학과 비교</h1><div class="empty card">비교할 학과가 없습니다.<br/>대학 찾기나 분석 결과에서 <b>비교</b> 체크박스를 눌러 최대 4곳을 담아보세요.<br/><br/><a class="btn btn-blue" href="#/list">대학 찾기</a></div>`;
      return;
    }
    const admSummary = (s) => (s.admissions || []).map((a) => `<div style="margin-bottom:10px"><b>${esc(a.round)} ${esc(a.name)}</b>${a.quota ? ` <span class="muted">${a.quota}명</span>` : ""}${weightBar(a)}</div>`).join("") || "-";
    const row = (label, fn) => `<tr><th scope="row">${label}</th>${list.map((s) => `<td>${fn(s) || "-"}</td>`).join("")}</tr>`;
    const practicals = (s) => [...new Set((s.admissions || []).map((a) => a.practical).filter(Boolean))].map(esc).join("<br/>");
    const rates = (s) => (s.admissions || []).filter((a) => typeof a.competitionRate === "number").map((a) => `${esc(a.name)} ${a.competitionRate}:1`).join("<br/>");
    const cuts = (s) => (s.admissions || []).filter((a) => typeof a.gradeCut === "number").map((a) => `${esc(a.name)} ${a.gradeCut}등급`).join("<br/>");
    app.innerHTML = `
      <div class="section-head"><h1 style="margin:0">학과 비교 (${list.length}/4)</h1><button class="btn btn-outline btn-sm" id="clear">모두 비우기</button></div>
      <div class="table-scroll" style="margin-top:14px">
        <table>
          <thead><tr><th></th>${list.map((s) => `<th style="min-width:220px"><a href="#/school/${encodeURIComponent(s.id)}">${esc(s.university)}</a><br/><span style="font-weight:600">${esc(s.department)}</span><br/><button class="btn btn-outline btn-sm" data-remove="${esc(s.id)}" style="margin-top:6px">빼기</button></th>`).join("")}</tr></thead>
          <tbody>
            ${row("유형", (s) => typeTag(s.type))}
            ${row("지역", (s) => esc([s.region, s.city].filter(Boolean).join(" ")))}
            ${row("설립", (s) => esc(s.establishment))}
            ${row("특화 분야", (s) => (s.tracks || []).map(esc).join(", "))}
            ${row("진로", (s) => (s.careers || []).map(esc).join(", "))}
            ${row("전형 · 반영비율", admSummary)}
            ${row("실기 종목", practicals)}
            ${row("경쟁률", rates)}
            ${row("참고 내신", cuts)}
            ${row("입학처", (s) => s.admissionsUrl ? `<a href="${esc(s.admissionsUrl)}" target="_blank" rel="noopener">바로가기</a>` : "")}
          </tbody>
        </table>
      </div>`;
    app.querySelectorAll("[data-remove]").forEach((b) => b.addEventListener("click", () => { toggleCompare(b.dataset.remove); viewCompare(); }));
    app.querySelector("#clear").addEventListener("click", () => { compare = []; store.set("tkd.compare", compare); updateCompareBadge(); viewCompare(); });
  }

  function viewGuide() {
    const cb = (D.creditbank && D.creditbank.overview) || null;
    app.innerHTML = `
      <h1>태권도학과 입시 가이드</h1>
      <p class="muted">처음 준비하는 학생을 위한 핵심 정리 (2027~2028학년도 기준 일반 일정 · 세부 일정은 대교협·각 대학 공지 확인)</p>

      <section class="section">
        <div class="section-head"><h2>연간 입시 일정</h2></div>
        <ol class="timeline">
          <li><b>3~6월</b><span>대학별 모집요강 발표 확인 · 실기 종목 확정 · 품/단 승품·승단 심사 · 대회 출전</span></li>
          <li><b>7~8월</b><span>지원 대학 압축(수시 6장) · 실기 집중 훈련 · 전문대 수시1차 준비</span></li>
          <li><b>9월</b><span><b style="color:inherit">4년제·전문대 수시1차 원서 접수</b> (4년제 수시는 최대 6회, 전문대는 횟수 제한 없음)</span></li>
          <li><b>10~11월</b><span>대학별 실기고사·면접 · 수능 · 전문대 수시2차 원서 접수(11월)</span></li>
          <li><b>12월</b><span>수시 합격자 발표 · 등록 · 12월 말 정시 원서 접수 시작</span></li>
          <li><b>1~2월</b><span>정시 실기고사 · 합격자 발표 · 추가모집</span></li>
          <li><b>상시</b><span>학점은행제 학습자 등록 및 교육기관 학기별 모집(보통 2월·8월 개강)</span></li>
        </ol>
      </section>

      <section class="section card prose">
        <h2>전형 유형 한눈에</h2>
        <h3>실기위주 전형</h3><p>태권도학과의 가장 대표적인 전형입니다. 학생부(내신) 20~40% + 실기 60~80% 구성이 많고, 실기는 품새(지정·자유), 겨루기, 시범·격파, 기본동작, 기초체력 중에서 대학별로 지정합니다.</p>
        <h3>학생부교과 전형</h3><p>내신 성적 위주로 선발합니다. 실기 부담은 적지만 내신 경쟁력이 필요합니다. 일부는 면접이나 수능최저를 함께 봅니다.</p>
        <h3>학생부종합 전형</h3><p>생활기록부(활동·출결·태권도 관련 활동)와 면접으로 평가합니다. 시범단·봉사·지도 보조 경험 등을 기록에 남겨두면 유리합니다.</p>
        <h3>특기자(경기실적) 전형</h3><p>전국대회 입상 등 경기 실적이 있는 학생 대상. 지원자격에 대회 등급·순위 조건이 붙는 경우가 많습니다.</p>
        <h3>정시(수능위주) 전형</h3><p>수능 + 실기(대학에 따라 학생부)로 선발합니다. 수능을 응시해야 지원할 수 있습니다.</p>
      </section>

      <section class="section card prose">
        <h2>실기 준비 체크리스트</h2>
        <ul>
          <li>지원 대학별 <b>실기 종목·배점·복장 규정</b>을 표로 정리하세요. 같은 "품새"라도 지정 품새가 다릅니다.</li>
          <li><b>품/단증</b>은 지원자격·가산점에 영향을 줄 수 있습니다. 국기원 품/단증을 미리 확보하세요.</li>
          <li>겨루기 전형은 체급·전자호구 사용 여부를 확인하고, 시범 전형은 발차기 높이·회전·격파 구성을 영상으로 점검하세요.</li>
          <li>공인 대회 상장은 <b>대한태권도협회 공인 여부</b>가 중요합니다.</li>
          <li>기초체력(제자리멀리뛰기, 왕복달리기 등)을 보는 대학도 있으니 함께 대비하세요.</li>
        </ul>
      </section>

      <section class="section card prose">
        <h2>학점은행제로 태권도 학위 받기</h2>
        ${cb ? `<p>${esc(cb.summary)}</p>
          ${(cb.degrees || []).length ? `<div class="table-scroll" style="margin:12px 0"><table><thead><tr><th>학위</th><th>총 학점</th><th>전공</th><th>교양</th><th>비고</th></tr></thead><tbody>${cb.degrees.map((d) => `<tr><td>${esc(d.degree)}</td><td>${esc(d.totalCredits ?? "-")}</td><td>${esc(d.majorCredits ?? "-")}</td><td>${esc(d.generalCredits ?? "-")}</td><td>${esc(d.notes || "")}</td></tr>`).join("")}</tbody></table></div>` : ""}
          ${(cb.steps || []).length ? `<h3>진행 순서</h3><ol>${cb.steps.map((x) => `<li>${esc(String(x).replace(/^\d+\.\s*/, ""))}</li>`).join("")}</ol>` : ""}
          ${(cb.creditRecognition || []).length ? `<h3>자격증·단증 학점 인정</h3><ul>${cb.creditRecognition.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
          <div class="grid grid-3" style="margin-top:12px">
            ${(cb.pros || []).length ? `<div><h3>장점</h3><ul>${cb.pros.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
            ${(cb.cons || []).length ? `<div><h3>유의할 점</h3><ul>${cb.cons.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
          </div>
          ${(cb.sources || []).length ? `<p class="small muted">출처: ${cb.sources.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a>`).join(" · ")}</p>` : ""}`
        : `<p>학점은행제는 국가평생교육진흥원이 운영하는 제도로, 평가인정 학습과목을 이수해 학점을 쌓으면 학위를 받을 수 있습니다. 학사는 140학점, 전문학사는 80학점이 필요합니다.</p>`}
        <p><a class="btn btn-outline btn-sm" href="#/list?type=creditbank">학점은행 교육기관 보기</a></p>
      </section>`;
  }

  /* ---------- Router ---------- */
  function route() {
    const hash = location.hash || "#/";
    const path = hash.slice(1).split("?")[0];
    const [, seg, arg] = path.split("/");
    document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("active", a.dataset.nav === (seg === "school" ? "list" : seg)));
    if (!seg) viewHome();
    else if (seg === "list") viewList();
    else if (seg === "school") viewSchool(decodeURIComponent(arg || ""));
    else if (seg === "analyze") viewAnalyze();
    else if (seg === "compare") viewCompare();
    else if (seg === "guide") viewGuide();
    else viewHome();
    if (seg !== "school" && seg !== "analyze") window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", route);
  updateCompareBadge();
  const stamp = document.getElementById("dataStamp");
  if (stamp) stamp.textContent = `수록: 4년제 ${(D.fouryear || []).length} · 전문대 ${(D.college || []).length} · 학점은행 ${((D.creditbank && D.creditbank.institutions) || []).length}곳 · 데이터 갱신 ${D.builtAt || "-"}`;
  route();
})();
