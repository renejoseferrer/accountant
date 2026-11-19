import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import seedState from "../data/household.json" with { type: "json" };

const MAX_BODY_BYTES = 5_000_000;
const COOKIE_NAME = "accountant_session";
let sql;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers
    }
  });
}

async function requestBody(request) {
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    throw new HttpError(413, "Request is too large.");
  }
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError(400, "Invalid JSON request.");
  }
}

function databaseClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new HttpError(503, "Configure DATABASE_URL with your Neon pooled connection string in the Vercel project settings.");
  }
  if (!sql) sql = neon(connectionString);
  return sql;
}

async function loadRow() {
  const query = databaseClient();
  const rows = await query`SELECT id, state, version FROM household_state WHERE id = 'household' LIMIT 1`;
  if (rows.length) return rows[0];

  const state = JSON.parse(JSON.stringify(seedState));
  await query`
    INSERT INTO household_state (id, state, version)
    VALUES ('household', ${JSON.stringify(state)}::jsonb, 0)
    ON CONFLICT (id) DO NOTHING
  `;

  const seededRows = await query`SELECT id, state, version FROM household_state WHERE id = 'household' LIMIT 1`;
  if (!seededRows.length) throw new HttpError(503, "The household database table is not ready.");
  return seededRows[0];
}

async function mutateState(mutator) {
  const query = databaseClient();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const row = await loadRow();
    const state = JSON.parse(JSON.stringify(row.state));
    const value = await mutator(state);
    const updated = await query`
      UPDATE household_state
      SET state = ${JSON.stringify(state)}::jsonb,
          version = ${Number(row.version) + 1},
          updated_at = now()
      WHERE id = 'household' AND version = ${Number(row.version)}
      RETURNING state, version
    `;
    if (updated.length) return { state: updated[0].state, value };
  }
  throw new HttpError(409, "The household changed at the same time. Please retry your update.");
}

