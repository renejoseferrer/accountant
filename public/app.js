const app = document.getElementById("app");
const navItems = [
  ["overview", "Overview", "⌂"],
  ["balance", "Balance sheet", "◫"],
  ["cashflow", "Cash flow & forecast", "↗"],
  ["ledger", "Smart ledger", "≡"],
  ["debt", "Debt & amortization", "↘"],
  ["plan", "Expenses & receipts", "✦"],
  ["investments", "Investments & tax", "◉"]
];
const definitions = {
  Assets: ["What you own or control that has measurable value. Tracking assets shows the resources available to support your household.", "Total assets = liquid assets + investments + other assets", "Healthy: Review balances regularly"],
  Essentials: ["Necessary spending for basic food, housing, utilities, required transportation, childcare, and medicine. Tracking it helps estimate the household's minimum monthly needs.", "Essentials = groceries + housing and utilities + required transport + childcare + medical", "Keep needs separate from optional spending"],
  "Fun / Wants": ["Optional purchases and services beyond essential needs. Tracking wants makes it easier to see whether flexible spending is within the household plan.", "Fun / Wants = total expenses − Essentials", "Compare with your chosen monthly target"],
  "Debt Payoff": ["Money paid toward debt balances during the month. Card purchases remain expenses; paying the card is recorded separately as debt repayment.", "Debt Payoff = cleared debt repayments", "Compare with your chosen monthly target"],
  "General Savings": ["Money moved into cash savings for emergencies and near-term goals. These transfers are not household expenses.", "General Savings = cleared transfers to savings", "Compare with your chosen monthly target"],
  "Investments / Wealth": ["Money contributed to investment accounts for longer-term goals. Contributions are transfers between assets, not spending.", "Investments = cleared contributions to investment accounts", "Compare with your chosen monthly target"],
  "Liquid Assets": ["Cash and near-cash funds you can access quickly without selling a long-term investment.", "Liquid assets = chequing + savings + emergency cash", "Healthy: Keep an accessible emergency fund"],
  "Illiquid Assets": ["Assets that take time or effort to turn into cash, such as a home or certain investments.", "Illiquid assets = total assets − liquid assets", "Plan for access before relying on them"],
  Liabilities: ["Amounts your household owes, including credit cards and loans. A clear liability picture helps you plan repayments.", "Total liabilities = current liabilities + long-term liabilities", "Healthy: Know rates, balances, and due dates"],
  "Credit Card / Loan": ["A credit card is revolving borrowing; a loan is money repaid in scheduled payments. Tracking the balance, rate, and required minimum helps avoid missed payments and understand borrowing costs.", "Estimated monthly interest = balance × annual rate ÷ 12", "Healthy: Record the required minimum and due date"],
  "Total Liabilities": ["Amounts the household still owes across credit cards, loans, and other borrowing. Tracking the full total makes debt payoff and net-worth changes easier to understand.", "Total liabilities = sum of all outstanding debt balances", "Healthy: Keep every minimum payment and due date recorded"],
  "Current Liabilities": ["Near-term balances that need attention soon, such as credit-card statements and upcoming payments.", "Current liabilities = recorded credit-card statement balances", "Keep due dates visible"],
  "Long-Term Liabilities": ["Debts scheduled to be repaid over more than a year, such as a car loan or mortgage.", "Long-term liabilities = total liabilities − current liabilities", "Compare rates and amortization"],
  "Net Worth": ["The value left after subtracting everything owed from everything owned. It is a useful snapshot, not a measure of monthly cash.", "Net Worth = Total Assets − Total Liabilities", "Healthy: A sustained upward trend"],
  "Cash Flow": ["Money coming into and going out of your household over a period. Transfers between your own accounts are not income or spending.", "Cash flow = income − expenses", "Compare actuals with your plan"],
  "Gross vs. Net Income": ["Gross income is before tax and deductions; net income is the amount deposited after deductions. Budgets based on take-home pay are easier to reconcile.", "Net income = gross income − payroll deductions", "Use cleared deposits for actual cash flow"],
  "Fixed vs. Variable Expenses": ["Fixed expenses recur at a similar amount; variable expenses change with use or choice. Separating them helps identify what you can adjust.", "Total expenses = fixed expenses + variable expenses", "Review variable spending monthly"],
  "Liquidity Ratio / Emergency Runway": ["Estimates how many months your liquid funds could cover essential spending if income stopped.", "Emergency runway = liquid assets ÷ monthly essential expenses", "Healthy: Target is 3–6 months"],
  "Savings Rate": ["The share of income you keep or direct toward future goals. This estimate uses recorded actual income and expenses.", "Savings rate = (income − expenses) ÷ income × 100%", "A consistent rate matters more than a perfect month"],
  "Debt-to-Income Ratio": ["Compares monthly debt payments with monthly income. Lenders use versions of this ratio to assess borrowing capacity.", "Debt-to-income = monthly debt payments ÷ gross monthly income × 100%", "Lower is generally easier to manage"],
  "Debt-to-Asset Ratio": ["Shows what portion of recorded assets is financed by debt. It puts liabilities in context with what you own.", "Debt-to-asset = total liabilities ÷ total assets × 100%", "Lower means more assets are unencumbered"],
  Amortization: ["The planned schedule for paying down a loan through regular payments of principal and interest.", "Months remaining = recorded schedule, or balance ÷ monthly payment as a rough estimate", "Check whether extra payments reduce interest"],
  "Principal vs. Interest": ["Principal reduces the amount borrowed; interest is the cost of borrowing. Early loan payments often contain a larger interest share.", "Monthly payment = principal paid + interest charged", "Higher-rate debt costs more to carry"],
  "Cost Basis / ACB": ["Adjusted Cost Base (ACB) is the tracked tax cost of an investment, adjusted for purchases and certain distributions.", "ACB = purchase costs + eligible adjustments − amounts returned or disposed", "ACB tracking can matter for taxable accounts"],
  "Asset Allocation": ["How a portfolio is divided among investment types such as equities, bonds, ETFs, and cash.", "Allocation % = category market value ÷ portfolio market value × 100%", "Choose a mix suited to your timeline and risk"],
  Reconciliation: ["Matches an expected paycheck or bill with a real cleared transaction. A match updates the forecast without counting the same event twice.", "Match: within ±3 days and ±15% of expected amount", "Expected amounts are not current cash"],
  "Monthly Debt Paid": ["The amount directed to reducing debt during the month. Card purchases are expenses; paying the card balance is a transfer, not a second expense.", "Debt paid = cleared payments to debt accounts", "Compare with your 10% target"],
  "Safe-to-Spend": ["A planning estimate of cash remaining after near-term bills due before the next payday. It is not a guarantee of affordability.", "Safe-to-spend = chequing cash − bills due before next payday", "Leave room for unrecorded spending"]
};
const categoryColors = ["#317f53", "#8db59a", "#c5dba8"];
function readPreference(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function markDemoRecords() {
  const demoIds={
    accounts:["checking-a","checking-j","hisa-b","checking-b","emergency-j","tfsa-a","rrsp-b","fhsa-b","visa-j","car-a"],
    transactions:["t1","t2","t3","t4","t5","t6","t7","t8","t9","t10","t11","t12","t13","t14","t15","t16"],
    schedule:["s1","s2","s3","s4","s5","s6","s7"],
    taxDeductions:["tax1","tax2"]
  };
  for(const [key,ids] of Object.entries(demoIds)){
    const records=state[key]||[];
    records.forEach(record=>{if(ids.includes(record.id))record._demo=true;});
  }
  const demoMerchants=["Loblaws","Metro Grocery","Shell","Netflix"];
  (state.merchantRules||[]).forEach(rule=>{if(demoMerchants.includes(rule.merchant))rule._demo=true;});
}
async function clearDemoRecords() {
  if(!window.confirm("Remove the built-in demo accounts, transactions, paydays, bills, tax receipts, and demo merchant rules? Your manually entered records and saved grocery receipts will stay."))return;
  for(const key of ["accounts","transactions","schedule","taxDeductions","merchantRules"]){
    state[key]=(state[key]||[]).filter(record=>!record._demo);
  }
  state.history=[];
  if(!await persist())return;
  render();showToast("Built-in demo records removed. Your manual entries were kept.");
}
let state;
let signedInUser = "";
let screen = "overview";
let view = readPreference("accountant-view", "Combined Household");
let jointShare = Math.min(100, Math.max(0, Number(readPreference("accountant-joint-share", "50")) || 0));
let learning = readPreference("accountant-learning", "true") !== "false";
let search = "";
let categoryFilter = "All categories";
let modal = "";
let selectedPartner = "Partner A";
let debtSort = "snowball";
let receiptDraft = null;
let receiptAttachmentDraft = null;
let receiptTotalTouched = false;
let receiptSearch = "";
let forecastDays = 30;
let ledgerSort = { key: "date", direction: "desc" };
let plaidConfigured = false;
let plaidUnavailable = false;
let toastTimer;

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const toCents = HouseholdMath.toCents;
const fromCents = (value) => value / 100;
const roundMoney = (value) => fromCents(toCents(value));
const sumMoney = (values) => fromCents(values.reduce((sum, value) => sum + toCents(value), 0));
const subtractMoney = (left, right) => fromCents(toCents(left) - toCents(right));
const roundedDivision = (numerator, denominator) => {
  const sign = numerator < 0 ? -1 : 1;
  return sign * Math.floor((Math.abs(numerator) + Math.floor(denominator / 2)) / denominator);
};
const amountCents = (record, key) => HouseholdMath.centsFor(record, key);
const sharedAmount = (value, owner) => fromCents(HouseholdMath.shareCents(toCents(value), owner, view, jointShare));
const percentLabel = (value) => `${Number(value || 0)}%`;
const cad = (value) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(roundMoney(value));
const pct = (value, decimals = 0) => `${Number(value || 0).toFixed(decimals)}%`;
const HOUSEHOLD_TIME_ZONE = "America/Edmonton";
function householdDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: HOUSEHOLD_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type).value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}
const dateLabel = (value, opts = { month: "short", day: "numeric" }) => new Date(`${value}T12:00:00Z`).toLocaleDateString("en-CA", { ...opts, timeZone: "UTC" });
const dayDiff = (date) => Math.ceil((new Date(`${date}T12:00:00Z`) - new Date(`${householdDate()}T12:00:00Z`)) / 86400000);
const iconFor = (merchant) => ({ Loblaws: "▦", "Metro Grocery": "▦", "Visa payment": "↔", "Paycheque · Northstar Design": "↗", "e-Transfer · Partner A": "⇄", "Hydro One": "ϟ", Shell: "◉", Netflix: "▷", "Coffee Culture": "☕", "City Childcare Centre": "⌂", "Car loan payment": "↘" }[merchant] || String(merchant || "?").slice(0, 1).toUpperCase());
function nextOccurrence(dateValue, cadence) {
  const date = new Date(`${dateValue}T12:00:00Z`);
  if (cadence === "Bi-weekly") date.setUTCDate(date.getUTCDate() + 14);
  else if (cadence === "Semi-monthly") {
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    if (date.getUTCDate() < 15) date.setUTCDate(15);
    else if (date.getUTCDate() < lastDay) date.setUTCDate(lastDay);
    else { date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + 1); date.setUTCDate(15); }
  }
  else {
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + 1);
    date.setUTCDate(Math.min(day, new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()));
  }
  return date.toISOString().slice(0, 10);
}
function forecastOccurrences(days = 90) {
  const occurrences = [];
  for (const item of state.schedule) {
    if (relevantOwner(item.owner) <= 0) continue;
    let date = item.date;
    let status = item.status;
    if (status === "Actual / Cleared" && dayDiff(date) < 0) {
      date = nextOccurrence(date, item.cadence);
      status = "Expected";
    } else {
      let skipped = 0;
      while (dayDiff(date) < 0 && skipped < 24) {
        date = nextOccurrence(date, item.cadence);
        skipped += 1;
      }
    }
    for (let count = 0; count < 24 && dayDiff(date) <= days; count += 1) {
      occurrences.push({ ...item, date, status });
      date = nextOccurrence(date, item.cadence);
      status = "Expected";
    }
  }
  return occurrences.sort((a,b)=>a.date.localeCompare(b.date));
}

function term(name, formulaValue, calcValue, options = {}) {
  const [definition, formula, benchmark] = definitions[name];
  const calculation = typeof calcValue === "function" ? calcValue() : calcValue;
  const label = options.label || name;
  const clickable = options.clickable ? " tabindex=\"0\" role=\"button\" aria-expanded=\"false\"" : " tabindex=\"0\"";
  return `<span class="term"${clickable} data-term="${esc(name)}"><span class="term-label">${esc(label)}</span><span class="term-info" aria-hidden="true">i</span><span class="popover" role="tooltip"><span class="popover-title">${esc(name)}</span><p>${esc(definition)}</p><div class="formula">${esc(formula)}</div><div class="your-calc">Your Calculation: ${esc(calculation || formulaValue || "Add account details to see this calculation.")}</div><span class="benchmark">${esc(benchmark)}</span></span></span>`;
}

function relevantOwner(owner) {
  if (view === "Combined Household") return 1;
  if (owner === view.replace(" Only", "")) return 1;
  return owner === "Joint" ? jointShare / 100 : 0;
}

function visibleAccounts(filter = () => true) {
  return state.accounts.filter(filter).map((account) => ({
    ...account,
    shownBalance: fromCents(HouseholdMath.shareCents(amountCents(account, "balance"), account.owner, view, jointShare))
  })).filter((account) => relevantOwner(account.owner) > 0);
}
function visibleTransactions() {
  return state.transactions.filter((transaction) => transaction.status !== "Superseded" && relevantOwner(transaction.owner) > 0).map((transaction) => ({
    ...transaction,
    shownAmount: fromCents(HouseholdMath.shareCents(amountCents(transaction, "amount"), transaction.owner, view, jointShare))
  }));
}
function amount(accounts) { return sumMoney(accounts.map((account) => account.shownBalance)); }
function metrics() {
  const accounts = visibleAccounts();
  const assets = amount(accounts.filter((a) => a.kind !== "liability"));
  const liquid = amount(accounts.filter((a) => a.kind === "cash"));
  const investments = amount(accounts.filter((a) => a.kind === "investment"));
  const debt = amount(accounts.filter((a) => a.kind === "liability"));
  const tx = visibleTransactions().filter((t) => t.status === "Actual" && HouseholdMath.countsTowardSpending(t));
  const ledger = HouseholdMath.calculateLedger(state, view, jointShare);
  const income = fromCents(ledger.incomeCents);
  const expenses = fromCents(ledger.expenseCents);
  const essentials = fromCents(tx.filter((t) => t.type === "expense").reduce((total, transaction) =>
    total + HouseholdMath.transactionCategoryCents(transaction, ["Groceries", "Housing & Utilities", "Transit & Fuel", "Childcare", "Medical"], view, jointShare), 0));
  const debtPaid = sumMoney(tx.filter((t) => t.category === "Debt repayment").map((t) => t.shownAmount));
  const invested = sumMoney(tx.filter((t) => t.category === "Investment contribution").map((t) => t.shownAmount));
  const generalSavings = sumMoney(tx.filter((t) => t.category === "General savings").map((t) => t.shownAmount));
  const basis = fromCents(accounts.filter((a) => a.kind === "investment").reduce((total, account) => total +
    HouseholdMath.shareCents(amountCents(account, "acb"), account.owner, view, jointShare), 0));
  const cadenceAmounts = (s, key) => {
    const amount = amountCents(s, key);
    if (s.cadence === "Bi-weekly") return roundedDivision(amount * 26, 12);
    if (s.cadence === "Semi-monthly") return amount * 2;
    return amount;
  };
  const grossMonthly = fromCents(state.schedule.filter((s) => s.type === "income").reduce((total, item) =>
    total + HouseholdMath.shareCents(cadenceAmounts(item, "grossAmount") || cadenceAmounts(item, "amount"), item.owner, view, jointShare), 0));
  const netMonthly = fromCents(state.schedule.filter((s) => s.type === "income").reduce((total, item) =>
    total + HouseholdMath.shareCents(cadenceAmounts(item, "amount"), item.owner, view, jointShare), 0));
  const liquidRatio = essentials ? liquid / essentials : 0;
  const savingsRate = income ? Math.max(0, subtractMoney(income, expenses) / income * 100) : 0;
  const liabilities = accounts.filter((account) => account.kind === "liability");
  const missingMinimums = liabilities.filter((account) => account.balance > 0 && !Number(account.minimumPayment ?? account.monthlyPayment));
  const monthlyDebtPayments = fromCents(liabilities.reduce((total, account) => {
    const key = account.minimumPayment !== undefined && account.minimumPayment !== null ? "minimumPayment" : "monthlyPayment";
    return total + HouseholdMath.shareCents(amountCents(account, key), account.owner, view, jointShare);
  }, 0));
  const dti = grossMonthly ? monthlyDebtPayments / grossMonthly * 100 : 0;
  const nextPayday = state.schedule.filter((s) => s.type === "income" && s.status === "Expected" && dayDiff(s.date) >= 0).sort((a,b)=>a.date.localeCompare(b.date))[0];
  const daysUntilPayday = nextPayday ? dayDiff(nextPayday.date) : 14;
  const dueBeforePay = fromCents(state.schedule.filter((s) => s.type === "bill" && dayDiff(s.date) >= 0 && dayDiff(s.date) <= daysUntilPayday)
    .reduce((total, item) => total + HouseholdMath.shareCents(amountCents(item, "amount"), item.owner, view, jointShare), 0));
  const liquidChecking = amount(accounts.filter((a) => a.kind === "cash" && (a.bucket === "Chequing" || /chequing|checking/i.test(`${a.name} ${a.accountType || ""}`))));
  return { accounts, assets, liquid, liquidChecking, investments, debt, netWorth: subtractMoney(assets, debt), income, expenses, essentials, debtPaid, invested, generalSavings, basis, liquidRatio, savingsRate, dti, debtAsset: assets ? debt / assets * 100 : 0, grossMonthly, netMonthly, monthlyDebtPayments, missingMinimums, dueBeforePay, safe: subtractMoney(liquidChecking, dueBeforePay), ledger };
}
function transactionCategoryTotal(transaction, categories) {
  return fromCents(HouseholdMath.transactionCategoryCents(transaction, categories, view, jointShare));
}

function loginMarkup() {
  app.innerHTML = `<main class="login-screen"><section class="login-art"><div class="brand"><span class="brand-mark">a.</span><div><div class="brand-name">accountant</div><div class="brand-subtitle">A clearer view of your money</div></div></div><div class="login-copy"><div class="eyebrow" style="color:#b4d7bf">Your household, in balance</div><h1>Money decisions feel better when you're in sync.</h1><p>A shared, private workspace to understand your cash flow, build wealth, and make the next decision with confidence.</p></div><div class="login-art-foot">Built for two. Grounded in your real numbers.</div></section><section class="login-form-wrap"><form class="login-form" id="loginForm"><span class="brand-mark">a.</span><h2>Welcome to your workspace</h2><p>Sign in as either household partner to get started.</p><div class="partner-choice"><button type="button" class="partner-option ${selectedPartner === "Partner A" ? "selected" : ""}" data-partner="Partner A"><strong>Partner A</strong><span>Personal view + household</span></button><button type="button" class="partner-option ${selectedPartner === "Partner B" ? "selected" : ""}" data-partner="Partner B"><strong>Partner B</strong><span>Personal view + household</span></button></div><div class="form-row"><label for="passcode">Workspace passcode</label><input class="input" type="password" id="passcode" inputmode="text" autocomplete="current-password" required></div><button class="button primary" type="submit">Open household workspace <span aria-hidden="true">→</span></button><div class="login-help">Enter the passcode supplied by the workspace owner.</div><div id="loginError" class="login-help" style="color:#bd4d46"></div></form></section></main>`;
  app.querySelectorAll("[data-partner]").forEach((button) => button.addEventListener("click", () => { selectedPartner = button.dataset.partner; loginMarkup(); }));
  app.querySelector("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const response = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ partner: selectedPartner, passcode: app.querySelector("#passcode").value }) });
    const result = await response.json();
    if (!response.ok) { app.querySelector("#loginError").textContent = result.error; return; }
    signedInUser = result.user;
    await loadState();
  });
}

