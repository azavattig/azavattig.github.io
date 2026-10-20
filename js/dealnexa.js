// DealNexa demo: replays a saved diligence review (data/dealnexa/report.json) of a fictional
// sample data room, then runs DealNexa's deterministic risk-scoring and LBO engines live
// (js/dealnexa-engines.js). Nothing here calls an AI model.
(function () {
  const DATA_URL = "data/dealnexa/report.json";
  const SVG_NS = "http://www.w3.org/2000/svg";
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const Engines = window.DealNexaEngines;

  const SEVERITY = {
    CRITICAL: { label: "Critical", icon: "!!", colorVar: "--status-critical" },
    HIGH: { label: "High", icon: "!", colorVar: "--status-serious" },
    MEDIUM: { label: "Medium", icon: "•", colorVar: "--status-warning" },
  };
  const BANDS = {
    red: { label: "High Risk", colorVar: "--status-critical", icon: "!!" },
    orange: { label: "Structured Deal Required", colorVar: "--status-serious", icon: "!" },
    yellow: { label: "Acceptable", colorVar: "--status-warning", icon: "•" },
    green: { label: "Strong Target", colorVar: "--status-good", icon: "✓" },
  };
  const MODULE_LABELS = {
    financial_performance: "Financial performance (25%)",
    revenue_quality: "Revenue quality (20%)",
    liquidity_solvency: "Liquidity & solvency (15%)",
    legal_contractual: "Legal & contractual (15%)",
    operational_scalability: "Operational scalability (15%)",
    strategic_fit: "Strategic fit (10%)",
  };
  const CLAUSE_LABELS = {
    indemnification: "Indemnification", liability_caps: "Liability caps", change_of_control: "Change of control",
    assignment: "Assignment", termination_asymmetry: "Termination asymmetry", unilateral_pricing: "Unilateral pricing",
    audit_rights: "Audit rights", injunctive_relief: "Injunctive relief", auto_renewals: "Auto-renewals", mfn: "Most-favoured nation",
  };

  let report = null;

  // ---- helpers -------------------------------------------------------------

  const $ = (id) => document.getElementById(id);
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, prefersReducedMotion ? 0 : ms));

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function money(value, digits = 0) {
    const sign = value < 0 ? "−" : "";
    return `${sign}$${Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
  }

  function millions(value, digits = 2) {
    const sign = value < 0 ? "−" : "";
    return `${sign}$${(Math.abs(value) / 1e6).toFixed(digits)}M`;
  }

  function svgEl(name, attrs = {}, parent) {
    const el = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
    if (parent) parent.appendChild(el);
    return el;
  }

  function withTitle(el, text) {
    svgEl("title", {}, el).textContent = text;
    return el;
  }

  function severityBadge(severity) {
    const s = SEVERITY[severity];
    return `<span class="dn-badge" style="--badge: var(${s.colorVar})"><span class="dn-badge__icon" aria-hidden="true">${s.icon}</span>${s.label}</span>`;
  }

  // ---- guided replay ---------------------------------------------------------

  function renderPipeline() {
    $("dn-steps").replaceChildren(...report.engine.pipeline.map((step) => {
      const li = document.createElement("li");
      li.className = "dn-step";
      li.innerHTML = `<span class="dn-step__mark" aria-hidden="true"></span><span>${escapeHtml(step)}</span>`;
      return li;
    }));
    $("dn-docs").replaceChildren(...report.dd_report.documents_reviewed.map((doc) => {
      const li = document.createElement("li");
      li.className = "dn-doc";
      li.title = doc.category;
      li.textContent = doc.document.replace(/\.docx$/, "").replace(/^\d+_/, "").replace(/_/g, " ");
      return li;
    }));
  }

  function setStep(index, state) {
    const step = $("dn-steps").children[index];
    if (step) step.dataset.state = state;
  }

  let isSkipping = false;
  async function runReplay() {
    $("dn-run").disabled = true;
    $("dn-skip").hidden = prefersReducedMotion;
    const docs = [...$("dn-docs").children];
    const steps = report.engine.pipeline;
    for (let i = 0; i < steps.length && !isSkipping; i++) {
      setStep(i, "running");
      if (i === 0) {
        for (const doc of docs) {
          if (isSkipping) break;
          doc.classList.add("is-read");
          await wait(90);
        }
      } else {
        await wait(i === 1 || i === 2 ? 1100 : 600);
      }
      setStep(i, "done");
    }
    finishReplay();
  }

  function finishReplay() {
    [...$("dn-docs").children].forEach((doc) => doc.classList.add("is-read"));
    report.engine.pipeline.forEach((_, i) => setStep(i, "done"));
    $("dn-skip").hidden = true;
    $("dn-run").textContent = "review complete";
    if (!$("dn-results").hidden) return;
    $("dn-results").hidden = false;
    renderAllPanels();
  }

  // ---- findings ------------------------------------------------------------

  const flagFilter = { severity: "ALL", section: "ALL" };

  function renderFindings() {
    const dd = report.dd_report;
    $("dn-summary").innerHTML = dd.executive_summary_paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
    $("dn-snapshot").innerHTML = dd.financial_snapshot.map((item) => `<div class="pv-kpi">
      <span class="pv-kpi__label">${escapeHtml(item.metric)}</span><span class="pv-kpi__value">${escapeHtml(item.value)}</span></div>`).join("");

    const counts = { ALL: dd.flags.length };
    for (const flag of dd.flags) counts[flag.severity] = (counts[flag.severity] || 0) + 1;
    const severityPicker = $("dn-severity");
    severityPicker.innerHTML = ["ALL", "CRITICAL", "HIGH", "MEDIUM"].map((key) =>
      `<button type="button" role="radio" data-severity="${key}" aria-checked="${key === flagFilter.severity}">
        ${key === "ALL" ? "All" : SEVERITY[key].label} (${counts[key] || 0})</button>`).join("");
    severityPicker.onclick = (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      flagFilter.severity = button.dataset.severity;
      severityPicker.querySelectorAll("button").forEach((b) => b.setAttribute("aria-checked", String(b === button)));
      renderFlagList();
    };
    const sections = [...new Set(dd.flags.map((f) => f.section))];
    $("dn-section").innerHTML = `<option value="ALL">All areas</option>` +
      sections.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s.replace(" Due Diligence", ""))}</option>`).join("");
    $("dn-section").onchange = (event) => {
      flagFilter.section = event.target.value;
      renderFlagList();
    };
    renderFlagList();
  }

  function renderFlagList() {
    const flags = report.dd_report.flags.filter((f) =>
      (flagFilter.severity === "ALL" || f.severity === flagFilter.severity) &&
      (flagFilter.section === "ALL" || f.section === flagFilter.section));
    $("dn-flags").innerHTML = flags.length ? flags.map((f) => `<details class="dn-flag" style="--flag: var(${SEVERITY[f.severity].colorVar})">
      <summary>
        <span class="dn-flag__top">${severityBadge(f.severity)}<span class="dn-flag__id">${f.id}</span><span class="dn-flag__area">${escapeHtml(f.area)}</span></span>
        <span class="dn-flag__summary">${escapeHtml(f.summary)}</span>
      </summary>
      <div class="dn-flag__body">
        <p class="dn-flag__where">${escapeHtml(f.section)} · ${escapeHtml(f.subsection)}</p>
        ${f.detail.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}
        <p class="dn-flag__action"><strong>Action before LOI.</strong> ${escapeHtml(f.action_required)}</p>
      </div>
    </details>`).join("") : `<p class="dn-empty">No flags match this filter.</p>`;
  }

  // ---- quality of earnings bridge -------------------------------------------

  function renderBridge() {
    const q = report.qoe;
    const steps = [{ label: "Reported EBITDA", total: q.reported_ebitda }];
    let running = q.reported_ebitda;
    for (const item of q.management) {
      steps.push({ label: item.label, delta: item.amount, from: running, source: item.source });
      running += item.amount;
    }
    steps.push({ label: "Management-adjusted", total: running });
    for (const item of q.diligence) {
      steps.push({ label: item.label, delta: item.amount, from: running, source: item.source });
      running += item.amount;
    }
    steps.push({ label: "Diligence-adjusted", total: running });

    const svg = $("dn-bridge");
    svg.replaceChildren();
    const width = svg.clientWidth || 640;
    const isNarrow = width < 560;
    const labelHeight = isNarrow ? 0 : 46;
    const height = 260 + labelHeight;
    const left = 44;
    const top = 22;
    const bottom = 20 + labelHeight;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("height", height);
    // A bridge's steps are small next to the totals, so the axis starts at $1.6M (labelled).
    const lo = 1600000;
    const hi = 2100000;
    const yOf = (v) => top + (1 - (v - lo) / (hi - lo)) * (height - top - bottom);
    for (let v = lo; v <= hi; v += 100000) {
      svgEl("line", { x1: left, x2: width, y1: yOf(v), y2: yOf(v), class: "pv-grid" }, svg);
      svgEl("text", { x: left - 6, y: yOf(v) + 4, class: "pv-axis-label", "text-anchor": "end" }, svg).textContent = (v / 1000).toLocaleString("en-US");
    }
    svgEl("text", { x: left, y: 12, class: "pv-axis-label" }, svg).textContent = "Axis starts at $1.6M";
    const slot = (width - left) / steps.length;
    const barWidth = Math.min(64, slot * 0.62);
    steps.forEach((step, i) => {
      const x = left + slot * i + (slot - barWidth) / 2;
      const isTotal = step.total !== undefined;
      const from = isTotal ? lo : step.from;
      const to = isTotal ? step.total : step.from + step.delta;
      const y = yOf(Math.max(from, to));
      const barHeight = Math.max(2, Math.abs(yOf(from) - yOf(to)));
      const fill = isTotal ? cssVar("--dn-total") : step.delta > 0 ? cssVar("--viz-1") : cssVar("--viz-2");
      const rect = svgEl("rect", { x, y, width: barWidth, height: barHeight, rx: 4, fill }, svg);
      const thousands = (v) => (v / 1000).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      const value = isTotal ? thousands(step.total) : `${step.delta > 0 ? "+" : "−"}${thousands(Math.abs(step.delta))}`;
      withTitle(rect, `${step.label}: ${isTotal ? money(step.total) : money(step.delta)}${step.source ? ` (${step.source})` : ""}`);
      if (isTotal || !isNarrow) {
        svgEl("text", { x: x + barWidth / 2, y: y - 6, class: "pv-value-label", "text-anchor": "middle" }, svg).textContent = value;
      }
      if (!isTotal && i < steps.length - 1) {
        svgEl("line", { x1: x + barWidth, x2: x + slot, y1: yOf(to), y2: yOf(to), class: "dn-connector" }, svg);
      }
      if (!isNarrow) {
        const label = svgEl("text", { x: x + barWidth / 2, y: height - labelHeight + 4, class: "pv-axis-label", "text-anchor": "middle" }, svg);
        wrapLabel(label, isTotal ? step.label : shortLabel(step.label), slot - 6);
      }
    });
    // On small screens the step labels move out of the chart into a list below it.
    $("dn-bridge-list").innerHTML = isNarrow ? steps.map((s) => `<li><span>${escapeHtml(s.label)}</span>
      <strong>${s.total !== undefined ? money(s.total) : money(s.delta)}</strong></li>`).join("") : "";

    $("dn-pending").innerHTML = q.pending.map((item) => `<li>
      <span>${escapeHtml(item.label)}</span>
      <span class="dn-pending__amount">${item.amount === null ? "not quantified" : money(item.amount)}</span>
      <span class="dn-pending__source">${escapeHtml(item.source)}</span></li>`).join("");
  }

  function shortLabel(label) {
    return label.split(" (")[0].replace("Personal-use add-back cut to documented estimate", "Personal-use cut");
  }

  function wrapLabel(textEl, text, maxWidth) {
    const words = text.split(" ");
    let line = [];
    const maxChars = Math.max(8, Math.floor(maxWidth / 6.2));
    const lines = [];
    for (const word of words) {
      if ([...line, word].join(" ").length > maxChars && line.length) {
        lines.push(line.join(" "));
        line = [word];
      } else line.push(word);
    }
    if (line.length) lines.push(line.join(" "));
    lines.slice(0, 3).forEach((text, i) => {
      const tspan = svgEl("tspan", { x: textEl.getAttribute("x"), dy: i === 0 ? 0 : 13 }, textEl);
      tspan.textContent = text;
    });
  }

  // ---- risk score ------------------------------------------------------------

  let scoreState = null;

  function defaultScoreState() {
    const metrics = Object.fromEntries(Object.entries(report.scoring_metrics).map(([k, v]) => [k, v.value]));
    metrics.operating_leverage = metrics.operating_leverage_declining ? "declining" : "flat";
    metrics.strategic_cost_synergy = "none";
    metrics.strategic_adjacency = "none";
    metrics.strategic_tech = "none";
    metrics.platform_potential = false;
    return { metrics, resolved: new Set() };
  }

  const SCORE_CONTROLS = [
    { group: "Financial performance", items: [
      { key: "revenue_cagr", label: "Revenue CAGR", type: "range", min: 0, max: 40, step: 0.1, unit: "%" },
      { key: "gross_margin", label: "Gross margin", type: "range", min: 0, max: 80, step: 0.1, unit: "%" },
      { key: "ebitda_margin", label: "EBITDA margin", type: "range", min: -10, max: 30, step: 0.1, unit: "%" },
    ] },
    { group: "Revenue quality", items: [
      { key: "top_customer_pct", label: "Largest customer share", type: "range", min: 0, max: 60, step: 0.5, unit: "%" },
      { key: "revenue_under_dispute_pct", label: "Revenue under dispute", type: "range", min: 0, max: 10, step: 0.1, unit: "%" },
    ] },
    { group: "Legal & contractual", items: [
      { key: "active_disputes", label: "Active disputes", type: "range", min: 0, max: 12, step: 1 },
      { key: "contract_inconsistencies", label: "Contract inconsistencies", type: "range", min: 0, max: 8, step: 1 },
      { key: "active_litigation", label: "Lawsuits filed", type: "range", min: 0, max: 3, step: 1 },
      { key: "compliance_flags", label: "Open compliance issues", type: "range", min: 0, max: 3, step: 1 },
    ] },
    { group: "Operational scalability", items: [
      { key: "margin_trend", label: "Margin trend", type: "select", options: [["improving", "Improving"], ["stable", "Stable"], ["compressing", "Compressing"], ["compressing_2plus_years", "Compressing 2+ years"]] },
      { key: "operating_leverage", label: "Operating leverage", type: "select", options: [["improving", "Improving"], ["flat", "Flat"], ["declining", "Declining"]] },
      { key: "revenue_per_employee", label: "Revenue per employee", type: "range", min: 50000, max: 700000, step: 5000, unit: "$" },
    ] },
    { group: "Strategic fit (depends on the buyer)", items: [
      { key: "strategic_cost_synergy", label: "Cost synergies", type: "select", options: [["none", "Not assessed"], ["low", "Low"], ["medium", "Medium"], ["high", "High"]] },
      { key: "strategic_adjacency", label: "Market adjacency", type: "select", options: [["none", "Not assessed"], ["low", "Low"], ["high", "High"]] },
      { key: "strategic_tech", label: "Systems integration", type: "select", options: [["none", "Not assessed"], ["easy", "Easy"], ["complex", "Complex"]] },
      { key: "platform_potential", label: "Platform for add-ons", type: "checkbox" },
    ] },
    { group: "Valuation", items: [
      { key: "base_multiple", label: "Base EV/EBITDA multiple", type: "range", min: 3, max: 10, step: 0.25, unit: "x" },
    ] },
  ];

  function formatControlValue(item, value) {
    if (item.unit === "%") return `${Number(value).toFixed(1)}%`;
    if (item.unit === "$") return money(Number(value));
    if (item.unit === "x") return `${Number(value).toFixed(2)}x`;
    return String(value);
  }

  function engineMetrics(state) {
    const m = { ...state.metrics };
    m.operating_leverage_improving = m.operating_leverage === "improving";
    m.operating_leverage_declining = m.operating_leverage === "declining";
    if (m.strategic_cost_synergy !== "none") m.cost_synergy_potential = m.strategic_cost_synergy;
    if (m.strategic_adjacency !== "none") m.market_adjacency = m.strategic_adjacency;
    if (m.strategic_tech !== "none") m.tech_integration = m.strategic_tech;
    return m;
  }

  function renderScoreControls() {
    const form = $("dn-controls");
    const basis = report.scoring_metrics;
    const groups = SCORE_CONTROLS.map(({ group, items }) => `<fieldset class="dn-fieldset"><legend>${escapeHtml(group)}</legend>
      ${items.map((item) => {
        const value = scoreState.metrics[item.key];
        const note = basis[item.key] ? `<span class="dn-control__note">Source: ${escapeHtml(basis[item.key].basis)}</span>` : "";
        if (item.type === "range") {
          return `<label class="dn-control"><span class="dn-control__row"><span>${item.label}</span><output>${formatControlValue(item, value)}</output></span>
            <input type="range" name="${item.key}" min="${item.min}" max="${item.max}" step="${item.step}" value="${value}">${note}</label>`;
        }
        if (item.type === "select") {
          return `<label class="dn-control"><span class="dn-control__row"><span>${item.label}</span></span>
            <select name="${item.key}">${item.options.map(([v, l]) => `<option value="${v}"${v === value ? " selected" : ""}>${l}</option>`).join("")}</select>${note}</label>`;
        }
        return `<label class="dn-control dn-control--check"><input type="checkbox" name="${item.key}"${value ? " checked" : ""}> ${item.label}</label>`;
      }).join("")}</fieldset>`).join("");

    const serious = report.dd_report.flags.filter((f) => f.severity === "CRITICAL" || f.severity === "HIGH");
    const flagBoxes = `<fieldset class="dn-fieldset dn-fieldset--flags"><legend>Critical and high flags</legend>
      <p class="dn-control__note">The engine treats open critical and high flags as red flags. Tick one to mark it resolved in diligence.</p>
      ${serious.map((f) => `<label class="dn-control dn-control--check"><input type="checkbox" name="resolved" value="${f.id}"${scoreState.resolved.has(f.id) ? " checked" : ""}>
        ${f.id} ${escapeHtml(f.area)}</label>`).join("")}</fieldset>`;
    form.innerHTML = groups + flagBoxes + `<button class="pill pill--soft dn-reset" type="button" id="dn-score-reset">reset to the documents</button>`;

    form.oninput = (event) => {
      const input = event.target;
      if (input.name === "resolved") {
        if (input.checked) scoreState.resolved.add(input.value);
        else scoreState.resolved.delete(input.value);
      } else if (input.type === "checkbox") {
        scoreState.metrics[input.name] = input.checked;
      } else if (input.type === "range") {
        scoreState.metrics[input.name] = Number(input.value);
        const item = SCORE_CONTROLS.flatMap((g) => g.items).find((i) => i.key === input.name);
        input.closest("label").querySelector("output").textContent = formatControlValue(item, input.value);
      } else {
        scoreState.metrics[input.name] = input.value;
      }
      renderScore();
    };
    $("dn-score-reset").onclick = () => {
      scoreState = defaultScoreState();
      renderScoreControls();
      renderScore();
    };
  }

  function renderScore() {
    const redFlags = report.dd_report.flags
      .filter((f) => (f.severity === "CRITICAL" || f.severity === "HIGH") && !scoreState.resolved.has(f.id))
      .map((f) => ({ title: f.area }));
    const result = Engines.calculateDealRiskScore({ metrics: engineMetrics(scoreState), redFlags });
    const band = BANDS[result.color];
    const v = result.valuation_impact;
    $("dn-score-head").innerHTML = `
      <div class="dn-score__number"><span>${result.overall_score}</span><small>/100</small></div>
      <p class="dn-score__band"><span class="dn-badge" style="--badge: var(${band.colorVar})"><span class="dn-badge__icon" aria-hidden="true">${band.icon}</span>${band.label}</span></p>
      <p class="dn-score__meaning">${escapeHtml(result.meaning)}. Recommended: ${escapeHtml(result.action.toLowerCase())}.</p>
      <p class="dn-score__valuation">Valuation: <strong>${v.base_multiple.toFixed(1)}x</strong> base → <strong>${v.risk_adjusted_multiple.toFixed(1)}x</strong> risk-adjusted
        (${v.total_adjustment < 0 ? "−" : "+"}${Math.abs(v.total_adjustment).toFixed(1)}x, about ${v.implied_price_reduction_pct}% off the price).</p>`;
    renderModuleBars(result);
  }

  function renderModuleBars(result) {
    const svg = $("dn-modules");
    svg.replaceChildren();
    const width = svg.clientWidth || 420;
    const labelWidth = Math.min(200, width * 0.42);
    const valueWidth = 34;
    const rowHeight = 34;
    const entries = Object.entries(result.module_scores);
    const height = entries.length * rowHeight + 18;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("height", height);
    const plot = width - labelWidth - valueWidth - 8;
    const xOf = (score) => labelWidth + (score / 100) * plot;
    for (const threshold of [50, 65, 80]) {
      svgEl("line", { x1: xOf(threshold), x2: xOf(threshold), y1: 0, y2: height - 18, class: "dn-threshold" }, svg);
      svgEl("text", { x: xOf(threshold), y: height - 4, class: "pv-axis-label", "text-anchor": "middle" }, svg).textContent = threshold;
    }
    entries.forEach(([key, score], i) => {
      const y = i * rowHeight + 6;
      const color = score >= 80 ? "green" : score >= 65 ? "yellow" : score >= 50 ? "orange" : "red";
      svgEl("text", { x: labelWidth - 10, y: y + 14, class: "pv-axis-label", "text-anchor": "end" }, svg).textContent = MODULE_LABELS[key];
      svgEl("rect", { x: labelWidth, y, width: plot, height: 18, rx: 4, class: "dn-track" }, svg);
      const bar = svgEl("rect", { x: labelWidth, y, width: Math.max(3, xOf(score) - labelWidth), height: 18, rx: 4, fill: cssVar(BANDS[color].colorVar) }, svg);
      const adjustment = result.module_adjustments[key];
      withTitle(bar, `${MODULE_LABELS[key]}: ${score} (${BANDS[color].label}); multiple ${adjustment >= 0 ? "+" : ""}${adjustment.toFixed(2)}x`);
      svgEl("text", { x: xOf(score) + 6, y: y + 14, class: "pv-value-label" }, svg).textContent = score;
    });
  }

  // ---- LBO ---------------------------------------------------------------------

  let lboState = null;

  function ebitdaOptions() {
    const q = report.qoe;
    const management = q.reported_ebitda + q.management.reduce((s, i) => s + i.amount, 0);
    const diligence = management + q.diligence.reduce((s, i) => s + i.amount, 0);
    const confirmed = diligence + q.pending[0].amount;
    return [
      ["diligence", "Diligence-adjusted", diligence],
      ["management", "Management-adjusted", management],
      ["reported", "Reported", q.reported_ebitda],
      ["confirmed", "If the maintenance overstatement is confirmed", confirmed],
    ];
  }

  const LBO_CONTROLS = [
    { key: "entry_multiple", label: "Entry multiple", min: 3, max: 8, step: 0.25, unit: "x" },
    { key: "exit_multiple", label: "Exit multiple", min: 3, max: 8, step: 0.25, unit: "x" },
    { key: "leverage_x", label: "Debt at entry (x EBITDA)", min: 0, max: 4.5, step: 0.25, unit: "x" },
    { key: "interest_rate", label: "Interest rate", min: 0.05, max: 0.14, step: 0.0025, unit: "pct" },
    { key: "ebitda_growth", label: "EBITDA growth per year", min: -0.05, max: 0.1, step: 0.005, unit: "pct" },
    { key: "hold_years", label: "Hold period", min: 3, max: 7, step: 1, unit: "yrs" },
  ];

  function formatLbo(item, value) {
    if (item.unit === "x") return `${Number(value).toFixed(2)}x`;
    if (item.unit === "pct") return `${(Number(value) * 100).toFixed(1)}%`;
    return `${value} years`;
  }

  function renderLboControls() {
    const form = $("dn-lbo-controls");
    form.innerHTML = `<label class="dn-control"><span class="dn-control__row"><span>Entry EBITDA</span></span>
      <select name="ebitda_case">${ebitdaOptions().map(([key, label, value]) => `<option value="${key}"${key === lboState.ebitda_case ? " selected" : ""}>${label} (${millions(value)})</option>`).join("")}</select></label>` +
      LBO_CONTROLS.map((item) => `<label class="dn-control"><span class="dn-control__row"><span>${item.label}</span><output>${formatLbo(item, lboState.inputs[item.key])}</output></span>
        <input type="range" name="${item.key}" min="${item.min}" max="${item.max}" step="${item.step}" value="${lboState.inputs[item.key]}"></label>`).join("") +
      `<button class="pill pill--soft dn-reset" type="button" id="dn-lbo-reset">reset to base case</button>`;
    form.oninput = (event) => {
      const input = event.target;
      if (input.name === "ebitda_case") {
        lboState.ebitda_case = input.value;
      } else {
        lboState.inputs[input.name] = Number(input.value);
        const item = LBO_CONTROLS.find((i) => i.key === input.name);
        input.closest("label").querySelector("output").textContent = formatLbo(item, input.value);
      }
      renderLbo();
    };
    $("dn-lbo-reset").onclick = () => {
      lboState = defaultLboState();
      renderLboControls();
      renderLbo();
    };
    $("dn-lbo-assumptions").innerHTML = report.lbo.assumptions.map((a) => `<li>${escapeHtml(a)}</li>`).join("") +
      `<li>Base case checked against DealNexa's Python LBO engine: MOIC ${report.lbo.reference.returns.moic.toFixed(2)}x, IRR ${(report.lbo.reference.returns.irr * 100).toFixed(1)}%.</li>`;
  }

  function defaultLboState() {
    return { ebitda_case: "diligence", inputs: { ...report.lbo.inputs } };
  }

  function renderLbo() {
    const entryEbitda = ebitdaOptions().find(([key]) => key === lboState.ebitda_case)[2];
    let result;
    try {
      result = Engines.runLbo({ ...lboState.inputs, entry_ebitda: entryEbitda });
    } catch (error) {
      $("dn-lbo-kpis").innerHTML = `<p class="pv-kpi-note">${escapeHtml(error.message)}</p>`;
      $("dn-debt").replaceChildren();
      $("dn-attribution").replaceChildren();
      return;
    }
    const su = result.sources_uses;
    const irr = result.returns.irr;
    $("dn-lbo-kpis").innerHTML = [
      ["MOIC", `${result.returns.moic.toFixed(2)}x`, `exit equity ${millions(result.exit.equity)}`],
      ["IRR", irr === null ? "n/a" : `${(irr * 100).toFixed(1)}%`, `over ${lboState.inputs.hold_years} years`],
      ["Equity check", millions(su.equity_entry), `debt ${millions(su.debt_entry)}`],
      ["Purchase price", millions(su.ev_entry), `${lboState.inputs.entry_multiple.toFixed(2)}x ${millions(entryEbitda)} EBITDA`],
    ].map(([label, value, note]) => `<div class="pv-kpi"><span class="pv-kpi__label">${label}</span>
      <span class="pv-kpi__value">${value}</span><span class="pv-kpi__delta">${note}</span></div>`).join("");
    renderDebtChart(result);
    renderAttribution(result);
  }

  function renderDebtChart(result) {
    const svg = $("dn-debt");
    svg.replaceChildren();
    const width = svg.clientWidth || 400;
    const height = 170;
    const left = 40;
    const top = 18;
    const bottom = 24;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("height", height);
    const values = [result.sources_uses.debt_entry, ...result.periods.map((p) => p.debt_close)];
    const max = Math.max(...values, 1);
    const yOf = (v) => top + (1 - v / max) * (height - top - bottom);
    svgEl("line", { x1: left, x2: width, y1: yOf(0), y2: yOf(0), class: "pv-grid" }, svg);
    const slot = (width - left) / values.length;
    const barWidth = Math.min(38, slot * 0.6);
    values.forEach((v, i) => {
      const x = left + slot * i + (slot - barWidth) / 2;
      const r = Math.min(4, (yOf(0) - yOf(v)) / 2);
      const y = yOf(v);
      const bar = svgEl("path", {
        d: `M${x},${yOf(0)} V${y + r} Q${x},${y} ${x + r},${y} H${x + barWidth - r} Q${x + barWidth},${y} ${x + barWidth},${y + r} V${yOf(0)} Z`,
        fill: cssVar("--viz-1"),
      }, svg);
      withTitle(bar, `${i === 0 ? "Entry" : `End of year ${i}`}: ${millions(v)}`);
      svgEl("text", { x: x + barWidth / 2, y: height - 6, class: "pv-axis-label", "text-anchor": "middle" }, svg).textContent = i === 0 ? "Entry" : `Y${i}`;
      if (i === 0 || i === values.length - 1) {
        svgEl("text", { x: x + barWidth / 2, y: y - 5, class: "pv-value-label", "text-anchor": "middle" }, svg).textContent = millions(v, 1);
      }
    });
  }

  function renderAttribution(result) {
    const svg = $("dn-attribution");
    svg.replaceChildren();
    const labels = { ebitda_growth: "EBITDA growth", multiple_expansion: "Multiple change", cross: "Growth × multiple", debt_paydown: "Debt paydown", fees_and_cash: "Fees and cash left in" };
    const entries = Object.entries(result.attribution).filter(([, v]) => Math.abs(v) > 1);
    const width = svg.clientWidth || 400;
    const labelWidth = 130;
    const rowHeight = 28;
    const height = entries.length * rowHeight + 8;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("height", height);
    const maxAbs = Math.max(...entries.map(([, v]) => Math.abs(v)), 1);
    const hasNegative = entries.some(([, v]) => v < 0);
    const plot = width - labelWidth - 70;
    const zeroX = labelWidth + (hasNegative ? plot * 0.3 : 0);
    const scale = (hasNegative ? plot * 0.7 : plot) / maxAbs;
    svgEl("line", { x1: zeroX, x2: zeroX, y1: 0, y2: height, class: "pv-grid" }, svg);
    entries.forEach(([key, v], i) => {
      const y = i * rowHeight + 5;
      svgEl("text", { x: labelWidth - 10, y: y + 13, class: "pv-axis-label", "text-anchor": "end" }, svg).textContent = labels[key] || key;
      const barWidth = Math.max(2, Math.abs(v) * scale);
      const x = v >= 0 ? zeroX : zeroX - barWidth;
      const bar = svgEl("rect", { x, y, width: barWidth, height: 18, rx: 4, fill: v >= 0 ? cssVar("--viz-1") : cssVar("--viz-2") }, svg);
      withTitle(bar, `${labels[key] || key}: ${millions(v)}`);
      svgEl("text", { x: v >= 0 ? x + barWidth + 6 : zeroX + 6, y: y + 13, class: "pv-value-label" }, svg).textContent = millions(v, 2);
    });
  }

  // ---- clauses and next steps --------------------------------------------------

  function renderNext() {
    $("dn-clauses").innerHTML = Object.entries(report.detected_clauses).map(([key, c]) => `<li class="dn-clause${c.detected ? " is-found" : ""}">
      <span class="dn-clause__name">${CLAUSE_LABELS[key] || key}</span>
      <span class="dn-clause__status">${c.detected ? `Found · ${c.risk} risk` : "Not found"}</span>
      ${c.detected ? `<ul class="dn-clause__snippets">${c.snippets.map((s) => `<li>“${escapeHtml(s)}”</li>`).join("")}</ul>` : ""}</li>`).join("");
    $("dn-next").innerHTML = report.dd_report.next_steps.map((group) => `<div class="dn-next__group">
      <p>${severityBadge(group.severity)} <strong>${escapeHtml(group.category)}</strong></p>
      <ul>${group.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>`).join("");
  }

  // ---- tabs and start-up -------------------------------------------------------

  function wireTabs() {
    const tabs = [...document.querySelectorAll(".dn-tabs [role=tab]")];
    const select = (tab) => {
      tabs.forEach((t) => {
        const isActive = t === tab;
        t.setAttribute("aria-selected", String(isActive));
        t.tabIndex = isActive ? 0 : -1;
        $(t.getAttribute("aria-controls")).hidden = !isActive;
      });
      // Charts measure their width, so draw them once their panel is visible.
      if (tab.id === "tab-qoe") renderBridge();
      if (tab.id === "tab-score") renderScore();
      if (tab.id === "tab-lbo") renderLbo();
    };
    tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => select(tab));
      tab.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
        const next = tabs[(i + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
        select(next);
        next.focus();
      });
    });
  }

  function renderAllPanels() {
    renderFindings();
    scoreState = defaultScoreState();
    renderScoreControls();
    lboState = defaultLboState();
    renderLboControls();
    renderNext();
  }

  async function init() {
    try {
      const response = await fetch(DATA_URL, { cache: "no-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      report = await response.json();
    } catch (error) {
      console.error("DealNexa demo failed to load:", error);
      $("dn-pipeline").innerHTML = '<p class="pv-kpi-note">The demo data could not be loaded. Please refresh the page.</p>';
      $("dn-run").disabled = true;
      return;
    }
    renderPipeline();
    wireTabs();
    $("dn-run").addEventListener("click", runReplay);
    $("dn-skip").addEventListener("click", () => {
      isSkipping = true;
    });

    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if ($("dn-results").hidden) return;
        if (!$("panel-qoe").hidden) renderBridge();
        if (!$("panel-score").hidden) renderScore();
        if (!$("panel-lbo").hidden) renderLbo();
      }, 150);
    });
  }

  init();
})();
