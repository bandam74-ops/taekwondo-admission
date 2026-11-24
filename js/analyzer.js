/* 태권도학과 입시 분석 엔진
 * 학생 프로필 → 역량 점수(0~100) → 전형별 반영비율로 적합도 계산 → 난이도 대비 안정/적정/소신/도전 판정.
 * 실제 합격 예측이 아닌 "전형 궁합" 참고 지표입니다.
 */
(function (global) {
  "use strict";

  const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

  const DAN_LABELS = ["없음", "1품/단", "2품/단", "3품/단", "4품/단 이상"];
  const AWARD_LABELS = ["없음", "시·도 대회 입상", "전국대회 출전·입상", "전국대회 메달(1~3위)", "국가대표·국제대회"];

  function abilities(p) {
    const academic = clamp(((9 - p.grade) / 8) * 100);
    const danBase = [10, 38, 55, 68, 78][p.dan] ?? 10;
    const awardBonus = [0, 6, 12, 18, 24][p.award] ?? 0;
    const practical = clamp(danBase + awardBonus + Math.min(p.years || 0, 10) * 1.2);
    const achievement = [5, 40, 60, 80, 100][p.award] ?? 5;
    const csat = p.csatTaken ? clamp(p.csatPercentile || 0) : 0;
    const interview = clamp(50 + (practical - 50) * 0.3 + (academic - 50) * 0.2);
    const documents = clamp(academic * 0.5 + achievement * 0.3 + practical * 0.2);
    return { academic, practical, achievement, csat, interview, documents };
  }

  const ELEMENT_MAP = {
    "학생부": "academic", "내신": "academic", "교과": "academic",
    "실기": "practical",
    "수능": "csat",
    "면접": "interview",
    "서류": "documents",
    "실적": "achievement", "입상실적": "achievement", "경기실적": "achievement",
  };

  function elementScore(key, ab) {
    const k = ELEMENT_MAP[key];
    if (k) return ab[k];
    // 알 수 없는 요소(기타 등)는 평균 수준으로 가정
    return (ab.academic + ab.practical) / 2;
  }

  function normElements(adm) {
    const el = adm.elements || {};
    const entries = Object.entries(el).filter(([, v]) => typeof v === "number" && v > 0);
    if (entries.length) return entries;
    // 반영비율이 없으면 전형 유형으로 추정
    switch (adm.category) {
      case "실기위주": return [["학생부", 40], ["실기", 60]];
      case "학생부교과": return [["학생부", 100]];
      case "학생부종합": return [["서류", 70], ["면접", 30]];
      case "수능위주": return [["수능", 100]];
      case "특기자": return [["실적", 60], ["실기", 40]];
      case "면접위주": return [["학생부", 40], ["면접", 60]];
      default: return [["학생부", 50], ["면접", 50]];
    }
  }

  // 입결 공개 자료가 부족한 경우를 위한 대략적 선호도 보정(지원자 규모·전통 기준의 참고값)
  const SELECTIVITY = {
    "yongin-tkd": 16, "knsu-tkd": 16, "kyunghee-tkd": 16,
    "keimyung-tkd": 6, "donga-tkd": 6, "gachon-tkd": 6, "chosun-tkd": 4, "woosuk-tkd": 4, "shinhan-tkd": 3,
  };
  const SPECIAL_RE = /기회균형|특수교육|농어촌|저소득|기초생활|차상위|장애|재외|외국인|북한이탈|서해|만학도|재직자|성인학습자|보훈|특성화고|정원외|고른기회|사회배려|다문화|군인|선취업/;

  function difficulty(school, adm, elements) {
    const typeBase = ({ "4year": 55, college: 35, creditbank: 8 }[school.type] ?? 45) + (SELECTIVITY[school.id] || 0);
    let D = typeBase;
    const w = Object.fromEntries(elements);
    const total = elements.reduce((s, [, v]) => s + v, 0) || 100;
    if (typeof adm.gradeCut === "number" && adm.gradeCut >= 1 && adm.gradeCut <= 9) {
      const dGrade = ((9 - adm.gradeCut) / 8) * 100;
      const share = (w["학생부"] || 0) / total;
      D = typeBase * (1 - Math.max(share, 0.4)) + dGrade * Math.max(share, 0.4);
    }
    if (typeof adm.csatCut === "number" && (w["수능"] || 0) > 0) {
      const share = (w["수능"] || 0) / total;
      D = D * (1 - share) + adm.csatCut * share;
    }
    if (typeof adm.competitionRate === "number") {
      D += clamp((adm.competitionRate - 4) * 1.8, -12, 18);
    }
    return clamp(D, 0, 95);
  }

  function levelOf(margin) {
    if (margin >= 12) return "안정";
    if (margin >= 0) return "적정";
    if (margin >= -12) return "소신";
    return "도전";
  }

  function hasDanRequirement(text) {
    if (!text) return false;
    return /([1-9]\s*(품|단))|품\s*\/\s*단|품·단|단증|품증|단\s*이상|품\s*이상/.test(text);
  }

  function evaluateAdmission(school, adm, profile, ab) {
    const elements = normElements(adm);
    const total = elements.reduce((s, [, v]) => s + v, 0) || 1;
    let fit = elements.reduce((s, [k, v]) => s + elementScore(k, ab) * v, 0) / total;

    const warnings = [];
    const reasons = [];
    let eligible = true;

    const w = Object.fromEntries(elements);
    const csatShare = (w["수능"] || 0) / total;
    if (csatShare > 0 && !profile.csatTaken) {
      eligible = false;
      warnings.push("수능 성적 반영 전형 — 수능 미응시 시 지원 불가");
    }
    const minText = (adm.csatMinimum || "").trim();
    if (minText && !/없음|미적용|해당\s*없|^-$/.test(minText) && !profile.csatTaken) {
      warnings.push(`수능최저 기준 있음(${minText})`);
      fit -= 10;
    }
    if (hasDanRequirement(adm.requirements) && profile.dan === 0) {
      warnings.push("지원자격에 품/단증 요구 가능 — 확인 필요");
      fit -= 15;
    }
    if (/선수|경기실적|입상|특기/.test(adm.requirements || "") && profile.award === 0) {
      warnings.push("경기 실적 관련 자격·평가 — 실적 필요 여부 확인");
      fit -= 8;
    }

    // 종목/진로 궁합 보너스
    const tracks = school.tracks || [];
    if (profile.event && tracks.some((t) => t.includes(profile.event))) {
      fit += 3;
      reasons.push(`${profile.event} 특화 학과`);
    }
    if (adm.practical && profile.event && adm.practical.includes(profile.event)) {
      fit += 2;
      reasons.push(`실기 종목에 ${profile.event} 포함`);
    }

    // 핵심 반영 요소 설명
    const top = [...elements].sort((a, b) => b[1] - a[1])[0];
    if (top) {
      const pct = Math.round((top[1] / total) * 100);
      const sc = Math.round(elementScore(top[0], ab));
      reasons.unshift(`${top[0]} ${pct}% 반영 · 내 ${top[0]} 역량 ${sc}점`);
    }
    if (typeof adm.gradeCut === "number" && (w["학생부"] || 0) > 0) {
      const gap = adm.gradeCut - profile.grade;
      reasons.push(`참고 내신 ${adm.gradeCut}등급 대비 ${gap >= 0 ? "+" : ""}${gap.toFixed(1)}`);
    }
    if (typeof adm.competitionRate === "number") reasons.push(`경쟁률 ${adm.competitionRate}:1`);

    fit = clamp(fit);
    const D = difficulty(school, adm, elements);
    const hasData = typeof adm.gradeCut === "number" || typeof adm.csatCut === "number" || typeof adm.competitionRate === "number";
    const margin = fit - D;
    let level = eligible ? levelOf(margin) : "지원불가";
    if (school.type === "creditbank" && eligible) level = "안정";

    return { school, adm, fit: Math.round(fit), difficulty: Math.round(D), margin, level, eligible, warnings, reasons, hasData };
  }

  function analyze(schools, profile) {
    const ab = abilities(profile);
    const out = [];
    for (const s of schools) {
      if (profile.types?.length && !profile.types.includes(s.type)) continue;
      if (profile.regions?.length && !profile.regions.includes(s.region) && s.region !== "온라인") continue;
      const adms = (s.admissions || []).filter((a) =>
        (!profile.rounds?.length || profile.rounds.includes(a.round) || s.type === "creditbank") &&
        (profile.special || !SPECIAL_RE.test((a.name || "") + " " + (a.requirements || "").slice(0, 60))));
      if (!adms.length) continue;
      const evals = adms.map((a) => evaluateAdmission(s, a, profile, ab));
      const eligibleEvals = evals.filter((e) => e.eligible);
      const best = (eligibleEvals.length ? eligibleEvals : evals).sort((a, b) => b.margin - a.margin)[0];
      let careerMatch = 0;
      if (profile.careers?.length) {
        const text = (s.careers || []).join(" ") + " " + (s.tracks || []).join(" ") + " " + (s.department || "");
        careerMatch = profile.careers.filter((c) => text.includes(c)).length;
      }
      out.push({ school: s, best, all: evals.sort((a, b) => b.margin - a.margin), careerMatch });
    }
    const order = { "안정": 0, "적정": 1, "소신": 2, "도전": 3, "지원불가": 4 };
    out.sort((a, b) => (order[a.best.level] - order[b.best.level]) || (b.careerMatch - a.careerMatch) || ((a.school.type === "creditbank") - (b.school.type === "creditbank")) || (b.best.margin - a.best.margin));
    return { abilities: ab, results: out, strategy: strategy(profile, ab) };
  }

  function strategy(p, ab) {
    const tips = [];
    if (ab.practical >= ab.academic + 15) tips.push("실기 역량이 내신보다 강합니다. <b>실기 반영 비율 60% 이상</b>인 실기위주 전형을 중심으로 원서를 구성하세요.");
    else if (ab.academic >= ab.practical + 15) tips.push("내신 경쟁력이 실기보다 좋습니다. <b>학생부교과·학생부 반영 비율이 높은 전형</b>을 우선 노리고, 실기는 기본기 위주로 안정적으로 준비하세요.");
    else tips.push("내신과 실기가 균형적입니다. 학생부와 실기를 함께 보는 <b>실기위주(학생부 30~40%) 전형</b>이 가장 유리합니다.");
    if (p.dan === 0) tips.push("아직 품/단증이 없다면 <b>1품(단) 취득이 최우선</b>입니다. 상당수 대학이 지원자격이나 실기 평가에서 품/단을 요구하거나 우대합니다.");
    if (p.award === 0) tips.push("경기 실적이 없다면 남은 기간 <b>시·도 협회장기 등 공인 대회 출전</b>으로 실적을 만들어 두세요. 특기자·실적 반영 전형 선택지가 넓어집니다.");
    if (p.award >= 3) tips.push("전국 단위 메달 실적이 있습니다. <b>특기자·경기실적 반영 전형</b>을 반드시 확인하세요 — 일반 실기전형보다 유리할 수 있습니다.");
    if (p.csatTaken && p.csatPercentile >= 55) tips.push("수능 성적이 활용 가능한 수준입니다. <b>정시(수능+실기) 전형</b>을 추가 카드로 활용하세요.");
    if (!p.csatTaken) tips.push("수능을 보지 않는다면 <b>수시 6장</b>과 전문대 수시(횟수 제한 없음)에 집중하세요. 수능최저가 있는 전형은 피하는 것이 안전합니다.");
    tips.push("원서는 <b>안정 2 · 적정 2 · 소신 2</b> 비율로 분산하고, 전문대·학점은행을 안전망으로 함께 고려하세요.");
    return tips;
  }

  global.TKDAnalyzer = { analyze, abilities, DAN_LABELS, AWARD_LABELS, normElements };
})(window);