function shellMarkup() {
  const active = navItems.find((item) => item[0] === screen);
  return `<div class="app-shell ${learning ? "" : "learning-off"}"><aside class="sidebar" id="sidebar"><div class="brand"><span class="brand-mark">a.</span><div><div class="brand-name">accountant</div><div class="brand-subtitle">Household workspace</div></div></div><div class="nav-label">Your finances</div><nav class="nav-list">${navItems.map(([id, label, icon]) => `<button class="nav-link ${screen === id ? "active" : ""}" data-screen="${id}"><span class="nav-icon">${icon}</span>${label}</button>`).join("")}</nav><div class="sidebar-bottom"><div class="sync-card"><div class="sync-heading"><span class="sync-dot offline"></span> ${plaidConfigured ? "Bank sync available" : "Bank sync not connected"}</div><p>${plaidConfigured ? "Import a bank statement here, or connect Plaid from the ledger." : "Use CSV import to bring in bank transactions."}</p><button class="button small" data-modal="import">Import CSV</button></div><div class="user-chip"><span class="avatar">${signedInUser.slice(-1)}</span><div class="user-meta"><div class="user-name">${esc(signedInUser)}</div><div class="user-home">${esc(state.household)}</div></div><button class="button small" data-action="logout" title="Sign out">↗</button></div></div></aside><main class="main-area"><header class="topbar"><div class="crumbs"><button class="mobile-menu" data-action="menu" aria-label="Open menu">☰</button><span>Workspace</span><span>›</span><strong>${esc(active[1])}</strong></div><div class="topbar-right"><button class="learn-toggle ${learning ? "on" : ""}" data-action="learning"><span>Learning underlines</span><span class="toggle-track"></span></button><select class="view-select" id="viewSelect" aria-label="Choose financial view">${["Combined Household", "Partner A Only", "Partner B Only"].map((item) => `<option ${view === item ? "selected" : ""}>${item}</option>`).join("")}</select></div></header><div class="content" id="pageContent"></div></main></div>${modal ? modalMarkup() : ""}`;
}

