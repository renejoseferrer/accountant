const app = document.getElementById("app");
const navItems = [
  ["overview", "Overview", "⌂"],
  ["balance", "Balance sheet", "◫"],
  ["cashflow", "Cash flow & forecast", "↗"],
  ["ledger", "Smart ledger", "≡"],
  ["debt", "Debt & amortization", "↘"],
  ["investments", "Investments & tax", "◉"]
];
const definitions = {
  Assets: ["What you own or control that has measurable value. Tracking assets shows the resources available to support your household.", "Total assets = liquid assets + investments + other assets", "Healthy: Review balances regularly"],
  "Liquid Assets": ["Cash and near-cash funds you can access quickly without selling a long-term investment.", "Liquid assets = chequing + savings + emergency cash", "Healthy: Keep an accessible emergency fund"],
  "Illiquid Assets": ["Assets that take time or effort to turn into cash, such as a home or certain investments.", "Illiquid assets = total assets − liquid assets", "Plan for access before relying on them"],
  Liabilities: ["Amounts your household owes, including credit cards and loans. A clear liability picture helps you plan repayments.", "Total liabilities = current liabilities + long-term liabilities", "Healthy: Know rates, balances, and due dates"],
  "Current Liabilities": ["Debts due soon, usually within one year, such as credit-card balances and upcoming payments.", "Current liabilities = balances due within 12 months", "Keep due dates visible"],
  "Long-Term Liabilities": ["Debts scheduled to be repaid over more than a year, such as a car loan or mortgage.", "Long-term liabilities = total liabilities − current liabilities", "Compare rates and amortization"],
  "Net Worth": ["The value left after subtracting everything owed from everything owned. It is a useful snapshot, not a measure of monthly cash.", "Net Worth = Total Assets − Total Liabilities", "Healthy: A sustained upward trend"],
  "Cash Flow": ["Money coming into and going out of your household over a period. Transfers between your own accounts are not income or spending.", "Cash flow = income − expenses", "Compare actuals with your plan"],
  "Gross vs. Net Income": ["Gross income is before tax and deductions; net income is the amount deposited after deductions. Budgets based on take-home pay are easier to reconcile.", "Net income = gross income − payroll deductions", "Use cleared deposits for actual cash flow"],
  "Fixed vs. Variable Expenses": ["Fixed expenses recur at a similar amount; variable expenses change with use or choice. Separating them helps identify what you can adjust.", "Total expenses = fixed expenses + variable expenses", "Review variable spending monthly"],
  "Liquidity Ratio / Emergency Runway": ["Estimates how many months your liquid funds could cover essential spending if income stopped.", "Emergency runway = liquid assets ÷ monthly essential expenses", "Healthy: Target is 3–6 months"],
  "Savings Rate": ["The share of income you keep or direct toward future goals. This estimate uses recorded actual income and expenses.", "Savings rate = (income − expenses) ÷ income × 100%", "A consistent rate matters more than a perfect month"],
  "Debt-to-Income Ratio": ["Compares monthly debt payments with monthly income. Lenders use versions of this ratio to assess borrowing capacity.", "Debt-to-income = monthly debt payments ÷ gross monthly income × 100%", "Lower is generally easier to manage"],
  "Debt-to-Asset Ratio": ["Shows what portion of recorded assets is financed by debt. It puts liabilities in context with what you own.", "Debt-to-asset = total liabilities ÷ total assets × 100%", "Lower means more assets are unencumbered"],
  Amortization: ["The planned schedule for paying down a loan through regular payments of principal and interest.", "Payment = principal portion + interest portion", "Check whether extra payments reduce interest"],
  "Principal vs. Interest": ["Principal reduces the amount borrowed; interest is the cost of borrowing. Early loan payments often contain a larger interest share.", "Interest per period ≈ balance × annual rate ÷ periods per year", "Higher-rate debt costs more to carry"],
  "Cost Basis / ACB": ["Adjusted Cost Base (ACB) is the tracked tax cost of a non-registered investment, adjusted for purchases and certain distributions.", "Unrealized gain/loss = market value − ACB", "ACB tracking can matter for taxable accounts"],
  "Asset Allocation": ["How a portfolio is divided among investment types such as equities, bonds, ETFs, and cash.", "Allocation % = category market value ÷ portfolio market value × 100%", "Choose a mix suited to your timeline and risk"],
  Reconciliation: ["Matches an expected paycheck or bill with a real cleared transaction. A match updates the forecast without counting the same event twice.", "Match: within ±3 days and ±15% of expected amount", "Expected amounts are not current cash"],
  "Monthly Debt Paid": ["The amount directed to reducing debt during the month. Card purchases are expenses; paying the card balance is a transfer, not a second expense.", "Debt paid = cleared payments to debt accounts", "Compare with your 10% target"],
  "Safe-to-Spend": ["A planning estimate of cash remaining after near-term bills due before the next payday. It is not a guarantee of affordability.", "Safe-to-spend = chequing cash − bills due before next payday", "Leave room for unrecorded spending"]
};
const categoryColors = ["#317f53", "#8db59a", "#c5dba8"];
function readPreference(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
let state;
let signedInUser = "";
let screen = "overview";
let view = readPreference("accountant-view", "Combined Household");
let jointShare = Math.min(100, Math.max(0, Number(readPreference("accountant-joint-share", "50")) || 0));
let learning = readPreference("accountant-learning", "true") !== "false";
let chatOpen = false;
let chatHistory = [];
let search = "";
let categoryFilter = "All categories";
let modal = "";
let selectedPartner = "Partner A";
let forecastDays = 30;
let toastTimer;

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const cad = (value, decimals = 0) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(Number(value) || 0);
const pct = (value, decimals = 0) => `${Number(value || 0).toFixed(decimals)}%`;
const dateLabel = (value, opts = { month: "short", day: "numeric" }) => new Date(`${value}T12:00:00`).toLocaleDateString("en-CA", opts);
const dayDiff = (date) => Math.ceil((new Date(`${date}T12:00:00`) - new Date(new Date().toDateString())) / 86400000);
const iconFor = (merchant) => ({ Loblaws: "▦", "Metro Grocery": "▦", "Visa payment": "↔", "Paycheque · Northstar Design": "↗", "e-Transfer · Partner A": "⇄", "Hydro One": "ϟ", Shell: "◉", Netflix: "▷", "Coffee Culture": "☕", "City Childcare Centre": "⌂", "Car loan payment": "↘" }[merchant] || String(merchant || "?").slice(0, 1).toUpperCase());
function nextOccurrence(dateValue, cadence) {
  const date = new Date(`${dateValue}T12:00:00`);
  if (cadence === "Bi-weekly") date.setDate(date.getDate() + 14);
  else if (cadence === "Semi-monthly") {
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    if (date.getDate() < 15) date.setDate(15);
    else if (date.getDate() < lastDay) date.setDate(lastDay);
    else { date.setDate(1); date.setMonth(date.getMonth() + 1); date.setDate(15); }
  }
  else date.setMonth(date.getMonth() + 1);
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
  const [definition, formula, benchmark] = definitions[name] || ["A useful financial measure for understanding and planning household finances.", `${name} = tracked household amounts`, "Review alongside your goals"];
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
  return state.accounts.filter(filter).map((account) => ({ ...account, shownBalance: account.balance * relevantOwner(account.owner) })).filter((account) => relevantOwner(account.owner) > 0);
}
function visibleTransactions() {
  return state.transactions.filter((transaction) => relevantOwner(transaction.owner) > 0);
}
function amount(accounts) { return accounts.reduce((sum, account) => sum + account.shownBalance, 0); }
function metrics() {
  const accounts = visibleAccounts();
  const assets = amount(accounts.filter((a) => a.kind !== "liability"));
  const liquid = amount(accounts.filter((a) => a.kind === "cash"));
  const investments = amount(accounts.filter((a) => a.kind === "investment"));
  const debt = amount(accounts.filter((a) => a.kind === "liability"));
  const tx = visibleTransactions().filter((t) => t.status === "Actual");
  const income = tx.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount * relevantOwner(t.owner), 0);
  const expenses = tx.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount * relevantOwner(t.owner), 0);
  const essentials = tx.filter((t) => t.type === "expense").reduce((sum, t) => sum + transactionCategoryTotal(t, ["Groceries", "Housing & Utilities", "Transit & Fuel", "Childcare", "Medical"]) * relevantOwner(t.owner), 0);
  const debtPaid = tx.filter((t) => t.category === "Debt repayment").reduce((sum, t) => sum + t.amount * relevantOwner(t.owner), 0);
  const invested = tx.filter((t) => t.category === "Investment contribution").reduce((sum, t) => sum + t.amount * relevantOwner(t.owner), 0);
  const generalSavings = tx.filter((t) => t.category === "General savings").reduce((sum, t) => sum + t.amount * relevantOwner(t.owner), 0);
  const basis = accounts.filter((a) => a.kind === "investment").reduce((sum, a) => sum + (a.acb || 0) * relevantOwner(a.owner), 0);
  const grossMonthly = state.schedule.filter((s) => s.type === "income").reduce((sum, s) => sum + (s.grossAmount || s.amount) * (s.cadence === "Bi-weekly" ? 26 / 12 : s.cadence === "Semi-monthly" ? 2 : 1) * relevantOwner(s.owner), 0);
  const netMonthly = state.schedule.filter((s) => s.type === "income").reduce((sum, s) => sum + s.amount * (s.cadence === "Bi-weekly" ? 26 / 12 : s.cadence === "Semi-monthly" ? 2 : 1) * relevantOwner(s.owner), 0);
  const liquidRatio = essentials ? liquid / essentials : 0;
  const savingsRate = income ? Math.max(0, (income - expenses) / income * 100) : 0;
  const monthlyDebtPayments = state.schedule.filter((s) => s.type === "bill" && /loan|mortgage|visa|credit card/i.test(s.name)).reduce((sum, s) => sum + s.amount * relevantOwner(s.owner), 0);
  const dti = grossMonthly ? monthlyDebtPayments / grossMonthly * 100 : 0;
  const nextPayday = state.schedule.filter((s) => s.type === "income" && s.status === "Expected" && dayDiff(s.date) >= 0).sort((a,b)=>a.date.localeCompare(b.date))[0];
  const daysUntilPayday = nextPayday ? dayDiff(nextPayday.date) : 14;
  const dueBeforePay = state.schedule.filter((s) => s.type === "bill" && dayDiff(s.date) >= 0 && dayDiff(s.date) <= daysUntilPayday).reduce((sum, s) => sum + s.amount * relevantOwner(s.owner), 0);
  const liquidChecking = amount(accounts.filter((a) => a.kind === "cash" && (a.bucket === "Chequing" || /chequing|checking/i.test(`${a.name} ${a.accountType || ""}`))));
  return { accounts, assets, liquid, liquidChecking, investments, debt, netWorth: assets - debt, income, expenses, essentials, debtPaid, invested, generalSavings, basis, liquidRatio, savingsRate, dti, debtAsset: assets ? debt / assets * 100 : 0, grossMonthly, netMonthly, monthlyDebtPayments, dueBeforePay, safe: liquidChecking - dueBeforePay };
}
function transactionCategoryTotal(transaction, categories) {
  if (Array.isArray(transaction.splits) && transaction.splits.length) {
    return transaction.splits.filter((split) => categories.includes(split.category)).reduce((sum, split) => sum + Number(split.amount), 0);
  }
  return categories.includes(transaction.category) ? transaction.amount : 0;
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
  return `<div class="app-shell ${learning ? "" : "learning-off"}"><aside class="sidebar" id="sidebar"><div class="brand"><span class="brand-mark">a.</span><div><div class="brand-name">accountant</div><div class="brand-subtitle">Household workspace</div></div></div><div class="nav-label">Your finances</div><nav class="nav-list">${navItems.map(([id, label, icon]) => `<button class="nav-link ${screen === id ? "active" : ""}" data-screen="${id}"><span class="nav-icon">${icon}</span>${label}</button>`).join("")}</nav><div class="sidebar-bottom"><div class="sync-card"><div class="sync-heading"><span class="sync-dot"></span> Your books are ready</div><p>Demo data is saved locally on this server. Connect an account or import a statement to update your ledger.</p><button class="button small" data-modal="connect">Connect an account</button></div><div class="user-chip"><span class="avatar">${signedInUser.slice(-1)}</span><div class="user-meta"><div class="user-name">${esc(signedInUser)}</div><div class="user-home">${esc(state.household)}</div></div><button class="button small" data-action="logout" title="Sign out">↗</button></div></div></aside><main class="main-area"><header class="topbar"><div class="crumbs"><button class="mobile-menu" data-action="menu" aria-label="Open menu">☰</button><span>Workspace</span><span>›</span><strong>${esc(active[1])}</strong></div><div class="topbar-right"><button class="learn-toggle ${learning ? "on" : ""}" data-action="learning"><span>Learning underlines</span><span class="toggle-track"></span></button><select class="view-select" id="viewSelect" aria-label="Choose financial view">${["Combined Household", "Partner A Only", "Partner B Only"].map((item) => `<option ${view === item ? "selected" : ""}>${item}</option>`).join("")}</select></div></header><div class="content" id="pageContent"></div></main></div>${chatOpen ? chatMarkup() : ""}${modal ? modalMarkup() : ""}`;
}

