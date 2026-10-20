// Browser ports of two deterministic DealNexa engines, so the demo can run them live:
// - calculateDealRiskScore: backend/services/riskScoringEngine.js, ported rule for rule.
// - runLbo: dealnexa-financials/app/engines/lbo.py (run_lbo). Uses floating-point numbers
//   instead of Decimal; checked against the Python engine's output in tools/.
(function (root) {
  const MODULE_WEIGHTS = {
    financial_performance: 0.25,
    revenue_quality: 0.2,
    liquidity_solvency: 0.15,
    legal_contractual: 0.15,
    operational_scalability: 0.15,
    strategic_fit: 0.1,
  };

  const VALUATION_ADJUSTMENTS = {
    financial_performance: { red: -0.3, orange: -0.15, yellow: -0.05, green: 0 },
    revenue_quality: { red: -1.0, orange: -0.5, yellow: -0.2, green: 0 },
    liquidity_solvency: { red: -0.5, orange: -0.25, yellow: -0.1, green: 0 },
    legal_contractual: { red: -0.5, orange: -0.25, yellow: -0.1, green: 0 },
    operational_scalability: { red: -0.3, orange: -0.15, yellow: -0.05, green: 0 },
    strategic_fit: { red: -0.2, orange: -0.1, yellow: 0, green: 0.1 },
  };

  const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
  const titled = (flags, words) => flags.filter((f) => words.some((w) => (f.title || "").toLowerCase().includes(w)));

  function scoreFinancialPerformance(m, redFlags) {
    let s = 70;
    if (m.revenue_cagr > 30 && m.gross_margin > 60) s = 85;
    else if (m.revenue_cagr > 20 && m.gross_margin > 50) s = 75;
    else if (m.revenue_cagr < 10) s -= 15;
    if (m.operating_loss_trend === "accelerating") s = m.loss_acceleration_pct > 50 ? 45 : s - 20;
    if (m.gross_margin < 0) s = 20;
    else if (m.gross_margin < 40) s -= 15;
    else if (m.gross_margin > 70) s += 10;
    if (m.ebitda_margin < -20) s -= 25;
    else if (m.ebitda_margin < 0) s -= 15;
    else if (m.ebitda_margin > 20) s += 10;
    if (titled(redFlags, ["loss", "profitability"]).length && m.losses_expanding_faster_than_revenue) s -= 15;
    return clamp(s, 0, 100);
  }

  function scoreRevenueQuality(m, redFlags) {
    let s = 70;
    if (m.nrr > 120) s = 90;
    else if (m.nrr > 110) s = 80;
    else if (m.nrr > 100) s = 70;
    else if (m.nrr < 90) s = 45;
    if (m.churn < 5) s += 10;
    else if (m.churn > 15) s -= 25;
    else if (m.churn > 10) s -= 15;
    if (m.top_customer_pct > 50) s -= 25;
    else if (m.top_customer_pct > 35) s -= 20;
    else if (m.top_customer_pct > 20) s -= 10;
    if (m.top_10_customers_pct > 75) s -= 20;
    if (m.revenue_under_dispute_pct > 5) s = 35;
    else if (m.revenue_under_dispute_pct > 2) s -= 20;
    if (titled(redFlags, ["dispute", "integrity"]).length) s -= 15;
    return clamp(s, 0, 100);
  }

  function scoreLiquiditySolvency(m, redFlags) {
    let s;
    if (m.runway_months < 6) s = 35;
    else if (m.runway_months < 12) s = 50;
    else if (m.runway_months < 18) s = 65;
    else if (m.runway_months < 24) s = 75;
    else s = 85;
    if (m.cash_decline_pct > 50 && m.runway_months >= 6) s -= 15;
    else if (m.cash_decline_pct > 40 && m.runway_months >= 6) s -= 10;
    else if (m.cash_decline_pct > 20) s -= 5;
    if (m.cash_declined_despite_financing) s -= 15;
    if (m.operating_cash_flow_positive) s += 10;
    else if (m.operating_cash_flow < -10000000) s -= 10;
    if (m.burn_multiple > 2) s -= 10;
    if (m.debt_service_coverage < 1) s -= 15;
    if (titled(redFlags, ["liquidity", "burn"]).length && s > 20) s -= 5;
    return clamp(s, 5, 100);
  }

  function scoreLegalContractual(m, redFlags) {
    let s = 75;
    if (m.active_disputes > 10) s = 30;
    else if (m.active_disputes > 5) s -= 30;
    else if (m.active_disputes > 2) s -= 15;
    if (m.contract_inconsistencies > 5) s -= 25;
    else if (m.contract_inconsistencies > 0) s -= 10;
    if (m.active_litigation > 0) s -= 20;
    if (m.ip_assignments_incomplete) s = 25;
    if (m.compliance_flags > 0) s -= 15;
    if (titled(redFlags, ["legal", "dispute", "integrity"]).length) s -= 15;
    if (m.clean_legal_audit) s = Math.min(100, s + 15);
    return clamp(s, 0, 100);
  }

  function scoreOperationalScalability(m) {
    let s = 70;
    if (m.operating_leverage_improving) s += 15;
    else if (m.operating_leverage_declining) s -= 15;
    if (m.cac_payback_months < 12) s += 10;
    else if (m.cac_payback_months > 24) s = 40;
    else if (m.cac_payback_months > 18) s -= 10;
    if (m.margin_trend === "improving") s += 15;
    else if (m.margin_trend === "compressing_2plus_years") s = 45;
    else if (m.margin_trend === "compressing") s -= 15;
    if (m.revenue_per_employee > 300000) s += 10;
    else if (m.revenue_per_employee < 150000) s -= 15;
    return clamp(s, 0, 100);
  }

  function scoreStrategicFit(m) {
    let s = 60;
    if (m.revenue_overlap_pct > 30) s += 15;
    else if (m.revenue_overlap_pct < 5) s -= 10;
    if (m.cost_synergy_potential === "high") s += 20;
    else if (m.cost_synergy_potential === "medium") s += 10;
    else if (m.cost_synergy_potential === "low") s -= 10;
    if (m.tech_integration === "easy") s += 15;
    else if (m.tech_integration === "complex") s -= 15;
    if (m.market_adjacency === "high") s += 15;
    else if (m.market_adjacency === "low") s -= 10;
    if (m.platform_potential) s += 10;
    if (m.no_strategic_rationale) s = 55;
    return clamp(s, 0, 100);
  }

  function band(score) {
    if (score >= 80) return "green";
    if (score >= 65) return "yellow";
    if (score >= 50) return "orange";
    return "red";
  }

  const BAND_INFO = {
    green: { label: "Strong Target", meaning: "High confidence", action: "Proceed" },
    yellow: { label: "Acceptable", meaning: "Manageable risk", action: "Standard diligence" },
    orange: { label: "Structured Deal Required", meaning: "Risk mitigation needed", action: "Structured deal with mitigation" },
    red: { label: "High Risk", meaning: "Price discount or avoid", action: "Avoid or significant price reduction" },
  };

  function calculateDealRiskScore({ metrics = {}, redFlags = [] } = {}) {
    const moduleScores = {
      financial_performance: scoreFinancialPerformance(metrics, redFlags),
      revenue_quality: scoreRevenueQuality(metrics, redFlags),
      liquidity_solvency: scoreLiquiditySolvency(metrics, redFlags),
      legal_contractual: scoreLegalContractual(metrics, redFlags),
      operational_scalability: scoreOperationalScalability(metrics),
      strategic_fit: scoreStrategicFit(metrics),
    };
    const overall = Math.round(Object.entries(moduleScores).reduce((sum, [k, v]) => sum + v * MODULE_WEIGHTS[k], 0));
    let adjustment = 0;
    const moduleAdjustments = {};
    for (const [k, v] of Object.entries(moduleScores)) {
      moduleAdjustments[k] = VALUATION_ADJUSTMENTS[k][band(v)];
      adjustment += moduleAdjustments[k];
    }
    const baseMultiple = metrics.base_multiple || 8.5;
    const color = band(overall);
    return {
      overall_score: overall,
      color,
      ...BAND_INFO[color],
      module_scores: moduleScores,
      module_adjustments: moduleAdjustments,
      valuation_impact: {
        base_multiple: Number(baseMultiple.toFixed(1)),
        total_adjustment: Number(adjustment.toFixed(1)),
        risk_adjusted_multiple: Number((baseMultiple + adjustment).toFixed(1)),
        implied_price_reduction_pct: Number(Math.abs((adjustment / baseMultiple) * 100).toFixed(1)),
      },
    };
  }

  function irr(cashflows, lo = -0.99, hi = 10, tol = 1e-9, iterations = 200) {
    const npv = (rate) => cashflows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + rate, t), 0);
    let fLo = npv(lo);
    if (fLo * npv(hi) > 0) return null;
    for (let i = 0; i < iterations; i++) {
      const mid = (lo + hi) / 2;
      const fMid = npv(mid);
      if (Math.abs(fMid) < tol) return mid;
      if (fLo * fMid < 0) hi = mid;
      else {
        lo = mid;
        fLo = fMid;
      }
    }
    return (lo + hi) / 2;
  }

  function runLbo(inp) {
    const n = (key, fallback = 0) => Number(inp[key] ?? fallback);
    const entryEbitda = n("entry_ebitda");
    const entryMultiple = n("entry_multiple");
    const exitMultiple = n("exit_multiple");
    const years = Math.trunc(n("hold_years"));
    const evEntry = entryMultiple * entryEbitda;
    const debtEntry = n("leverage_x") * entryEbitda + n("operating_lease_pv");
    const fees = n("fees_pct") * evEntry;
    const minCash = n("min_cash");
    const usesTotal = evEntry + fees + minCash;
    const equityEntry = usesTotal - debtEntry;
    if (equityEntry <= 0) throw new Error("Debt covers the whole purchase price; lower the leverage.");

    const periods = [];
    let ebitda = entryEbitda;
    let debt = debtEntry;
    for (let year = 1; year <= years; year++) {
      ebitda *= 1 + n("ebitda_growth");
      const capex = n("capex_pct") * ebitda;
      const interest = n("interest_rate") * debt;
      const taxable = ebitda - interest;
      const tax = taxable > 0 ? taxable * n("tax_rate") : 0;
      const fcf = ebitda - capex - n("nwc_change") - interest - tax;
      const opening = debt;
      const mandatory = Math.min(n("mandatory_amort_pct") * opening, opening);
      const afterMandatory = Math.max(fcf - mandatory, 0);
      const sweep = Math.min(n("cash_sweep_pct") * afterMandatory, opening - mandatory);
      debt = opening - mandatory - sweep;
      periods.push({ year, ebitda, capex, interest, tax, fcf, debt_open: opening, mandatory_amort: mandatory, cash_sweep: sweep, debt_close: debt });
    }
    const evExit = exitMultiple * ebitda;
    const equityExit = evExit - debt;
    const cashflows = [-equityEntry, ...Array(years - 1).fill(0), equityExit];
    const attribution = {
      ebitda_growth: (ebitda - entryEbitda) * entryMultiple,
      multiple_expansion: (exitMultiple - entryMultiple) * entryEbitda,
      cross: (ebitda - entryEbitda) * (exitMultiple - entryMultiple),
      debt_paydown: debtEntry - debt,
      fees_and_cash: -(fees + minCash),
    };
    return {
      sources_uses: { ev_entry: evEntry, debt_entry: debtEntry, fees, min_cash: minCash, equity_entry: equityEntry, uses_total: usesTotal, sources_total: debtEntry + equityEntry },
      exit: { ev: evExit, ebitda, multiple: exitMultiple, debt, equity: equityExit },
      periods,
      returns: { moic: equityExit / equityEntry, irr: irr(cashflows) },
      attribution,
      total_value_creation: equityExit - equityEntry,
    };
  }

  const api = { calculateDealRiskScore, runLbo, MODULE_WEIGHTS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.DealNexaEngines = api;
})(typeof window !== "undefined" ? window : globalThis);