function pageHeading(eyebrow, title, subtitle, actions = "") {
  return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p class="subtitle">${subtitle}</p></div><div class="heading-actions">${actions}</div></div>`;
}
function statCard(label, value, note, symbol, live, tone = "") {
  const labelMarkup = definitions[label] ? term(label, "", live) : esc(label);
  return `<article class="card stat-card"><div class="stat-top"><span>${labelMarkup}</span><span class="stat-symbol">${symbol}</span></div><div class="stat-value ${tone}">${value}</div><div class="stat-foot">${note}</div></article>`;
}
function sectionCard(title, subtitle, body, extra = "") {
  return `<section class="card section-card"><div class="section-title-row"><div><h2>${title}</h2>${subtitle ? `<p class="muted" style="font-size:11px;margin:5px 0 0">${subtitle}</p>` : ""}</div>${extra}</div>${body}</section>`;
}
function chartMarkup(value = metrics().netWorth) {
  const history = state.history;
  const max = Math.max(...history.map((item) => item.netWorth), value) * 1.09;
  const min = Math.min(...history.map((item) => item.netWorth), value) * .91;
  const points = [...history.map((item) => item.netWorth), value].map((amount, index, list) => {
    const x = index / (list.length - 1) * 94 + 3;
    const y = 87 - (amount - min) / (max - min || 1) * 72;
    return [x, y];
  });
  const path = points.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ");
  const area = `${path} L97,95 L3,95 Z`;
  return `<div class="chart-wrap"><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Net worth trend, increasing over the last six months"><defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#57a36c" stop-opacity=".2"/><stop offset="1" stop-color="#57a36c" stop-opacity="0"/></linearGradient></defs><line x1="0" y1="15" x2="100" y2="15" class="chart-gridline"/><line x1="0" y1="48" x2="100" y2="48" class="chart-gridline"/><line x1="0" y1="81" x2="100" y2="81" class="chart-gridline"/><path d="${area}" class="chart-area"/><path d="${path}" class="chart-path"/>${points.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.5" class="chart-point"/>`).join("")}</svg></div><div class="chart-labels">${history.map((item) => `<span>${item.month}</span>`).join("")}<span>Now</span></div><div class="chart-legend"><span class="legend-dot"></span> Household net worth</div>`;
}
function ownerBreakdown() {
  const owners = ["Partner A", "Partner B", "Joint"];
  const total = metrics().assets || 1;
  const rows = owners.map((owner) => {
    const assets = amount(visibleAccounts((account) => account.kind !== "liability" && account.owner === owner));
    const share = assets / total * 100;
    return { owner, assets, share };
  });
  return `<div class="asset-total">${cad(metrics().assets)}<small>Total assets across selected view</small></div><div class="stacked-bar">${rows.map((row, i) => `<span title="${row.owner}: ${cad(row.assets)}" style="width:${row.share}%;background:${categoryColors[i]}"></span>`).join("")}</div><div class="owner-list">${rows.map((row, i) => `<div class="owner-row"><span class="owner-dot" style="background:${categoryColors[i]}"></span><span>${row.owner}</span><strong>${cad(row.assets)}</strong></div>`).join("")}</div>`;
}
function transactionRow(t) {
  const signed = t.type === "income" ? "+" : t.type === "expense" ? "−" : "";
  const badge = t.type === "transfer" ? `<span class="pill">${esc(t.category === "Debt repayment" ? "Debt repayment · neutral" : t.category === "Investment contribution" ? "Investment · neutral" : t.category === "General savings" ? "General savings · neutral" : "Internal transfer · neutral")}</span>` : t.type === "income" ? `<span class="pill green">Income</span>` : Array.isArray(t.splits) && t.splits.length ? `<span class="pill">${esc(t.splits.map((split)=>split.category).join(" + "))}</span>` : `<span class="pill">${esc(t.category)}</span>`;
  const linkedReceipt = receiptForTransaction(t);
  const receiptAction = linkedReceipt ? `<button class="table-action" type="button" data-view-receipt="${esc(linkedReceipt.id)}">Items / proof</button>` : "";
  const agreement = linkedReceipt ? expenseAgreement(linkedReceipt) : null;
  const review = agreement?.status === "needs review" ? `<span class="pill amber">Needs review</span>` : t.receiptMatchRole === "bank-record" ? `<span class="pill">Linked bank record</span>` : "";
  const importRemove = t.note === "CSV import" ? `<button type="button" class="table-action" data-action="import-delete" data-transaction-id="${esc(t.id)}">Remove import</button>` : "";
  return `<tr><td data-label="Date">${dateLabel(t.date)}</td><td data-label="Merchant"><div class="merchant-cell"><span class="merchant-icon">${esc(iconFor(t.merchant))}</span><span>${esc(t.merchant)}${t.mcc ? `<small class="muted" style="display:block;font-weight:400;margin-top:3px">MCC ${esc(t.mcc)}</small>` : ""}</span></div></td><td data-label="Category">${badge} ${review}</td><td data-label="Owner">${esc(t.owner)}</td><td data-label="Account">${esc(t.account)}</td><td data-label="Amount" class="amount">${signed}${cad(t.shownAmount ?? t.amount, 2)}</td><td data-label="Actions">${t.manual?`<button type="button" class="table-action" data-edit-transaction="${esc(t.id)}">Edit</button>`:""}${receiptAction}<button type="button" class="table-action" data-split="${esc(t.id)}">Split</button>${importRemove}</td></tr>`;
}
function recentTransactions(limit = 5, filter = () => true) {
  const rows = visibleTransactions().filter(filter).slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
  if (!rows.length) return `<tr><td colspan="7" class="empty-state">No transactions match this view.</td></tr>`;
  return rows.map(transactionRow).join("");
}
function tableHeader(headers) {
  return `<thead><tr>${headers.map((header) => `<th>${definitions[header] ? term(header, "", `${esc(header)} values are shown in the active household view.`) : esc(header)}</th>`).join("")}</tr></thead>`;
}
function ledgerTableHeader(headers) {
  const keys = ["date", "merchant", "category", "owner", "account", "amount", null];
  return `<thead><tr>${headers.map((header, index) => {
    const key = keys[index];
    if (!key) return `<th>${esc(header)}</th>`;
    const direction = ledgerSort.key === key ? ledgerSort.direction : "";
    const icon = direction === "asc" ? " ↑" : direction === "desc" ? " ↓" : "";
    const label = definitions[header] ? `<span class="term-label">${esc(header)}</span>` : esc(header);
      const info = definitions[header] ? `<span class="term" tabindex="0" data-term="${esc(header)}"><span class="term-info" aria-label="Learn about ${esc(header)}">i</span><span class="popover" role="tooltip"><span class="popover-title">${esc(header)}</span><p>${esc(definitions[header][0])}</p><div class="formula">${esc(definitions[header][1])}</div><div class="your-calc">Your Calculation: ${esc(header)} is calculated from the selected view's recorded transactions.</div><span class="benchmark">${esc(definitions[header][2])}</span></span></span>` : "";
    return `<th><button class="sort-header" type="button" data-sort="${key}" aria-label="Sort by ${esc(header)}">${label}${icon}</button>${info}</th>`;
  }).join("")}</tr></thead>`;
}
function ratioCard(title, value, note, calculation) {
  return `<div class="ratio-box"><div class="ratio-title">${term(title, "", calculation)}</div><div class="ratio-number">${value}</div><div class="ratio-note">${note}</div></div>`;
}
function budgetMarkup() {
  const m = metrics();
  const basisCents = toCents(m.netMonthly);
  const now = new Date(`${householdDate()}T12:00:00Z`);
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const elapsedDays = now.getUTCDate();
  const monthLabel = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", month: "short" }).format(now);
  const actuals = visibleTransactions().filter((transaction) => transaction.status === "Actual" && HouseholdMath.countsTowardSpending(transaction) &&
    transaction.date >= `${year}-${String(month + 1).padStart(2, "0")}-01` && transaction.date <= householdDate());
  const sharedCents = (transaction) => HouseholdMath.shareCents(amountCents(transaction, "amount"), transaction.owner, view, jointShare);
  const expenseCents = actuals.filter((transaction) => transaction.type === "expense")
    .reduce((total, transaction) => total + sharedCents(transaction), 0);
  const essentialsCategories = ["Groceries", "Housing & Utilities", "Transit & Fuel", "Childcare", "Medical"];
  const essentialsCents = actuals.filter((transaction) => transaction.type === "expense")
    .reduce((total, transaction) => total +
      HouseholdMath.transactionCategoryCents(transaction, essentialsCategories, view, jointShare), 0);
  const actualCentsByCategory = {
    Essentials: essentialsCents,
    "Fun / Wants": expenseCents - essentialsCents,
    "Debt Payoff": actuals.filter((transaction) => transaction.category === "Debt repayment")
      .reduce((total, transaction) => total + sharedCents(transaction), 0),
    "General Savings": actuals.filter((transaction) => transaction.category === "General savings")
      .reduce((total, transaction) => total + sharedCents(transaction), 0),
    "Investments / Wealth": actuals.filter((transaction) => transaction.category === "Investment contribution")
      .reduce((total, transaction) => total + sharedCents(transaction), 0)
  };
  const plan = HouseholdMath.calculateBudgetPlan(state.budget, basisCents, actualCentsByCategory, daysInMonth, elapsedDays);
  const totalActualCents = plan.rows.reduce((total, row) => total + row.actualCents, 0);
  const rows = plan.rows.map((row) => {
    const actual = fromCents(row.actualCents);
    const target = fromCents(row.targetCents);
    const projection = fromCents(row.projectedCents);
    const percentage = row.targetCents ? row.actualCents / row.targetCents * 100 : 0;
    const targetPercent = state.budget.find((item) => item.category === row.category).target;
    const details = row.category === "Essentials"
      ? `${essentialsCategories.map((category) => `${category} ${cad(fromCents(actuals.filter((transaction) => transaction.type === "expense").reduce((total, transaction) => total + HouseholdMath.transactionCategoryCents(transaction, [category], view, jointShare), 0)))}`).join(" + ")} = ${cad(actual)}`
      : row.category === "Fun / Wants"
        ? `${cad(fromCents(expenseCents))} total expenses − ${cad(fromCents(essentialsCents))} Essentials = ${cad(actual)}`
        : `${cad(actual)} recorded ${row.category.toLowerCase()} activity`;
    const calculation = `${details}; ${targetPercent}% × ${cad(fromCents(basisCents))} full-month income = ${cad(target)}`;
    return `<div class="budget-row"><span>${definitions[row.category] ? term(row.category, "", calculation) : esc(row.category)}</span><div><div class="progress ${percentage > 100 ? "over" : ""}"><span style="width:${Math.min(100, percentage)}%"></span></div><div class="muted budget-figures" style="font-size:9px;margin-top:4px"><span>Month to date, ${monthLabel} 1–${elapsedDays}: ${cad(actual)}</span><span>Full month target: ${cad(target)}</span><span>Projected month end: ${cad(projection)}</span></div></div><span class="progress-target">${esc(targetPercent)}%</span></div>`;
  });
  return `${rows.join("")}<div class="budget-summary"><strong>Plan total</strong><span>Month to date, ${monthLabel} 1–${elapsedDays}: ${cad(fromCents(totalActualCents))}</span><span>Full month target: ${cad(fromCents(plan.targetTotalCents))}</span><span>Projected month end: ${cad(fromCents(plan.projectedTotalCents))}</span></div>`;
}
function budgetSplitLabel() {
  return state.budget.map((item)=>String(Number(item.target))).join(" / ");
}
function categorySpend(categories) {
  const byCategory = metrics().ledger.expensesByCategoryCents;
  return fromCents(categories.reduce((total, category) => total + (byCategory[category] || 0), 0));
}
function overviewScreen() {
  const m = metrics();
  const cashFlowNet = subtractMoney(m.income, m.expenses);
  const todayLabel = new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: HOUSEHOLD_TIME_ZONE }).format(new Date());
  const liabilities = m.accounts.filter((account) => account.kind === "liability");
  const currentLiabilities = amount(liabilities.filter((account) => /credit card/i.test(account.accountType || "")));
  const longTermLiabilities = subtractMoney(m.debt, currentLiabilities);
  return `${pageHeading(todayLabel, `Good evening, ${esc(signedInUser)}.`, "Here’s your household money at a glance.", `<button class="button" data-modal="import">Import statement</button>`)}
    <div class="grid stats-grid">
      ${statCard("Net Worth", cad(m.netWorth), `<span class="trend">↗ 8.0%</span> over the last 6 months`, "↗", `${cad(m.assets)} − ${cad(m.debt)} = ${cad(m.netWorth)}`)}
      ${statCard("Liquid Assets", cad(m.liquid), "Available across chequing & savings", "◉", `${cad(m.liquid)} in cash accounts`)}
      ${statCard("Cash Flow", cad(cashFlowNet), `${cad(m.income)} income · ${cad(m.expenses)} spending`, "↔", `${cad(m.income)} − ${cad(m.expenses)} = ${cad(cashFlowNet)}`)}
      ${statCard("Total Liabilities", cad(m.debt), "Credit card + car loan", "⌁", `${cad(currentLiabilities)} current + ${cad(longTermLiabilities)} long-term = ${cad(m.debt)}`)}
    </div>
    <div class="grid content-grid"><section class="card chart-card"><div class="card-header"><div><h2>${term("Net Worth", "", `${cad(m.assets)} − ${cad(m.debt)} = ${cad(m.netWorth)}`, { label: "Net worth over time" })}</h2><p>Household assets less liabilities · last 6 months</p></div><span class="pill green">+8.0% this period</span></div>${chartMarkup()}</section><section class="card breakdown-card"><div class="card-header"><div><h2>Assets by owner</h2><p>One shared view, no double-counting</p></div><button class="button small" data-screen="balance">Details</button></div>${ownerBreakdown()}</section></div>
    <div class="grid content-grid"><section class="card"><div class="card-header"><div><h2>Monthly plan</h2><p>Actuals are month-to-date; targets are full-month equivalents from expected pay cadence (${budgetSplitLabel()}).</p></div><button class="button small" data-screen="cashflow">View plan</button></div>${budgetMarkup()}</section><article class="card insight-card"><div class="insight-label">A thoughtful next step · Personal Accountant</div><h2>Your household has ${m.liquidRatio.toFixed(1)} months of essential spending in liquid funds.</h2><p>${m.liquidRatio < 3 ? "Building toward a three-month reserve can make unexpected costs easier to manage." : m.liquidRatio <= 6 ? "You’re within the typical 3–6 month emergency runway range. Keep this reserve accessible." : "Your accessible reserve is above the typical 3–6 month range. Consider whether part of it is intended for another near-term goal."}</p><button class="button small" data-screen="balance">Explore your ratios →</button></article></div>
    <div class="grid content-grid"><section class="card section-card"><div class="section-title-row"><div><h2>Recent activity</h2><p class="muted" style="font-size:11px;margin:5px 0 0">Purchases, income, and transfers—all clearly separated</p></div><button class="button small" data-screen="ledger">Open ledger</button></div><div class="table-wrap"><table class="mobile-table">${tableHeader(["Date", "Merchant", "Category", "Owner", "Account", "Amount", "Actions"])}<tbody>${recentTransactions(5)}</tbody></table></div></section><section class="card"><div class="card-header"><div><h2>Coming up</h2><p>Expected amounts stay out of today’s balances</p></div><button class="button small" data-screen="cashflow">30 days</button></div>${scheduleList(4)}</section></div>`;
}
function balanceScreen() {
  const m = metrics();
  const accounts = visibleAccounts();
  const owners = ["Partner A", "Partner B", "Joint"];
  const currentLiabilities = amount(accounts.filter((a)=>a.kind==="liability"&&/credit card/i.test(a.accountType || "")));
  const longTermLiabilities = amount(accounts.filter((a)=>a.kind==="liability"&&!/credit card/i.test(a.accountType || "")));
  const rows = owners.map((owner) => {
    const owned = accounts.filter((a) => a.owner === owner);
    const assets = amount(owned.filter((a) => a.kind !== "liability"));
    const debt = amount(owned.filter((a) => a.kind === "liability"));
    return `<tr><td data-label="Owner"><strong>${owner}</strong></td><td data-label="Liquid assets" class="amount">${cad(amount(owned.filter((a) => a.kind === "cash")))}</td><td data-label="Investments" class="amount">${cad(amount(owned.filter((a) => a.kind === "investment")))}</td><td data-label="Total assets" class="amount">${cad(assets)}</td><td data-label="Liabilities" class="amount">${cad(debt)}</td><td data-label="Net worth" class="amount">${cad(subtractMoney(assets, debt))}</td></tr>`;
  }).join("");
  const assetParts = `${cad(amount(accounts.filter((a) => a.kind === "cash")))} liquid + ${cad(amount(accounts.filter((a) => a.kind === "investment")))} investments + ${cad(amount(accounts.filter((a) => a.kind !== "cash" && a.kind !== "investment" && a.kind !== "liability")))} other assets = ${cad(m.assets)}`;
  const liabilityParts = accounts.filter((account) => account.kind === "liability")
    .map((account) => `${esc(account.name)} ${cad(account.shownBalance)}`).join(" + ") || "No recorded debt";
  return `${pageHeading("The full picture", "Balance sheet", "What you own, what you owe, and how your household is progressing.", `<button class="button" data-action="manage-accounts">Manage accounts</button>`)}
    <div class="grid stats-grid">${statCard("Assets", cad(m.assets), "Cash + investment accounts", "◫", assetParts)}${statCard("Liquid Assets", cad(m.liquid), "Accessible cash balances", "◉", `${cad(amount(accounts.filter((a) => a.kind === "cash")))} across recorded cash accounts = ${cad(m.liquid)}`)}${statCard("Illiquid Assets", cad(Math.max(0, subtractMoney(m.assets, m.liquid))), "Investments & long-term holdings", "▤", `${cad(m.assets)} − ${cad(m.liquid)} = ${cad(Math.max(0, subtractMoney(m.assets, m.liquid)))}`)}${statCard("Net Worth", cad(m.netWorth), "Assets less all liabilities", "↗", `${cad(m.assets)} − ${cad(m.debt)} = ${cad(m.netWorth)}`)}</div>
    ${sectionCard("Owner breakdown", "Personal accounts and the shared household bucket. Joint balances are included once in Combined Household.", `<div class="table-wrap owner-table-wrap"><table class="owner-balance-table mobile-table"><thead><tr>${["Owner","Liquid assets","Investments","Total assets","Liabilities","Net worth"].map((label)=>`<th>${esc(label)}</th>`).join("")}</tr></thead><tbody>${rows}<tr class="household-total"><td data-label="Owner"><strong>Household total</strong></td><td data-label="Liquid assets" class="amount">${cad(amount(accounts.filter((a)=>a.kind==="cash")))}</td><td data-label="Investments" class="amount">${cad(amount(accounts.filter((a)=>a.kind==="investment")))}</td><td data-label="Total assets" class="amount">${cad(m.assets)}</td><td data-label="Liabilities" class="amount">${cad(m.debt)}</td><td data-label="Net worth" class="amount">${cad(m.netWorth)}</td></tr></tbody></table></div>`, `<label class="muted" style="font-size:10px">Joint share in personal view <strong>${jointShare}%</strong></label><input id="jointShare" type="range" min="0" max="100" value="${jointShare}" style="width:95px;accent-color:#32865a">`)}
    <div class="grid content-grid"><section class="card chart-card"><div class="card-header"><div><h2>Net worth history</h2><p>Monthly snapshot</p></div><span class="pill green">Six-month view</span></div>${chartMarkup()}</section><section class="card"><div class="card-header"><div><h2>Accountant ratios</h2><p>Indicators based on tracked data</p></div></div><div class="ratio-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">${ratioCard("Savings Rate", pct(m.savingsRate, 1), "Actual income less expenses", `${cad(subtractMoney(m.income,m.expenses))} ÷ ${cad(m.income)} = ${pct(m.savingsRate,1)}`)}${ratioCard("Debt-to-Income Ratio", pct(m.dti, 1), "Scheduled debt payments ÷ gross", `${cad(m.monthlyDebtPayments)} ÷ ${cad(m.grossMonthly)} = ${pct(m.dti,1)}`)}${ratioCard("Liquidity Ratio / Emergency Runway", `${m.liquidRatio.toFixed(1)} mo`, "Target: 3–6 months", `${cad(m.liquid)} ÷ ${cad(m.essentials)} essential expenses = ${m.liquidRatio.toFixed(1)} months`)}${ratioCard("Debt-to-Asset Ratio", pct(m.debtAsset, 1), "Liabilities ÷ assets", `${cad(m.debt)} ÷ ${cad(m.assets)} = ${pct(m.debtAsset,1)}`)}</div></section></div>
    ${sectionCard("Liability maturity", "Separate near-term statement balances from longer-term loans.", `<div class="metric-list"><div class="metric-row"><span>${term("Current Liabilities", "", `${cad(currentLiabilities)} in current credit-card balances`)}</span><strong>${cad(currentLiabilities)}</strong></div><div class="metric-row"><span>${term("Long-Term Liabilities", "", `${cad(m.debt)} total liabilities − ${cad(currentLiabilities)} current liabilities = ${cad(longTermLiabilities)}`)}</span><strong>${cad(longTermLiabilities)}</strong></div></div>`)}
    ${sectionCard("All accounts", "Add or edit cash, investments, credit, and private personal-loan balances.", `<div id="accountManager" class="account-tools"><button class="button primary" data-action="account-add">+ Add account or loan</button><button class="button" data-modal="connect-choice">Connect an account</button><button class="button" data-action="clear-demo">Clear demo data</button></div>${accountTable(accounts)}`)}`;
}
function accountTable(accounts) {
  const labels = ["Account", "Institution", "Owner", "Type", "Balance", "Details", "Actions"];
  return `<div class="table-wrap"><table class="account-table mobile-table">${tableHeader(labels)}<tbody>${accounts.map((a) => {
    const monthlyInterest = fromCents(roundedDivision(toCents(a.shownBalance) * HouseholdMath.toBasisPoints(a.apr || "0.00"), 120000));
    const minimum = a.minimumPayment ?? a.monthlyPayment;
    return `<tr><td data-label="Account"><div class="merchant-cell"><span class="merchant-icon">${a.kind === "liability" ? "↘" : a.kind === "investment" ? "◉" : "▣"}</span><strong>${esc(a.name)}</strong></div></td><td data-label="Institution">${esc(a.institution)}</td><td data-label="Owner">${esc(a.owner)}</td><td data-label="Type"><span class="pill">${a.kind === "liability" ? term("Credit Card / Loan", "", `${cad(a.shownBalance)} × ${String(a.apr || "0.00")}% ÷ 12 ≈ ${cad(monthlyInterest)} estimated monthly interest; ${minimum == null ? "minimum not entered" : `${cad(sharedAmount(minimum, a.owner))} minimum payment`}`, { label: a.accountType || "Debt" }) : esc(a.accountType || a.bucket || "Cash")}</span></td><td data-label="Balance" class="amount">${cad(a.shownBalance)}</td><td data-label="Details">${a.kind === "liability" ? `${String(a.apr || "0.00")}% APR · due ${a.dueDate ? dateLabel(a.dueDate) : "not set"}` : a.kind === "investment" ? `ACB ${cad(sharedAmount(a.acb || 0, a.owner))}` : `•••• ${esc(a.last4 || "—")}`}</td><td data-label="Actions"><button class="table-action" data-edit-account="${esc(a.id)}">Edit</button></td></tr>`;
  }).join("")}</tbody></table></div>`;
}
function scheduleList(limit = 20, days = null) {
  const rows = forecastOccurrences(days ?? 90).slice(0, limit);
  return rows.map((item) => `<div class="forecast-item"><div class="forecast-date">${dateLabel(item.date)}</div><div><div class="forecast-name">${esc(item.name)}</div><div class="forecast-meta">${esc(item.cadence)} · ${esc(item.owner)}</div></div><div class="forecast-amount ${item.type === "income" ? "trend" : ""}">${item.type === "income" ? "+" : "−"}${cad(sharedAmount(item.amount, item.owner))}</div><div style="text-align:right"><span class="pill ${item.status === "Actual / Cleared" ? "green" : "amber"}">${esc(item.status)}</span><div><button class="table-action" data-edit-schedule="${esc(item.id)}">Edit</button><button class="table-action" data-action="schedule-delete" data-schedule-id="${esc(item.id)}">Remove</button></div></div></div>`).join("") || `<div class="empty-state">No scheduled items for this view.</div>`;
}
function cashflowScreen() {
  const m = metrics();
  const forecast = forecastOccurrences(forecastDays);
  const reconciliationExample = forecast.find((item) => item.status !== "Actual / Cleared");
  const reconciliationCalculation = reconciliationExample
    ? `${esc(reconciliationExample.name)} expects ${cad(sharedAmount(reconciliationExample.amount, reconciliationExample.owner))} on ${dateLabel(reconciliationExample.date)}; a match must be within ±3 days and ±15% of that amount.`
    : "No expected paycheck or bill is available to match in this view.";
  const bills = sumMoney(forecast.filter((s) => s.type === "bill").map((s) => sharedAmount(s.amount, s.owner)));
  const expectedIncome = sumMoney(forecast.filter((s)=>s.type==="income").map((s)=>sharedAmount(s.amount, s.owner)));
  const cashFlowNet = subtractMoney(m.income, m.expenses);
  const fixedExpenses = categorySpend(["Housing & Utilities", "Childcare", "Subscriptions"]);
  const variableExpenses = subtractMoney(m.expenses, fixedExpenses);
  return `${pageHeading("Plan ahead with confidence", "Cash flow & forecast", "Expected paydays and bills are planning signals—not current assets.", `<button class="button primary" data-modal="schedule">+ Add recurring item</button>`)}
    <div class="grid stats-grid">${statCard("Safe-to-Spend", cad(m.safe), `${cad(m.liquidChecking)} chequing − ${cad(m.dueBeforePay)} near-term bills`, "◈", `${cad(m.liquidChecking)} − ${cad(m.dueBeforePay)} = ${cad(m.safe)}`)}${statCard(`Expected income · ${forecastDays} days`, cad(expectedIncome), "Not counted in current net worth", "↗", "Expected deposits are not yet cash")} ${statCard(`Bills due · ${forecastDays} days`, cad(bills), "Upcoming bills & statements", "↘", `${cad(bills)} expected payments`)}${statCard("Actual cash flow", cad(cashFlowNet), `${cad(m.income)} income − ${cad(m.expenses)} expenses`, "↔", `${cad(m.income)} − ${cad(m.expenses)} = ${cad(cashFlowNet)}`)}</div>
    <div class="grid content-grid"><section class="card section-card"><div class="card-header"><div><h2>Expected vs. actual timeline</h2><p>Actuals reconcile within ±3 days and ±15% of an expected amount</p></div><div class="heading-actions">${[30,60,90].map((days)=>`<button class="button small ${forecastDays===days?"primary":""}" data-forecast-days="${days}">${days} days</button>`).join("")}</div></div>${scheduleList(forecast.length, forecastDays)}</section><section class="card"><div class="card-header"><div><h2>Safe-to-spend</h2><p>Before your next payday</p></div></div><div class="asset-total">${cad(m.safe)}<small>Current chequing balance less bills due before payday</small></div><div class="metric-list"><div class="metric-row"><span>Liquid chequing balances</span><strong>${cad(m.liquidChecking)}</strong></div><div class="metric-row"><span>Upcoming scheduled bills</span><strong>− ${cad(m.dueBeforePay)}</strong></div><div class="metric-row"><span>${term("Safe-to-Spend", "", `${cad(m.liquidChecking)} − ${cad(m.dueBeforePay)} = ${cad(m.safe)}`)}</span><strong>${cad(m.safe)}</strong></div></div><div style="padding:0 20px 18px"><div class="notice">${term("Reconciliation", "", reconciliationCalculation)} Paydays and bills remain Expected until a matching bank transaction clears.</div></div></section></div>
    <div class="grid content-grid"><section class="card"><div class="card-header"><div><h2>Monthly budget targets</h2><p>${budgetSplitLabel()} split · based on estimated household take-home pay</p></div><button class="button small" data-action="budget">Customize targets</button></div>${budgetMarkup()}</section><section class="card"><div class="card-header"><div><h2>Fixed vs. variable</h2><p>All actual spending is included in one of these two groups.</p></div></div><div class="metric-list"><div class="metric-row"><span>${term("Gross vs. Net Income", "", `${cad(m.grossMonthly)} gross − ${cad(subtractMoney(m.grossMonthly,m.netMonthly))} estimated deductions = ${cad(m.netMonthly)} planned net deposits`)}</span><strong>${cad(m.income)} cleared net</strong></div><div class="metric-row"><span>${term("Fixed vs. Variable Expenses", "", `${cad(fixedExpenses)} fixed-style + ${cad(variableExpenses)} variable-style = ${cad(m.expenses)}`)}</span><strong>${cad(m.expenses)}</strong></div><div class="metric-row"><span>Fixed-style categories</span><strong>${cad(fixedExpenses)}</strong></div><div class="metric-row"><span>Variable-style categories</span><strong>${cad(variableExpenses)}</strong></div><div class="metric-row"><span>${term("Savings Rate", "", `${cad(subtractMoney(m.income,m.expenses))} ÷ ${cad(m.income)} = ${pct(m.savingsRate,1)}`)}</span><strong>${pct(m.savingsRate,1)}</strong></div></div></section></div>`;
}
function ledgerScreen() {
  let transactions = visibleTransactions().filter((t) =>
    (!search || `${t.merchant} ${t.category} ${t.account} ${t.owner}`.toLowerCase().includes(search.toLowerCase())) &&
    (categoryFilter === "All categories" || t.category === categoryFilter || (t.splits||[]).some((split)=>split.category===categoryFilter)));
  if (ledgerSort.key === "amount") {
    transactions = HouseholdMath.sortTransactionsBySignedAmount(transactions, ledgerSort.direction, view, jointShare);
  } else {
    transactions.sort((a, b) => {
      const compared = String(a[ledgerSort.key] ?? "").localeCompare(String(b[ledgerSort.key] ?? ""), undefined, { numeric: true, sensitivity: "base" });
      return (compared || a.id.localeCompare(b.id)) * (ledgerSort.direction === "asc" ? 1 : -1);
    });
  }
  const categories = ["All categories", ...new Set(state.transactions.flatMap((t) => [t.category,...(t.splits||[]).map((split)=>split.category)]))];
  return `${pageHeading("Every dollar, in the right place", "Smart ledger", "Card purchases count as expenses; repayments and transfers stay neutral.", `<button class="button" data-action="transaction-add">+ Add income / debt payment</button><button class="button" data-action="receipt-manual">+ Add itemized expense</button><button class="button" data-modal="connect-choice">Connect an account</button><button class="button" data-modal="connect">Connect Plaid</button><button class="button primary" data-modal="import">↑ Import CSV</button>`)}
    <div class="notice bank-sync-status">${plaidConfigured ? "Plaid is configured. You can connect a read-only account or import a CSV statement." : `Bank sync not connected — use CSV import. <button class="button link" data-modal="import">Choose a CSV statement</button>`}</div>
    <div class="grid stats-grid">${statCard("Actual income", cad(metrics().income), "Cleared deposits only", "↗", `${cad(metrics().income)} actual income`)}${statCard("Purchases & bills", cad(metrics().expenses), "Includes credit-card purchases once", "↘", `${cad(metrics().expenses)} categorized expenses`)}${statCard("Monthly Debt Paid", cad(metrics().debtPaid), "Not double-counted as an expense", "⌁", `${cad(metrics().debtPaid)} cleared repayments`)}${statCard("Investment contributions", cad(metrics().invested), "Tracked separately from spending", "◉", `${cad(metrics().invested)} contributions`)}</div>
    <section class="card section-card"><div class="section-title-row"><div><h2>Transactions</h2><p class="muted" style="font-size:11px;margin:5px 0 0">${transactions.length} records · use Split to allocate a multi-category purchase</p></div><button class="button small" data-action="merchant-rules">Merchant rules (${state.merchantRules.length})</button></div><div class="filter-row"><input class="input search-input" id="ledgerSearch" value="${esc(search)}" placeholder="Search merchant, category, account…"><select class="select" id="categoryFilter">${categories.map((category) => `<option ${category === categoryFilter ? "selected" : ""}>${esc(category)}</option>`).join("")}</select><span class="pill">Transfers excluded from expenses</span></div><div class="table-wrap ledger-table-wrap"><table class="ledger-table mobile-table">${ledgerTableHeader(["Date", "Merchant", "Category", "Owner", "Account", "Amount", "Actions"])}<tbody>${transactions.length ? transactions.map(transactionRow).join("") : `<tr><td colspan="7" class="empty-state">No transactions match these filters.</td></tr>`}</tbody></table></div></section>
    <div class="grid content-grid"><section class="card"><div class="card-header"><div><h2>Account routing rules</h2><p>Automatically keep movement separate from spending</p></div></div><div class="metric-list"><div class="metric-row"><span>Chequing → card / loan</span><strong><span class="pill green">Debt repayment · neutral</span></strong></div><div class="metric-row"><span>Chequing → TFSA / RRSP / FHSA</span><strong><span class="pill green">Investment contribution</span></strong></div><div class="metric-row"><span>Account → account / e-Transfer</span><strong><span class="pill">Internal transfer · neutral</span></strong></div><div class="metric-row"><span>Credit card swipe</span><strong><span class="pill amber">Expense + liability</span></strong></div></div></section><section class="card"><div class="card-header"><div><h2>Smart import</h2><p>Canadian bank CSVs · deduplicated by date, amount & last 4</p></div></div><div style="padding:0 18px 18px"><div class="notice">Plaid Link credentials stay on the server. CSV imports are available now; Plaid linking requires a configured server integration.</div></div></section></div>`;
}
function debtScreen() {
  const m = metrics();
  const allDebts = visibleAccounts((a) => a.kind === "liability");
  const debts = allDebts.slice().sort((a,b) => debtSort === "highest-rate" ? HouseholdMath.toBasisPoints(b.apr || "0.00") - HouseholdMath.toBasisPoints(a.apr || "0.00") : debtSort === "largest" ? toCents(b.shownBalance)-toCents(a.shownBalance) : toCents(a.shownBalance)-toCents(b.shownBalance));
  const payoffDebts = debts.filter((a) => !/mortgage/i.test(a.accountType || ""));
  const targetDebt = payoffDebts.find((a) => a.balance > 0);
  const rolledMinimums = sumMoney(payoffDebts.filter((debt) => debt.balance <= 0).map((debt) => sharedAmount(debt.minimumPayment ?? debt.monthlyPayment ?? 0, debt.owner)));
  const targetMinimum = sharedAmount(targetDebt?.minimumPayment ?? targetDebt?.monthlyPayment ?? 0, targetDebt?.owner);
  const totalDebt = amount(debts);
  const monthlyMinimums = m.monthlyDebtPayments;
  const debtIncomeLabel = `${cad(m.monthlyDebtPayments)} monthly minimum payments ÷ ${cad(m.grossMonthly)} estimated gross monthly income = ${pct(m.dti,1)}`;
  const snowballExtra = Math.max(0,Number(state.debtPlanExtraMonthly)||0);
  return `${pageHeading("Make a plan for what you owe", "Debt snowball", "Pay every minimum, focus extra money on the smallest balance, then roll that payment to the next debt.", `<button class="button" data-action="account-add">+ Add a debt</button><button class="button primary" data-action="debt-tip">How this works</button>`)}
    <div class="grid stats-grid">${statCard("Total debt", cad(totalDebt), `${debts.length} tracked accounts`, "⌁", `${cad(totalDebt)} outstanding`)}${statCard("Monthly minimums", cad(monthlyMinimums), m.missingMinimums.length ? `${m.missingMinimums.length} debt(s) need a minimum payment` : "Includes minimums for every debt", "↘", m.missingMinimums.length ? `${cad(monthlyMinimums)} known minimum payments; incomplete until all missing amounts are entered` : `${cad(monthlyMinimums)} minimum payments across all debts`)}${statCard("Extra snowball amount", cad(snowballExtra), "Added to the current target debt", "↗", `${cad(snowballExtra)} planned extra payment`)}${statCard("Debt-to-Income Ratio", pct(m.dti,1), `Based on ${cad(m.grossMonthly)} estimated gross monthly income`, "÷", debtIncomeLabel)}</div>
    ${m.missingMinimums.length ? `<div class="notice warning debt-attention">Needs attention: add the required minimum payment for ${m.missingMinimums.map((debt)=>esc(debt.name)).join(", ")}. The displayed total includes all known minimums and is incomplete until these are entered.</div>` : ""}
    ${sectionCard("Your snowball plan", "Smallest balance first. When a debt is cleared, its minimum payment rolls to the next target.", `<div class="snowball-controls"><label>Sort debts <select class="select" id="debtSort"><option value="snowball" ${debtSort==="snowball"?"selected":""}>Smallest balance (snowball)</option><option value="largest" ${debtSort==="largest"?"selected":""}>Largest balance</option><option value="highest-rate" ${debtSort==="highest-rate"?"selected":""}>Highest interest rate</option></select></label><label>Extra monthly debt amount <input class="input" id="snowballExtra" type="number" min="0" step="0.01" value="${snowballExtra.toFixed(2)}"></label><button class="button small primary" data-action="save-snowball">Save plan</button></div>${targetDebt ? `<div class="snowball-target"><span class="pill green">CURRENT TARGET</span><strong>${esc(targetDebt.name)}</strong><span>${cad(targetDebt.balance)} remaining · ${targetMinimum ? `${cad(targetMinimum)} minimum + ${cad(snowballExtra)} extra${rolledMinimums ? ` + ${cad(rolledMinimums)} rolled from paid-off debts` : ""} = ${cad(sumMoney([targetMinimum,snowballExtra,rolledMinimums]))} planned toward target` : `minimum not set · ${cad(sumMoney([snowballExtra,rolledMinimums]))} extra/rolled amount tracked; enter a minimum payment to calculate the full monthly target`}</span></div>` : `<div class="notice">All non-mortgage debts are paid off. Keep the cash cushion and build your full emergency fund.</div>`}<div class="table-wrap"><table class="mobile-table">${tableHeader(["Order","Debt","Owed to / owner","Balance","Minimum","Paid down","Status"])}<tbody>${debts.length ? debts.map((debt,index)=>{    const beginning=sharedAmount(debt.startingBalance || debt.balance,debt.owner);const paid=Math.max(0,subtractMoney(beginning,debt.shownBalance));const progress=beginning?Math.min(100,paid/beginning*100):100;const current=debt.id===targetDebt?.id;const missing=debt.balance>0&&!Number(debt.minimumPayment??debt.monthlyPayment);return `<tr class="${missing?"needs-attention":""}"><td data-label="Order"><span class="pill ${current?"green":""}">${/mortgage/i.test(debt.accountType||"")?"Later":`#${index+1}`}</span></td><td data-label="Debt"><strong>${esc(debt.name)}</strong><small class="muted" style="display:block;margin-top:3px">${esc(debt.accountType||"Debt")} · ${String(debt.apr||"0.00")}% APR</small></td><td data-label="Owed to / owner">${esc(debt.institution||"Personal loan")} · ${esc(debt.owner)}</td><td data-label="Balance" class="amount">${cad(debt.shownBalance)}</td><td data-label="Minimum">${missing?`<span class="pill red">Needs attention · <button class="table-action" data-edit-account="${esc(debt.id)}">Set minimum</button></span>`:cad(sharedAmount(debt.minimumPayment ?? debt.monthlyPayment ?? 0,debt.owner))}</td><td data-label="Paid down"><div class="progress"><span style="width:${progress}%"></span></div><small class="muted">${cad(paid)} paid · ${progress.toFixed(0)}%</small></td><td data-label="Status">${missing?`<span class="pill red">Minimum missing</span>`:current?`<span class="pill amber">Snowball target</span>`:debt.balance<=0?`<span class="pill green">Paid off</span>`:`<button class="table-action" data-edit-account="${esc(debt.id)}">Edit</button>`}</td></tr>`}).join(""):`<tr><td colspan="7" class="empty-state">Add a debt to build your payoff plan.</td></tr>`}</tbody></table></div>`)}
    <div class="grid two-col">${debts.map((debt) => {
      const payment = sharedAmount(debt.monthlyPayment ?? debt.minimumPayment ?? 0, debt.owner);
      const months = debt.amortizationMonths || (payment ? Math.max(1, Math.ceil(debt.shownBalance / payment)) : 0);
      const interest = fromCents(roundedDivision(toCents(debt.shownBalance) * HouseholdMath.toBasisPoints(debt.apr || "0.00"), 120000));
      const principal = Math.max(0, subtractMoney(payment, interest));
      const shownLimit = sharedAmount(debt.limit || 0, debt.owner);
      const amortizationCalculation = debt.amortizationMonths
        ? `Recorded schedule: ${months} months for a ${cad(debt.shownBalance)} balance.`
        : payment
          ? `${cad(debt.shownBalance)} balance ÷ ${cad(payment)} monthly payment ≈ ${months} months before future interest.`
          : "Enter a payment to estimate payoff time.";
      return `<article class="card" style="padding:19px;margin-bottom:16px"><div class="account-head"><div><div class="account-name">${esc(debt.name)}</div><div class="account-sub">${esc(debt.institution||"Personal loan")} · ${esc(debt.owner)}</div></div><span class="pill ${HouseholdMath.toBasisPoints(debt.apr || "0.00") >= 1200 ? "red" : "amber"}">${String(debt.apr||"0.00")}% APR</span></div><div class="account-value">${cad(debt.shownBalance)}</div><div class="account-sub">${debt.accountType === "Credit card" ? `${cad(shownLimit)} credit limit · ${shownLimit?((debt.shownBalance / shownLimit) * 100).toFixed(0):0}% utilization` : debt.shownBalance<=0?"Paid in full":months?`Estimated payoff in ${months} months`:"Enter a payment to estimate payoff"}</div><div class="metric-list" style="padding:8px 0 0"><div class="metric-row"><span>Next due date</span><strong>${debt.dueDate?dateLabel(debt.dueDate):"Not set"}</strong></div><div class="metric-row"><span>Minimum payment</span><strong>${debt.minimumPayment || debt.monthlyPayment ? cad(payment) : "Not set"}</strong></div><div class="metric-row"><span>${term("Principal vs. Interest", "", payment ? `${cad(payment)} monthly payment = ${cad(principal)} principal + ${cad(interest)} estimated interest` : "Enter a payment to estimate the principal and interest split")}</span><strong>${payment ? `${cad(principal)} / ${cad(interest)}` : "Set payment"}</strong></div><div class="metric-row"><span>${term("Amortization", "", amortizationCalculation)}</span><strong>${months ? `${months} months` : "Not available"}</strong></div><div class="metric-row"><span></span><strong><button class="table-action" data-edit-account="${esc(debt.id)}">Edit debt details</button></strong></div></div></article>`;
    }).join("")}</div>
    ${sectionCard("How the snowball rolls", "Pay minimums on every debt, then aim your extra amount at the current target. Once it is paid off, its minimum joins your extra amount for the next smallest debt.", `<div class="notice">The snowball favors momentum, not lowest interest cost. Keep all required minimums current; compare the highest-rate view if reducing interest is your priority. Mortgage stays outside Baby Step 2.</div>`)}`;
}
function receiptItemCents(item) {
  if (Number.isSafeInteger(item.lineTotalCents)) return item.lineTotalCents;
  return amountCents(item, "amount");
}
function receiptCandidate(receipt, transaction) {
  if (!receipt || !transaction || transaction.type !== "expense") return false;
  const receiptDate = new Date(`${receipt.date}T12:00:00Z`);
  const transactionDate = new Date(`${transaction.date}T12:00:00Z`);
  if (!Number.isFinite(receiptDate.getTime()) || !Number.isFinite(transactionDate.getTime()) ||
      Math.abs(receiptDate - transactionDate) > 3 * 86400000) return false;
  const receiptName = String(receipt.merchant || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const transactionName = String(transaction.merchant || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!receiptName || !transactionName) return false;
  if (receiptName.includes(transactionName) || transactionName.includes(receiptName)) return true;
  return String(receipt.merchant || "").toLowerCase().split(/[^a-z0-9]+/)
    .some((word) => word.length >= 4 && String(transaction.merchant || "").toLowerCase().includes(word));
}
function receiptForTransaction(transaction) {
  return (state.groceryReceipts || []).find((receipt) =>
    receipt.id === transaction?.receiptId || receipt.expenseTransactionId === transaction?.id);
}
function expenseAgreement(receipt) {
  const receiptCents = Number(receipt.receiptTotalCents ?? receipt.expenseTotalCents ?? 0);
  const ledger = state.transactions.find((item) => item.id === receipt.expenseTransactionId);
  const ledgerCents = ledger ? amountCents(ledger, "amount") : Number(receipt.ledgerTotalCents ?? receipt.expenseTotalCents ?? receiptCents);
  const bank = receipt.matchedTransactionId ? state.transactions.find((item) => item.id === receipt.matchedTransactionId) : null;
  if (!bank) return { status: "waiting", label: "Waiting for a bank match", receiptCents, ledgerCents, bankCents: null, lines: [] };
  const bankCents = amountCents(bank, "amount");
  const lines = [];
  const differ = (left, leftCents, right, rightCents) => {
    if (leftCents === rightCents) return;
    lines.push(`${left} ${cad(fromCents(leftCents))} and ${right} ${cad(fromCents(rightCents))} differ by ${cad(fromCents(Math.abs(rightCents - leftCents)))}`);
  };
  differ("Receipt", receiptCents, "Ledger", ledgerCents);
  differ("Receipt", receiptCents, "Bank", bankCents);
  differ("Ledger", ledgerCents, "Bank", bankCents);
  return lines.length
    ? { status: "needs review", label: "Needs review", receiptCents, ledgerCents, bankCents, lines }
    : { status: "matched", label: "Matched — all three totals agree", receiptCents, ledgerCents, bankCents, lines };
}
function agreementMarkup(receipt) {
  const agreement = expenseAgreement(receipt);
  const numbers = `<div class="receipt-check-numbers"><span>Receipt: ${cad(fromCents(agreement.receiptCents))}</span><span>Ledger: ${cad(fromCents(agreement.ledgerCents))}</span><span>Bank: ${agreement.bankCents == null ? "not matched" : cad(fromCents(agreement.bankCents))}</span></div>`;
  if (agreement.status === "waiting") return `${numbers}<div class="notice">Waiting for a bank match. This is not a mismatch.</div>`;
  if (agreement.status === "matched") return `${numbers}<div class="notice">Matched — all three totals agree.</div>`;
  return `${numbers}<div class="notice receipt-mismatch"><strong>Needs review.</strong> ${agreement.lines.map(esc).join(" ")}</div>`;
}
function unmatchedBankTransactions() {
  return state.transactions.filter((transaction) =>
    transaction.type === "expense" && transaction.status !== "Superseded" && transaction.source !== "receipt" &&
    !transaction.receiptId && (transaction.bankImported || transaction.note === "CSV import" || transaction.note === "Bank sync"));
}
function receiptSuggestions() {
  return (state.groceryReceipts || []).flatMap((receipt) => {
    if (receipt.matchedTransactionId) return [];
    const receiptCents = Number(receipt.receiptTotalCents ?? receipt.expenseTotalCents ?? 0);
    return unmatchedBankTransactions().filter((transaction) =>
      !(receipt.rejectedTransactionIds || []).includes(transaction.id) &&
      !(transaction.rejectedReceiptIds || []).includes(receipt.id) &&
      receiptCandidate(receipt, transaction) &&
      amountCents(transaction, "amount") === receiptCents
    ).map((transaction) => ({ receipt, transaction }));
  });
}
function suggestionCard({ receipt, transaction }) {
  const receiptCents = Number(receipt.receiptTotalCents ?? receipt.expenseTotalCents ?? 0);
  const bankCents = amountCents(transaction, "amount");
  return `<article class="receipt-card"><div class="receipt-card-head"><strong>${esc(receipt.merchant)} · ${dateLabel(receipt.date)} · ${cad(fromCents(receiptCents))}</strong><span class="pill amber">Suggested · not matched</span></div><div class="receipt-check-numbers"><span>Receipt store: ${esc(receipt.merchant)}</span><span>Bank store: ${esc(transaction.merchant)}</span><span>Bank date: ${dateLabel(transaction.date)}</span><span>Bank amount: ${cad(fromCents(bankCents))}</span></div><p class="muted">Amount, date, and store match. Nothing is linked until you confirm.</p><div class="receipt-card-actions"><button type="button" class="button small primary" data-action="receipt-confirm" data-receipt-id="${esc(receipt.id)}" data-transaction-id="${esc(transaction.id)}">Confirm</button><button type="button" class="button small" data-action="receipt-reject" data-receipt-id="${esc(receipt.id)}" data-transaction-id="${esc(transaction.id)}">Reject</button></div></article>`;
}
function babyStepsScreen() {
  const m=metrics();
  const starter=amount(visibleAccounts(a=>a.kind==="cash"&&/emergency|starter fund/i.test(`${a.name} ${a.bucket||""}`)));
  const essentialsMonthly=Math.max(m.essentials,fromCents(roundedDivision(toCents(m.netMonthly)*55,100)),1);
  const fullFundTarget=fromCents(toCents(essentialsMonthly)*3);
  const fullFund=starter;
  const nonMortgageAccounts=visibleAccounts(a=>a.kind==="liability"&&!/mortgage/i.test(a.accountType||""));
  const nonMortgageDebt=amount(nonMortgageAccounts);
  const startingNonMortgageDebt=sumMoney(nonMortgageAccounts.map(a=>sharedAmount(a.startingBalance || a.balance,a.owner)));
  const currentStep=starter<1000?1:nonMortgageDebt>0?2:fullFund<fullFundTarget?3:4;
  const steps=[
    ["Starter emergency cushion","Save the first $1,000 for small surprises.",starter,1000,"Savings bucket · 15%"],
    ["Debt snowball","Pay off non-mortgage debt smallest-to-largest, keeping minimums current.",Math.max(0,subtractMoney(startingNonMortgageDebt,nonMortgageDebt)),Math.max(1,startingNonMortgageDebt),"Debt bucket · 10% + planned snowball"],
    ["Full emergency fund","Build three months of essential expenses; you can adjust the 3–6 month goal in your plan.",fullFund,fullFundTarget,"Savings bucket · 15%"],
    ["Build wealth","Invest at least 15% toward long-term wealth; redirect snowball payments here when debt is clear.",m.invested,Math.max(1,fromCents(roundedDivision(toCents(m.netMonthly)*15,100))),"Investments bucket · 15%"]
  ];
  const receipts=state.groceryReceipts||[];
  const filteredReceipts=receipts.filter((receipt)=>
    !receiptSearch||`${receipt.merchant} ${(receipt.items||[]).map((item)=>item.name).join(" ")}`.toLowerCase().includes(receiptSearch.toLowerCase())
  ).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  const suggestions=receiptSuggestions();
  const reviewReceipts=(state.groceryReceipts||[]).filter((receipt)=>expenseAgreement(receipt).status==="needs review");
  const suggestionMarkup=`<section class="card section-card" id="receiptSuggestions"><div class="section-title-row"><div><h2>Suggested receipt matches</h2><p class="muted" style="font-size:11px;margin:5px 0 0">Imported bank rows that match a saved receipt on amount, date, and store. Nothing is linked until you press Confirm. Reject only hides the suggestion.</p></div><span class="pill">${suggestions.length} suggested</span></div>${suggestions.length?suggestions.map(suggestionCard).join(""):`<div class="empty-state">No unmatched imported transaction currently matches a saved receipt on amount, date, and store.</div>`}</section>`;
  const reviewMarkup=`<section class="card section-card" id="needsReviewList"><div class="section-title-row"><div><h2>Needs review</h2><p class="muted" style="font-size:11px;margin:5px 0 0">Receipt, ledger, and bank totals that do not agree to the cent.</p></div><span class="pill ${reviewReceipts.length?"amber":"green"}">Needs review: ${reviewReceipts.length}</span></div>${reviewReceipts.length?reviewReceipts.map((receipt)=>`<article class="receipt-card"><div class="receipt-card-head"><strong>${esc(receipt.merchant)} · ${dateLabel(receipt.date)}</strong><span class="pill amber">Needs review</span></div>${agreementMarkup(receipt)}<button type="button" class="button small" data-view-receipt="${esc(receipt.id)}">Open expense</button></article>`).join(""):`<div class="empty-state">No expenses need review.</div>`}</section>`;
  const receiptMarkup=filteredReceipts.length?filteredReceipts.map((receipt)=>{
    const agreement=expenseAgreement(receipt);
    const status=agreement.status==="matched"?`<span class="pill green">${esc(agreement.label)}</span>`:agreement.status==="needs review"?`<span class="pill amber">Needs review</span>`:`<span class="pill">Waiting for a bank match</span>`;
    const items=(receipt.items||[]).map((item)=>`<li><span>${esc(item.name)} · ${Number(item.quantity||1)} × ${cad(fromCents(Number(item.unitPriceCents??receiptItemCents(item))))} · ${esc(item.category||item.bucket||"Uncategorized")}</span><strong>${cad(fromCents(receiptItemCents(item)))}</strong></li>`).join("");
    return `<article class="receipt-card"><div class="receipt-card-head"><div><strong>${esc(receipt.merchant)}</strong><div class="muted">${dateLabel(receipt.date)} · ${esc(receipt.owner||"Household")} · ${esc(state.accounts.find((account)=>account.id===receipt.accountId)?.name||"Payment account")}</div></div>${status}</div><ul class="receipt-item-list">${items}</ul><div class="receipt-card-total"><strong>Receipt total ${cad(fromCents(agreement.receiptCents))}</strong>${agreementMarkup(receipt)}</div><div class="receipt-card-actions"><button type="button" class="button small" data-view-receipt="${esc(receipt.id)}">View expense details</button>${receipt.hasAttachment?`<a class="button small" href="/api/receipts/${encodeURIComponent(receipt.id)}/file" target="_blank" rel="noopener">Open original ${receipt.attachmentType==="application/pdf"?"PDF":"photo"}</a>`:'<span class="muted">No receipt file attached</span>'}</div></article>`;
  }).join(""):`<div class="empty-state">${receipts.length?"No saved expenses match your search.":"No itemized expenses yet. Add one by hand or upload a receipt photo."}</div>`;
  return `${pageHeading("Simple steps, one household plan","Baby Steps & itemized expenses","Keep receipt proof and reviewed line items with each household expense.",`<button class="button" data-action="receipt-manual">+ Add expense by hand</button><button class="button primary" data-action="receipt-scan">＋ Upload / take receipt photo</button>`)}
    ${sectionCard("Your Baby Steps",`Current focus: Step ${currentStep} · based on balances you’ve entered`,`${steps.map((step,index)=>{const number=index+1;const active=number===currentStep;const complete=number<currentStep;const progress=Math.min(100,Math.max(0,step[3]?step[2]/step[3]*100:0));return `<div class="baby-step ${active?"active":""} ${complete?"complete":""}"><span class="step-number">${complete?"✓":number}</span><div class="step-copy"><strong>${esc(step[0])}</strong><p>${esc(step[1])}</p><div class="progress"><span style="width:${progress}%"></span></div><small>${number===2?`${cad(nonMortgageDebt)} non-mortgage debt remains`:number===1?`${cad(starter)} of ${cad(1000)} starter cushion`:number===3?`${cad(fullFund)} of ${cad(fullFundTarget)} full-fund target`:`${cad(m.invested)} recorded investment contributions · target guide ${cad(step[3])}`}</small><span class="pill">${esc(step[4])}</span></div></div>`}).join("")}<div class="notice">A simple adaptation of Dave Ramsey’s Baby Steps for your household plan—not financial advice. The 15% savings bucket builds your emergency cushion; the 15% investments bucket supports long-term wealth. During the debt step, use the 10% debt bucket plus any planned snowball extra. When non-mortgage debt is cleared, consider rolling that payment into wealth building.</div>`)}
    ${reviewMarkup}
    ${suggestionMarkup}
    ${sectionCard("Itemized expenses & receipt proof","Each line item is categorized separately. An imported bank transaction is only linked after you confirm it.",`<div class="filter-row"><input class="input search-input" id="receiptSearch" placeholder="Search store or item…" value="${esc(receiptSearch)}"><button class="button small" data-action="receipt-manual">Add by hand</button><button class="button small" data-action="receipt-scan">Upload / take photo</button></div>${receiptMarkup}`)}`;
}
function investmentsScreen() {
  const accounts = visibleAccounts((a) => a.kind === "investment");
  const m = metrics();
  const gains = sumMoney(accounts.map((a) => subtractMoney(a.shownBalance, sharedAmount(a.acb || 0, a.owner))));
  const allocationNames = ["Equities", "ETFs", "Bonds", "Cash"];
  const allocationCents = Object.fromEntries(allocationNames.map((name) => [name, accounts.reduce((total, account) => {
    const allocation = account.allocation || { Equities: "50.00", ETFs: "25.00", Bonds: "20.00", Cash: "5.00" };
    return total + roundedDivision(toCents(account.shownBalance) * HouseholdMath.toBasisPoints(allocation[name] || "0.00"), 10000);
  }, 0)]));
  const allocationCalculation = allocationNames.map((name) =>
    `${name} ${cad(fromCents(allocationCents[name]))} ÷ ${cad(m.investments)} = ${pct(m.investments ? allocationCents[name] / toCents(m.investments) * 100 : 0, 1)}`
  ).join("; ");
  const deductions = state.taxDeductions.filter((item) => relevantOwner(item.owner) > 0)
    .map((item) => ({ ...item, shownAmount: sharedAmount(item.amount, item.owner) }));
  return `${pageHeading("Invest with the whole picture", "Investments & tax vault", "Canadian account types, portfolio mix, adjusted cost base, and deductible receipts.", `<button class="button" data-action="tax-export">↓ Export tax CSV</button><button class="button primary" data-action="balance-update">Quarterly balance update</button>`)}
    <div class="grid stats-grid">${statCard("Investment assets", cad(m.investments), `${accounts.length} accounts in this view`, "◉", `${cad(m.investments)} total recorded investment balances`)}${statCard("Unrealized gain / loss", `${gains >= 0 ? "+" : "−"}${cad(Math.abs(gains))}`, "Market value less tracked ACB", "↗", `${cad(m.investments)} market value − ${cad(m.basis)} tracked ACB = ${cad(gains)}`)}${statCard("Cost Basis / ACB", cad(m.basis), "Tracked adjusted cost base", "▤", `Total tracked ACB across ${accounts.length} investment accounts = ${cad(m.basis)}`)}${statCard("Tax receipts", `${deductions.length} receipts`, `${cad(sumMoney(deductions.map((d)=>d.shownAmount)))} tagged`, "⌑", `${deductions.length} tagged receipts`)}</div>
    <section class="card section-card"><div class="section-title-row"><div><h2>Canadian portfolio overview</h2><p class="muted" style="font-size:11px;margin:5px 0 0">${term("Asset Allocation", "", allocationCalculation)}</p></div><span class="pill green">TFSA · RRSP · FHSA · Non-Registered</span></div><div class="account-grid">${accounts.map((a) => {
      const gain = subtractMoney(a.shownBalance, sharedAmount(a.acb || 0, a.owner));
      const allocation = a.allocation || { Equities: 50, ETFs: 25, Bonds: 20, Cash: 5 };
      return `<article class="account-card"><div class="account-head"><div><div class="account-name">${esc(a.name)}</div><div class="account-sub">${esc(a.accountType)} · ${esc(a.owner)}</div></div>${a.manual ? `<span class="pill amber">Manual · quarterly</span>` : `<span class="pill green">Synced</span>`}</div><div class="account-value">${cad(a.shownBalance)}</div><div class="account-change">${gain >= 0 ? "+" : "−"}${cad(Math.abs(gain))} unrealized · ACB ${cad(sharedAmount(a.acb || 0,a.owner))}</div><div class="allocation">${Object.values(allocation).map((value) => `<span style="width:${value}%"></span>`).join("")}</div><div class="account-sub" style="margin-top:8px">Equities ${Number(allocation.Equities)}% · ETFs ${Number(allocation.ETFs)}% · Bonds ${Number(allocation.Bonds)}% · Cash ${Number(allocation.Cash)}%</div></article>`;
    }).join("")}</div></section>
    <div class="grid content-grid"><section class="card section-card"><div class="section-title-row"><div><h2>Tax-deduction log</h2><p class="muted" style="font-size:11px;margin:5px 0 0">Keep receipt tags together for tax season</p></div><button class="button small" data-action="tax-add">+ Add receipt</button></div><div class="table-wrap"><table class="mobile-table tax-list">${tableHeader(["Date", "Merchant", "Category", "Owner", "Tag", "Amount"])}<tbody>${deductions.map((d) => `<tr><td>${dateLabel(d.date)}</td><td><strong>${esc(d.merchant)}</strong></td><td><span class="pill">${esc(d.category)}</span></td><td>${esc(d.owner)}</td><td>${esc(d.tag)}</td><td class="amount">${cad(d.shownAmount,2)}</td></tr>`).join("")}</tbody></table></div></section><section class="card"><div class="card-header"><div><h2>Account types</h2><p>Contribution limits and tax treatment vary by account</p></div></div><div class="metric-list"><div class="metric-row"><span>TFSA</span><strong>Tax-free growth / withdrawals</strong></div><div class="metric-row"><span>RRSP</span><strong>Tax-deferred retirement savings</strong></div><div class="metric-row"><span>FHSA</span><strong>First-home saving, eligible tax benefits</strong></div><div class="metric-row"><span>Non-registered</span><strong>ACB tracking may be important</strong></div></div></section></div>`;
}
function pageMarkup() {
  const content = { overview: overviewScreen, balance: balanceScreen, cashflow: cashflowScreen, ledger: ledgerScreen, debt: debtScreen, plan: babyStepsScreen, investments: investmentsScreen }[screen]();
  const page = app.querySelector("#pageContent");
  page.innerHTML = content;
  bindPageEvents();
}

function modalMarkup() {
  if (modal && modal.type === "split") {
    const transaction = state.transactions.find((t) => t.id === modal.splitId);
    if (!transaction) return "";
    const receipt = receiptForTransaction(transaction);
    const categories = ["Groceries","Housing & Utilities","Dining","Transit & Fuel","Childcare","Medical","Shopping","Subscriptions","Other"];
    if (receipt?.items?.length) {
      const itemTotal = receipt.items.reduce((total, item) => total + receiptItemCents(item), 0);
      const transactionCents = amountCents(transaction, "amount");
      return `<div class="modal-backdrop" data-action="backdrop"><section class="modal"><div class="modal-head"><div><div class="eyebrow">Line items</div><h2>Split this receipt by item</h2><p class="subtitle" style="margin-top:6px">${esc(transaction.merchant)} · ${cad(transaction.amount,2)}</p></div><button type="button" class="modal-close" data-action="modal-close">×</button></div><p class="muted">Each item keeps its own amount. Choose a category for each item. The item total must equal the expense total.</p><div id="splitLines">${receipt.items.map((item, index) => `<div class="split-line item-split-line"><span>${esc(item.name)}</span><strong>${cad(fromCents(receiptItemCents(item)))}</strong><select class="select split-item-category" data-index="${index}">${categories.map((category)=>`<option value="${esc(category)}" ${(item.category||"Groceries")===category?"selected":""}>${category}</option>`).join("")}</select></div>`).join("")}</div><div class="notice ${itemTotal===transactionCents?"":"receipt-mismatch"}" id="splitTotal">Item total: ${cad(fromCents(itemTotal))} · Expense total: ${cad(fromCents(transactionCents))}${itemTotal===transactionCents?"":` · Difference: ${cad(fromCents(transactionCents-itemTotal))}`}</div><div class="modal-actions"><button type="button" class="button" data-action="modal-close">Cancel</button><button type="button" class="button primary" data-action="split-save">Save item categories</button></div></section></div>`;
    }
    const lines = modal.lines || [{ category: transaction.category, amount: transaction.amount }, { category: "Household", amount: 0 }];
    const splitTotal = sumMoney(lines.map((line) => line.amount));
    return `<div class="modal-backdrop" data-action="backdrop"><section class="modal"><div class="modal-head"><div><div class="eyebrow">Transaction details</div><h2>Split this transaction</h2><p class="subtitle" style="margin-top:6px">${esc(transaction.merchant)} · ${cad(transaction.amount,2)}</p></div><button type="button" class="modal-close" data-action="modal-close">×</button></div><div id="splitLines">${lines.map((line, index) => `<div class="split-line"><select class="select split-category" data-index="${index}">${categories.map((category)=>`<option ${line.category===category?"selected":""}>${category}</option>`).join("")}</select><input class="input split-amount" data-index="${index}" type="number" step="0.01" min="0" value="${Number(line.amount).toFixed(2)}"></div>`).join("")}</div><button type="button" class="button small" data-action="add-split">+ Add category</button><div class="form-row" style="margin-top:16px"><label><input id="saveRule" type="checkbox"> Save Merchant Rule for ${esc(transaction.merchant)}</label><div class="muted" style="font-size:10px;margin-top:5px">Remember this category preference for future imports.</div></div><div class="notice" id="splitTotal">Split total: ${cad(splitTotal)} · Transaction total: ${cad(transaction.amount,2)}</div><div class="modal-actions"><button type="button" class="button" data-action="modal-close">Cancel</button><button type="button" class="button primary" data-action="split-save">Save split</button></div></section></div>`;
  }
  if (modal && modal.type === "account") {
    const account=state.accounts.find(item=>item.id===modal.id);
    const kinds=["Chequing","Savings","Emergency fund","TFSA","RRSP","FHSA","Non-Registered","Credit card","Line of credit","Car loan","Student loan","Mortgage","Personal loan"];
    const type=account?.accountType||account?.bucket||"Chequing";
    return `<div class="modal-backdrop" data-action="backdrop"><section class="modal"><div class="modal-head"><div><div class="eyebrow">Household money</div><h2>${account?"Edit account or loan":"Add account or private loan"}</h2><p class="subtitle" style="margin-top:6px">Enter balances manually. Private loans can be named for the person you owe.</p></div><button class="modal-close" data-action="modal-close">×</button></div><form id="accountForm"><input type="hidden" name="id" value="${esc(account?.id||"")}"><div class="form-row"><label>Account or debt name</label><input class="input" name="name" required maxlength="80" placeholder="e.g. Loan from Alex" value="${esc(account?.name||"")}"></div><div class="grid two-col"><div class="form-row"><label>Type</label><select class="select" name="accountType">${kinds.map(item=>`<option ${item===type?"selected":""}>${item}</option>`).join("")}</select></div><div class="form-row"><label>Owner</label><select class="select" name="owner">${["Joint","Partner A","Partner B"].map(owner=>`<option ${owner===(account?.owner||"Joint")?"selected":""}>${owner}</option>`).join("")}</select></div></div><div class="form-row"><label>Bank or person owed (optional)</label><input class="input" name="institution" maxlength="80" placeholder="e.g. Alex" value="${esc(account?.institution||"")}"></div><div class="grid two-col"><div class="form-row"><label>Current balance (CAD)</label><input class="input" name="balance" type="number" min="0" step="0.01" required value="${Number(account?.balance||0)}"></div><div class="form-row"><label>Starting balance (for payoff progress)</label><input class="input" name="startingBalance" type="number" min="0" step="0.01" value="${Number(account?.startingBalance ?? account?.balance ?? 0)}"></div></div><div class="grid two-col">    <div class="form-row"><label>Interest rate (APR %)</label><input class="input" name="apr" type="text" inputmode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" value="${esc(String(account?.apr ?? "0.00"))}"></div><div class="form-row"><label>Minimum monthly payment <span id="minimumRequiredHint"></span></label><input class="input" id="minimumPaymentInput" name="minimumPayment" type="number" min="0" step="0.01" value="${account?.minimumPayment ?? account?.monthlyPayment ?? ""}"></div></div><div class="grid two-col"><div class="form-row"><label>Credit limit (if applicable)</label><input class="input" name="limit" type="number" min="0" step="0.01" value="${Number(account?.limit||0)}"></div><div class="form-row"><label>Next due date (optional)</label><input class="input" name="dueDate" type="date" value="${esc(account?.dueDate||"")}"></div></div><div class="form-row"><label>Adjusted cost base (investment)</label><input class="input" name="acb" type="number" min="0" step="0.01" value="${Number(account?.acb||0)}"></div><div class="notice">For debts, the starting balance helps show progress as you update today’s balance. Mortgage is listed but kept outside the non-mortgage snowball target.</div><div class="modal-actions"><button type="button" class="button" data-action="modal-close">Cancel</button><button class="button primary">Save account</button></div></form></section></div>`;
  }
  if (modal === "transaction" || modal?.type === "transaction") {
    const transaction=modal.type==="transaction"?state.transactions.find(item=>item.id===modal.id):null;
    const today=householdDate();
    const categories=["Groceries","Housing & Utilities","Transit & Fuel","Childcare","Medical","Dining","Shopping","Subscriptions","Salary","Debt repayment","Other"];
    const typeOptions=transaction?`<option value="expense" ${transaction.type==="expense"?"selected":""}>Spending</option><option value="income" ${transaction.type==="income"?"selected":""}>Income</option><option value="debt" ${transaction.category==="Debt repayment"?"selected":""}>Debt payment</option>`:`<option value="income">Income</option><option value="debt">Debt payment</option>`;
    return `<div class="modal-backdrop" data-action="backdrop"><section class="modal"><div class="modal-head"><div><div class="eyebrow">Manual ledger entry</div><h2>${transaction?"Edit":"Add"} ${transaction?"ledger entry":"income or debt payment"}</h2><p class="subtitle" style="margin-top:6px">Expenses are added with item details and receipt proof. A repayment reduces cash and the selected debt.</p></div><button class="modal-close" data-action="modal-close">×</button></div><form id="transactionForm"><input type="hidden" name="id" value="${esc(transaction?.id||"")}"><div class="form-row"><label>Description or merchant</label><input class="input" name="merchant" required maxlength="100" placeholder="e.g. Paycheque" value="${esc(transaction?.merchant||"")}"></div><div class="grid two-col"><div class="form-row"><label>Entry type</label><select class="select" name="type">${typeOptions}</select></div><div class="form-row"><label>Amount (CAD)</label><input class="input" name="amount" type="number" min="0.01" step="0.01" required value="${transaction?.amount??""}"></div></div><div class="grid two-col"><div class="form-row"><label>Budget category</label><select class="select" name="category">${categories.map(category=>`<option ${category===(transaction?.category||"Groceries")?"selected":""}>${category}</option>`).join("")}</select></div><div class="form-row"><label>Date</label><input class="input" name="date" type="date" value="${esc(transaction?.date||today)}" required></div></div><div class="form-row"><label>Account (cash source for debt payment)</label><select class="select" name="accountId">${state.accounts.filter(account=>account.kind==="cash").map(account=>`<option value="${esc(account.id)}" ${account.name===transaction?.account&&account.owner===transaction?.owner?"selected":""}>${esc(account.name)} · ${esc(account.owner)}</option>`).join("")}</select></div><div class="form-row" id="debtTargetWrap" ${transaction?.category==="Debt repayment"?"":"hidden"}><label>Debt being paid</label><select class="select" name="debtAccountId">${state.accounts.filter(account=>account.kind==="liability").map(account=>`<option value="${esc(account.id)}" ${account.id===transaction?.debtAccountId?"selected":""}>${esc(account.name)} · ${esc(account.owner)}</option>`).join("")}</select></div><div class="notice">For future bills or paydays, use Cash flow → Add recurring item. Debt payments are transfers, not extra spending.</div><div class="modal-actions"><button type="button" class="button" data-action="modal-close">Cancel</button><button class="button primary">Save entry</button></div></form></section></div>`;
  }
  if (modal === "receipt-scan" || modal === "receipt-entry") {
    const accounts=state.accounts.filter((account)=>account.kind==="cash"||account.kind==="liability");
    const defaultAccount=accounts.find((account)=>account.owner===signedInUser&&account.kind==="cash")||accounts[0];
    const draft=receiptDraft||{merchant:"",date:householdDate(),receiptTotalCents:0,accountId:defaultAccount?.id||"",items:[]};
    const categories=["Groceries","Housing & Utilities","Dining","Transit & Fuel","Childcare","Medical","Shopping","Subscriptions","Other"];
    const itemTotal=draft.items.reduce((total,item)=>total+(Number.isSafeInteger(item.lineTotalCents)?item.lineTotalCents:Number(item.amountCents)||0),0);
    const initialTotal=Number.isSafeInteger(draft.receiptTotalCents)?draft.receiptTotalCents:itemTotal;
    const account=accounts.find((entry)=>entry.id===draft.accountId)||defaultAccount;
    const attachmentPreview=receiptAttachmentDraft?.type?.startsWith("image/")?`<img class="receipt-preview" src="${receiptAttachmentDraft.dataUrl}" alt="Original receipt photo preview">`:receiptAttachmentDraft?.type==="application/pdf"?`<div class="notice">PDF attached: ${esc(receiptAttachmentDraft.name)} · ${Math.ceil(receiptAttachmentDraft.bytes/1024)} KB</div>`:"";
    const status=receiptAttachmentDraft?.status||"Choose a receipt image for on-device OCR, or attach a PDF and enter items below.";
    return `<div class="modal-backdrop" data-action="backdrop"><section class="modal receipt-modal"><div class="modal-head"><div><div class="eyebrow">${modal==="receipt-scan"?"Receipt photo review":"Manual itemized expense"}</div><h2>${modal==="receipt-scan"?"Review receipt items":"Add an itemized expense"}</h2><p class="subtitle" style="margin-top:6px">Nothing is saved until you review the details and the cents match.</p></div><button class="modal-close" data-action="modal-close">×</button></div>${modal==="receipt-scan"?`<div class="drop-zone"><label for="receiptImage" class="button small">Take photo / choose image or PDF</label><input type="file" id="receiptImage" accept="image/*,application/pdf" capture="environment" hidden><div id="receiptOcrStatus" style="margin-top:9px">${esc(status)}</div>${attachmentPreview}</div>`:""}<form id="receiptForm"><div class="form-row" style="margin-top:15px"><label>Store or merchant</label><input id="receiptMerchant" class="input" maxlength="100" required value="${esc(draft.merchant)}"></div><div class="grid two-col"><div class="form-row"><label>Date</label><input id="receiptDate" class="input" type="date" required value="${esc(draft.date)}"></div><div class="form-row"><label>Payment account</label><select class="select" id="receiptAccount" required>${accounts.map((entry)=>`<option value="${esc(entry.id)}" ${entry.id===account?.id?"selected":""}>${esc(entry.name)} · ${esc(entry.owner)} · ${entry.kind==="liability"?"Credit card":"Cash"}</option>`).join("")}</select></div></div><div class="form-row"><label>Receipt total (CAD)</label><input id="receiptTotal" class="input" type="number" min="0.01" step="0.01" required value="${fromCents(initialTotal).toFixed(2)}"></div><div class="receipt-items-head"><strong>Line items · categorize each item</strong><button class="button small" type="button" data-action="receipt-add-item">+ Add item</button></div><div class="receipt-item-labels"><span>Item</span><span>Qty</span><span>Price each</span><span>Line total</span><span>Category</span><span></span></div><div id="receiptItems">${draft.items.map((item,index)=>`<div class="receipt-item-row"><input class="input receipt-item-name" aria-label="Item name" maxlength="120" required value="${esc(item.name)}" placeholder="Item"><input class="input receipt-item-quantity" aria-label="Quantity" type="number" min="1" max="999" step="1" required value="${Number(item.quantity||1)}" placeholder="Qty"><input class="input receipt-item-price" aria-label="Price per item" type="number" min="0" step="0.01" required value="${fromCents(Number(item.unitPriceCents??item.amountCents??0)).toFixed(2)}" placeholder="Price each"><output class="receipt-line-total">${cad(fromCents(Number(item.lineTotalCents??item.amountCents??0)))}</output><select class="select receipt-item-category" aria-label="Item category">${categories.map((category)=>`<option value="${category}" ${category===(item.category||"Groceries")?"selected":""}>${category==="Dining"?"Eating Out (Dining)":category}</option>`).join("")}</select><button class="button small" type="button" data-remove-receipt-item="${index}" aria-label="Remove item">×</button></div>`).join("")||`<p class="muted" id="receiptEmpty">Add at least one line item.</p>`}</div><div class="receipt-total-check"><span>Items total: <strong id="receiptItemsTotal">${cad(fromCents(itemTotal))}</strong></span><span id="receiptDifference" role="status">Difference: ${cad(fromCents(initialTotal-itemTotal))}</span></div><div id="receiptValidation" class="notice ${initialTotal===itemTotal?"":"receipt-mismatch"}" role="alert">${initialTotal===itemTotal?"Item total and receipt total agree.":`Items are short by ${cad(fromCents(initialTotal-itemTotal))}. Saving is blocked until they agree.`}</div><div class="notice" style="margin-top:12px">Original photos and PDFs up to 1.5 MB are saved with the expense and can be reopened later. Photos are read on this device. Line totals use whole cents, and amount differences are never adjusted automatically.</div><div class="modal-actions"><button type="button" class="button" data-action="modal-close">Cancel</button><button class="button primary" type="submit">Save expense</button></div></form></section></div>`;
  }
  if (modal && modal.type === "receipt-view") {
    const receipt=(state.groceryReceipts||[]).find((item)=>item.id===modal.id);
    if(!receipt)return "";
    const receiptCents=Number(receipt.receiptTotalCents??receipt.expenseTotalCents??0);
    const bankChoices = receipt.matchedTransactionId ? "" : `<div class="notice">Link a bank record yourself if the amount, date, or store does not match a suggestion. Linking a different amount flags Needs review and does not change either number.</div>${unmatchedBankTransactions().map((transaction)=>{
      const bankCents=amountCents(transaction,"amount");
      const gap=bankCents-receiptCents;
      return `<article class="receipt-card"><div class="receipt-card-head"><strong>${esc(transaction.merchant)}</strong><span>${dateLabel(transaction.date)} · ${cad(fromCents(bankCents))}</span></div><p class="muted">${gap===0?"Same amount as this receipt.":`Bank amount differs by ${cad(fromCents(Math.abs(gap)))}.`}</p><button type="button" class="button small" data-action="receipt-confirm" data-receipt-id="${esc(receipt.id)}" data-transaction-id="${esc(transaction.id)}">Link this bank record</button></article>`;
    }).join("")||`<p class="muted">No unmatched imported bank expense is available to link.</p>`}`;
    const removeActions = modal.confirmDelete
      ? `<div class="notice receipt-mismatch" role="alert">Remove this expense, its line items, and its saved proof? Account totals will be recalculated. This cannot be undone from this screen.</div><div class="modal-actions"><button type="button" class="button" data-action="receipt-delete-cancel">Keep expense</button><button type="button" class="button primary" data-action="receipt-delete" data-receipt-id="${esc(receipt.id)}">Yes, remove expense & proof</button></div>`
      : `<div class="modal-actions"><button type="button" class="button" data-action="receipt-delete-ask" data-receipt-id="${esc(receipt.id)}">Remove expense & proof</button><button type="button" class="button primary" data-action="modal-close">Done</button></div>`;
    return `<div class="modal-backdrop" data-action="backdrop"><section class="modal receipt-modal"><div class="modal-head"><div><div class="eyebrow">Saved expense proof</div><h2>${esc(receipt.merchant)}</h2><p class="subtitle">${dateLabel(receipt.date)} · ${esc(receipt.owner||"Household")}</p></div><button type="button" class="modal-close" data-action="modal-close">×</button></div><ul class="receipt-item-list">${(receipt.items||[]).map((item)=>`<li><span>${esc(item.name)} · ${Number(item.quantity||1)} × ${cad(fromCents(Number(item.unitPriceCents??receiptItemCents(item))))} · ${esc(item.category||item.bucket||"Uncategorized")}</span><strong>${cad(fromCents(receiptItemCents(item)))}</strong></li>`).join("")}</ul>${agreementMarkup(receipt)}${receipt.hasAttachment?`<a class="button" href="/api/receipts/${encodeURIComponent(receipt.id)}/file" target="_blank" rel="noopener">Open original ${receipt.attachmentType==="application/pdf"?"PDF":"photo"}</a>`:""}${bankChoices}${removeActions}</section></div>`;
  }
  if (modal === "import") {
    return `<div class="modal-backdrop" data-action="backdrop"><section class="modal"><div class="modal-head"><div><div class="eyebrow">Canadian bank statements</div><h2>Import a CSV statement</h2><p class="subtitle" style="margin-top:6px">RBC, TD, CIBC, BMO, Scotiabank, Tangerine, EQ Bank and standard CSV formats.</p></div><button type="button" class="modal-close" data-action="modal-close">×</button></div><div class="form-row"><label for="csvOwner">Account owner</label><select class="select" id="csvOwner" style="width:100%"><option>Partner A</option><option>Partner B</option><option>Joint</option></select></div><div class="grid two-col"><div class="form-row"><label for="csvKind">Account type</label><select class="select" id="csvKind" style="width:100%"><option value="cash">Chequing / savings</option><option value="liability">Credit card</option></select></div><div class="form-row"><label for="csvAccount">Account name</label><input class="input" id="csvAccount" style="width:100%" value="Imported chequing"></div></div><div class="form-row"><label for="csvLast4">Last 4 digits (for duplicate protection)</label><input class="input" id="csvLast4" maxlength="4" value="0000" style="width:100%"></div><div class="drop-zone" id="dropZone"><strong>Drop your CSV statement here</strong>or <label class="button small" for="csvFile">choose a file</label><input type="file" id="csvFile" accept=".csv,text/csv" hidden><div id="fileName" style="margin-top:8px">Your statement is processed by this server.</div></div><div class="notice" style="margin-top:14px">After import, the next step lists saved receipts that match a new row on amount, date, and store. Nothing is linked until you press Confirm.</div><div class="modal-actions"><button type="button" class="button" data-action="modal-close">Cancel</button><button type="button" class="button primary" id="importButton">Import transactions</button></div></section></div>`;
  }
  if (modal && modal.type === "import-matches") {
    const suggestions = receiptSuggestions();
    return `<div class="modal-backdrop" data-action="backdrop"><section class="modal"><div class="modal-head"><div><div class="eyebrow">Import step 2</div><h2>Suggested receipt matches</h2><p class="subtitle" style="margin-top:6px">${esc(modal.summary || "Review matches before anything is linked.")}</p></div><button type="button" class="modal-close" data-action="modal-close">×</button></div>${suggestions.length ? suggestions.map(suggestionCard).join("") : `<div class="empty-state">No saved receipt matched an unmatched imported row on amount, date, and store. Nothing was linked.</div>`}<div class="modal-actions"><button type="button" class="button primary" data-action="modal-close">Done</button></div></section></div>`;
  }
  if (modal === "connect") {
    return `<div class="modal-backdrop" data-action="backdrop"><section class="modal"><div class="modal-head"><div><div class="eyebrow">Secure connection</div><h2>Connect a financial account</h2><p class="subtitle" style="margin-top:6px">Read-only data connections for your household workspace.</p></div><button class="modal-close" data-action="modal-close">×</button></div>${plaidConfigured ? `<div class="notice">Plaid is configured. Credentials and access tokens stay on the backend.</div><div class="form-row" style="margin-top:16px"><label>Connection environment</label><select class="select" style="width:100%" id="plaidEnvironment"><option>Sandbox</option><option>Limited Production</option></select></div><button class="button primary" style="width:100%" data-action="plaid-connect">Connect with Plaid</button><div id="plaidResult" class="muted" style="font-size:11px;margin-top:10px"></div>` : `<div class="notice warning">${plaidUnavailable ? "Plaid linking is not available in this Vercel demo yet." : "Bank sync not connected. Plaid is not configured on this server (missing PLAID_CLIENT_ID or PLAID_SECRET)."} Use the CSV importer to bring in a statement instead.</div><button class="button primary" style="width:100%;margin-top:14px" data-modal="import">Import a CSV statement</button>`}<hr style="border:0;border-top:1px solid var(--line);margin:18px 0"><div class="account-head"><div><div class="account-name">Joint account duplicate shield</div><div class="account-sub">Mute duplicate account feeds when already linked by your partner.</div></div><button class="button small" data-action="toggle-muted">Mark as muted</button></div><div class="modal-actions"><button class="button" data-action="modal-close">Done</button></div></section></div>`;
  }
  if (modal === "connect-choice") {
    return `<div class="modal-backdrop" data-action="backdrop"><section class="modal"><div class="modal-head"><div><div class="eyebrow">Add a financial account</div><h2>Connect an account</h2><p class="subtitle">Choose how you want to add it. You can enter balances by hand or bring in bank activity.</p></div><button class="modal-close" data-action="modal-close" aria-label="Close choices">×</button></div><div class="connection-choices"><button class="button" data-action="connect-add-account"><strong>Add an account by hand</strong><span>Enter an account balance or loan details.</span></button><button class="button" data-action="connect-import"><strong>Import a bank file (CSV)</strong><span>Bring in transactions from a downloaded statement.</span></button><button class="button" data-action="connect-plaid-choice"><strong>Link a bank (Plaid)</strong><span>${plaidConfigured ? "Start a read-only bank connection." : "Check whether bank linking is available."}</span></button></div><div class="modal-actions"><button class="button" data-action="modal-close">Cancel</button></div></section></div>`;
  }
  if (modal === "schedule" || modal?.type === "schedule") {
    const item=modal?.type==="schedule"?state.schedule.find(entry=>entry.id===modal.id):null;
    return `<div class="modal-backdrop" data-action="backdrop"><section class="modal"><div class="modal-head"><div><div class="eyebrow">Plan ahead</div><h2>${item?"Edit":"Add"} recurring income or a bill</h2></div><button class="modal-close" data-action="modal-close">×</button></div><form id="scheduleForm"><input type="hidden" name="id" value="${esc(item?.id||"")}"><div class="form-row"><label>Item name</label><input class="input" required name="name" placeholder="e.g. Paycheque or Internet" value="${esc(item?.name||"")}"></div><div class="grid two-col"><div class="form-row"><label>Type</label><select class="select" name="type"><option value="income" ${item?.type==="income"?"selected":""}>Payday / income</option><option value="bill" ${item?.type==="bill"?"selected":""}>Recurring bill</option></select></div><div class="form-row"><label>Amount (CAD)</label><input class="input" required name="amount" type="number" min=".01" step=".01" value="${item?.amount??""}"></div></div><div class="grid two-col"><div class="form-row"><label>Next date</label><input class="input" name="date" type="date" required value="${esc(item?.date||householdDate())}"></div><div class="form-row"><label>Owner</label><select class="select" name="owner">${["Joint","Partner A","Partner B"].map(owner=>`<option ${owner===(item?.owner||"Joint")?"selected":""}>${owner}</option>`).join("")}</select></div></div><div class="form-row"><label>Cadence</label><select class="select" name="cadence">${["Monthly","Bi-weekly","Semi-monthly"].map(cadence=>`<option ${cadence===(item?.cadence||"Monthly")?"selected":""}>${cadence}</option>`).join("")}</select></div><div class="notice">Expected items stay separate from actual balances until a matching deposit or bill clears.</div><div class="modal-actions"><button type="button" class="button" data-action="modal-close">Cancel</button><button class="button primary">Save item</button></div></form></section></div>`;
  }
  if (modal === "budget") {
    return `<div class="modal-backdrop" data-action="backdrop"><section class="modal"><div class="modal-head"><div><div class="eyebrow">Household budget model</div><h2>Customize your target split</h2><p class="subtitle">Targets should add up to 100%.</p></div><button class="modal-close" data-action="modal-close">×</button></div><form id="budgetForm">${state.budget.map((item, index) => `<div class="form-row"><label>${esc(item.category)} (%)</label><input class="input budget-input" type="number" min="0" max="100" step="0.01" value="${item.target}" data-index="${index}" required></div>`).join("")}<div class="notice" id="budgetTotal">Total: 100%</div><div class="modal-actions"><button type="button" class="button" data-action="modal-close">Cancel</button><button class="button primary">Save targets</button></div></form></section></div>`;
  }
  if (modal === "receipt") {
    return `<div class="modal-backdrop" data-action="backdrop"><section class="modal"><div class="modal-head"><div><div class="eyebrow">Tax vault</div><h2>Add a tax-deductible receipt</h2></div><button class="modal-close" data-action="modal-close">×</button></div><form id="taxReceiptForm"><div class="form-row"><label>Merchant</label><input class="input" name="merchant" required></div><div class="grid two-col"><div class="form-row"><label>Category</label><select class="select" name="category"><option>Medical</option><option>Childcare</option><option>Donations</option><option>Union/Work Dues</option></select></div><div class="form-row"><label>Amount (CAD)</label><input class="input" name="amount" required type="number" min=".01" step=".01"></div></div><div class="grid two-col"><div class="form-row"><label>Date</label><input class="input" name="date" type="date" value="${householdDate()}" required></div><div class="form-row"><label>Owner</label><select class="select" name="owner"><option>Partner A</option><option>Partner B</option><option>Joint</option></select></div></div><div class="form-row"><label>Receipt tag</label><input class="input" name="tag" placeholder="e.g. dental receipt"></div><div class="modal-actions"><button type="button" class="button" data-action="modal-close">Cancel</button><button class="button primary">Add receipt</button></div></form></section></div>`;
  }
  if (modal === "debt-help") {
    const missingMinimums = metrics().missingMinimums.length > 0;
    const minimumMessage = missingMinimums
      ? "The total includes only entered minimums. It is incomplete until every missing amount is entered."
      : "The total includes the entered minimums for every tracked debt.";
    return `<div class="modal-backdrop" data-action="backdrop"><section class="modal durable-help"><div class="modal-head"><div><div class="eyebrow">Debt payoff guide</div><h2>How the snowball works</h2></div><button class="modal-close" data-action="modal-close" aria-label="Close explanation">×</button></div><div class="help-content"><p>1. Keep the required minimum payments current on every debt.</p><p>2. Sort non-mortgage debts from the smallest balance to the largest. Put any extra monthly amount toward the smallest balance.</p><p>3. When a debt is fully paid, add its minimum payment to the extra amount aimed at the next debt. ${minimumMessage}</p><p>The snowball can build momentum, but paying the highest-interest debt first may cost less interest. Compare both views and keep enough cash for upcoming needs.</p></div><div class="modal-actions"><button class="button primary" data-action="modal-close">Got it</button></div></section></div>`;
  }
  if (modal === "balance") {
    return `<div class="modal-backdrop" data-action="backdrop"><section class="modal"><div class="modal-head"><div><div class="eyebrow">Quarterly plan update</div><h2>Record an employer plan balance</h2></div><button class="modal-close" data-action="modal-close">×</button></div><form id="balanceForm"><div class="form-row"><label>Account</label><select class="select" name="id">${state.accounts.filter((a)=>a.kind==="investment").map((a)=>`<option value="${esc(a.id)}">${esc(a.name)} · ${esc(a.owner)}</option>`).join("")}</select></div><div class="grid two-col"><div class="form-row"><label>Market value (CAD)</label><input class="input" type="number" name="balance" min="0" step=".01" required></div><div class="form-row"><label>Adjusted Cost Base (CAD)</label><input class="input" type="number" name="acb" min="0" step=".01" required></div></div><div class="notice">Manual Group RRSP / ESOP balances are updated quarterly and do not affect daily chequing cash flow.</div><div class="modal-actions"><button type="button" class="button" data-action="modal-close">Cancel</button><button class="button primary">Save balance</button></div></form></section></div>`;
  }
  if (modal === "rules") {
    return `<div class="modal-backdrop" data-action="backdrop"><section class="modal"><div class="modal-head"><div><div class="eyebrow">Auto-categorization</div><h2>Saved merchant rules</h2></div><button class="modal-close" data-action="modal-close">×</button></div><div class="metric-list">${state.merchantRules.map((rule)=>`<div class="metric-row"><strong>${esc(rule.merchant)}</strong><span class="pill">${esc(rule.category)}</span></div>`).join("") || `<p class="muted">No merchant rules yet.</p>`}</div><div class="notice">Use “Split” on a transaction and choose “Save Merchant Rule” to remember its category.</div><div class="modal-actions"><button class="button" data-action="modal-close">Done</button></div></section></div>`;
  }
  return "";
}