function pageHeading(eyebrow, title, subtitle, actions = "") {
  return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p class="subtitle">${subtitle}</p></div><div class="heading-actions">${actions}</div></div>`;
}
function statCard(label, value, note, symbol, live, tone = "") {
  return `<article class="card stat-card"><div class="stat-top"><span>${term(label, "", live)}</span><span class="stat-symbol">${symbol}</span></div><div class="stat-value ${tone}">${value}</div><div class="stat-foot">${note}</div></article>`;
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
  return `<tr><td>${dateLabel(t.date)}</td><td><div class="merchant-cell"><span class="merchant-icon">${esc(iconFor(t.merchant))}</span><span>${esc(t.merchant)}${t.mcc ? `<small class="muted" style="display:block;font-weight:400;margin-top:3px">MCC ${esc(t.mcc)}</small>` : ""}</span></div></td><td>${badge}</td><td>${esc(t.owner)}</td><td>${esc(t.account)}</td><td class="amount">${signed}${cad(t.amount, 2)}</td><td><button class="table-action" data-split="${esc(t.id)}">Split</button></td></tr>`;
}
function recentTransactions(limit = 5, filter = () => true) {
  const rows = visibleTransactions().filter(filter).slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
  if (!rows.length) return `<tr><td colspan="7" class="empty-state">No transactions match this view.</td></tr>`;
  return rows.map(transactionRow).join("");
}
function tableHeader(headers) {
  return `<thead><tr>${headers.map((header) => `<th>${term(header, "", definitions[header] ? "" : `${esc(header)} values are shown from the active household view.`)}</th>`).join("")}</tr></thead>`;
}
function ratioCard(title, value, note, calculation) {
  return `<div class="ratio-box"><div class="ratio-title">${term(title, "", calculation)}</div><div class="ratio-number">${value}</div><div class="ratio-note">${note}</div></div>`;
}
function budgetMarkup() {
  const m = metrics();
  const basis = m.netMonthly || m.income || 6940;
  const categories = [
    { name: "Essentials", amount: m.essentials, target: 55 },
    { name: "Fun / Wants", amount: categorySpend(["Dining", "Shopping", "Subscriptions"]), target: 5 },
    { name: "Debt Payoff", amount: m.debtPaid, target: 10 },
    { name: "General Savings", amount: m.generalSavings, target: 15 },
    { name: "Investments / Wealth", amount: m.invested, target: 15 }
  ];
  return categories.map((item, index) => {
    item.target = Number(state.budget[index]?.target ?? item.target);
    const budget = basis * item.target / 100;
    const percentage = budget ? item.amount / budget * 100 : 0;
    return `<div class="budget-row"><span>${esc(item.name)}</span><div><div class="progress ${percentage > 115 ? "over" : ""}"><span style="width:${Math.min(100, percentage)}%"></span></div><div class="muted" style="font-size:9px;margin-top:4px">${cad(item.amount)} actual · ${cad(budget)} target</div></div><span class="progress-target">${item.target}%</span></div>`;
  }).join("");
}
function budgetSplitLabel() {
  return state.budget.map((item)=>item.target).join(" / ");
}
function categorySpend(categories) {
  return visibleTransactions().filter((t) => t.type === "expense" && t.status === "Actual").reduce((sum, t) => sum + transactionCategoryTotal(t, categories) * relevantOwner(t.owner), 0);
}
function overviewScreen() {
  const m = metrics();
  const todayLabel = new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date());
  return `${pageHeading(todayLabel, `Good evening, ${esc(signedInUser)}.`, "Here’s your household money at a glance.", `<button class="button" data-modal="import">Import statement</button><button class="button primary" data-action="chat">Ask your accountant ✦</button>`)}
    <div class="grid stats-grid">
      ${statCard("Net Worth", cad(m.netWorth), `<span class="trend">↗ 8.0%</span> over the last 6 months`, "↗", `${cad(m.assets)} − ${cad(m.debt)} = ${cad(m.netWorth)}`)}
      ${statCard("Liquid Assets", cad(m.liquid), "Available across chequing & savings", "◉", `${cad(m.liquid)} in cash accounts`)}
      ${statCard("Cash Flow", cad(m.income - m.expenses), `${cad(m.income)} income · ${cad(m.expenses)} spending`, "↔", `${cad(m.income)} − ${cad(m.expenses)} = ${cad(m.income - m.expenses)}`)}
      ${statCard("Total Liabilities", cad(m.debt), "Credit card + car loan", "⌁", `${cad(m.debt)} outstanding`)}
    </div>
    <div class="grid content-grid"><section class="card chart-card"><div class="card-header"><div><h2>${term("Net Worth", "", `${cad(m.assets)} − ${cad(m.debt)} = ${cad(m.netWorth)}`, { label: "Net worth over time" })}</h2><p>Household assets less liabilities · last 6 months</p></div><span class="pill green">+8.0% this period</span></div>${chartMarkup()}</section><section class="card breakdown-card"><div class="card-header"><div><h2>Assets by owner</h2><p>One shared view, no double-counting</p></div><button class="button small" data-screen="balance">Details</button></div>${ownerBreakdown()}</section></div>
    <div class="grid content-grid"><section class="card"><div class="card-header"><div><h2>Monthly plan</h2><p>Actual allocations against the ${budgetSplitLabel()} household model</p></div><button class="button small" data-screen="cashflow">View plan</button></div>${budgetMarkup()}</section><article class="card insight-card"><div class="insight-label">A thoughtful next step · Personal Accountant</div><h2>Your household has ${m.liquidRatio.toFixed(1)} months of essential spending in liquid funds.</h2><p>${m.liquidRatio < 3 ? "Building toward a three-month reserve can make unexpected costs easier to manage." : m.liquidRatio <= 6 ? "You’re within the typical 3–6 month emergency runway range. Keep this reserve accessible." : "Your accessible reserve is above the typical 3–6 month range. Consider whether part of it is intended for another near-term goal."}</p><button class="button small" data-screen="balance">Explore your ratios →</button></article></div>
    <div class="grid content-grid"><section class="card section-card"><div class="section-title-row"><div><h2>Recent activity</h2><p class="muted" style="font-size:11px;margin:5px 0 0">Purchases, income, and transfers—all clearly separated</p></div><button class="button small" data-screen="ledger">Open ledger</button></div><div class="table-wrap"><table>${tableHeader(["Date", "Merchant", "Category", "Owner", "Account", "Amount", "Actions"])}<tbody>${recentTransactions(5)}</tbody></table></div></section><section class="card"><div class="card-header"><div><h2>Coming up</h2><p>Expected amounts stay out of today’s balances</p></div><button class="button small" data-screen="cashflow">30 days</button></div>${scheduleList(4)}</section></div>`;
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
    return `<tr><td><strong>${owner}</strong></td><td class="amount">${cad(amount(owned.filter((a) => a.kind === "cash")))}</td><td class="amount">${cad(amount(owned.filter((a) => a.kind === "investment")))}</td><td class="amount">${cad(assets)}</td><td class="amount">${cad(debt)}</td><td class="amount">${cad(assets - debt)}</td></tr>`;
  }).join("");
  return `${pageHeading("The full picture", "Balance sheet", "What you own, what you owe, and how your household is progressing.", `<button class="button" data-modal="connect">Manage accounts</button>`)}
    <div class="grid stats-grid">${statCard("Assets", cad(m.assets), "Cash + investment accounts", "◫", `${cad(m.assets)} total assets`)}${statCard("Liquid Assets", cad(m.liquid), "Accessible cash balances", "◉", `${cad(m.liquid)} liquid`)}${statCard("Illiquid Assets", cad(Math.max(0, m.assets - m.liquid)), "Investments & long-term holdings", "▤", `${cad(m.assets)} − ${cad(m.liquid)} = ${cad(Math.max(0, m.assets - m.liquid))}`)}${statCard("Net Worth", cad(m.netWorth), "Assets less all liabilities", "↗", `${cad(m.assets)} − ${cad(m.debt)} = ${cad(m.netWorth)}`)}</div>
    ${sectionCard("Owner breakdown", "Personal accounts and the shared household bucket. Joint balances are included once in Combined Household.", `<div class="table-wrap"><table>${tableHeader(["Owner", "Liquid assets", "Investments", "Total assets", "Liabilities", "Net worth"])}<tbody>${rows}<tr style="background:#fafcf9"><td><strong>Household total</strong></td><td class="amount">${cad(amount(accounts.filter((a)=>a.kind==="cash")))}</td><td class="amount">${cad(amount(accounts.filter((a)=>a.kind==="investment")))}</td><td class="amount">${cad(m.assets)}</td><td class="amount">${cad(m.debt)}</td><td class="amount">${cad(m.netWorth)}</td></tr></tbody></table></div>`, `<label class="muted" style="font-size:10px">Joint share in personal view <strong>${jointShare}%</strong></label><input id="jointShare" type="range" min="0" max="100" value="${jointShare}" style="width:95px;accent-color:#32865a">`)}
    <div class="grid content-grid"><section class="card chart-card"><div class="card-header"><div><h2>Net worth history</h2><p>Monthly snapshot</p></div><span class="pill green">Six-month view</span></div>${chartMarkup()}</section><section class="card"><div class="card-header"><div><h2>Accountant ratios</h2><p>Indicators based on tracked data</p></div></div><div class="ratio-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">${ratioCard("Savings Rate", pct(m.savingsRate, 1), "Actual income less expenses", `${cad(m.income - m.expenses)} ÷ ${cad(m.income)} = ${pct(m.savingsRate,1)}`)}${ratioCard("Debt-to-Income Ratio", pct(m.dti, 1), "Scheduled debt payments ÷ gross", `${cad(m.monthlyDebtPayments)} ÷ ${cad(m.grossMonthly)} = ${pct(m.dti,1)}`)}${ratioCard("Liquidity Ratio / Emergency Runway", `${m.liquidRatio.toFixed(1)} mo`, "Target: 3–6 months", `${cad(m.liquid)} ÷ ${cad(m.essentials)} essential expenses = ${m.liquidRatio.toFixed(1)} months`)}${ratioCard("Debt-to-Asset Ratio", pct(m.debtAsset, 1), "Liabilities ÷ assets", `${cad(m.debt)} ÷ ${cad(m.assets)} = ${pct(m.debtAsset,1)}`)}</div></section></div>
    ${sectionCard("Liability maturity", "Separate near-term statement balances from longer-term loans.", `<div class="metric-list"><div class="metric-row"><span>${term("Current Liabilities", "", `${cad(currentLiabilities)} due on current credit-card statements`)}</span><strong>${cad(currentLiabilities)}</strong></div><div class="metric-row"><span>${term("Long-Term Liabilities", "", `${cad(longTermLiabilities)} remaining on loans`)}</span><strong>${cad(longTermLiabilities)}</strong></div></div>`)}
    ${sectionCard("All accounts", "Current balances are separate from expected future cash flow.", accountTable(accounts))}`;
}
function accountTable(accounts) {
  return `<div class="table-wrap"><table>${tableHeader(["Account", "Institution", "Owner", "Type", "Balance", "Details"])}<tbody>${accounts.map((a) => `<tr><td><div class="merchant-cell"><span class="merchant-icon">${a.kind === "liability" ? "↘" : a.kind === "investment" ? "◉" : "▣"}</span><strong>${esc(a.name)}</strong></div></td><td>${esc(a.institution)}</td><td>${esc(a.owner)}</td><td><span class="pill">${esc(a.accountType || a.bucket || "Cash")}</span></td><td class="amount">${cad(a.shownBalance)}</td><td>${a.kind === "liability" ? `${a.apr}% APR · due ${dateLabel(a.dueDate)}` : a.kind === "investment" ? `ACB ${cad((a.acb || 0) * relevantOwner(a.owner))}` : `•••• ${esc(a.last4)}`}</td></tr>`).join("")}</tbody></table></div>`;
}
function scheduleList(limit = 20, days = null) {
  const rows = forecastOccurrences(days ?? 90).slice(0, limit);
  return rows.map((item) => `<div class="forecast-item"><div class="forecast-date">${dateLabel(item.date)}</div><div><div class="forecast-name">${esc(item.name)}</div><div class="forecast-meta">${esc(item.cadence)} · ${esc(item.owner)}</div></div><div class="forecast-amount ${item.type === "income" ? "trend" : ""}">${item.type === "income" ? "+" : "−"}${cad(item.amount * relevantOwner(item.owner))}</div><div style="text-align:right"><span class="pill ${item.status === "Actual / Cleared" ? "green" : "amber"}">${esc(item.status)}</span></div></div>`).join("") || `<div class="empty-state">No scheduled items for this view.</div>`;
}
function cashflowScreen() {
  const m = metrics();
  const forecast = forecastOccurrences(forecastDays);
  const bills = forecast.filter((s) => s.type === "bill").reduce((sum, s) => sum + s.amount * relevantOwner(s.owner), 0);
  const expectedIncome = forecast.filter((s)=>s.type==="income").reduce((sum,s)=>sum+s.amount*relevantOwner(s.owner),0);
  return `${pageHeading("Plan ahead with confidence", "Cash flow & forecast", "Expected paydays and bills are planning signals—not current assets.", `<button class="button primary" data-modal="schedule">+ Add recurring item</button>`)}
    <div class="grid stats-grid">${statCard("Safe-to-Spend", cad(m.safe), `${cad(m.liquidChecking)} chequing − ${cad(m.dueBeforePay)} near-term bills`, "◈", `${cad(m.liquidChecking)} − ${cad(m.dueBeforePay)} = ${cad(m.safe)}`)}${statCard(`Expected income · ${forecastDays} days`, cad(expectedIncome), "Not counted in current net worth", "↗", "Expected deposits are not yet cash")} ${statCard(`Bills due · ${forecastDays} days`, cad(bills), "Upcoming bills & statements", "↘", `${cad(bills)} expected payments`)}${statCard("Actual cash flow", cad(m.income - m.expenses), `${cad(m.income)} income − ${cad(m.expenses)} expenses`, "↔", `${cad(m.income)} − ${cad(m.expenses)} = ${cad(m.income - m.expenses)}`)}</div>
    <div class="grid content-grid"><section class="card section-card"><div class="card-header"><div><h2>Expected vs. actual timeline</h2><p>Actuals reconcile within ±3 days and ±15% of an expected amount</p></div><div class="heading-actions">${[30,60,90].map((days)=>`<button class="button small ${forecastDays===days?"primary":""}" data-forecast-days="${days}">${days} days</button>`).join("")}</div></div>${scheduleList(50, forecastDays)}</section><section class="card"><div class="card-header"><div><h2>Safe-to-spend</h2><p>Before your next payday</p></div></div><div class="asset-total">${cad(m.safe)}<small>Current chequing balance less bills due before payday</small></div><div class="metric-list"><div class="metric-row"><span>Liquid chequing balances</span><strong>${cad(m.liquidChecking)}</strong></div><div class="metric-row"><span>Upcoming scheduled bills</span><strong>− ${cad(m.dueBeforePay)}</strong></div><div class="metric-row"><span>${term("Safe-to-Spend", "", `${cad(m.liquidChecking)} − ${cad(m.dueBeforePay)} = ${cad(m.safe)}`)}</span><strong>${cad(m.safe)}</strong></div></div><div style="padding:0 20px 18px"><div class="notice">${term("Reconciliation", "", "Expected item matched against cleared amount")} Paydays and bills remain Expected until a matching bank transaction clears.</div></div></section></div>
    <div class="grid content-grid"><section class="card"><div class="card-header"><div><h2>Monthly budget targets</h2><p>${budgetSplitLabel()} split · based on estimated household take-home pay</p></div><button class="button small" data-action="budget">Customize targets</button></div>${budgetMarkup()}</section><section class="card"><div class="card-header"><div><h2>Fixed vs. variable</h2><p>Actual categorized purchase activity</p></div></div><div class="metric-list"><div class="metric-row"><span>${term("Gross vs. Net Income", "", `${cad(m.grossMonthly)} gross − ${cad(m.grossMonthly-m.netMonthly)} estimated deductions = ${cad(m.netMonthly)} planned net deposits`)}</span><strong>${cad(m.income)} cleared net</strong></div><div class="metric-row"><span>${term("Fixed vs. Variable Expenses", "", `${cad(categorySpend(["Housing & Utilities", "Childcare", "Subscriptions"]))} fixed-style + ${cad(categorySpend(["Groceries", "Dining", "Transit & Fuel", "Shopping"]))} variable-style`)}</span><strong>${cad(m.expenses)}</strong></div><div class="metric-row"><span>Fixed-style categories</span><strong>${cad(categorySpend(["Housing & Utilities", "Childcare", "Subscriptions"]))}</strong></div><div class="metric-row"><span>Variable-style categories</span><strong>${cad(categorySpend(["Groceries", "Dining", "Transit & Fuel", "Shopping", "Medical"]))}</strong></div><div class="metric-row"><span>${term("Savings Rate", "", `${cad(m.income-m.expenses)} ÷ ${cad(m.income)} = ${pct(m.savingsRate,1)}`)}</span><strong>${pct(m.savingsRate,1)}</strong></div></div></section></div>`;
}
function ledgerScreen() {
  const transactions = visibleTransactions().filter((t) => (!search || `${t.merchant} ${t.category} ${t.account} ${t.owner}`.toLowerCase().includes(search.toLowerCase())) && (categoryFilter === "All categories" || t.category === categoryFilter)).sort((a, b) => b.date.localeCompare(a.date));
  const categories = ["All categories", ...new Set(state.transactions.map((t) => t.category))];
  return `${pageHeading("Every dollar, in the right place", "Smart ledger", "Card purchases count as expenses; repayments and transfers stay neutral.", `<button class="button" data-action="plaid-sync">Sync connected</button><button class="button" data-modal="connect">Connect Plaid</button><button class="button primary" data-modal="import">↑ Import CSV</button>`)}
    <div class="grid stats-grid">${statCard("Actual income", cad(metrics().income), "Cleared deposits only", "↗", `${cad(metrics().income)} actual income`)}${statCard("Purchases & bills", cad(metrics().expenses), "Includes credit-card purchases once", "↘", `${cad(metrics().expenses)} categorized expenses`)}${statCard("Monthly Debt Paid", cad(metrics().debtPaid), "Not double-counted as an expense", "⌁", `${cad(metrics().debtPaid)} cleared repayments`)}${statCard("Investment contributions", cad(metrics().invested), "Tracked separately from spending", "◉", `${cad(metrics().invested)} contributions`)}</div>
    <section class="card section-card"><div class="section-title-row"><div><h2>Transactions</h2><p class="muted" style="font-size:11px;margin:5px 0 0">${transactions.length} records · use Split to allocate a multi-category purchase</p></div><button class="button small" data-action="merchant-rules">Merchant rules (${state.merchantRules.length})</button></div><div class="filter-row"><input class="input search-input" id="ledgerSearch" value="${esc(search)}" placeholder="Search merchant, category, account…"><select class="select" id="categoryFilter">${categories.map((category) => `<option ${category === categoryFilter ? "selected" : ""}>${esc(category)}</option>`).join("")}</select><span class="pill">Transfers excluded from expenses</span></div><div class="table-wrap"><table>${tableHeader(["Date", "Merchant", "Category", "Owner", "Account", "Amount", "Actions"])}<tbody>${transactions.length ? transactions.map(transactionRow).join("") : `<tr><td colspan="7" class="empty-state">No transactions match these filters.</td></tr>`}</tbody></table></div></section>
    <div class="grid content-grid"><section class="card"><div class="card-header"><div><h2>Account routing rules</h2><p>Automatically keep movement separate from spending</p></div></div><div class="metric-list"><div class="metric-row"><span>Chequing → card / loan</span><strong><span class="pill green">Debt repayment · neutral</span></strong></div><div class="metric-row"><span>Chequing → TFSA / RRSP / FHSA</span><strong><span class="pill green">Investment contribution</span></strong></div><div class="metric-row"><span>Account → account / e-Transfer</span><strong><span class="pill">Internal transfer · neutral</span></strong></div><div class="metric-row"><span>Credit card swipe</span><strong><span class="pill amber">Expense + liability</span></strong></div></div></section><section class="card"><div class="card-header"><div><h2>Smart import</h2><p>Canadian bank CSVs · deduplicated by date, amount & last 4</p></div></div><div style="padding:0 18px 18px"><div class="notice">Plaid Link credentials stay on the server. CSV imports are available now; Plaid linking requires a configured server integration.</div></div></section></div>`;
}
function debtScreen() {
  const debts = visibleAccounts((a) => a.kind === "liability");
  const totalDebt = amount(debts);
  return `${pageHeading("Make a plan for what you owe", "Debt & amortization", "See balances, interest rates, statement dates, and a simple payoff estimate.", `<button class="button primary" data-action="debt-tip">How payoff works</button>`)}
    <div class="grid stats-grid">${statCard("Total debt", cad(totalDebt), `${debts.length} tracked accounts`, "⌁", `${cad(totalDebt)} outstanding`)}${statCard("Monthly debt payments", cad(state.schedule.filter((s)=>s.type==="bill"&&/loan|mortgage|visa|credit card/i.test(s.name)).reduce((sum,s)=>sum+s.amount*relevantOwner(s.owner),0)), "Scheduled payments", "↘", "Scheduled debt payments")}${statCard("Debt-to-Income Ratio", pct(metrics().dti,1), "Using estimated gross monthly income", "÷", pct(metrics().dti,1))}${statCard("Debt-to-Asset Ratio", pct(metrics().debtAsset,1), "Liabilities as a share of assets", "%", pct(metrics().debtAsset,1))}</div>
    <div class="grid two-col">${debts.map((debt) => {
      const months = debt.amortizationMonths || Math.max(1, Math.ceil(debt.balance / (debt.monthlyPayment || 250)));
      const payment = debt.monthlyPayment || Math.max(75, debt.balance * (debt.apr / 100 / 12 + 0.02));
      const interest = debt.balance * debt.apr / 100 / 12;
      const principal = Math.max(0, payment - interest);
      return `<article class="card" style="padding:19px;margin-bottom:16px"><div class="account-head"><div><div class="account-name">${esc(debt.name)}</div><div class="account-sub">${esc(debt.institution)} · ${esc(debt.owner)}</div></div><span class="pill ${debt.apr >= 12 ? "red" : "amber"}">${debt.apr}% APR</span></div><div class="account-value">${cad(debt.shownBalance)}</div><div class="account-sub">${debt.accountType === "Credit card" ? `${cad(debt.limit)} credit limit · ${((debt.balance / debt.limit) * 100).toFixed(0)}% utilization` : `Estimated payoff in ${months} months`}</div><div class="debt-visual"><span style="width:${Math.max(3, Math.min(100, debt.balance / (debt.limit || (debt.balance * 1.6)) * 100))}%"></span></div><div class="metric-list" style="padding:8px 0 0"><div class="metric-row"><span>Next due date</span><strong>${dateLabel(debt.dueDate)}</strong></div><div class="metric-row"><span>Monthly payment estimate</span><strong>${cad(payment)}</strong></div><div class="metric-row"><span>${term("Principal vs. Interest", "", `${cad(payment)} ≈ ${cad(principal)} principal + ${cad(interest)} interest`)}</span><strong>${cad(principal)} / ${cad(interest)}</strong></div><div class="metric-row"><span>${term("Amortization", "", `Approx. ${months} months at current payment`)}</span><strong>${months} months</strong></div></div></article>`;
    }).join("")}</div>
    ${sectionCard("A simple payoff lens", "Highest interest first can lower the total cost, if your cash buffer and minimum payments are protected.", `<div class="metric-list"><div class="metric-row"><span>Credit card · 19.99%</span><strong>Prioritize extra payments here</strong></div><div class="metric-row"><span>Car loan · 6.49%</span><strong>Keep scheduled payments current</strong></div><div class="notice">This is educational guidance based on the rates you entered, not individualized tax, investment, or lending advice.</div></div>`)}`;
}
function investmentsScreen() {
  const accounts = visibleAccounts((a) => a.kind === "investment");
  const m = metrics();
  const gains = accounts.reduce((sum, a) => sum + (a.balance - (a.acb || 0)) * relevantOwner(a.owner), 0);
  const deductions = state.taxDeductions.filter((item) => relevantOwner(item.owner) > 0);
  return `${pageHeading("Invest with the whole picture", "Investments & tax vault", "Canadian account types, portfolio mix, adjusted cost base, and deductible receipts.", `<button class="button" data-action="tax-export">↓ Export tax CSV</button><button class="button primary" data-action="balance-update">Quarterly balance update</button>`)}
    <div class="grid stats-grid">${statCard("Investment assets", cad(m.investments), `${accounts.length} accounts in this view`, "◉", `${cad(m.investments)} market value`)}${statCard("Unrealized gain / loss", `${gains >= 0 ? "+" : "−"}${cad(Math.abs(gains))}`, "Market value less tracked ACB", "↗", `${cad(m.investments)} − ${cad(m.basis)} = ${cad(gains)}`)}${statCard("Cost Basis / ACB", cad(m.basis), "Tracked adjusted cost base", "▤", `${cad(m.investments)} − ${cad(m.basis)} = ${cad(gains)}`)}${statCard("Tax receipts", `${deductions.length} receipts`, `${cad(deductions.reduce((sum,d)=>sum+d.amount,0))} tagged`, "⌑", `${deductions.length} tagged receipts`)}</div>
    <section class="card section-card"><div class="section-title-row"><div><h2>Canadian portfolio overview</h2><p class="muted" style="font-size:11px;margin:5px 0 0">${term("Asset Allocation", "", "Equities, ETFs, bonds, and cash as tracked per account")}</p></div><span class="pill green">TFSA · RRSP · FHSA · Non-Registered</span></div><div class="account-grid">${accounts.map((a) => {
      const gain = a.balance - (a.acb || 0);
      const allocation = a.allocation || { Equities: 50, ETFs: 25, Bonds: 20, Cash: 5 };
      return `<article class="account-card"><div class="account-head"><div><div class="account-name">${esc(a.name)}</div><div class="account-sub">${esc(a.accountType)} · ${esc(a.owner)}</div></div>${a.manual ? `<span class="pill amber">Manual · quarterly</span>` : `<span class="pill green">Synced</span>`}</div><div class="account-value">${cad(a.shownBalance)}</div><div class="account-change">${gain >= 0 ? "+" : "−"}${cad(Math.abs(gain))} unrealized · ACB ${cad((a.acb || 0) * relevantOwner(a.owner))}</div><div class="allocation">${Object.values(allocation).map((value) => `<span style="width:${value}%"></span>`).join("")}</div><div class="account-sub" style="margin-top:8px">Equities ${allocation.Equities}% · ETFs ${allocation.ETFs}% · Bonds ${allocation.Bonds}% · Cash ${allocation.Cash}%</div></article>`;
    }).join("")}</div></section>
    <div class="grid content-grid"><section class="card section-card"><div class="section-title-row"><div><h2>Tax-deduction log</h2><p class="muted" style="font-size:11px;margin:5px 0 0">Keep receipt tags together for tax season</p></div><button class="button small" data-action="tax-add">+ Add receipt</button></div><div class="table-wrap"><table>${tableHeader(["Date", "Merchant", "Category", "Owner", "Tag", "Amount"])}<tbody>${deductions.map((d) => `<tr><td>${dateLabel(d.date)}</td><td><strong>${esc(d.merchant)}</strong></td><td><span class="pill">${esc(d.category)}</span></td><td>${esc(d.owner)}</td><td>${esc(d.tag)}</td><td class="amount">${cad(d.amount,2)}</td></tr>`).join("")}</tbody></table></div></section><section class="card"><div class="card-header"><div><h2>Account types</h2><p>Contribution limits and tax treatment vary by account</p></div></div><div class="metric-list"><div class="metric-row"><span>TFSA</span><strong>Tax-free growth / withdrawals</strong></div><div class="metric-row"><span>RRSP</span><strong>Tax-deferred retirement savings</strong></div><div class="metric-row"><span>FHSA</span><strong>First-home saving, eligible tax benefits</strong></div><div class="metric-row"><span>Non-registered</span><strong>ACB tracking may be important</strong></div></div></section></div>`;
}
function pageMarkup() {
  const content = { overview: overviewScreen, balance: balanceScreen, cashflow: cashflowScreen, ledger: ledgerScreen, debt: debtScreen, investments: investmentsScreen }[screen]();
  const page = app.querySelector("#pageContent");
  page.innerHTML = content;
  const m = metrics();
  const liveSummary = `${view}: ${cad(m.assets)} total assets − ${cad(m.debt)} liabilities = ${cad(m.netWorth)} net worth.`;
  page.querySelectorAll(".card h2, .metric-row > span:first-child, .budget-row > span:first-child, .account-card .account-name").forEach((label) => {
    if (label.dataset.noTerm === "true" || label.querySelector(".term")) return;
    const text = label.textContent.trim();
    if (text) label.innerHTML = term(text, "", liveSummary);
  });
  bindPageEvents();
}

function chatMarkup() {
  return `<section class="chat-drawer" aria-label="Ask your accountant"><div class="chat-head"><div><strong>Ask your accountant ✦</strong><small>Answers grounded in your household ledger</small></div><button class="modal-close" data-action="chat-close" aria-label="Close chat">×</button></div><div class="chat-messages" id="chatMessages">${chatHistory.length ? chatHistory.map((m) => `<div class="chat-message ${m.role === "user" ? "user" : ""}">${esc(m.text)}</div>`).join("") : `<div class="chat-message">Hi ${esc(signedInUser)}. I can help explain your recorded cash flow, spending, savings, and debt trade-offs. I’ll stick to the numbers in your ledger.</div><div class="chat-message">Try: “What is our current cash flow?”</div>`}</div><form class="chat-form" id="chatForm"><input class="input" name="question" placeholder="Ask about your household numbers…" required><button class="button primary small">Ask</button></form></section>`;
}

function modalMarkup() {
  if (modal && modal.type === "split") {
    const transaction = state.transactions.find((t) => t.id === modal.splitId);
    if (!transaction) return "";
    const lines = modal.lines || [{ category: transaction.category, amount: transaction.amount }, { category: "Household", amount: 0 }];
    return `<div class="modal-backdrop" data-action="backdrop"><section class="modal"><div class="modal-head"><div><div class="eyebrow">Transaction details</div><h2>Split this transaction</h2><p class="subtitle" style="margin-top:6px">${esc(transaction.merchant)} · ${cad(transaction.amount,2)}</p></div><button class="modal-close" data-action="modal-close">×</button></div><div id="splitLines">${lines.map((line, index) => `<div class="split-line"><select class="select split-category" data-index="${index}">${["Groceries","Dining","Housing & Utilities","Transit & Fuel","Subscriptions","Childcare","Medical","Shopping","Other"].map((category)=>`<option ${line.category===category?"selected":""}>${category}</option>`).join("")}</select><input class="input split-amount" data-index="${index}" type="number" step="0.01" min="0" value="${Number(line.amount).toFixed(2)}"></div>`).join("")}</div><button class="button small" data-action="add-split">+ Add category</button><div class="form-row" style="margin-top:16px"><label><input id="saveRule" type="checkbox"> Save Merchant Rule for ${esc(transaction.merchant)}</label><div class="muted" style="font-size:10px;margin-top:5px">Remember this category preference for future imports.</div></div><div class="notice" id="splitTotal">Split total: ${cad(lines.reduce((sum,line)=>sum+Number(line.amount),0),2)} · Transaction total: ${cad(transaction.amount,2)}</div><div class="modal-actions"><button class="button" data-action="modal-close">Cancel</button><button class="button primary" data-action="split-save">Save split</button></div></section></div>`;
  }
  if (modal === "import") {
    return `<div class="modal-backdrop" data-action="backdrop"><section class="modal"><div class="modal-head"><div><div class="eyebrow">Canadian bank statements</div><h2>Import a CSV statement</h2><p class="subtitle" style="margin-top:6px">RBC, TD, CIBC, BMO, Scotiabank, Tangerine, EQ Bank and standard CSV formats.</p></div><button class="modal-close" data-action="modal-close">×</button></div><div class="form-row"><label for="csvOwner">Account owner</label><select class="select" id="csvOwner" style="width:100%"><option>Partner A</option><option>Partner B</option><option>Joint</option></select></div><div class="grid two-col"><div class="form-row"><label for="csvKind">Account type</label><select class="select" id="csvKind" style="width:100%"><option value="cash">Chequing / savings</option><option value="liability">Credit card</option></select></div><div class="form-row"><label for="csvAccount">Account name</label><input class="input" id="csvAccount" style="width:100%" value="Imported chequing"></div></div><div class="form-row"><label for="csvLast4">Last 4 digits (for duplicate protection)</label><input class="input" id="csvLast4" maxlength="4" value="0000" style="width:100%"></div><div class="drop-zone" id="dropZone"><strong>Drop your CSV statement here</strong>or <label class="button small" for="csvFile">choose a file</label><input type="file" id="csvFile" accept=".csv,text/csv" hidden><div id="fileName" style="margin-top:8px">Your statement is processed by this server.</div></div><div class="notice" style="margin-top:14px">Expected columns: Date, Description / Merchant, Amount (or separate Debit and Credit columns). Purchases, deposits, and internal transfers are routed based on account and merchant.</div><div class="modal-actions"><button class="button" data-action="modal-close">Cancel</button><button class="button primary" id="importButton">Import transactions</button></div></section></div>`;
  }
  if (modal === "connect") {
    return `<div class="modal-backdrop" data-action="backdrop"><section class="modal"><div class="modal-head"><div><div class="eyebrow">Secure connection</div><h2>Connect a financial account</h2><p class="subtitle" style="margin-top:6px">Read-only data connections for your household workspace.</p></div><button class="modal-close" data-action="modal-close">×</button></div><div class="notice">Plaid credentials and access tokens are handled on the backend, never in the browser. Configure PLAID_CLIENT_ID and PLAID_SECRET on your server to enable Plaid Link.</div><div class="form-row" style="margin-top:16px"><label>Connection environment</label><select class="select" style="width:100%" id="plaidEnvironment"><option>Sandbox</option><option>Limited Production</option></select></div><button class="button primary" style="width:100%" data-action="plaid-connect">Connect with Plaid</button><div id="plaidResult" class="muted" style="font-size:11px;margin-top:10px"></div><hr style="border:0;border-top:1px solid var(--line);margin:18px 0"><div class="account-head"><div><div class="account-name">Joint account duplicate shield</div><div class="account-sub">Mute duplicate account feeds when already linked by your partner.</div></div><button class="button small" data-action="toggle-muted">Mark as muted</button></div><div class="modal-actions"><button class="button" data-action="modal-close">Done</button></div></section></div>`;
  }
  if (modal === "schedule") {
    return `<div class="modal-backdrop" data-action="backdrop"><section class="modal"><div class="modal-head"><div><div class="eyebrow">Plan ahead</div><h2>Add recurring income or a bill</h2></div><button class="modal-close" data-action="modal-close">×</button></div><form id="scheduleForm"><div class="form-row"><label>Item name</label><input class="input" required name="name" placeholder="e.g. Paycheque or Internet"></div><div class="grid two-col"><div class="form-row"><label>Type</label><select class="select" name="type"><option value="income">Payday / income</option><option value="bill">Recurring bill</option></select></div><div class="form-row"><label>Amount (CAD)</label><input class="input" required name="amount" type="number" min=".01" step=".01"></div></div><div class="grid two-col"><div class="form-row"><label>Next date</label><input class="input" name="date" type="date" required></div><div class="form-row"><label>Owner</label><select class="select" name="owner"><option>Joint</option><option>Partner A</option><option>Partner B</option></select></div></div><div class="form-row"><label>Cadence</label><select class="select" name="cadence"><option>Monthly</option><option>Bi-weekly</option><option>Semi-monthly</option></select></div><div class="notice">Expected items stay separate from actual balances until a matching deposit or bill clears.</div><div class="modal-actions"><button type="button" class="button" data-action="modal-close">Cancel</button><button class="button primary">Add item</button></div></form></section></div>`;
  }
  if (modal === "budget") {
    return `<div class="modal-backdrop" data-action="backdrop"><section class="modal"><div class="modal-head"><div><div class="eyebrow">Household budget model</div><h2>Customize your target split</h2><p class="subtitle">Targets should add up to 100%.</p></div><button class="modal-close" data-action="modal-close">×</button></div><form id="budgetForm">${state.budget.map((item, index) => `<div class="form-row"><label>${esc(item.category)} (%)</label><input class="input budget-input" type="number" min="0" max="100" value="${item.target}" data-index="${index}" required></div>`).join("")}<div class="notice" id="budgetTotal">Total: 100%</div><div class="modal-actions"><button type="button" class="button" data-action="modal-close">Cancel</button><button class="button primary">Save targets</button></div></form></section></div>`;
  }
  if (modal === "receipt") {
    return `<div class="modal-backdrop" data-action="backdrop"><section class="modal"><div class="modal-head"><div><div class="eyebrow">Tax vault</div><h2>Add a tax-deductible receipt</h2></div><button class="modal-close" data-action="modal-close">×</button></div><form id="receiptForm"><div class="form-row"><label>Merchant</label><input class="input" name="merchant" required></div><div class="grid two-col"><div class="form-row"><label>Category</label><select class="select" name="category"><option>Medical</option><option>Childcare</option><option>Donations</option><option>Union/Work Dues</option></select></div><div class="form-row"><label>Amount (CAD)</label><input class="input" name="amount" required type="number" min=".01" step=".01"></div></div><div class="grid two-col"><div class="form-row"><label>Date</label><input class="input" name="date" type="date" required></div><div class="form-row"><label>Owner</label><select class="select" name="owner"><option>Partner A</option><option>Partner B</option><option>Joint</option></select></div></div><div class="form-row"><label>Receipt tag</label><input class="input" name="tag" placeholder="e.g. dental receipt"></div><div class="modal-actions"><button type="button" class="button" data-action="modal-close">Cancel</button><button class="button primary">Add receipt</button></div></form></section></div>`;
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
  signedInUser = result.user;
  render();
}
function render() {
  if (!signedInUser || !state) { loginMarkup(); return; }
  app.innerHTML = shellMarkup();
  pageMarkup();
  bindGlobalEvents();
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
  app.querySelector("#chatForm")?.addEventListener("submit",sendQuestion);
}
function bindPageEvents() {
  const page=app.querySelector("#pageContent");
  page.querySelectorAll("[data-screen]").forEach((button)=>button.addEventListener("click",()=>{screen=button.dataset.screen;render();}));
  page.querySelectorAll("[data-action]").forEach((button)=>button.addEventListener("click",handleAction));
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
  page.querySelector("#jointShare")?.addEventListener("input",(event)=>{jointShare=Number(event.target.value);const label=event.target.parentElement.querySelector("strong");label.textContent=`${jointShare}%`;});
  page.querySelector("#jointShare")?.addEventListener("change",()=>{localStorage.setItem("accountant-joint-share",String(jointShare));render();});
  app.querySelectorAll(".term").forEach((item)=>{
    const positionPopover=()=>{
      if(window.innerWidth<=760)return;
      const rect=item.getBoundingClientRect();
      const left=Math.max(150,Math.min(window.innerWidth-150,rect.left+rect.width/2));
      const below=rect.bottom+10;
      const popover=item.querySelector(".popover");
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
  if (action === "chat") { chatOpen=true;render(); }
  if (action === "chat-close") { chatOpen=false;render(); }
  if (action === "logout") { await fetch("/api/logout",{method:"POST"});signedInUser="";state=null;loginMarkup(); }
  if (action === "menu") app.querySelector("#sidebar").classList.toggle("open");
  if (action === "modal-close") {modal="";render();}
  if (action === "backdrop" && event.target.classList.contains("modal-backdrop")) {modal="";render();}
  if (action === "add-split") {const lines=readSplitLines();lines.push({category:"Shopping",amount:0});modal.lines=lines;render();bindModalEvents();}
  if (action === "split-save") await saveSplit();
  if (action === "budget") {modal="budget";render();bindModalEvents();}
  if (action === "merchant-rules") {modal="rules";render();bindModalEvents();}
  if (action === "tax-export") exportTaxCsv();
  if (action === "tax-add") {modal="receipt";render();bindModalEvents();}
  if (action === "balance-update") {modal="balance";render();bindModalEvents();}
  if (action === "debt-tip") showToast("Pay minimums first, preserve an emergency buffer, then compare extra payments by interest rate.");
  if (action === "plaid-connect") await checkPlaid();
  if (action === "plaid-sync") await syncPlaid();
  if (action === "toggle-muted") {
    const joint = state.accounts.find((account)=>account.owner==="Joint"&&account.kind==="cash");
    if(joint){const previous=joint.muted;joint.muted=!joint.muted;if(!await persist()){joint.muted=previous;return;}showToast(joint.muted?"Joint account feed marked muted.":"Joint account feed re-enabled.");render();}
  }
}
function readSplitLines() {
  const categories=[...app.querySelectorAll(".split-category")].map((input)=>input.value);
  const amounts=[...app.querySelectorAll(".split-amount")].map((input)=>Number(input.value));
  return categories.map((category,index)=>({category,amount:amounts[index]}));
}
function bindModalEvents() {
  app.querySelectorAll(".modal-backdrop[data-action], .modal [data-action]").forEach((button)=>button.addEventListener("click",handleAction));
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
    const total=[...app.querySelectorAll(".split-amount")].reduce((sum,item)=>sum+Number(item.value),0);
    const tx=state.transactions.find((t)=>t.id===modal.splitId);
    app.querySelector("#splitTotal").textContent=`Split total: ${cad(total,2)} · Transaction total: ${cad(tx.amount,2)}`;
  }));
  app.querySelector("#scheduleForm")?.addEventListener("submit",async(event)=>{
    event.preventDefault();const data=new FormData(event.currentTarget);
    state.schedule.push({id:`schedule-${Date.now()}`,name:data.get("name"),type:data.get("type"),amount:Number(data.get("amount")),date:data.get("date"),cadence:data.get("cadence"),owner:data.get("owner"),status:"Expected"});
    if(!await persist())return;modal="";render();showToast("Recurring item added to your forecast.");
  });
  app.querySelector("#budgetForm")?.addEventListener("submit",(event)=>{
    event.preventDefault();const values=[...app.querySelectorAll(".budget-input")].map((input)=>Number(input.value));
    if(values.reduce((sum,value)=>sum+value,0)!==100){showToast("Budget targets must add up to exactly 100%.");return;}
    state.budget.forEach((item,index)=>item.target=values[index]);persist().then((saved)=>{if(!saved)return;modal="";render();showToast("Household budget targets updated.");});
  });
  app.querySelectorAll(".budget-input").forEach((input)=>input.addEventListener("input",()=>{
    const total=[...app.querySelectorAll(".budget-input")].reduce((sum,item)=>sum+Number(item.value),0);
    app.querySelector("#budgetTotal").textContent=`Total: ${total}%${total===100?" ✓":" · targets must add up to 100%"}`;
  }));
  app.querySelector("#receiptForm")?.addEventListener("submit",(event)=>{
    event.preventDefault();const data=new FormData(event.currentTarget);
    state.taxDeductions.unshift({id:`tax-${Date.now()}`,merchant:data.get("merchant"),category:data.get("category"),amount:Number(data.get("amount")),date:data.get("date"),owner:data.get("owner"),tag:data.get("tag")||"Receipt"});
    persist().then((saved)=>{if(!saved)return;modal="";render();showToast("Receipt added to your tax vault.");});
  });
  app.querySelector("#balanceForm")?.addEventListener("submit",(event)=>{
    event.preventDefault();const data=new FormData(event.currentTarget);const account=state.accounts.find((item)=>item.id===data.get("id"));
    account.balance=Number(data.get("balance"));account.acb=Number(data.get("acb"));persist().then((saved)=>{if(!saved)return;modal="";render();showToast(`${account.name} updated.`);});
  });
}
async function importCsv() {
  const file=window.selectedCsv;
  if(!file){showToast("Choose a CSV statement to import.");return;}
  const csv=await file.text();
  const account={owner:app.querySelector("#csvOwner").value,name:app.querySelector("#csvAccount").value,last4:app.querySelector("#csvLast4").value,kind:app.querySelector("#csvKind").value};
  const response=await fetch("/api/transactions/import",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({csv,account})});
  const result=await response.json();
  if(!response.ok){showToast(result.error);return;}
  state=result.state;modal="";render();showToast(`${result.imported} transaction(s) imported · ${result.duplicates} duplicate(s) skipped.`);
}
async function saveSplit() {
  const lines=readSplitLines();
  const transaction=state.transactions.find((item)=>item.id===modal.splitId);
  if(Math.abs(lines.reduce((sum,line)=>sum+line.amount,0)-transaction.amount)>.01){showToast("Split amounts must equal the transaction total.");return;}
  const response=await fetch(`/api/transactions/${encodeURIComponent(transaction.id)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({splits:lines,category:lines[0].category})});
  const result=await response.json();
  if(!response.ok){showToast(result.error);return;}
  state=result.state;
  if(app.querySelector("#saveRule").checked){
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
      accounts:state.accounts
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
async function sendQuestion(event) {
  event.preventDefault();const input=event.currentTarget.elements.question;const question=input.value.trim();if(!question)return;
  chatHistory.push({role:"user",text:question});chatHistory.push({role:"assistant",text:"Checking your verified household ledger…"});input.value="";render();
  const response=await fetch("/api/ask",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question})});const result=await response.json();
  chatHistory[chatHistory.length-1].text=response.ok?result.answer:result.error;render();
  const messages=app.querySelector("#chatMessages");messages.scrollTop=messages.scrollHeight;
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
