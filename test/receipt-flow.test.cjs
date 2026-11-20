const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const HouseholdMath = require("../public/household-math.js");
const ReceiptValidation = require("../lib/receipt-validation.cjs");

const root = path.join(__dirname, "..");
const sampleItems = [
  { name: "Milk", quantity: 2, unitPriceCents: 525, lineTotalCents: 1050, category: "Groceries" },
  { name: "Apples", quantity: 4, unitPriceCents: 350, lineTotalCents: 1400, category: "Groceries" },
  { name: "Cleaner", quantity: 1, unitPriceCents: 1050, lineTotalCents: 1050, category: "Housing & Utilities" }
];

test("receipt entry validates cents, preserves proof, splits categories, and confirms bank matches", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "accountant-receipt-test-"));
  const socket = net.createServer();
  await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
  const port = socket.address().port;
  await new Promise((resolve, reject) => socket.close((error) => error ? reject(error) : resolve()));
  const server = spawn(process.execPath, [path.join(root, "server.js")], {
    cwd: root,
    env: { ...process.env, PORT: String(port), DATA_DIR: directory },
    stdio: "ignore"
  });
  const base = `http://127.0.0.1:${port}`;
  let cookie = "";
  const request = async (route, options = {}) => {
    const response = await fetch(`${base}${route}`, {
      ...options,
      headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}), ...options.headers }
    });
    const type = response.headers.get("content-type") || "";
    return { response, result: type.includes("application/json") ? await response.json() : Buffer.from(await response.arrayBuffer()) };
  };

  try {
    let healthy = false;
    for (let attempt = 0; attempt < 60 && !healthy; attempt += 1) {
      try { healthy = (await fetch(`${base}/health`)).ok; } catch {}
      if (!healthy) await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(healthy, true, "isolated server starts");
    const login = await fetch(`${base}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partner: "Partner A", passcode: "1234" })
    });
    assert.equal(login.status, 200);
    cookie = login.headers.get("set-cookie").split(";")[0];
    const initial = (await request("/api/state")).result.state;
    const account = initial.accounts.find((item) => item.id === "checking-a");
    assert.ok(account);

    const payload = {
      merchant: "Three Item Market",
      date: "2026-11-18",
      accountId: account.id,
      owner: account.owner,
      receiptTotalCents: 3500,
      items: sampleItems
    };
    const blocked = await request("/api/receipts", {
      method: "POST",
      body: JSON.stringify({ ...payload, receiptTotalCents: 3501 })
    });
    assert.equal(blocked.response.status, 400);
    assert.match(blocked.result.error, /Difference: \$0\.01/);

    const savedManual = await request("/api/receipts", { method: "POST", body: JSON.stringify(payload) });
    assert.equal(savedManual.response.status, 201);
    const manualReceipt = savedManual.result.receipt;
    assert.equal(sampleItems.reduce((sum, item) => sum + item.lineTotalCents, 0), manualReceipt.receiptTotalCents);
    let afterManual = (await request("/api/state")).result.state;
    const manualTransaction = afterManual.transactions.find((item) => item.id === manualReceipt.expenseTransactionId);
    assert.equal(manualTransaction.amountCents, 3500);
    assert.equal(manualTransaction.splits.reduce((sum, item) => sum + item.amountCents, 0), 3500);
    const beforeLedger = HouseholdMath.calculateLedger(initial, "Combined Household", 50);
    const afterLedger = HouseholdMath.calculateLedger(afterManual, "Combined Household", 50);
    assert.equal(afterLedger.expensesByCategoryCents.Groceries - beforeLedger.expensesByCategoryCents.Groceries, 2450);
    assert.equal(afterLedger.expensesByCategoryCents["Housing & Utilities"] - beforeLedger.expensesByCategoryCents["Housing & Utilities"], 1050);

    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l2cAAAAASUVORK5CYII=", "base64");
    const imageReceiptPayload = {
      merchant: "Phase Two Sample Mart",
      date: "2026-11-19",
      accountId: account.id,
      owner: account.owner,
      receiptTotalCents: 2000,
      items: [{ name: "Bread", quantity: 2, unitPriceCents: 1000, lineTotalCents: 2000, category: "Groceries" }],
      attachment: { name: "sample-receipt.png", type: "image/png", dataUrl: `data:image/png;base64,${png.toString("base64")}` }
    };
    const savedImage = await request("/api/receipts", { method: "POST", body: JSON.stringify(imageReceiptPayload) });
    assert.equal(savedImage.response.status, 201);
    const imageReceipt = savedImage.result.receipt;
    assert.equal(imageReceipt.hasAttachment, true);
    afterManual = (await request("/api/state")).result.state;
    const reloadedReceipt = afterManual.groceryReceipts.find((item) => item.id === imageReceipt.id);
    assert.equal(reloadedReceipt.hasAttachment, true);
    assert.equal(reloadedReceipt.items[0].lineTotalCents, 2000);
    const openedFile = await request(`/api/receipts/${imageReceipt.id}/file`);
    assert.deepEqual(openedFile.result, png);

    const imported = await request("/api/transactions/import", {
      method: "POST",
      body: JSON.stringify({
        account: { owner: "Partner A", name: account.name, last4: account.last4, kind: "cash" },
        csv: "Date,Description,Amount\n2026-11-19,Phase Two Sample Mart,-20.01"
      })
    });
    assert.equal(imported.response.status, 200);
    const bankTransaction = imported.result.state.transactions.find((item) =>
      item.note === "CSV import" && item.merchant === "Phase Two Sample Mart");
    assert.ok(bankTransaction);
    assert.equal(bankTransaction.amountCents, 2001);
    assert.equal(bankTransaction.receiptId, undefined, "import only suggests; it does not silently match");
    assert.equal(bankTransaction.receiptSuggestionId, undefined, "a one-cent amount difference is not suggested as a match");
    assert.equal(ReceiptValidation.receiptCandidate(imageReceipt, bankTransaction), true);
    const originalAfterImport = imported.result.state.transactions.find((item) => item.id === imageReceipt.expenseTransactionId);
    assert.equal(originalAfterImport.status, "Actual", "import must not hide the ledger expense before confirmation");

    const confirmed = await request(`/api/receipts/${imageReceipt.id}`, {
      method: "PATCH",
      body: JSON.stringify({ confirm: true, transactionId: bankTransaction.id })
    });
    assert.equal(confirmed.response.status, 200);
    assert.equal(confirmed.result.receipt.matchStatus, "needs review");
    assert.equal(confirmed.result.receipt.differenceCents, 1);
    assert.equal(confirmed.result.receipt.receiptTotalCents, 2000);
    assert.equal(confirmed.result.receipt.ledgerTotalCents, 2000);
    assert.equal(confirmed.result.receipt.bankAmountCents, 2001);
    assert.equal(confirmed.result.receipt.differences.some((item) => item.pair === "Receipt and Bank" && item.differenceCents === 1), true);
    assert.equal(ReceiptValidation.formatCents(confirmed.result.receipt.differenceCents), "$0.01");
    const linkedState = (await request("/api/state")).result.state;
    assert.equal(linkedState.transactions.find((item) => item.id === bankTransaction.id).receiptMatchRole, "bank-record");
    assert.equal(HouseholdMath.calculateLedger(linkedState, "Combined Household", 50).expenseCents,
      HouseholdMath.calculateLedger(afterManual, "Combined Household", 50).expenseCents,
      "a linked bank row must not be counted as a second expense");

    for (const receipt of [manualReceipt, imageReceipt]) {
      const deleted = await request(`/api/receipts/${receipt.id}`, { method: "DELETE" });
      assert.equal(deleted.response.status, 200);
    }
  } finally {
    server.kill();
    await rm(directory, { recursive: true, force: true });
  }
});

test("receipt removal, rejected suggestions, exact matches, and item categories stay exact", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "accountant-receipt-repair-"));
  const socket = net.createServer();
  await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
  const port = socket.address().port;
  await new Promise((resolve, reject) => socket.close((error) => error ? reject(error) : resolve()));
  const server = spawn(process.execPath, [path.join(root, "server.js")], {
    cwd: root,
    env: { ...process.env, PORT: String(port), DATA_DIR: directory },
    stdio: "ignore"
  });
  const base = `http://127.0.0.1:${port}`;
  let cookie = "";
  const request = async (route, options = {}) => {
    const response = await fetch(`${base}${route}`, {
      ...options,
      headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}), ...options.headers }
    });
    const type = response.headers.get("content-type") || "";
    return { response, result: type.includes("application/json") ? await response.json() : Buffer.from(await response.arrayBuffer()) };
  };
  try {
    let healthy = false;
    for (let attempt = 0; attempt < 40 && !healthy; attempt += 1) {
      try { healthy = (await fetch(`${base}/health`)).ok; } catch {}
      if (!healthy) await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(healthy, true);
    const login = await fetch(`${base}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partner: "Partner A", passcode: "1234" })
    });
    cookie = login.headers.get("set-cookie").split(";")[0];
    const initial = (await request("/api/state")).result.state;
    const account = initial.accounts.find((item) => item.id === "checking-a");
    const beforeBalance = account.balanceCents;
    const beforeExpenses = HouseholdMath.calculateLedger(initial, "Combined Household", 50).expenseCents;
    const saved = await request("/api/receipts", {
      method: "POST",
      body: JSON.stringify({
        merchant: "Exact Match Market",
        date: "2026-11-20",
        accountId: account.id,
        owner: account.owner,
        receiptTotalCents: 3500,
        items: sampleItems
      })
    });
    assert.equal(saved.response.status, 201);
    const receipt = saved.result.receipt;
    const imported = await request("/api/transactions/import", {
      method: "POST",
      body: JSON.stringify({
        account: { owner: account.owner, name: account.name, last4: account.last4, kind: "cash" },
        csv: "Date,Description,Amount\n2026-11-20,Exact Match Market,-35.00\n2026-11-20,Exact Match Market,-36.00"
      })
    });
    assert.equal(imported.response.status, 200);
    const exact = imported.result.state.transactions.find((item) => item.merchant === "Exact Match Market" && item.amountCents === 3500);
    const different = imported.result.state.transactions.find((item) => item.merchant === "Exact Match Market" && item.amountCents === 3600);
    assert.equal(exact.receiptSuggestionId, receipt.id);
    assert.equal(exact.receiptId, undefined);
    assert.equal(different.receiptSuggestionId, undefined);
    assert.equal(imported.result.state.transactions.find((item) => item.id === receipt.expenseTransactionId).status, "Actual");

    const rejected = await request(`/api/receipts/${receipt.id}`, {
      method: "PATCH",
      body: JSON.stringify({ reject: true, transactionId: exact.id })
    });
    assert.equal(rejected.response.status, 200);
    const afterReject = (await request("/api/state")).result.state;
    assert.equal(afterReject.groceryReceipts.some((item) => item.id === receipt.id), true);
    assert.equal(afterReject.transactions.some((item) => item.id === exact.id), true);
    assert.equal(afterReject.transactions.find((item) => item.id === exact.id).receiptId, undefined);
    assert.equal(ReceiptValidation.suggestReceiptMatch(afterReject.groceryReceipts.find((item) => item.id === receipt.id), afterReject.transactions.find((item) => item.id === exact.id)), false);

    const mismatch = await request(`/api/receipts/${receipt.id}`, {
      method: "PATCH",
      body: JSON.stringify({ confirm: true, transactionId: different.id })
    });
    assert.equal(mismatch.response.status, 200);
    assert.equal(mismatch.result.receipt.matchStatus, "needs review");
    assert.equal(mismatch.result.receipt.ledgerTotalCents, 3500);
    assert.equal(mismatch.result.receipt.bankAmountCents, 3600);
    assert.equal(mismatch.result.receipt.differences.some((item) => item.pair === "Receipt and Bank"), true);

    const beforeMove = (await request("/api/state")).result.state;
    const moved = await request(`/api/transactions/${receipt.expenseTransactionId}`, {
      method: "PATCH",
      body: JSON.stringify({ itemCategories: ["Groceries", "Groceries", "Groceries"] })
    });
    assert.equal(moved.response.status, 200);
    const movedState = moved.result.state;
    const movedTransaction = movedState.transactions.find((item) => item.id === receipt.expenseTransactionId);
    assert.equal(movedTransaction.amountCents, 3500);
    assert.equal(movedTransaction.splits.every((split) => split.category === "Groceries"), true);
    assert.equal(HouseholdMath.calculateLedger(movedState, "Combined Household", 50).expenseCents,
      HouseholdMath.calculateLedger(beforeMove, "Combined Household", 50).expenseCents);
    assert.equal((HouseholdMath.calculateLedger(movedState, "Combined Household", 50).expensesByCategoryCents.Groceries || 0) -
      (HouseholdMath.calculateLedger(beforeMove, "Combined Household", 50).expensesByCategoryCents.Groceries || 0), 1050);
    assert.equal((HouseholdMath.calculateLedger(movedState, "Combined Household", 50).expensesByCategoryCents["Housing & Utilities"] || 0) -
      (HouseholdMath.calculateLedger(beforeMove, "Combined Household", 50).expensesByCategoryCents["Housing & Utilities"] || 0), -1050);

    const removedImport = await request(`/api/transactions/${different.id}`, { method: "DELETE" });
    assert.equal(removedImport.response.status, 200);
    const removedReceipt = await request(`/api/receipts/${receipt.id}`, { method: "DELETE" });
    assert.equal(removedReceipt.response.status, 200);
    const removedExact = await request(`/api/transactions/${exact.id}`, { method: "DELETE" });
    assert.equal(removedExact.response.status, 200);
    const restored = (await request("/api/state")).result.state;
    assert.equal(restored.groceryReceipts.some((item) => item.id === receipt.id), false);
    assert.equal(restored.transactions.some((item) => item.id === receipt.expenseTransactionId), false);
    assert.equal(restored.accounts.find((item) => item.id === account.id).balanceCents, beforeBalance);
    assert.equal(HouseholdMath.calculateLedger(restored, "Combined Household", 50).expenseCents, beforeExpenses);
  } finally {
    server.kill();
    await rm(directory, { recursive: true, force: true });
  }
});

test("receipt matching considers merchant and dates but does not mutate records", () => {
  const receipt = { merchant: "Costco Wholesale", date: "2026-11-18" };
  const transaction = { merchant: "COSTCO #081", date: "2026-11-20", type: "expense", amount: 10 };
  assert.equal(ReceiptValidation.receiptCandidate(receipt, transaction), true);
  assert.equal(ReceiptValidation.receiptCandidate(receipt, { ...transaction, date: "2026-11-22" }), false);
  assert.equal(ReceiptValidation.receiptCandidate(receipt, { ...transaction, merchant: "Netflix" }), false);
});
