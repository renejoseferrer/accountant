const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const HouseholdMath = require("./public/household-math.js");
const ReceiptValidation = require("./lib/receipt-validation.cjs");
const Classification = require("./lib/classification.cjs");

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const SEED_FILE = path.join(ROOT, "data", "household.json");
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, ".local-data");
const DATA_FILE = path.join(DATA_DIR, "household.json");
const PORT = Number(process.env.PORT || 3000);
const sessions = new Map();
const plaidItems = new Map();
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png"
};

function ensureDataFile() {
  if (fs.existsSync(DATA_FILE)) return;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.copyFileSync(SEED_FILE, DATA_FILE);
}

function readData() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  const before = JSON.stringify(data);
  normalizeMoneyState(data);
  if (JSON.stringify(data) !== before) fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  return data;
}

function writeData(data) {
  normalizeMoneyState(data);
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function publicState(state) {
  return {
    ...state,
    groceryReceipts: (state.groceryReceipts || []).map(ReceiptValidation.safeReceipt)
  };
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
  Classification.classifyState(state);
  return state;
}

function send(res, status, value, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "X-Content-Type-Options": "nosniff" });
  res.end(type.startsWith("application/json") ? JSON.stringify(value) : value);
}

function cookieValue(req, key) {
  const cookies = (req.headers.cookie || "").split(";").map((part) => part.trim());
  const item = cookies.find((part) => part.startsWith(`${key}=`));
  return item ? item.slice(key.length + 1) : "";
}

function currentUser(req) {
  const token = cookieValue(req, "accountant_session");
  return token ? sessions.get(token) : null;
}

function requireUser(req, res) {
  const user = currentUser(req);
  if (!user) send(res, 401, { error: "Please sign in to your household workspace." });
  return user;
}