async function loadState() {
  const response = await fetch("/api/state");
  if (response.status === 401) { signedInUser = ""; loginMarkup(); return; }
  const result = await response.json();
  state = result.state;
  for (const account of state.accounts || []) {
    for (const key of ["balance", "startingBalance", "minimumPayment", "monthlyPayment", "limit", "acb"]) {
      if (account[key] !== undefined && account[key] !== null) {
        account[`${key}Cents`] = amountCents(account, key);
        account[key] = fromCents(account[`${key}Cents`]);
      }
    }
    if (account.apr !== undefined && account.apr !== null) account.apr = HouseholdMath.fixedDecimal(String(account.apr), 2);
    if (account.allocation) {
      for (const key of Object.keys(account.allocation)) account.allocation[key] = HouseholdMath.fixedDecimal(String(account.allocation[key]), 2);
    }
  }
  for (const transaction of state.transactions || []) {
    transaction.amountCents = amountCents(transaction, "amount");
    transaction.amount = fromCents(transaction.amountCents);
    if (Array.isArray(transaction.splits)) transaction.splits = transaction.splits.map((split) => ({ ...split, amountCents: amountCents(split, "amount"), amount: fromCents(amountCents(split, "amount")) }));
  }
  for (const scheduled of state.schedule || []) {
    scheduled.amountCents = amountCents(scheduled, "amount");
    scheduled.amount = fromCents(scheduled.amountCents);
    if (scheduled.grossAmount !== undefined) {
      scheduled.grossAmountCents = amountCents(scheduled, "grossAmount");
      scheduled.grossAmount = fromCents(scheduled.grossAmountCents);
    }
  }
  for (const receipt of state.taxDeductions || []) {
    receipt.amountCents = amountCents(receipt, "amount");
    receipt.amount = fromCents(receipt.amountCents);
  }
  state.groceryReceipts = (state.groceryReceipts || []).map((receipt) => ({
    ...receipt,
    taxCents: amountCents(receipt, "tax"),
    tax: fromCents(amountCents(receipt, "tax")),
    items: (receipt.items || []).map((item) => ({ ...item, amountCents: amountCents(item, "amount"), amount: fromCents(amountCents(item, "amount")) }))
  }));
  (state.budget || []).forEach((item) => { item.target = HouseholdMath.fixedDecimal(String(item.target), 2); });
  state.groceryReceipts ||= [];
  state.debtPlanExtraMonthly ||= 0;
  state.debtPlanExtraMonthly = roundMoney(state.debtPlanExtraMonthly);
  markDemoRecords();
  signedInUser = result.user;
  try {
    const plaidStatus = await fetch("/api/plaid/status");
    const plaidResult = await plaidStatus.json();
    plaidConfigured = plaidStatus.ok && plaidResult.configured === true;
    plaidUnavailable = plaidResult.unavailable === true;
  } catch {
    plaidConfigured = false;
    plaidUnavailable = false;
  }
  render();
}
function render() {
  if (!signedInUser || !state) { loginMarkup(); return; }
  app.innerHTML = shellMarkup();
  pageMarkup();
  bindGlobalEvents();
  if (modal) bindModalEvents();
}
function showToast(message) {
  document.querySelectorAll(".toast").forEach((toast)=>toast.remove());
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.append(toast);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>toast.remove(), 3300);
}
function bindGlobalEvents() {
  app.querySelectorAll(".sidebar [data-screen]").forEach((button)=>button.addEventListener("click",()=>{
    screen = button.dataset.screen;
    app.querySelector("#sidebar")?.classList.remove("open");
    render();
  }));
  app.querySelectorAll(".sidebar [data-action], .topbar [data-action]").forEach((button)=>button.addEventListener("click",handleAction));
  app.querySelectorAll(".sidebar [data-modal]").forEach((button)=>button.addEventListener("click",()=>{
    modal = button.dataset.modal;
    if (modal === "import") window.selectedCsv = null;
    render();
    bindModalEvents();
  }));
  app.querySelector("#viewSelect").addEventListener("change",(event)=>{view=event.target.value;localStorage.setItem("accountant-view",view);render();});
}
function bindPageEvents() {
  const page=app.querySelector("#pageContent");
  page.querySelectorAll("[data-screen]").forEach((button)=>button.addEventListener("click",()=>{screen=button.dataset.screen;render();}));
  page.querySelectorAll("[data-action]").forEach((button)=>button.addEventListener("click",handleAction));
  page.querySelectorAll("[data-edit-account]").forEach((button)=>button.addEventListener("click",()=>{modal={type:"account",id:button.dataset.editAccount};render();bindModalEvents();}));
  page.querySelectorAll("[data-edit-schedule]").forEach((button)=>button.addEventListener("click",()=>{modal={type:"schedule",id:button.dataset.editSchedule};render();bindModalEvents();}));
  page.querySelectorAll("[data-edit-transaction]").forEach((button)=>button.addEventListener("click",()=>{modal={type:"transaction",id:button.dataset.editTransaction};render();bindModalEvents();}));
  page.querySelectorAll("[data-view-receipt]").forEach((button)=>button.addEventListener("click",()=>{modal={type:"receipt-view",id:button.dataset.viewReceipt};render();bindModalEvents();}));
  page.querySelectorAll("[data-confirm-receipt]").forEach((button)=>button.addEventListener("click",async()=>{
    const response=await fetch(`/api/receipts/${encodeURIComponent(button.dataset.confirmReceipt)}`,{
      method:"PATCH",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({confirm:true,transactionId:button.dataset.matchTransaction})
    });
    const result=await response.json();
    if(!response.ok){showToast(result.error||"Could not confirm this receipt match.");return;}
    await loadState();
    showToast(result.receipt.matchStatus==="matched"?"Receipt, ledger, and bank totals agree to the cent.":"Match saved as needs review. The amount difference is shown.");
  }));
  page.querySelectorAll("[data-modal]").forEach((button)=>button.addEventListener("click",()=>{
    modal=button.dataset.modal;
    if(modal==="import")window.selectedCsv=null;
    render();
    bindModalEvents();
  }));
  page.querySelectorAll("[data-forecast-days]").forEach((button)=>button.addEventListener("click",()=>{forecastDays=Number(button.dataset.forecastDays);render();}));
  app.querySelectorAll("[data-split]").forEach((button)=>button.addEventListener("click",()=>{modal={type:"split",splitId:button.dataset.split};render();bindModalEvents();}));
  page.querySelector("#ledgerSearch")?.addEventListener("input",(event)=>{search=event.target.value;const cursor=event.target.selectionStart;pageMarkup();const input=app.querySelector("#ledgerSearch");input.focus();input.setSelectionRange(cursor,cursor);});
  page.querySelector("#categoryFilter")?.addEventListener("change",(event)=>{categoryFilter=event.target.value;pageMarkup();});
  page.querySelector("#debtSort")?.addEventListener("change",(event)=>{debtSort=event.target.value;pageMarkup();});
  page.querySelectorAll("[data-sort]").forEach((button)=>button.addEventListener("click",()=>{
    const key=button.dataset.sort;
    ledgerSort={key,direction:ledgerSort.key===key&&ledgerSort.direction==="asc"?"desc":"asc"};
    pageMarkup();
  }));
  page.querySelector("#receiptSearch")?.addEventListener("input",(event)=>{receiptSearch=event.target.value;const cursor=event.target.selectionStart;pageMarkup();const input=app.querySelector("#receiptSearch");input.focus();input.setSelectionRange(cursor,cursor);});
  page.querySelector("#jointShare")?.addEventListener("input",(event)=>{jointShare=Number(event.target.value);const label=event.target.parentElement.querySelector("strong");label.textContent=`${jointShare}%`;});
  page.querySelector("#jointShare")?.addEventListener("change",()=>{localStorage.setItem("accountant-joint-share",String(jointShare));render();});
  app.querySelectorAll(".term").forEach((item)=>{
    const positionPopover=()=>{
      if(window.innerWidth<=760)return;
      const rect=item.getBoundingClientRect();
      const popover=item.querySelector(".popover");
      const halfWidth=(popover.getBoundingClientRect().width||360)/2;
      const left=Math.max(halfWidth+12,Math.min(window.innerWidth-halfWidth-12,rect.left+rect.width/2));
      const below=rect.bottom+10;
      const height=popover.getBoundingClientRect().height||220;
      const top=below+height<window.innerHeight-8?below:Math.max(8,rect.top-height-10);
      popover.style.position="fixed";
      popover.style.left=`${left}px`;
      popover.style.top=`${top}px`;
      popover.style.transform="translateX(-50%)";
    };
    item.addEventListener("mouseenter",positionPopover);
    item.addEventListener("focus",positionPopover);
    item.addEventListener("click",()=>{item.classList.toggle("open");item.setAttribute("aria-expanded",item.classList.contains("open"));});
    item.addEventListener("keydown",(event)=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();item.classList.toggle("open");}});
  });
}
async function handleAction(event) {
  const action = event.currentTarget.dataset.action;
  if (action === "learning") { learning=!learning;localStorage.setItem("accountant-learning",String(learning));render(); }
  if (action === "logout") { await fetch("/api/logout",{method:"POST"});signedInUser="";state=null;loginMarkup(); }
  if (action === "menu") app.querySelector("#sidebar").classList.toggle("open");
  if (action === "manage-accounts") {
    screen="balance";
    render();
    app.querySelector("#accountManager")?.scrollIntoView({behavior:"smooth",block:"center"});
  }
  if (action === "modal-close") {modal="";render();}
  if (action === "backdrop" && event.target.classList.contains("modal-backdrop")) {modal="";render();}
  if (action === "connect-add-account") {modal={type:"account"};render();bindModalEvents();}
  if (action === "connect-import") {modal="import";window.selectedCsv=null;render();bindModalEvents();}
  if (action === "connect-plaid-choice") {modal="connect";render();bindModalEvents();}
  if (action === "add-split") {const lines=readSplitLines();lines.push({category:"Shopping",amount:0});modal.lines=lines;render();bindModalEvents();}
  if (action === "split-save") await saveSplit();
  if (action === "budget") {modal="budget";render();bindModalEvents();}
  if (action === "account-add") {modal={type:"account"};render();bindModalEvents();}
  if (action === "transaction-add") {modal="transaction";render();bindModalEvents();}
  if (action === "receipt-scan" || action === "receipt-manual") {
    const accounts=state.accounts.filter((account)=>account.kind==="cash"||account.kind==="liability");
    const defaultAccount=accounts.find((account)=>account.owner===signedInUser&&account.kind==="cash")||accounts[0];
    receiptAttachmentDraft=null;
    receiptTotalTouched=false;
    receiptDraft={merchant:"",date:householdDate(),receiptTotalCents:0,accountId:defaultAccount?.id||"",items:[]};
    modal=action==="receipt-scan"?"receipt-scan":"receipt-entry";
    render();bindModalEvents();
  }
  if (action === "receipt-add-item") {receiptDraft=readReceiptDraft();receiptDraft.items.push({name:"",quantity:1,unitPriceCents:0,lineTotalCents:0,category:"Groceries"});render();bindModalEvents();refreshReceiptTotals();}
  if (action === "receipt-save") await saveReceipt();
  if (action === "receipt-delete-ask") {
    event.preventDefault();
    event.stopPropagation();
    const receiptId=event.currentTarget.dataset.receiptId||modal?.id;
    if(!receiptId){showToast("Could not find this expense to remove.");return;}
    modal={type:"receipt-view",id:receiptId,confirmDelete:true};
    render();
    return;
  }
  if (action === "receipt-delete-cancel") {
    event.preventDefault();
    event.stopPropagation();
    modal={type:"receipt-view",id:modal?.id};
    render();
    return;
  }
  if (action === "receipt-delete") {
    event.preventDefault();
    event.stopPropagation();
    const receiptId=event.currentTarget.dataset.receiptId||modal?.id;
    if(!receiptId){showToast("Could not find this expense to remove.");return;}
    if(!modal?.confirmDelete){modal={type:"receipt-view",id:receiptId,confirmDelete:true};render();return;}
    const response=await fetch(`/api/receipts/${encodeURIComponent(receiptId)}`,{method:"DELETE"});
    const result=await response.json();
    if(!response.ok){showToast(result.error||"Could not remove this receipt expense.");return;}
    modal="";await loadState();showToast("Receipt expense, line items, and proof removed. Totals were recalculated.");
    return;
  }
  if (action === "receipt-confirm") {
    event.preventDefault();
    event.stopPropagation();
    await confirmReceiptMatch(event.currentTarget.dataset.receiptId, event.currentTarget.dataset.transactionId);
    return;
  }
  if (action === "receipt-reject") {
    event.preventDefault();
    event.stopPropagation();
    await rejectReceiptMatch(event.currentTarget.dataset.receiptId, event.currentTarget.dataset.transactionId);
    return;
  }
  if (action === "import-delete") {
    event.preventDefault();
    event.stopPropagation();
    const transactionId=event.currentTarget.dataset.transactionId;
    if(!transactionId){showToast("Could not find that imported row.");return;}
    const response=await fetch(`/api/transactions/${encodeURIComponent(transactionId)}`,{method:"DELETE"});
    const result=await response.json();
    if(!response.ok){showToast(result.error||"Could not remove the imported row.");return;}
    if(result.state)state=result.state; else await loadState();
    render();
    showToast("Imported row removed. Nothing else was deleted.");
    return;
  }
  if (action === "save-snowball") {
    const extra=Number(app.querySelector("#snowballExtra").value);
    if(!Number.isFinite(extra)||extra<0){showToast("Enter a non-negative monthly extra amount.");return;}
    state.debtPlanExtraMonthly=extra;
    if(await persist()){render();showToast("Debt snowball plan saved.");}
  }
  if (action === "clear-demo") await clearDemoRecords();
  if (action === "schedule-delete") {
    if(!window.confirm("Remove this recurring item from your forecast?"))return;
    state.schedule=state.schedule.filter(item=>item.id!==event.currentTarget.dataset.scheduleId);
    if(await persist()){render();showToast("Recurring item removed.");}
  }
  if (action === "merchant-rules") {modal="rules";render();bindModalEvents();}
  if (action === "tax-export") exportTaxCsv();
  if (action === "tax-add") {modal="receipt";render();bindModalEvents();}
  if (action === "balance-update") {modal="balance";render();bindModalEvents();}
  if (action === "debt-tip") {modal="debt-help";render();bindModalEvents();}
  if (action === "plaid-connect") await checkPlaid();
  if (action === "plaid-sync") await syncPlaid();
  if (action === "toggle-muted") {
    const joint = state.accounts.find((account)=>account.owner==="Joint"&&account.kind==="cash");
    if(joint){const previous=joint.muted;joint.muted=!joint.muted;if(!await persist()){joint.muted=previous;return;}showToast(joint.muted?"Joint account feed marked muted.":"Joint account feed re-enabled.");render();}
  }
}
function readSplitLines() {
  const categories=[...app.querySelectorAll(".split-category")].map((input)=>input.value);
  const amounts=[...app.querySelectorAll(".split-amount")].map((input)=>roundMoney(input.value));
  return categories.map((category,index)=>({category,amount:amounts[index]}));
}
function bindModalEvents() {
  const modalRoot = app.querySelector(".modal-backdrop");
  if (!modalRoot || modalRoot.dataset.bound === "1") return;
  modalRoot.dataset.bound = "1";
  app.querySelectorAll(".modal-backdrop[data-action], .modal [data-action]").forEach((button)=>button.addEventListener("click",handleAction));
  app.querySelectorAll(".modal [data-modal]").forEach((button)=>button.addEventListener("click",()=>{modal=button.dataset.modal;if(modal==="import")window.selectedCsv=null;render();bindModalEvents();}));
  const accountType=app.querySelector("#accountForm select[name='accountType']");
  const minimumInput=app.querySelector("#minimumPaymentInput");
  const setMinimumRequirement=()=>{
    if(!accountType||!minimumInput)return;
    const required=accountType.value==="Credit card";
    minimumInput.required=required;
    app.querySelector("#minimumRequiredHint").textContent=required?"(required for credit cards)":"";
  };
  accountType?.addEventListener("change",setMinimumRequirement);
  setMinimumRequirement();
  const file=app.querySelector("#csvFile");
  if (file) {
    file.addEventListener("change",()=>{window.selectedCsv=file.files[0]||null;app.querySelector("#fileName").textContent=window.selectedCsv?window.selectedCsv.name:"Your statement is processed by this server.";});
    const drop=app.querySelector("#dropZone");
    ["dragenter","dragover"].forEach((name)=>drop.addEventListener(name,(event)=>{event.preventDefault();drop.classList.add("dragover");}));
    ["dragleave","drop"].forEach((name)=>drop.addEventListener(name,(event)=>{event.preventDefault();drop.classList.remove("dragover");if(name==="drop"&&event.dataTransfer.files.length){window.selectedCsv=event.dataTransfer.files[0];app.querySelector("#fileName").textContent=window.selectedCsv.name;}}));
    app.querySelector("#importButton").addEventListener("click",importCsv);
  }
  const splitAmounts=app.querySelectorAll(".split-amount");
  splitAmounts.forEach((input)=>input.addEventListener("input",()=>{
    const total=sumMoney([...app.querySelectorAll(".split-amount")].map((item)=>item.value));
    const tx=state.transactions.find((t)=>t.id===modal.splitId);
    app.querySelector("#splitTotal").textContent=`Split total: ${cad(total,2)} · Transaction total: ${cad(tx.amount,2)}`;
  }));
  app.querySelector("#scheduleForm")?.addEventListener("submit",async(event)=>{
    event.preventDefault();const data=new FormData(event.currentTarget);
    const item={id:String(data.get("id")||`schedule-${Date.now()}`),name:String(data.get("name")).trim(),type:String(data.get("type")),amount:Number(data.get("amount")),date:String(data.get("date")),cadence:String(data.get("cadence")),owner:String(data.get("owner")),status:"Expected"};
    const index=state.schedule.findIndex(entry=>entry.id===item.id);
    if(index>=0)state.schedule[index]=item;else state.schedule.push(item);
    if(!await persist())return;modal="";render();showToast("Recurring item added to your forecast.");
  });
  app.querySelector("#budgetForm")?.addEventListener("submit",(event)=>{
    event.preventDefault();
    const values=[...app.querySelectorAll(".budget-input")].map((input)=>HouseholdMath.fixedDecimal(input.value,2));
    if(values.reduce((sum,value)=>sum+toCents(value),0)!==10000){showToast("Budget targets must add up to exactly 100%.");return;}
    state.budget.forEach((item,index)=>item.target=values[index]);persist().then((saved)=>{if(!saved)return;modal="";render();showToast("Household budget targets updated.");});
  });
  app.querySelectorAll(".budget-input").forEach((input)=>input.addEventListener("input",()=>{
    const total=[...app.querySelectorAll(".budget-input")].reduce((sum,item)=>sum+toCents(item.value),0);
    app.querySelector("#budgetTotal").textContent=`Total: ${fromCents(total)}%${total===10000?" ✓":" · targets must add up to 100%"}`;
  }));
  app.querySelector("#taxReceiptForm")?.addEventListener("submit",(event)=>{
    event.preventDefault();const data=new FormData(event.currentTarget);
    state.taxDeductions.unshift({id:`tax-${Date.now()}`,merchant:data.get("merchant"),category:data.get("category"),amount:roundMoney(data.get("amount")),date:data.get("date"),owner:data.get("owner"),tag:data.get("tag")||"Receipt"});
    persist().then((saved)=>{if(!saved)return;modal="";render();showToast("Receipt added to your tax vault.");});
  });
  app.querySelector("#balanceForm")?.addEventListener("submit",(event)=>{
    event.preventDefault();const data=new FormData(event.currentTarget);const account=state.accounts.find((item)=>item.id===data.get("id"));
    account.balance=Number(data.get("balance"));account.acb=Number(data.get("acb"));persist().then((saved)=>{if(!saved)return;modal="";render();showToast(`${account.name} updated.`);});
  });
  app.querySelector("#accountForm")?.addEventListener("submit",saveAccount);
  app.querySelector("#transactionForm")?.addEventListener("submit",saveManualTransaction);
  app.querySelector("#transactionForm select[name='type']")?.addEventListener("change",event=>{
    const debtPayment=event.target.value==="debt";
    app.querySelector("#debtTargetWrap").hidden=!debtPayment;
    if(debtPayment)app.querySelector("#transactionForm select[name='category']").value="Debt repayment";
  });
  app.querySelector("#receiptImage")?.addEventListener("change",scanReceiptImage);
  app.querySelector("#receiptSearch")?.addEventListener("input",(event)=>{receiptSearch=event.target.value;});
  app.querySelector("#receiptForm")?.addEventListener("submit",async(event)=>{event.preventDefault();await saveReceipt();});
  app.querySelectorAll("#receiptTotal,.receipt-item-quantity,.receipt-item-price").forEach((input)=>
    input.addEventListener("input",()=>{if(input.id==="receiptTotal")receiptTotalTouched=true;refreshReceiptTotals();}));
  app.querySelectorAll("[data-remove-receipt-item]").forEach(button=>button.addEventListener("click",()=>{
    receiptDraft=readReceiptDraft();
    receiptDraft.items.splice(Number(button.dataset.removeReceiptItem),1);
    render();bindModalEvents();
  }));
}
function readReceiptDraft() {
  const items=[...app.querySelectorAll(".receipt-item-row")].map((row)=>{
    const quantity=Number(row.querySelector(".receipt-item-quantity").value);
    const unitPriceCents=toCents(row.querySelector(".receipt-item-price").value||0);
    return {
      name:row.querySelector(".receipt-item-name").value.trim(),
      quantity,
      unitPriceCents,
      lineTotalCents:Number.isSafeInteger(quantity)&&quantity>0?quantity*unitPriceCents:0,
      category:row.querySelector(".receipt-item-category").value
    };
  });
  return {
    merchant:app.querySelector("#receiptMerchant")?.value||"",
    date:app.querySelector("#receiptDate")?.value||"",
    accountId:app.querySelector("#receiptAccount")?.value||"",
    receiptTotalCents:toCents(app.querySelector("#receiptTotal")?.value||0),
    items
  };
}
function refreshReceiptTotals() {
  const items=[...app.querySelectorAll(".receipt-item-row")].map((row)=>{
    const quantity=Number(row.querySelector(".receipt-item-quantity").value);
    const unitPriceCents=toCents(row.querySelector(".receipt-item-price").value||0);
    const cents=Number.isSafeInteger(quantity)&&quantity>0?quantity*unitPriceCents:0;
    row.querySelector(".receipt-line-total").textContent=cad(fromCents(cents));
    return cents;
  });
  const total=items.reduce((sum,cents)=>sum+cents,0);
  const totalInput=app.querySelector("#receiptTotal");
  if(totalInput&&modal==="receipt-entry"&&!receiptTotalTouched)totalInput.value=fromCents(total).toFixed(2);
  const receiptTotal=toCents(totalInput?.value||0);
  const difference=receiptTotal-total;
  app.querySelector("#receiptItemsTotal").textContent=cad(fromCents(total));
  app.querySelector("#receiptDifference").textContent=`Difference: ${cad(fromCents(difference))}`;
  const validation=app.querySelector("#receiptValidation");
  validation.classList.toggle("receipt-mismatch",difference!==0);
  validation.textContent=difference===0
    ?"Item total and receipt total agree."
    :`Items ${difference>0?"are short":"exceed"} by ${cad(fromCents(Math.abs(difference)))}. Saving is blocked until they agree.`;
}
function parseReceiptText(text) {
  const lines=String(text||"").split(/\r?\n/).map(line=>line.replace(/\s+/g," ").trim()).filter(Boolean);
  const datePattern=/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b|\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b|\b(\d{1,2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\s+(20\d{2})\b/i;
  let date=householdDate();
  let merchant="";
  let taxCents=0;
  let receiptTotalCents=null;
  const items=[];
  for(const line of lines){
    const dateMatch=line.match(datePattern);
    if(dateMatch){
      let parts;
      if(dateMatch[1]) parts=[dateMatch[1],dateMatch[2],dateMatch[3]];
      else if(dateMatch[4]){let year=Number(dateMatch[6]);if(year<100)year+=2000;parts=[year,dateMatch[4],dateMatch[5]];}
      else {const months=["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];parts=[dateMatch[9],months.indexOf(dateMatch[8].toUpperCase())+1,dateMatch[7]];}
      const candidate=`${String(parts[0]).padStart(4,"0")}-${String(parts[1]).padStart(2,"0")}-${String(parts[2]).padStart(2,"0")}`;
        const [candidateYear,candidateMonth,candidateDay]=candidate.split("-").map(Number);
        const check=new Date(Date.UTC(candidateYear,candidateMonth-1,candidateDay));
        if(check.getUTCFullYear()===candidateYear&&check.getUTCMonth()===candidateMonth-1&&check.getUTCDate()===candidateDay)date=candidate;
    }
    const amountMatch=line.match(/(?:\$?\s*)(\d{1,5}[.,]\d{2})\s*(?:[A-Z])?$/i);
    const amountCents=amountMatch?toCents(amountMatch[1].replace(",", ".")):null;
    if(/\b(?:TOTAL|BALANCE DUE)\b/i.test(line)&&amountCents!==null){receiptTotalCents=amountCents;continue;}
    if(/\b(?:HST|GST|PST|TAX)\b/i.test(line)&&amountCents!==null){taxCents+=amountCents;continue;}
    if(/\b(?:SUBTOTAL|TOTAL|BALANCE DUE|CHANGE|CASH|DEBIT|CREDIT|VISA|MASTERCARD|APPROVED|SAVINGS|ITEMS SOLD)\b/i.test(line))continue;
    if(!merchant&&/[A-Z]{3}/i.test(line)&&amountCents===null&&!dateMatch)merchant=line.slice(0,80);
    if(amountCents===null||amountCents<=0||!/[A-Z]/i.test(line))continue;
    const name=line.slice(0,amountMatch.index).replace(/^[\d\s.*#-]+/,"").replace(/\s+\d+\s*[xX]\s*$/,"").trim();
    if(name.length<2||/^(?:TOTAL|SUBTOTAL|TAX|HST|GST|PST)$/i.test(name))continue;
    const category=/detergent|cleaner|disinfect|soap|paper towel|toilet paper/i.test(name)?"Housing & Utilities":"Groceries";
    items.push({name:name.slice(0,100),quantity:1,unitPriceCents:amountCents,lineTotalCents:amountCents,category});
  }
  if(taxCents>0)items.push({name:"Sales tax",quantity:1,unitPriceCents:taxCents,lineTotalCents:taxCents,category:items[0]?.category||"Groceries"});
  const itemsTotalCents=items.reduce((sum,item)=>sum+item.lineTotalCents,0);
  return {merchant,date,receiptTotalCents:receiptTotalCents??itemsTotalCents,items};
}
async function scanReceiptImage(event) {
  const file=event.target.files?.[0];
  if(!file)return;
  const status=app.querySelector("#receiptOcrStatus");
  if(!(file.type.startsWith("image/")||file.type==="application/pdf")||file.type==="image/svg+xml"||file.size>1_500_000){
    status.textContent="Choose a photo or PDF no larger than 1.5 MB.";return;
  }
  status.textContent="Keeping the original file with this expense…";
  try{
    const dataUrl=await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result));
      reader.onerror=()=>reject(reader.error||new Error("Could not read the selected file."));
      reader.readAsDataURL(file);
    });
    receiptAttachmentDraft={name:file.name,type:file.type,bytes:file.size,dataUrl,status:"Original receipt file is attached."};
    if(file.type==="application/pdf"){
      receiptAttachmentDraft.status="PDF attached. Add or correct its line items below; this browser reader scans photos, not PDF pages.";
      render();bindModalEvents();return;
    }
    if(!window.Tesseract?.recognize){
      receiptAttachmentDraft.status="Photo attached. On-device OCR did not load, so enter or correct the items manually.";
      render();bindModalEvents();return;
    }
    status.textContent="Reading receipt on this device…";
    const result=await window.Tesseract.recognize(file,"eng",{logger:message=>{
      if(message.status==="recognizing text")status.textContent=`Reading receipt… ${Math.round((message.progress||0)*100)}%`;
    }});
    const parsed=parseReceiptText(result.data.text);
    receiptDraft={...readReceiptDraft(),...parsed,accountId:app.querySelector("#receiptAccount")?.value||receiptDraft?.accountId||""};
    receiptTotalTouched=true;
    receiptAttachmentDraft.status=receiptDraft.items.length
      ?`Found ${receiptDraft.items.length} possible line items. Review and correct them before saving.`
      :"Photo attached. Could not confidently find line items; enter them manually below.";
    render();bindModalEvents();
    refreshReceiptTotals();
  }catch(error){
    status.textContent=`Could not read the file: ${error.message}`;
    console.error("Receipt OCR failed:",error);
  }
}
async function saveReceipt() {
  const receipt=readReceiptDraft();
  const itemsTotalCents=receipt.items.reduce((sum,item)=>sum+item.lineTotalCents,0);
  if(!receipt.merchant.trim()){showToast("Enter the store name.");return;}
  if(!receipt.accountId){showToast("Choose a payment account.");return;}
  if(!receipt.date||Number.isNaN(new Date(`${receipt.date}T12:00:00Z`).getTime())){showToast("Enter a valid receipt date.");return;}
  if(!receipt.items.length||receipt.items.some(item=>!item.name||!Number.isSafeInteger(item.quantity)||item.quantity<1||!Number.isSafeInteger(item.unitPriceCents)||item.unitPriceCents<0)){
    showToast("Add at least one valid item with a name, whole-number quantity, and price.");return;
  }
  if(!Number.isSafeInteger(receipt.receiptTotalCents)||receipt.receiptTotalCents<=0||itemsTotalCents!==receipt.receiptTotalCents){
    refreshReceiptTotals();
    const difference=receipt.receiptTotalCents-itemsTotalCents;
    showToast(`Expense not saved. Items differ from the receipt by ${cad(fromCents(Math.abs(difference)))}.`);
    return;
  }
  const account=state.accounts.find((item)=>item.id===receipt.accountId);
  if(!account){showToast("The selected payment account is no longer available.");return;}
  const payload={
    merchant:receipt.merchant.trim(),
    date:receipt.date,
    accountId:account.id,
    owner:account.owner,
    receiptTotalCents:receipt.receiptTotalCents,
    items:receipt.items,
    ...(receiptAttachmentDraft?{attachment:{
      name:receiptAttachmentDraft.name,
      type:receiptAttachmentDraft.type,
      dataUrl:receiptAttachmentDraft.dataUrl
    }}:{})
  };
  try{
    const response=await fetch("/api/receipts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    const result=await response.json();
    if(!response.ok){showToast(result.error||"Could not save this expense.");return;}
    receiptDraft=null;receiptAttachmentDraft=null;modal="";
    await loadState();
    showToast(`${receipt.items.length} reviewed line item(s) and the expense were saved.`);
  }catch(error){showToast(error.message||"Could not save this expense.");}
}
async function saveAccount(event) {
  event.preventDefault();
  const data=new FormData(event.currentTarget);
  const accountType=String(data.get("accountType"));
  const kind=["Chequing","Savings","Emergency fund"].includes(accountType)?"cash":["TFSA","RRSP","FHSA","Non-Registered"].includes(accountType)?"investment":"liability";
  const balance=Number(data.get("balance"));
  const startingBalance=Number(data.get("startingBalance"));
  const aprText=String(data.get("apr")||"0").trim();
  const minimumRaw=String(data.get("minimumPayment")||"").trim();
  const minimumPayment=minimumRaw===""?null:Number(minimumRaw);
  const limit=Number(data.get("limit")||0);
  const acb=Number(data.get("acb")||0);
  if([balance,startingBalance,limit,acb].some(value=>!Number.isFinite(value)||value<0)||(minimumPayment!==null&&(!Number.isFinite(minimumPayment)||minimumPayment<0))||
    (kind==="liability"&&!HouseholdMath.isNonNegativeDecimal(aprText,2))){showToast("Balances, payments, limits, and rates must be non-negative numbers with rates up to two decimal places.");return;}
  if(accountType==="Credit card"&&minimumPayment===null){showToast("Enter the credit card’s required minimum monthly payment.");app.querySelector("#minimumPaymentInput")?.focus();return;}
  const fixedApr=HouseholdMath.fixedDecimal(aprText, 2);
  const id=String(data.get("id")||"");
  const existing=state.accounts.find(account=>account.id===id);
  const account={
    ...(existing||{}),id:id||`manual-${Date.now()}`,name:String(data.get("name")).trim(),
    institution:String(data.get("institution")||"Manual entry").trim()||"Manual entry",
    kind,accountType,owner:String(data.get("owner")),balance:roundMoney(balance),
    ...(kind==="cash"?{bucket:accountType==="Emergency fund"?"Emergency":accountType==="Savings"?"Savings":"Chequing"}:{}),
    ...(kind==="investment"?{acb:roundMoney(acb),manual:true,allocation:existing?.allocation||{Equities:50,ETFs:25,Bonds:20,Cash:5}}:{}),
    ...(kind==="liability"?{startingBalance:roundMoney(Math.max(balance,startingBalance)),apr:fixedApr,minimumPayment:minimumPayment===null?undefined:roundMoney(minimumPayment),monthlyPayment:minimumPayment===null?undefined:roundMoney(minimumPayment),limit:roundMoney(limit),dueDate:String(data.get("dueDate")||"")}:{}),
    ...(existing?{}:{manual:true})
  };
  if(existing)state.accounts[state.accounts.indexOf(existing)]=account;
  else state.accounts.push(account);
  if(!await persist())return;
  modal="";render();showToast(`${account.name} saved.`);
}
async function saveManualTransaction(event) {
  event.preventDefault();
  const data=new FormData(event.currentTarget);
  const amountValue=roundMoney(Number(data.get("amount")));
  const account=state.accounts.find(item=>item.id===data.get("accountId"));
  if(!account||!Number.isFinite(amountValue)||amountValue<=0){showToast("Choose an account and enter a positive amount.");return;}
  const entryType=String(data.get("type"));
  const type=entryType==="debt"?"transfer":entryType;
  const category=entryType==="debt"?"Debt repayment":String(data.get("category"));
  const debtAccount=entryType==="debt"?state.accounts.find(item=>item.id===data.get("debtAccountId")):null;
  if((entryType==="income"||entryType==="debt")&&account.kind!=="cash"){showToast("Choose a chequing or savings account for income and debt payments.");return;}
  if(entryType==="debt"&&(!debtAccount||debtAccount.kind!=="liability")){showToast("Choose the debt account being paid.");return;}
  const id=String(data.get("id")||"");
  const existing=state.transactions.find(item=>item.id===id);
  const previousAccount=existing?state.accounts.find(item=>item.name===existing.account&&item.owner===existing.owner):null;
  const previousDebt=existing?.debtAccountId?state.accounts.find(item=>item.id===existing.debtAccountId):null;
  const oldSourceEffect=existing?(existing.type==="income"?existing.amount:existing.type==="expense"?(previousAccount?.kind==="liability"?existing.amount:-existing.amount):existing.category==="Debt repayment"?-existing.amount:0):0;
  const oldDebtEffect=previousDebt&&existing?.category==="Debt repayment"?-existing.amount:0;
  const sourceBase=previousAccount?subtractMoney(previousAccount.balance,oldSourceEffect):roundMoney(account.balance);
  const sourceEffect=type==="income"?amountValue:type==="expense"?(account.kind==="liability"?amountValue:-amountValue):entryType==="debt"?-amountValue:0;
  const finalSource=fromCents(toCents(sourceBase)+toCents(sourceEffect));
  const debtBase=debtAccount?subtractMoney(debtAccount.balance,oldDebtEffect):0;
  const finalDebt=entryType==="debt"?subtractMoney(debtBase,amountValue):debtBase;
  if(finalSource<0||finalDebt<0){showToast(finalSource<0?"That would make the chequing balance negative. Update it or choose another account.":"The payment is larger than the debt balance.");return;}
  if(previousAccount)previousAccount.balance=sourceBase;
  account.balance=finalSource;
  if(previousDebt)previousDebt.balance=debtBase;
  if(debtAccount){
    if(!debtAccount.startingBalance)debtAccount.startingBalance=debtBase;
    debtAccount.balance=finalDebt;
  }
  if(account.kind==="liability"&&!account.startingBalance&&type==="expense")account.startingBalance=subtractMoney(account.balance,amountValue);
  const updated={...(existing||{}),id:id||`manual-${Date.now()}`,date:String(data.get("date")),merchant:String(data.get("merchant")).trim(),amount:amountValue,category,type,owner:account.owner,account:account.name,status:"Actual",note:"Manual entry",manual:true,...(entryType==="debt"?{debtAccountId:debtAccount.id}:{})};
  if(existing)state.transactions[state.transactions.indexOf(existing)]=updated;else state.transactions.unshift(updated);
  if(!await persist())return;
  modal="";render();showToast("Ledger entry and account balance saved.");
}
async function confirmReceiptMatch(receiptId, transactionId) {
  if(!receiptId||!transactionId){showToast("Choose a receipt and a bank row before confirming.");return;}
  const response=await fetch(`/api/receipts/${encodeURIComponent(receiptId)}`,{
    method:"PATCH",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({confirm:true,transactionId})
  });
  const result=await response.json();
  if(!response.ok){showToast(result.error||"Could not confirm this receipt match.");return;}
  await loadState();
  const agreement=expenseAgreement(result.receipt.matchStatus? (state.groceryReceipts||[]).find((item)=>item.id===receiptId) || result.receipt : result.receipt);
  showToast(agreement.status==="matched"?"Matched — all three totals agree.":`Needs review. ${agreement.lines.join(" ")}`);
}
async function rejectReceiptMatch(receiptId, transactionId) {
  if(!receiptId||!transactionId){showToast("Choose the suggestion to reject.");return;}
  const response=await fetch(`/api/receipts/${encodeURIComponent(receiptId)}`,{
    method:"PATCH",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({reject:true,transactionId})
  });
  const result=await response.json();
  if(!response.ok){showToast(result.error||"Could not reject this suggestion.");return;}
  await loadState();
  showToast("Suggestion rejected. The receipt and the bank row were both kept.");
}
async function importCsv() {
  const file=window.selectedCsv;
  if(!file){showToast("Choose a CSV statement to import.");return;}
  const csv=await file.text();
  const account={owner:app.querySelector("#csvOwner").value,name:app.querySelector("#csvAccount").value,last4:app.querySelector("#csvLast4").value,kind:app.querySelector("#csvKind").value};
  const response=await fetch("/api/transactions/import",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({csv,account})});
  const result=await response.json();
  if(!response.ok){showToast(result.error);return;}
  state=result.state;
  modal={type:"import-matches",summary:`${result.imported} transaction(s) imported · ${result.duplicates} duplicate(s) skipped. Confirm a match only if it is the same purchase.`};
  render();
  showToast("Import saved. Review suggested receipt matches before linking anything.");
}
async function saveSplit() {
  const transaction=state.transactions.find((item)=>item.id===modal.splitId);
  const receipt=receiptForTransaction(transaction);
  if(receipt?.items?.length){
    const itemCategories=[...app.querySelectorAll(".split-item-category")].map((input)=>input.value);
    if(itemCategories.length!==receipt.items.length){showToast("Choose a category for every line item.");return;}
    const response=await fetch(`/api/transactions/${encodeURIComponent(transaction.id)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({itemCategories})});
    const result=await response.json();
    if(!response.ok){showToast(result.error);return;}
    state=result.state;
    modal="";render();showToast("Item categories saved. The expense total is unchanged.");
    return;
  }
  const lines=readSplitLines();
  if(toCents(sumMoney(lines.map((line)=>line.amount)))!==toCents(transaction.amount)){showToast("Split amounts must equal the transaction total.");return;}
  const response=await fetch(`/api/transactions/${encodeURIComponent(transaction.id)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({splits:lines,category:lines[0].category})});
  const result=await response.json();
  if(!response.ok){showToast(result.error);return;}
  state=result.state;
  if(app.querySelector("#saveRule")?.checked){
    state.merchantRules.unshift({merchant:transaction.merchant,category:lines[0].category});
    if(!await persist())return;
  }
  modal="";render();showToast("Transaction split saved. Category totals remain tied to the original purchase.");
}
async function persist() {
  try {
    const response=await fetch("/api/state",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      budget:state.budget,
      schedule:state.schedule,
      merchantRules:state.merchantRules,
      taxDeductions:state.taxDeductions,
      accounts:state.accounts,
      transactions:state.transactions,
      debtPlanExtraMonthly:state.debtPlanExtraMonthly
    })});
    const result=await response.json();
    if(!response.ok){showToast(result.error||"Could not save household changes.");await loadState();bindModalEvents();return false;}
    state=result.state;
    return true;
  } catch (error) {
    showToast(error.message||"Could not save household changes.");
    return false;
  }
}
async function checkPlaid() {
  const target=app.querySelector("#plaidResult");
  const environment=app.querySelector("#plaidEnvironment").value;
  const response=await fetch("/api/plaid/link-token",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({environment})});
  const result=await response.json();
  if(!response.ok){target.textContent=result.error;return;}
  if(!window.Plaid){target.textContent="Plaid Link could not load. Check your internet connection and retry.";return;}
  const handler=window.Plaid.create({
    token:result.linkToken,
    onSuccess:async(publicToken,metadata)=>{
      target.textContent="Securing your connection…";
      const exchange=await fetch("/api/plaid/exchange",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({publicToken,institution:metadata.institution?.name||"Connected institution",environment:result.environment})});
      const connected=await exchange.json();
      if(!exchange.ok){target.textContent=connected.error;return;}
      const sync=await fetch("/api/plaid/sync",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({itemId:connected.itemId})});
      const synced=await sync.json();
      if(!sync.ok){target.textContent=synced.error;return;}
      state=synced.state;modal="";render();showToast(`Connected ${connected.institution}; ${synced.imported} new transaction(s) synced.`);
    },
    onExit:(error)=>{if(error)target.textContent=error.display_message||error.error_message||"Plaid connection was not completed.";}
  });
  handler.open();
}
async function syncPlaid() {
  const response=await fetch("/api/plaid/sync",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({})});
  const result=await response.json();
  if(!response.ok){showToast(result.error);return;}
  state=result.state;render();showToast(`${result.imported} new Plaid transaction(s) synced.`);
}
function exportTaxCsv() {
  const rows=[["Date","Merchant","Category","Owner","Tag","Amount CAD"],...state.taxDeductions.filter((item)=>relevantOwner(item.owner)>0).map((item)=>[item.date,item.merchant,item.category,item.owner,item.tag,item.amount])];
  const csv=rows.map((row)=>row.map((value)=>`"${String(value).replace(/"/g,'""')}"`).join(",")).join("\r\n");
  const link=document.createElement("a");link.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));link.download="household-tax-receipts.csv";link.click();URL.revokeObjectURL(link.href);showToast("Tax receipt CSV exported.");
}

document.addEventListener("click",(event)=>{if(!event.target.closest(".term"))document.querySelectorAll(".term.open").forEach((item)=>item.classList.remove("open"));});
(async function init(){
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch((error) => console.error("Could not register the app's offline shell:", error));
  }
  try {
    const response=await fetch("/api/session");
    const result=await response.json();
    if(!result.user){loginMarkup();return;}
    signedInUser=result.user;
    await loadState();
  } catch {
    app.innerHTML=`<div class="empty-state">Could not reach the finance server. Start it with <code>npm start</code> and refresh this page.</div>`;
  }
})();
