import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createRequire } from "node:module";
import { neon } from "@neondatabase/serverless";
import seedState from "../data/household.json" with { type: "json" };

const require = createRequire(import.meta.url);
const HouseholdMath = require("../public/household-math.js");
const ReceiptValidation = require("./receipt-validation.cjs");
const MAX_BODY_BYTES = 5_000_000;
const COOKIE_NAME = "accountant_session";
let sql;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function moneyCents(value) {
  return HouseholdMath.toCents(value);
}

function normalizeMoneyState(state) {
  const addCents = (record, key) => {
    if (record[key] !== undefined && record[key] !== null) {
      record[key] = moneyCents(record[key]) / 100;
      record[`${key}Cents`] = moneyCents(record[key]);
    }
  };
  (state.accounts || []).forEach((account) => {
    if (account.id === "visa-j" && account.name === "Visa Rewards" &&
        account.minimumPayment == null && account.monthlyPayment == null) {
      account.minimumPayment = 35;
    }
    ["balance", "startingBalance", "minimumPayment", "monthlyPayment", "limit", "acb"].forEach((key) => addCents(account, key));
    if (account.apr !== undefined && account.apr !== null) account.apr = HouseholdMath.fixedDecimal(String(account.apr), 2);
    if (account.allocation) {
      for (const key of Object.keys(account.allocation)) account.allocation[key] = HouseholdMath.fixedDecimal(String(account.allocation[key]), 2);
    }
  });
  (state.transactions || []).forEach((transaction) => {
    addCents(transaction, "amount");
    (transaction.splits || []).forEach((split) => addCents(split, "amount"));
  });
  (state.schedule || []).forEach((item) => {
    addCents(item, "amount");
    addCents(item, "grossAmount");
  });
  (state.taxDeductions || []).forEach((item) => addCents(item, "amount"));
  (state.groceryReceipts || []).forEach((receipt) => {
    addCents(receipt, "tax");
    (receipt.items || []).forEach((item) => addCents(item, "amount"));
  });
  (state.history || []).forEach((item) => addCents(item, "netWorth"));
  (state.budget || []).forEach((item) => { item.target = HouseholdMath.fixedDecimal(String(item.target), 2); });
  addCents(state, "debtPlanExtraMonthly");
  return state;
}

function publicState(state) {
  return {
    ...state,
    groceryReceipts: (state.groceryReceipts || []).map(ReceiptValidation.safeReceipt)
  };
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
  if (rows.length) {
    const state = normalizeMoneyState(JSON.parse(JSON.stringify(rows[0].state)));
    if (JSON.stringify(state) !== JSON.stringify(rows[0].state)) {
      const migrated = await query`
        UPDATE household_state
        SET state = ${JSON.stringify(state)}::jsonb,
            version = ${Number(rows[0].version) + 1},
            updated_at = now()
        WHERE id = 'household' AND version = ${Number(rows[0].version)}
        RETURNING state, version
      `;
      if (migrated.length) return { ...migrated[0], id: rows[0].id, state: normalizeMoneyState(migrated[0].state) };
      const latest = await query`SELECT id, state, version FROM household_state WHERE id = 'household' LIMIT 1`;
      if (!latest.length) throw new HttpError(503, "The household database row is not available.");
      return { ...latest[0], state: normalizeMoneyState(latest[0].state) };
    }
    return { ...rows[0], state };
  }

  const state = normalizeMoneyState(JSON.parse(JSON.stringify(seedState)));
  await query`
    INSERT INTO household_state (id, state, version)
    VALUES ('household', ${JSON.stringify(state)}::jsonb, 0)
    ON CONFLICT (id) DO NOTHING
  `;

  const seededRows = await query`SELECT id, state, version FROM household_state WHERE id = 'household' LIMIT 1`;
  if (!seededRows.length) throw new HttpError(503, "The household database table is not ready.");
  return { ...seededRows[0], state: normalizeMoneyState(seededRows[0].state) };
}