function cookieFromRequest(request) {
  const cookie = request.headers.get("cookie") || "";
  const part = cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${COOKIE_NAME}=`));
  return part ? part.slice(COOKIE_NAME.length + 1) : "";
}

function createSession(user) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new HttpError(503, "Configure SESSION_SECRET in the Vercel project settings.");
  const payload = Buffer.from(JSON.stringify({ user, exp: Math.floor(Date.now() / 1000) + 43_200 })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function currentUser(request) {
  const secret = process.env.SESSION_SECRET;
  const token = cookieFromRequest(request);
  if (!secret || !token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", secret).update(payload).digest();
  let supplied;
  try { supplied = Buffer.from(signature, "base64url"); } catch { return null; }
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return session.exp > Math.floor(Date.now() / 1000) && ["Partner A", "Partner B"].includes(session.user) ? session.user : null;
  } catch {
    return null;
  }
}

function sessionCookie(value, maxAge) {
  return `${COOKIE_NAME}=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

function normalizeDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function csvRows(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') { field += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(field.trim()); field = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function categorize(description, mcc = "") {
  const code = String(mcc);
  if (code === "5411") return "Groceries";
  if (["5812", "5814"].includes(code)) return "Dining";
  if (code === "4900") return "Housing & Utilities";
  if (["5541", "5542", "4111", "4121"].includes(code)) return "Transit & Fuel";
  if (code === "4899") return "Subscriptions";
  if (["8011", "8021", "8031", "8041", "8062", "5912"].includes(code)) return "Medical";
  const text = description.toLowerCase();
  if (/grocery|market|costco|walmart|superstore|loblaw/.test(text)) return "Groceries";
  if (/restaurant|cafe|coffee|uber eats|skip|dining/.test(text)) return "Dining";
  if (/hydro|electric|water|internet|rent|mortgage|utility/.test(text)) return "Housing & Utilities";
  if (/shell|esso|petro|transit|uber|gas/.test(text)) return "Transit & Fuel";
  if (/netflix|spotify|subscription|apple.com/.test(text)) return "Subscriptions";
  if (/pharmacy|medical|clinic|dentist/.test(text)) return "Medical";
  if (/daycare|childcare/.test(text)) return "Childcare";
  return "Shopping";
}

function parseImport(text, account) {
  const rows = csvRows(text);
  if (rows.length < 2) throw new HttpError(400, "The CSV needs a header row and at least one transaction.");
  const headers = rows[0].map((header) => header.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const find = (options) => headers.findIndex((header) => options.includes(header));
  const dateIndex = find(["date", "transactiondate", "posteddate", "transaction"]);
  const nameIndex = find(["description", "merchant", "name", "details", "payee"]);
  const mccIndex = find(["mcc", "merchantcategorycode", "merchantcategory"]);
  const amountIndex = find(["amount", "transactionamount"]);
  const debitIndex = find(["debit", "withdrawal", "withdrawals"]);
  const creditIndex = find(["credit", "deposit", "deposits"]);
  if (dateIndex < 0 || nameIndex < 0 || (amountIndex < 0 && debitIndex < 0 && creditIndex < 0)) {
    throw new HttpError(400, "Could not find Date, Description/Merchant, and Amount columns.");
  }

  const seen = new Set();
  const imported = [];
  for (const row of rows.slice(1)) {
    const date = normalizeDate(row[dateIndex]);
    const merchant = (row[nameIndex] || "").trim();
    const parseAmount = (value) => Number(String(value || "").replace(/[$,\s]/g, "").replace(/^\((.*)\)$/, "-$1")) || 0;
    const amount = debitIndex >= 0 || creditIndex >= 0
      ? parseAmount(row[creditIndex]) - parseAmount(row[debitIndex])
      : parseAmount(row[amountIndex]);
    if (!date || !merchant || !Number.isFinite(amount) || amount === 0) continue;

    const lower = merchant.toLowerCase();
    const routed = /e[- ]?transfer|transfer between|internal transfer/.test(lower)
      ? { type: "transfer", category: "Internal transfer" }
      : /visa payment|card payment|credit card payment|loan payment|payment to (?:visa|mastercard|loan)/.test(lower)
        ? { type: "transfer", category: "Debt repayment" }
        : /tfsa contribution|rrsp contribution|fhsa contribution|brokerage|questrade|wealthsimple|investment contribution/.test(lower)
          ? { type: "transfer", category: "Investment contribution" }
          : /savings contribution|savings transfer|emergency fund|high interest savings|hisa/.test(lower)
            ? { type: "transfer", category: "General savings" }
            : null;
    const type = routed?.type || ((account.kind === "liability" ? amount > 0 : amount < 0) ? "expense" : "income");
    const value = Math.abs(amount);
    const fingerprint = `${date}|${value.toFixed(2)}|${account.last4 || ""}|${type}`;
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    imported.push({
      id: randomBytes(16).toString("hex"),
      date,
      merchant,
      amount: value,
      category: routed?.category || (type === "expense" ? categorize(merchant, mccIndex < 0 ? "" : row[mccIndex]) : "Salary"),
      owner: account.owner || "Joint",
      account: account.name || "Imported account",
      type,
      status: "Actual",
      note: "CSV import",
      last4: account.last4 || "",
      mcc: mccIndex < 0 ? "" : row[mccIndex]
    });
  }
  return imported;
}

function reconcileExpected(state, transaction) {
  if (transaction.type !== "income" && transaction.type !== "expense" && transaction.category !== "Debt repayment") return;
  const type = transaction.type === "income" ? "income" : "bill";
  const match = state.schedule
    .filter((scheduled) => scheduled.status === "Expected" && scheduled.type === type)
    .map((scheduled) => ({
      scheduled,
      days: Math.abs((new Date(`${scheduled.date}T12:00:00`) - new Date(`${transaction.date}T12:00:00`)) / 86_400_000),
      difference: Math.abs(transaction.amount - scheduled.amount) / scheduled.amount
    }))
    .filter((candidate) => candidate.days <= 3 && candidate.difference <= 0.15)
    .sort((a, b) => a.days - b.days || a.difference - b.difference)[0];
  if (match) {
    match.scheduled.status = "Actual / Cleared";
    match.scheduled.amount = transaction.amount;
    match.scheduled.date = transaction.date;
  }
}

function cad(value) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(value);
}

function answerQuestion(state, question) {
  const assets = state.accounts.filter((account) => account.kind !== "liability").reduce((sum, account) => sum + account.balance, 0);
  const debt = state.accounts.filter((account) => account.kind === "liability").reduce((sum, account) => sum + account.balance, 0);
  const actual = state.transactions.filter((transaction) => transaction.status === "Actual");
  const income = actual.filter((transaction) => transaction.type === "income").reduce((sum, transaction) => sum + transaction.amount, 0);
  const expenses = actual.filter((transaction) => transaction.type === "expense").reduce((sum, transaction) => sum + transaction.amount, 0);
  const savings = income ? Math.max(0, (income - expenses) / income) : 0;
  const query = question.toLowerCase();
  if (/debt|pay.?off|loan/.test(query)) {
    const highestRate = state.accounts.filter((account) => account.kind === "liability").sort((a, b) => b.apr - a.apr)[0];
    return `Your tracked liabilities total ${cad(debt)}. ${highestRate ? `${highestRate.name} has the highest listed rate at ${highestRate.apr}%, so extra payments there generally reduce interest fastest—while keeping a cash buffer for near-term bills.` : "Add a debt account with its interest rate to compare payoff options."}`;
  }
  if (/spend|expense|cash flow|cashflow/.test(query)) {
    return `Your recorded actuals show ${cad(income)} in income and ${cad(expenses)} in categorized expenses. Internal transfers and debt repayments are excluded from expenses, so this view reflects purchases rather than moving money between your own accounts.`;
  }
  if (/save|savings|invest/.test(query)) {
    return `Based on the currently recorded actuals, your savings rate is ${(savings * 100).toFixed(1)}%. This estimate is income less categorized expenses divided by income; investments and debt payments are tracked separately and should be considered when you set your monthly targets.`;
  }
  return `Your household currently tracks ${cad(assets)} in assets, ${cad(debt)} in liabilities, and ${cad(assets - debt)} in net worth. I use only verified records in the household ledger. Ask about cash flow, spending, savings, or debt trade-offs for a more specific summary.`;
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

async function mutateWithBody(request, mutator) {
  const input = await requestBody(request);
  return mutateState((state) => mutator(state, input));
}

async function routeApi(request, route, user) {
  if (route === "health" && request.method === "GET") return json({ status: "ok" });

  if (route === "session" && request.method === "GET") {
    return json({ user: currentUser(request) });
  }
  if (route === "login" && request.method === "POST") {
    const { partner, passcode } = await requestBody(request);
    if (!process.env.DEMO_PASSCODE || !process.env.SESSION_SECRET) {
      throw new HttpError(503, "Configure DEMO_PASSCODE and SESSION_SECRET in the Vercel project settings.");
    }
    if (!["Partner A", "Partner B"].includes(partner) || !safeEqual(passcode || "", process.env.DEMO_PASSCODE)) {
      throw new HttpError(401, "Choose a partner and enter the workspace passcode.");
    }
    const token = createSession(partner);
    return json({ user: partner }, 200, { "Set-Cookie": sessionCookie(token, 43_200) });
  }
  if (route === "logout" && request.method === "POST") {
    return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("", 0) });
  }
  if (route.startsWith("plaid/")) {
    throw new HttpError(503, "Plaid token storage is not configured for this Vercel demo. Use the Canadian CSV importer.");
  }
  if (!user) throw new HttpError(401, "Please sign in to your household workspace.");

  if (route === "state" && request.method === "GET") {
    const row = await loadRow();
    return json({ state: row.state, user });
  }
  if (route === "state" && request.method === "PUT") {
    const { state } = await mutateWithBody(request, (current, update) => {
      if (Array.isArray(update.budget)) {
        const targets = update.budget.map((item) => Number(item.target));
        if (targets.some((value) => !Number.isFinite(value) || value < 0 || value > 100) || targets.reduce((a, b) => a + b, 0) !== 100) {
          throw new HttpError(400, "Budget targets must be between 0 and 100 and add up to 100%.");
        }
        current.budget = update.budget.map((item, index) => ({ ...current.budget[index], target: targets[index] }));
      }
      if (Array.isArray(update.schedule)) {
        if (update.schedule.length > 300 || update.schedule.some((item) => !Number.isFinite(Number(item.amount)) || Number(item.amount) <= 0 || !normalizeDate(item.date))) {
          throw new HttpError(400, "A schedule entry needs a valid date and positive amount.");
        }
        current.schedule = update.schedule;
      }
      if (Array.isArray(update.merchantRules)) current.merchantRules = update.merchantRules.slice(0, 1000);
      if (Array.isArray(update.taxDeductions)) current.taxDeductions = update.taxDeductions.slice(0, 5000);
      if (Array.isArray(update.accounts)) {
        for (const changed of update.accounts) {
          const account = current.accounts.find((item) => item.id === changed.id);
          if (account && typeof changed.muted === "boolean") account.muted = changed.muted;
          if (account?.kind === "investment") {
            const balance = Number(changed.balance);
            const acb = Number(changed.acb);
            if (!Number.isFinite(balance) || balance < 0 || !Number.isFinite(acb) || acb < 0) {
              throw new HttpError(400, "Investment balances and ACB must be non-negative numbers.");
            }
            account.balance = balance;
            account.acb = acb;
          }
        }
      }
    });
    return json({ state });
  }
  if (route === "transactions/import" && request.method === "POST") {
    const { state, value } = await mutateWithBody(request, (current, input) => {
      const account = input.account || {};
      const imported = parseImport(String(input.csv || ""), account);
      const owner = account.owner || "Joint";
      const name = account.name || "Imported account";
      const last4 = account.last4 || "";
      let linked = current.accounts.find((item) => item.owner === owner &&
        (item.name.toLowerCase() === name.toLowerCase() || (last4 && item.last4 === last4)));
      if (!linked) {
        linked = {
          id: randomBytes(16).toString("hex"),
          name,
          institution: "CSV import",
          kind: account.kind === "liability" ? "liability" : "cash",
          bucket: account.kind === "liability" ? undefined : "Liquid",
          accountType: account.kind === "liability" ? "Credit card" : "Chequing",
          owner,
          balance: 0,
          last4
        };
        current.accounts.push(linked);
      }
      const fingerprints = new Set(current.transactions.map((transaction) =>
        `${transaction.date}|${Number(transaction.amount).toFixed(2)}|${transaction.last4 || ""}|${transaction.type}`));
      const fresh = imported.filter((transaction) => {
        const key = `${transaction.date}|${transaction.amount.toFixed(2)}|${last4}|${transaction.type}`;
        if (fingerprints.has(key)) return false;
        fingerprints.add(key);
        return true;
      });
      for (const transaction of fresh) {
        const rule = current.merchantRules.find((candidate) => transaction.merchant.toLowerCase().includes(candidate.merchant.toLowerCase()));
        if (rule && transaction.type === "expense") transaction.category = rule.category;
        const importedAccount = current.accounts.find((candidate) => candidate.owner === transaction.owner &&
          (candidate.name.toLowerCase() === transaction.account.toLowerCase() || candidate.last4 === transaction.last4));
        if (transaction.type === "expense" && importedAccount?.kind === "liability") importedAccount.balance += transaction.amount;
        if (transaction.category === "Debt repayment") {
          const description = transaction.merchant.toLowerCase();
          const debt = current.accounts.find((candidate) => candidate.kind === "liability" &&
            (description.includes(candidate.name.toLowerCase().split(" ")[0]) ||
             (candidate.accountType === "Car loan" && /car loan|auto loan/.test(description)) ||
             (candidate.accountType === "Credit card" && /visa|mastercard|credit card/.test(description))));
          if (debt) debt.balance = Math.max(0, debt.balance - transaction.amount);
        }
        if (transaction.category === "Investment contribution") {
          const investment = current.accounts.find((candidate) => candidate.kind === "investment" &&
            transaction.merchant.toLowerCase().includes(candidate.accountType.toLowerCase()));
          if (investment) investment.balance += transaction.amount;
        }
        reconcileExpected(current, transaction);
      }
      current.transactions.unshift(...fresh);
      return { imported: fresh.length, duplicates: imported.length - fresh.length };
    });
    return json({ ...value, state });
  }
  if (route.startsWith("transactions/") && request.method === "PATCH") {
    const id = decodeURIComponent(route.slice("transactions/".length));
    const { state, value } = await mutateWithBody(request, (current, update) => {
      const transaction = current.transactions.find((item) => item.id === id);
      if (!transaction) throw new HttpError(404, "Transaction not found.");
      if (typeof update.category === "string") transaction.category = update.category.slice(0, 60);
      if (Array.isArray(update.splits)) {
        const splits = update.splits.map((split) => ({ category: String(split.category).slice(0, 60), amount: Number(split.amount) }));
        if (splits.some((split) => !Number.isFinite(split.amount) || split.amount < 0) ||
            Math.abs(splits.reduce((sum, split) => sum + split.amount, 0) - transaction.amount) > 0.01) {
          throw new HttpError(400, "Split amounts must add up to the transaction total.");
        }
        transaction.splits = splits;
      }
    });
    return json({ state, ...value });
  }
  if (route === "ask" && request.method === "POST") {
    const { question } = await requestBody(request);
    return json({ answer: answerQuestion((await loadRow()).state, String(question || "").slice(0, 1000)) });
  }

  throw new HttpError(404, "API route not found.");
}

export async function handleApi(request) {
  const url = new URL(request.url);
  const route = (url.searchParams.get("route") || "").replace(/^\/+/, "");
  try {
    return await routeApi(request, route, currentUser(request));
  } catch (error) {
    const status = Number(error.status) || 500;
    if (status >= 500) console.error("Vercel API request failed:", error);
    return json({ error: error.message || "The request could not be completed." }, status);
  }
}