function body(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 5_000_000) {
        reject(new Error("Request is too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error("Invalid JSON request.")); }
    });
    req.on("error", reject);
  });
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
  if (rows.length < 2) throw new Error("The CSV needs a header row and at least one transaction.");
  const headers = rows[0].map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const find = (options) => headers.findIndex((header) => options.includes(header));
  const dateIndex = find(["date", "transactiondate", "posteddate", "transaction"]);
  const nameIndex = find(["description", "merchant", "name", "details", "payee"]);
  const mccIndex = find(["mcc", "merchantcategorycode", "merchantcategory"]);
  const amountIndex = find(["amount", "transactionamount"]);
  const debitIndex = find(["debit", "withdrawal", "withdrawals"]);
  const creditIndex = find(["credit", "deposit", "deposits"]);
  if (dateIndex < 0 || nameIndex < 0 || (amountIndex < 0 && debitIndex < 0 && creditIndex < 0)) {
    throw new Error("Could not find Date, Description/Merchant, and Amount columns.");
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
    const signedAmount = Math.abs(amount);
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
    const fingerprint = `${date}|${signedAmount.toFixed(2)}|${account.last4 || ""}|${type}`;
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    imported.push({
      id: crypto.randomUUID(),
      date,
      merchant,
      amount: signedAmount,
      category: routed?.category || ((account.kind === "liability" ? amount > 0 : amount < 0) ? categorize(merchant, mccIndex < 0 ? "" : row[mccIndex]) : "Salary"),
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
      days: Math.abs((new Date(`${scheduled.date}T12:00:00`) - new Date(`${transaction.date}T12:00:00`)) / 86400000),
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

function plaidRequest(environment, endpoint, payload) {
  const host = environment === "production" ? "https://production.plaid.com" : "https://sandbox.plaid.com";
  return fetch(`${host}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, client_id: process.env.PLAID_CLIENT_ID, secret: process.env.PLAID_SECRET })
  }).then(async (response) => {
    const result = await response.json();
    if (!response.ok) throw new Error(result.error_message || "Plaid request failed.");
    return result;
  });
}

function selectedPlaidEnvironment(requested) {
  const selection = String(requested || "").toLowerCase();
  if (selection === "sandbox") return "sandbox";
  if (selection === "production" || selection === "limited production") return "production";
  return process.env.PLAID_ENV === "production" ? "production" : "sandbox";
}

async function syncPlaidItems(items) {
  const state = readData();
  const seenIds = new Set(state.transactions.map((transaction) => transaction.plaidTransactionId).filter(Boolean));
  const fingerprints = new Set(state.transactions.filter((transaction) =>
    transaction.source !== "receipt" && transaction.status !== "Superseded").map((transaction) =>
    `${transaction.date}|${Number(transaction.amount).toFixed(2)}|${transaction.last4 || ""}|${transaction.type}`));
  let imported = 0;
  for (const item of items) {
    const snapshot = await plaidRequest(item.environment, "/accounts/get", { access_token: item.accessToken });
    for (const balance of snapshot.accounts || []) {
      const linked = item.accounts.find((account) => account.plaidAccountId === balance.account_id);
      const saved = linked && state.accounts.find((account) => account.id === linked.id);
      if (saved) saved.balance = Math.abs(Number(balance.balances?.current) || 0);
    }
    let cursor = item.cursor;
    let more = true;
    while (more) {
      const page = await plaidRequest(item.environment, "/transactions/sync", {
        access_token: item.accessToken,
        ...(cursor ? { cursor } : {}),
        count: 250
      });
      for (const transaction of page.added || []) {
        if (seenIds.has(transaction.transaction_id)) continue;
        const account = item.accounts.find((entry) => entry.plaidAccountId === transaction.account_id);
        const date = normalizeDate(transaction.date || transaction.authorized_date);
        if (!account || !date || state.accounts.find((entry) => entry.id === account.id)?.muted) continue;
        const amount = Math.abs(Number(transaction.amount));
        const name = transaction.merchant_name || transaction.name || "Bank transaction";
        const primary = transaction.personal_finance_category?.primary || "";
        const detailed = transaction.personal_finance_category?.detailed || "";
        const description = `${name} ${primary} ${detailed}`.toLowerCase();
        const routed = /e[- ]?transfer|transfer between|internal transfer/.test(description)
          ? { type: "transfer", category: "Internal transfer" }
          : /credit card payment|loan payment|payment to (?:visa|mastercard|loan)|loan_payments|credit_card_payments/i.test(description)
            ? { type: "transfer", category: "Debt repayment" }
            : /tfsa contribution|rrsp contribution|fhsa contribution|investment contribution|brokerage|questrade|wealthsimple|investment/.test(description)
              ? { type: "transfer", category: "Investment contribution" }
              : /savings contribution|savings transfer|emergency fund|high interest savings|hisa/.test(description)
                ? { type: "transfer", category: "General savings" }
                : /^transfer/.test(primary.toLowerCase())
                  ? { type: "transfer", category: "Internal transfer" }
                  : null;
        const type = routed?.type || (Number(transaction.amount) > 0 ? "expense" : "income");
        const category = routed?.category || (type === "expense" ? categorize(name, transaction.mcc) : "Salary");
        const fingerprint = `${date}|${amount.toFixed(2)}|${account.last4 || ""}|${type}`;
        seenIds.add(transaction.transaction_id);
        if (fingerprints.has(fingerprint)) continue;
        fingerprints.add(fingerprint);
        const record = {
          id: crypto.randomUUID(),
          plaidTransactionId: transaction.transaction_id,
          date,
          merchant: name,
          amount,
          category,
          owner: account.owner,
          account: account.name,
          type,
          status: "Actual",
          mcc: transaction.mcc || "",
          last4: account.last4,
          note: "Bank sync"
        };
        if (type === "expense") {
          const suggestedReceipt = (state.groceryReceipts || []).find((receipt) =>
            !receipt.matchedTransactionId && ReceiptValidation.receiptCandidate(receipt, record));
          if (suggestedReceipt) {
            const original = state.transactions.find((entry) => entry.id === suggestedReceipt.expenseTransactionId);
            if (original && original.status === "Actual") {
              original.status = "Superseded";
              original.supersededByTransactionId = record.id;
            }
            record.source = "bank";
            record.bankImported = true;
            record.receiptSuggestionId = suggestedReceipt.id;
          }
        }
        state.transactions.unshift(record);
        reconcileExpected(state, record);
        imported += 1;
      }
      cursor = page.next_cursor;
      more = page.has_more;
    }
    item.cursor = cursor;
  }
  writeData(state);
  return { imported, state: publicState(state) };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  try {
    if (req.method === "GET" && url.pathname === "/health") {
      return send(res, 200, { status: "ok" });
    }
    if (req.method === "GET" && url.pathname === "/api/session") {
      return send(res, 200, { user: currentUser(req) });
    }
    if (req.method === "POST" && url.pathname === "/api/login") {
      const { partner, passcode } = await body(req);
      const expectedPasscode = process.env.DEMO_PASSCODE || "1234";
      if (process.env.NODE_ENV === "production" && !process.env.DEMO_PASSCODE) {
        return send(res, 503, { error: "The workspace owner needs to configure DEMO_PASSCODE on the server." });
      }
      if (!["Partner A", "Partner B"].includes(partner) || passcode !== expectedPasscode) {
        return send(res, 401, { error: "Choose a partner and enter the workspace passcode." });
      }
      const token = crypto.randomBytes(32).toString("hex");
      sessions.set(token, partner);
      res.setHeader("Set-Cookie", `accountant_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
      return send(res, 200, { user: partner });
    }
    if (req.method === "POST" && url.pathname === "/api/logout") {
      sessions.delete(cookieValue(req, "accountant_session"));
      res.setHeader("Set-Cookie", `accountant_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
      return send(res, 200, { ok: true });
    }
    if (url.pathname.startsWith("/api/")) {
      const user = requireUser(req, res);
      if (!user) return;
      if (req.method === "GET" && url.pathname === "/api/state") {
        return send(res, 200, { state: publicState(readData()), user });
      }
      if (req.method === "GET" && url.pathname.startsWith("/api/receipts/") && url.pathname.endsWith("/file")) {
        const id = decodeURIComponent(url.pathname.split("/").slice(-2)[0]);
        const receipt = (readData().groceryReceipts || []).find((item) => item.id === id);
        if (!receipt?.attachmentDataBase64) return send(res, 404, { error: "Receipt file not found." });
        const bytes = Buffer.from(receipt.attachmentDataBase64, "base64");
        const safeName = String(receipt.attachmentName || "receipt").replace(/[\r\n"]/g, "_");
        res.writeHead(200, {
          "Content-Type": receipt.attachmentType || "application/octet-stream",
          "Content-Length": bytes.length,
          "Content-Disposition": `inline; filename="${safeName}"`,
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private, no-store"
        });
        return res.end(bytes);
      }
      if (req.method === "POST" && url.pathname === "/api/receipts") {
        const input = ReceiptValidation.validateReceiptInput(await body(req));
        const state = readData();
        input.items = input.items.map((item) => {
          const suggestion = Classification.suggestClassification({
            merchant: input.merchant,
            itemName: item.name,
            category: item.category,
            merchantRules: state.merchantRules,
            transactions: state.transactions,
            receipts: state.groceryReceipts
          });
          const fastFood = suggestion.category === "Dining" && suggestion.classification === "Wants";
          return {
            ...item,
            category: fastFood ? "Dining" : item.category || suggestion.category,
            classification: fastFood ? "Wants" : item.classification || suggestion.classification,
            classificationConfidence: suggestion.confidence,
            classificationSource: suggestion.source,
            classificationConfirmed: item.classificationConfirmed === true
          };
        });
        const account = state.accounts.find((item) => item.id === input.accountId && item.owner === input.owner);
        if (!account || !["cash", "liability"].includes(account.kind)) {
          return send(res, 400, { error: "Choose an existing chequing, savings, or credit-card account." });
        }
        if (account.kind === "cash" && moneyCents(account.balance) < input.receiptTotalCents) {
          return send(res, 400, { error: "The selected cash account balance is below this expense. Update its balance or choose another payment account." });
        }
        const id = crypto.randomUUID();
        const transactionId = crypto.randomUUID();
        const categories = [...new Set(input.items.map((item) => item.category))];
        const transaction = {
          id: transactionId,
          date: input.date,
          merchant: input.merchant,
          amount: input.receiptTotalCents / 100,
          amountCents: input.receiptTotalCents,
          category: categories.length === 1 ? categories[0] : "Split purchase",
          splits: input.items.map((item) => ({
            name: item.name,
            category: item.category,
            classification: item.classification,
            classificationConfidence: item.classificationConfidence,
            classificationSource: item.classificationSource,
            classificationConfirmed: item.classificationConfirmed,
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
        };
        account.balance = (moneyCents(account.balance) +
          (account.kind === "liability" ? input.receiptTotalCents : -input.receiptTotalCents)) / 100;
        const receipt = {
          id,
          merchant: input.merchant,
          date: input.date,
          owner: account.owner,
          accountId: account.id,
          receiptTotalCents: input.receiptTotalCents,
          expenseTotalCents: input.receiptTotalCents,
          expenseTransactionId: transactionId,
          matchedTransactionId: null,
          matchStatus: "pending",
          items: input.items,
          ...(input.attachment ? {
            attachmentType: input.attachment.type,
            attachmentName: input.attachment.name,
            attachmentBytes: input.attachment.byteLength,
            attachmentDataBase64: input.attachment.dataBase64
          } : {})
        };
        state.groceryReceipts ||= [];
        state.groceryReceipts.unshift(receipt);
        state.transactions.unshift(transaction);
        writeData(state);
        return send(res, 201, { receipt: ReceiptValidation.safeReceipt(receipt) });
      }
      if (req.method === "PATCH" && url.pathname.startsWith("/api/receipts/")) {
        const id = decodeURIComponent(url.pathname.split("/").pop());
        const update = await body(req);
        const state = readData();
        const receipt = (state.groceryReceipts || []).find((item) => item.id === id);
        const transaction = state.transactions.find((item) => item.id === update.transactionId);
      if (!receipt || typeof update.transactionId !== "string") {
        return send(res, 400, { error: "Choose a saved receipt and a bank transaction." });
      }
      if (update.reject === true) {
        if (!transaction) return send(res, 404, { error: "Bank transaction not found." });
        ReceiptValidation.rejectReceiptSuggestion(receipt, transaction);
        writeData(state);
        return send(res, 200, { receipt: ReceiptValidation.safeReceipt(receipt), rejected: true });
        }
      if (update.confirm !== true) {
        return send(res, 400, { error: "Confirm or reject the suggested bank transaction. Nothing is linked automatically." });
        }
      ReceiptValidation.applyReceiptLink(receipt, transaction, state.transactions);
        writeData(state);
        return send(res, 200, { receipt: ReceiptValidation.safeReceipt(receipt) });
      }
      if (req.method === "DELETE" && url.pathname.startsWith("/api/receipts/")) {
        const id = decodeURIComponent(url.pathname.split("/").pop());
        const state = readData();
        const index = (state.groceryReceipts || []).findIndex((item) => item.id === id);
        if (index < 0) return send(res, 404, { error: "Receipt expense not found." });
        const receipt = state.groceryReceipts[index];
        const original = state.transactions.find((item) => item.id === receipt.expenseTransactionId);
        if (original?.status === "Actual" && original.source === "receipt") {
          const account = state.accounts.find((item) => item.id === receipt.accountId);
          if (account?.kind === "cash") account.balance = (moneyCents(account.balance) + moneyCents(original.amount)) / 100;
          if (account?.kind === "liability") {
            if (moneyCents(account.balance) < moneyCents(original.amount)) {
              return send(res, 409, { error: "This credit-card balance has changed since the expense. Review the balance before removing it." });
            }
            account.balance = (moneyCents(account.balance) - moneyCents(original.amount)) / 100;
          }
        }
        state.transactions = state.transactions.filter((item) => item.id !== receipt.expenseTransactionId);
        const linked = state.transactions.find((item) => item.id === receipt.matchedTransactionId);
        if (linked?.receiptId === id) {
          delete linked.receiptId;
          delete linked.matchStatus;
          delete linked.receiptMatchRole;
        }
        state.groceryReceipts.splice(index, 1);
        writeData(state);
        return send(res, 200, { ok: true });
      }
      if (req.method === "POST" && url.pathname === "/api/classification/bulk") {
        const update = await body(req);
        const state = readData();
        const updates = Array.isArray(update.items) ? update.items : [];
        if ((!update.category && !update.classification) || !String(update.reason || "").trim()) {
          return send(res, 400, { error: "Choose a category or mark and record a reason for the classification change." });
        }
        const grouped = new Map();
        for (const item of updates) {
          const transaction = state.transactions.find((entry) => entry.id === item.transactionId);
          if (!transaction) return send(res, 404, { error: "One of the selected expenses no longer exists." });
          if (!grouped.has(transaction.id)) grouped.set(transaction.id, { transaction, items: [] });
          grouped.get(transaction.id).items.push({
            index: Number.isSafeInteger(item.index) ? item.index : undefined,
            ...(update.category ? { category: update.category } : {}),
            ...(update.classification ? { classification: update.classification } : {}),
            confirmed: true
          });
        }
        try {
          for (const { transaction, items } of grouped.values()) {
            Classification.applyClassificationUpdates(state, transaction, items, {
              reason: update.reason,
              changedBy: user
            });
          }
        } catch (error) {
          return send(res, error.status || 400, { error: error.message });
        }
        writeData(state);
        return send(res, 200, { state: publicState(state), changed: updates.length });
      }
      if (req.method === "POST" && url.pathname === "/api/return-tasks") {
        const input = await body(req);
        const state = readData();
        const transaction = state.transactions.find((item) => item.id === input.transactionId);
        if (!transaction || transaction.type !== "expense") return send(res, 404, { error: "Choose an expense to consider returning." });
        try {
          const task = Classification.createReturnTask(state, {
            transaction,
            index: Number.isSafeInteger(input.index) ? input.index : undefined,
            returnBy: input.returnBy || null,
            changedBy: user
          });
          writeData(state);
          return send(res, 201, { task, state: publicState(state) });
        } catch (error) {
          return send(res, error.status || 400, { error: error.message });
        }
      }
      if (req.method === "PATCH" && url.pathname.startsWith("/api/return-tasks/")) {
        const id = decodeURIComponent(url.pathname.split("/").pop());
        const input = await body(req);
        const state = readData();
        const task = (state.returnTasks || []).find((item) => item.id === id);
        if (!task) return send(res, 404, { error: "Return task not found." });
        try {
          Classification.finishReturnTask(state, task, {
            status: input.status,
            reason: input.reason,
            changedBy: user
          });
          writeData(state);
          return send(res, 200, { task, state: publicState(state) });
        } catch (error) {
          return send(res, error.status || 400, { error: error.message });
        }
      }
      if (req.method === "PUT" && url.pathname === "/api/state") {
        const update = await body(req);
        const state = readData();
        if (Array.isArray(update.budget)) {
          const targets = update.budget.map((item) => HouseholdMath.toCents(item.target));
          if (targets.some((value) => !Number.isSafeInteger(value) || value < 0 || value > 10000) || targets.reduce((a, b) => a + b, 0) !== 10000) {
            return send(res, 400, { error: "Budget targets must be between 0 and 100 and add up to 100%." });
          }
          state.budget = update.budget.map((item, index) => ({ ...state.budget[index], target: HouseholdMath.fixedDecimal(String(item.target), 2) }));
        }
        if (Array.isArray(update.schedule)) {
          if (update.schedule.length > 300 || update.schedule.some((item) => !Number.isFinite(Number(item.amount)) || Number(item.amount) <= 0 || !normalizeDate(item.date))) {
            return send(res, 400, { error: "A schedule entry needs a valid date and positive amount." });
          }
          state.schedule = update.schedule;
        }
        if (Array.isArray(update.merchantRules)) {
          if (update.merchantRules.length > 1000 || update.merchantRules.some((rule) =>
            !String(rule.merchant || "").trim() || rule.merchant.length > 100 ||
            !ReceiptValidation.EXPENSE_CATEGORIES.has(rule.category) ||
            !["Essentials", "Wants"].includes(rule.classification))) {
            return send(res, 400, { error: "Merchant rules need a name, existing category, and Essentials or Wants mark." });
          }
          state.merchantRules = update.merchantRules;
        }
        if (Array.isArray(update.homeStock)) {
          if (update.homeStock.length > 2000 || update.homeStock.some((item) =>
            !String(item.name || "").trim() || item.name.length > 120 ||
            !Number.isSafeInteger(Number(item.quantity)) || Number(item.quantity) < 0 ||
            (item.expiryDate && !/^\d{4}-\d{2}-\d{2}$/.test(item.expiryDate)))) {
            return send(res, 400, { error: "Home stock items need a name, non-negative whole-number quantity, and valid optional expiry date." });
          }
          state.homeStock = update.homeStock;
        }
        if (Array.isArray(update.taxDeductions)) state.taxDeductions = update.taxDeductions.slice(0, 5000);
        if (Array.isArray(update.accounts)) {
          if (update.accounts.some((account) => account.accountType === "Credit card" &&
            (account.minimumPayment === undefined || account.minimumPayment === null || account.minimumPayment === ""))) {
            return send(res, 400, { error: "Credit card accounts require a minimum monthly payment." });
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
            return send(res, 400, { error: "Accounts need a unique ID, name, valid owner and type, and non-negative numeric balances." });
          }
          state.accounts = update.accounts;
        }
        if (Array.isArray(update.transactions)) {
          if (update.transactions.length > 20000 || update.transactions.some((transaction) =>
            !transaction.id || !normalizeDate(transaction.date) ||
            !String(transaction.merchant || "").trim() ||
            !Number.isFinite(Number(transaction.amount)) || Number(transaction.amount) <= 0 ||
            !["income", "expense", "transfer"].includes(transaction.type) ||
            !["Partner A", "Partner B", "Joint"].includes(transaction.owner)
          )) {
            return send(res, 400, { error: "Ledger entries need a date, description, positive amount, type, and valid owner." });
          }
          const priorTransactions = new Map(state.transactions.map((transaction) => [transaction.id, transaction]));
          for (const transaction of update.transactions) {
            const prior = priorTransactions.get(transaction.id);
            if (prior) Classification.recordTransactionClassificationChanges(
              state, prior, transaction, String(update.classificationChangeReason || "Updated in ledger"), user
            );
          }
          state.transactions = update.transactions;
        }
        if (update.debtPlanExtraMonthly !== undefined) {
          const extra = Number(update.debtPlanExtraMonthly);
          if (!Number.isFinite(extra) || extra < 0) return send(res, 400, { error: "The snowball extra must be a non-negative amount." });
          state.debtPlanExtraMonthly = extra;
        }
        writeData(state);
        return send(res, 200, { state: publicState(state) });
      }
      if (req.method === "POST" && url.pathname === "/api/transactions/import") {
        const { csv, account } = await body(req);
        const state = readData();
        const imported = parseImport(String(csv || ""), account || {});
        const importOwner = account.owner || "Joint";
        const importName = account.name || "Imported account";
        const importLast4 = account.last4 || "";
        let linkedAccount = state.accounts.find((candidate) =>
          candidate.owner === importOwner &&
          (candidate.name.toLowerCase() === importName.toLowerCase() || (importLast4 && candidate.last4 === importLast4))
        );
        if (!linkedAccount) {
          linkedAccount = {
            id: crypto.randomUUID(),
            name: importName,
            institution: "CSV import",
            kind: account.kind === "liability" ? "liability" : "cash",
            bucket: account.kind === "liability" ? undefined : "Liquid",
            accountType: account.kind === "liability" ? "Credit card" : "Chequing",
            owner: importOwner,
            balance: 0,
            last4: importLast4
          };
          state.accounts.push(linkedAccount);
        }
        const fingerprints = new Set(state.transactions.filter((t) => t.source !== "receipt" && t.status !== "Superseded")
          .map((t) => `${t.date}|${Number(t.amount).toFixed(2)}|${(t.last4 || "").toString()}|${t.type}`));
        const fresh = imported.filter((t) => {
          const key = `${t.date}|${t.amount.toFixed(2)}|${(account.last4 || "").toString()}|${t.type}`;
          if (fingerprints.has(key)) return false;
          fingerprints.add(key);
          t.bankImported = true;
          t.source = "bank";
          ReceiptValidation.assignReceiptSuggestion(state.groceryReceipts, t);
          return true;
        });
        for (const transaction of fresh) {
          const suggestedReceipt = transaction.receiptSuggestionId
            ? (state.groceryReceipts || []).find((receipt) => receipt.id === transaction.receiptSuggestionId)
            : null;
          const rule = state.merchantRules.find((candidate) => transaction.merchant.toLowerCase().includes(candidate.merchant.toLowerCase()));
          if (rule && transaction.type === "expense") transaction.category = rule.category;
          const importedAccount = state.accounts.find((candidate) =>
            candidate.owner === transaction.owner &&
            (candidate.name.toLowerCase() === transaction.account.toLowerCase() || candidate.last4 === transaction.last4)
          );
          if (transaction.type === "expense" && importedAccount?.kind === "liability" && !suggestedReceipt) {
            transaction.balanceAppliedCents = moneyCents(transaction.amount);
            importedAccount.balance = (moneyCents(importedAccount.balance) + transaction.balanceAppliedCents) / 100;
          }
          if (transaction.category === "Debt repayment") {
            const description = transaction.merchant.toLowerCase();
            const debt = state.accounts.find((candidate) => candidate.kind === "liability" &&
              (description.includes(candidate.name.toLowerCase().split(" ")[0]) ||
                (candidate.accountType === "Car loan" && /car loan|auto loan/.test(description)) ||
                (candidate.accountType === "Credit card" && /visa|mastercard|credit card/.test(description))));
            if (debt) {
              debt.startingBalance ??= debt.balance;
              debt.balance = Math.max(0, moneyCents(debt.balance) - moneyCents(transaction.amount)) / 100;
            }
          }
          if (transaction.category === "Investment contribution") {
            const investment = state.accounts.find((candidate) => candidate.kind === "investment" && transaction.merchant.toLowerCase().includes(candidate.accountType.toLowerCase()));
            if (investment) investment.balance = (moneyCents(investment.balance) + moneyCents(transaction.amount)) / 100;
          }
          reconcileExpected(state, transaction);
        }
        for (const transaction of fresh) reconcileExpected(state, transaction);
        state.transactions.unshift(...fresh);
        writeData(state);
        return send(res, 200, { imported: fresh.length, duplicates: imported.length - fresh.length, state: publicState(state) });
      }
      if (req.method === "PATCH" && url.pathname.startsWith("/api/transactions/")) {
        const id = decodeURIComponent(url.pathname.split("/").pop());
        const update = await body(req);
        const state = readData();
        const transaction = state.transactions.find((t) => t.id === id);
        if (!transaction) return send(res, 404, { error: "Transaction not found." });
        if (Array.isArray(update.itemUpdates)) {
          if (!String(update.reason || "").trim()) return send(res, 400, { error: "Record a reason for changing an item classification or category." });
          try {
            Classification.applyClassificationUpdates(state, transaction, update.itemUpdates, { reason:update.reason, changedBy:user });
          } catch (error) {
            return send(res, error.status || 400, { error:error.message });
          }
        } else if (typeof update.category === "string") {
          Classification.recordClassificationChange(state, {
            target:transaction.id,targetName:transaction.merchant,field:"category",
            before:transaction.category,after:update.category.slice(0,60),
            reason:String(update.reason||"Category updated").trim(),changedBy:user
          });
          transaction.category = update.category.slice(0, 60);
        } else if (Array.isArray(update.itemCategories)) {
          const itemUpdates=update.itemCategories.map((category,index)=>({index,category,confirmed:true}));
          try {
            Classification.applyClassificationUpdates(state,transaction,itemUpdates,{reason:String(update.reason||"Category updated"),changedBy:user});
          } catch (error) {
            return send(res,error.status||400,{error:error.message});
          }
        } else if (Array.isArray(update.splits)) {
          if ((state.groceryReceipts || []).some((receipt) => receipt.expenseTransactionId === transaction.id || receipt.id === transaction.receiptId)) {
            return send(res, 400, { error: "This expense has line items. Change each item's category instead of splitting the whole total." });
          }
          const splits = update.splits.map((split) => ({ category: String(split.category).slice(0, 60), amount: Number(split.amount) }));
          if (splits.some((split) => !Number.isFinite(split.amount) || split.amount < 0) ||
              splits.reduce((sum, split) => sum + moneyCents(split.amount), 0) !== moneyCents(transaction.amount)) {
            return send(res, 400, { error: "Split amounts must add up to the transaction total." });
          }
          transaction.splits = splits;
        }
        writeData(state);
        return send(res, 200, { state: publicState(state) });
      }
      if (req.method === "DELETE" && url.pathname.startsWith("/api/transactions/")) {
        const id = decodeURIComponent(url.pathname.split("/").pop());
        const state = readData();
        const transaction = state.transactions.find((item) => item.id === id);
        if (!transaction) return send(res, 404, { error: "Transaction not found." });
        if (transaction.note !== "CSV import" && transaction.manual !== true) {
          return send(res, 400, { error: "Only an imported statement row or a hand-entered ledger row can be removed here." });
        }
        if (transaction.source === "receipt") {
          return send(res, 400, { error: "Remove a receipt expense from its proof record so its line items are removed too." });
        }
        if (Number.isSafeInteger(transaction.balanceAppliedCents) && transaction.balanceAppliedCents !== 0) {
          const account = state.accounts.find((item) => item.owner === transaction.owner &&
            (item.name === transaction.account || item.last4 === transaction.last4));
          if (account) account.balance = (moneyCents(account.balance) - transaction.balanceAppliedCents) / 100;
        }
        const linkedReceipt = (state.groceryReceipts || []).find((receipt) => receipt.matchedTransactionId === id);
        if (linkedReceipt) {
          linkedReceipt.matchedTransactionId = null;
          linkedReceipt.matchStatus = "pending";
          linkedReceipt.bankAmountCents = null;
          linkedReceipt.differenceCents = 0;
          linkedReceipt.differences = [];
        }
        state.transactions = state.transactions.filter((item) => item.id !== id);
        writeData(state);
        return send(res, 200, { ok: true, state: publicState(state) });
      }
      if (req.method === "GET" && url.pathname === "/api/plaid/status") {
        return send(res, 200, { configured: Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET) });
      }
      if (req.method === "POST" && url.pathname === "/api/plaid/link-token") {
        if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
          return send(res, 503, { error: "Plaid is not configured. Set PLAID_CLIENT_ID and PLAID_SECRET on the server to enable read-only linking." });
        }
        const request = await body(req);
        const environment = selectedPlaidEnvironment(request.environment);
        const token = await plaidRequest(environment, "/link/token/create", {
          client_name: "Accountant Household Workspace",
          user: { client_user_id: crypto.createHash("sha256").update(statehousehold()).digest("hex") },
          products: ["transactions"],
          country_codes: ["CA"],
          language: "en"
        });
        return send(res, 200, { linkToken: token.link_token, environment });
      }
      if (req.method === "POST" && url.pathname === "/api/plaid/exchange") {
        const { publicToken, institution, environment: requestedEnvironment } = await body(req);
        if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET || typeof publicToken !== "string") {
          return send(res, 400, { error: "A valid Plaid public token and server credentials are required." });
        }
        const environment = selectedPlaidEnvironment(requestedEnvironment);
        const exchanged = await plaidRequest(environment, "/item/public_token/exchange", { public_token: publicToken });
        const accountResponse = await plaidRequest(environment, "/accounts/get", { access_token: exchanged.access_token });
        const itemId = crypto.randomUUID();
        const state = readData();
        const accounts = (accountResponse.accounts || []).map((account) => {
          const existing = state.accounts.find((item) => item.last4 === account.mask && item.owner === user && item.institution === String(institution || "Connected institution"));
          const kind = account.type === "credit" || account.subtype === "credit card" ? "liability" : account.type === "investment" ? "investment" : "cash";
          const mapped = {
            id: existing?.id || crypto.randomUUID(),
            name: account.name || account.official_name || account.subtype || "Connected account",
            institution: String(institution || "Connected institution"),
            kind,
            bucket: kind === "cash" ? "Liquid" : undefined,
            accountType: account.subtype || account.type,
            owner: user,
            balance: Math.abs(Number(account.balances?.current) || 0),
            last4: account.mask || "",
            plaidAccountId: account.account_id
          };
          if (!existing) state.accounts.push(mapped);
          return mapped;
        });
        writeData(state);
        plaidItems.set(itemId, { accessToken: exchanged.access_token, institution: String(institution || "Connected institution"), environment, accounts, cursor: null });
        return send(res, 200, { connected: true, itemId, institution: String(institution || "Connected institution") });
      }
      if (req.method === "POST" && url.pathname === "/api/plaid/sync") {
        const { itemId } = await body(req);
        const items = itemId ? [plaidItems.get(String(itemId))].filter(Boolean) : [...plaidItems.values()];
        if (!items.length) return send(res, 404, { error: "No active Plaid connections are available in this server session. Reconnect an institution." });
        return send(res, 200, await syncPlaidItems(items));
      }
      return send(res, 404, { error: "API route not found." });
    }

    const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
    const publicFiles = new Set([
      "/index.html",
      "/styles.css",
      "/app.js",
      "/household-math.js",
      "/manifest.webmanifest",
      "/sw.js",
      "/icons/accountant.svg",
      "/icons/accountant-192.png",
      "/icons/accountant-512.png",
      "/icons/apple-touch-icon.png"
    ]);
    if (!publicFiles.has(requested)) return send(res, 404, "Not found", "text/plain; charset=utf-8");
    const file = path.resolve(PUBLIC_DIR, `.${requested}`);
    if (!file.startsWith(`${PUBLIC_DIR}${path.sep}`)) return send(res, 403, "Forbidden", "text/plain; charset=utf-8");
    fs.readFile(file, (error, contents) => {
      if (error) return send(res, 404, "Not found", "text/plain; charset=utf-8");
      return send(res, 200, contents, MIME[path.extname(file)] || "application/octet-stream");
    });
  } catch (error) {
    return send(res, Number(error.status) || 400, { error: error.message || "The request could not be completed." });
  }
});

ensureDataFile();

function statehousehold() {
  return readData().household || "household";
}

server.listen(PORT, () => {
  console.log(`Household Accountant running at http://localhost:${PORT}`);
});