async function mutateState(mutator) {
  const query = databaseClient();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const row = await loadRow();
    const state = JSON.parse(JSON.stringify(row.state));
    const value = await mutator(state);
    normalizeMoneyState(state);
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
  if (route === "plaid/status" && request.method === "GET") {
    return json({ configured: false, unavailable: true });
  }

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
    return json({ state: publicState(row.state), user });
  }
  if (route.startsWith("receipts/") && route.endsWith("/file") && request.method === "GET") {
    const id = decodeURIComponent(route.slice("receipts/".length, -"/file".length));
    const row = await loadRow();
    const receipt = (row.state.groceryReceipts || []).find((item) => item.id === id);
    if (!receipt?.attachmentDataBase64) throw new HttpError(404, "Receipt file not found.");
    const bytes = Buffer.from(receipt.attachmentDataBase64, "base64");
    const safeName = String(receipt.attachmentName || "receipt").replace(/[\r\n"]/g, "_");
    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": receipt.attachmentType || "application/octet-stream",
        "Content-Length": String(bytes.length),
        "Content-Disposition": `inline; filename="${safeName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });
  }
  if (route === "receipts" && request.method === "POST") {
    const { state, value } = await mutateWithBody(request, (current, input) => {
      const validated = ReceiptValidation.validateReceiptInput(input);
      const account = current.accounts.find((item) => item.id === validated.accountId && item.owner === validated.owner);
      if (!account || !["cash", "liability"].includes(account.kind)) {
        throw new HttpError(400, "Choose an existing chequing, savings, or credit-card account.");
      }
      if (account.kind === "cash" && moneyCents(account.balance) < validated.receiptTotalCents) {
        throw new HttpError(400, "The selected cash account balance is below this expense. Update its balance or choose another payment account.");
      }
      const id = randomBytes(16).toString("hex");
      const transactionId = randomBytes(16).toString("hex");
      const categories = [...new Set(validated.items.map((item) => item.category))];
      current.transactions.unshift({
        id: transactionId,
        date: validated.date,
        merchant: validated.merchant,
        amount: validated.receiptTotalCents / 100,
        amountCents: validated.receiptTotalCents,
        category: categories.length === 1 ? categories[0] : "Split purchase",
        splits: validated.items.map((item) => ({
          category: item.category,
          amount: item.lineTotalCents / 100,
          amountCents: item.lineTotalCents
        })),
        type: "expense",
        owner: account.owner,
        account: account.name,
        accountId: account.id,
        last4: account.last4 || "",
        status: "Actual",
        note: "Receipt expense",
        source: "receipt",
        receiptId: id
      });
      account.balance = (moneyCents(account.balance) +
        (account.kind === "liability" ? validated.receiptTotalCents : -validated.receiptTotalCents)) / 100;
      const receipt = {
        id,
        merchant: validated.merchant,
        date: validated.date,
        owner: account.owner,
        accountId: account.id,
        receiptTotalCents: validated.receiptTotalCents,
        expenseTotalCents: validated.receiptTotalCents,
        expenseTransactionId: transactionId,
        matchedTransactionId: null,
        matchStatus: "pending",
        items: validated.items,
        ...(validated.attachment ? {
          attachmentType: validated.attachment.type,
          attachmentName: validated.attachment.name,
          attachmentBytes: validated.attachment.byteLength,
          attachmentDataBase64: validated.attachment.dataBase64
        } : {})
      };
      current.groceryReceipts ||= [];
      current.groceryReceipts.unshift(receipt);
      return receipt;
    });
    return json({ receipt: ReceiptValidation.safeReceipt(value) }, 201);
  }
  if (route.startsWith("receipts/") && request.method === "PATCH") {
    const id = decodeURIComponent(route.slice("receipts/".length));
    const { value } = await mutateWithBody(request, (current, update) => {
      const receipt = (current.groceryReceipts || []).find((item) => item.id === id);
      const transaction = current.transactions.find((item) => item.id === update.transactionId);
      if (!receipt || typeof update.transactionId !== "string") {
        throw new HttpError(400, "Choose a saved receipt and a bank transaction.");
      }
      if (update.reject === true) {
        if (!transaction) throw new HttpError(404, "Bank transaction not found.");
        ReceiptValidation.rejectReceiptSuggestion(receipt, transaction);
        return receipt;
      }
      if (update.confirm !== true) {
        throw new HttpError(400, "Confirm or reject the suggested bank transaction. Nothing is linked automatically.");
      }
      return ReceiptValidation.applyReceiptLink(receipt, transaction, current.transactions);
    });
    return json({ receipt: ReceiptValidation.safeReceipt(value) });
  }
  if (route.startsWith("receipts/") && request.method === "DELETE") {
    const id = decodeURIComponent(route.slice("receipts/".length));
    const { value } = await mutateState((current) => {
      const index = (current.groceryReceipts || []).findIndex((item) => item.id === id);
      if (index < 0) throw new HttpError(404, "Receipt expense not found.");
      const receipt = current.groceryReceipts[index];
      const original = current.transactions.find((item) => item.id === receipt.expenseTransactionId);
      if (original?.status === "Actual" && original.source === "receipt") {
        const account = current.accounts.find((item) => item.id === receipt.accountId);
        if (account?.kind === "cash") account.balance = (moneyCents(account.balance) + moneyCents(original.amount)) / 100;
        if (account?.kind === "liability") {
          if (moneyCents(account.balance) < moneyCents(original.amount)) {
            throw new HttpError(409, "This credit-card balance has changed since the expense. Review the balance before removing it.");
          }
          account.balance = (moneyCents(account.balance) - moneyCents(original.amount)) / 100;
        }
      }
      current.transactions = current.transactions.filter((item) => item.id !== receipt.expenseTransactionId);
      const linked = current.transactions.find((item) => item.id === receipt.matchedTransactionId);
      if (linked?.receiptId === id) {
        delete linked.receiptId;
        delete linked.matchStatus;
        delete linked.receiptMatchRole;
      }
      current.groceryReceipts.splice(index, 1);
      return true;
    });
    return json({ ok: value });
  }
  if (route === "state" && request.method === "PUT") {
    const { state } = await mutateWithBody(request, (current, update) => {
      if (Array.isArray(update.budget)) {
        const targets = update.budget.map((item) => HouseholdMath.toCents(item.target));
        if (targets.some((value) => !Number.isSafeInteger(value) || value < 0 || value > 10000) || targets.reduce((a, b) => a + b, 0) !== 10000) {
          throw new HttpError(400, "Budget targets must be between 0 and 100 and add up to 100%.");
        }
        current.budget = update.budget.map((item, index) => ({ ...current.budget[index], target: HouseholdMath.fixedDecimal(String(item.target), 2) }));
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
        if (update.accounts.some((account) => account.accountType === "Credit card" &&
          (account.minimumPayment === undefined || account.minimumPayment === null || account.minimumPayment === ""))) {
          throw new HttpError(400, "Credit card accounts require a minimum monthly payment.");
        }
        const validAccounts = new Set(update.accounts.map((account) => account.id));
        if (update.accounts.length > 500 || update.accounts.some((account) =>
          !account.id || !String(account.name || "").trim() ||
          !["cash", "investment", "liability"].includes(account.kind) ||
          !["Partner A", "Partner B", "Joint"].includes(account.owner) ||
          !Number.isFinite(Number(account.balance)) || Number(account.balance) < 0 ||
          (account.kind === "liability" &&
            (account.apr !== undefined && account.apr !== null && !HouseholdMath.isNonNegativeDecimal(account.apr, 2) ||
              [account.minimumPayment, account.limit, account.startingBalance].some((value) => value !== undefined && (!Number.isFinite(Number(value)) || Number(value) < 0)))) ||
          (account.kind === "investment" && [account.acb].some((value) => value !== undefined && (!Number.isFinite(Number(value)) || Number(value) < 0)))
        ) || validAccounts.size !== update.accounts.length) {
          throw new HttpError(400, "Accounts need a unique ID, name, valid owner and type, and non-negative numeric balances.");
        }
        current.accounts = update.accounts;
      }
      if (Array.isArray(update.transactions)) {
        if (update.transactions.length > 20_000 || update.transactions.some((transaction) =>
          !transaction.id || !normalizeDate(transaction.date) ||
          !String(transaction.merchant || "").trim() ||
          !Number.isFinite(Number(transaction.amount)) || Number(transaction.amount) <= 0 ||
          !["income", "expense", "transfer"].includes(transaction.type) ||
          !["Partner A", "Partner B", "Joint"].includes(transaction.owner)
        )) {
          throw new HttpError(400, "Ledger entries need a date, description, positive amount, type, and valid owner.");
        }
        current.transactions = update.transactions;
      }
      if (update.debtPlanExtraMonthly !== undefined) {
        const extra = Number(update.debtPlanExtraMonthly);
        if (!Number.isFinite(extra) || extra < 0) throw new HttpError(400, "The snowball extra must be a non-negative amount.");
        current.debtPlanExtraMonthly = extra;
      }
    });
    return json({ state: publicState(state) });
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
      const fingerprints = new Set(current.transactions.filter((transaction) =>
        transaction.source !== "receipt" && transaction.status !== "Superseded").map((transaction) =>
        `${transaction.date}|${Number(transaction.amount).toFixed(2)}|${transaction.last4 || ""}|${transaction.type}`));
      const fresh = imported.filter((transaction) => {
        const key = `${transaction.date}|${transaction.amount.toFixed(2)}|${last4}|${transaction.type}`;
        if (fingerprints.has(key)) return false;
        fingerprints.add(key);
        transaction.bankImported = true;
        transaction.source = "bank";
        ReceiptValidation.assignReceiptSuggestion(current.groceryReceipts, transaction);
        return true;
      });
      for (const transaction of fresh) {
        const suggestedReceipt = transaction.receiptSuggestionId
          ? (current.groceryReceipts || []).find((receipt) => receipt.id === transaction.receiptSuggestionId)
          : null;
        const rule = current.merchantRules.find((candidate) => transaction.merchant.toLowerCase().includes(candidate.merchant.toLowerCase()));
        if (rule && transaction.type === "expense") transaction.category = rule.category;
        const importedAccount = current.accounts.find((candidate) => candidate.owner === transaction.owner &&
          (candidate.name.toLowerCase() === transaction.account.toLowerCase() || candidate.last4 === transaction.last4));
        if (transaction.type === "expense" && importedAccount?.kind === "liability" && !suggestedReceipt) {
          transaction.balanceAppliedCents = moneyCents(transaction.amount);
          importedAccount.balance = (moneyCents(importedAccount.balance) + transaction.balanceAppliedCents) / 100;
        }
        if (transaction.category === "Debt repayment") {
          const description = transaction.merchant.toLowerCase();
          const debt = current.accounts.find((candidate) => candidate.kind === "liability" &&
            (description.includes(candidate.name.toLowerCase().split(" ")[0]) ||
             (candidate.accountType === "Car loan" && /car loan|auto loan/.test(description)) ||
             (candidate.accountType === "Credit card" && /visa|mastercard|credit card/.test(description))));
          if (debt) {
            debt.startingBalance ??= debt.balance;
            debt.balance = Math.max(0, moneyCents(debt.balance) - moneyCents(transaction.amount)) / 100;
          }
        }
        if (transaction.category === "Investment contribution") {
          const investment = current.accounts.find((candidate) => candidate.kind === "investment" &&
            transaction.merchant.toLowerCase().includes(candidate.accountType.toLowerCase()));
          if (investment) investment.balance = (moneyCents(investment.balance) + moneyCents(transaction.amount)) / 100;
        }
        reconcileExpected(current, transaction);
      }
      current.transactions.unshift(...fresh);
      return { imported: fresh.length, duplicates: imported.length - fresh.length };
    });
    return json({ ...value, state: publicState(state) });
  }
  if (route.startsWith("transactions/") && request.method === "PATCH") {
    const id = decodeURIComponent(route.slice("transactions/".length));
    const { state, value } = await mutateWithBody(request, (current, update) => {
      const transaction = current.transactions.find((item) => item.id === id);
      if (!transaction) throw new HttpError(404, "Transaction not found.");
      if (typeof update.category === "string") transaction.category = update.category.slice(0, 60);
      if (Array.isArray(update.itemCategories)) {
        ReceiptValidation.applyItemCategories(current, transaction, update.itemCategories);
      } else if (Array.isArray(update.splits)) {
        if ((current.groceryReceipts || []).some((receipt) => receipt.expenseTransactionId === transaction.id || receipt.id === transaction.receiptId)) {
          throw new HttpError(400, "This expense has line items. Change each item's category instead of splitting the whole total.");
        }
        const splits = update.splits.map((split) => ({ category: String(split.category).slice(0, 60), amount: Number(split.amount) }));
        if (splits.some((split) => !Number.isFinite(split.amount) || split.amount < 0) ||
            splits.reduce((sum, split) => sum + moneyCents(split.amount), 0) !== moneyCents(transaction.amount)) {
          throw new HttpError(400, "Split amounts must add up to the transaction total.");
        }
        transaction.splits = splits;
      }
    });
    return json({ state: publicState(state), ...value });
  }
  if (route.startsWith("transactions/") && request.method === "DELETE") {
    const id = decodeURIComponent(route.slice("transactions/".length));
    const { state } = await mutateState((current) => {
      const transaction = current.transactions.find((item) => item.id === id);
      if (!transaction) throw new HttpError(404, "Transaction not found.");
      if (transaction.note !== "CSV import" && transaction.manual !== true) {
        throw new HttpError(400, "Only an imported statement row or a hand-entered ledger row can be removed here.");
      }
      if (transaction.source === "receipt") {
        throw new HttpError(400, "Remove a receipt expense from its proof record so its line items are removed too.");
      }
      if (Number.isSafeInteger(transaction.balanceAppliedCents) && transaction.balanceAppliedCents !== 0) {
        const account = current.accounts.find((item) => item.owner === transaction.owner &&
          (item.name === transaction.account || item.last4 === transaction.last4));
        if (account) account.balance = (moneyCents(account.balance) - transaction.balanceAppliedCents) / 100;
      }
      const linkedReceipt = (current.groceryReceipts || []).find((receipt) => receipt.matchedTransactionId === id);
      if (linkedReceipt) {
        linkedReceipt.matchedTransactionId = null;
        linkedReceipt.matchStatus = "pending";
        linkedReceipt.bankAmountCents = null;
        linkedReceipt.differenceCents = 0;
        linkedReceipt.differences = [];
      }
      current.transactions = current.transactions.filter((item) => item.id !== id);
    });
    return json({ ok: true, state: publicState(state) });
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
