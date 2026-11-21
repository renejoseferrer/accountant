const HouseholdMath = require("../public/household-math.js");

const EXPENSE_CATEGORIES = new Set([
  "Groceries",
  "Housing & Utilities",
  "Transit & Fuel",
  "Childcare",
  "Medical",
  "Dining",
  "Shopping",
  "Subscriptions",
  "Other"
]);
const MAX_ATTACHMENT_BYTES = 1_500_000;

function merchantKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function receiptCandidate(receipt, transaction) {
  if (!receipt || !transaction || transaction.type !== "expense") return false;
  const receiptDate = new Date(`${receipt.date}T12:00:00Z`);
  const transactionDate = new Date(`${transaction.date}T12:00:00Z`);
  if (!Number.isFinite(receiptDate.getTime()) || !Number.isFinite(transactionDate.getTime())) return false;
  const days = Math.abs(receiptDate - transactionDate) / 86_400_000;
  if (days > 3) return false;
  const receiptMerchant = merchantKey(receipt.merchant);
  const transactionMerchant = merchantKey(transaction.merchant);
  if (!receiptMerchant || !transactionMerchant) return false;
  if (receiptMerchant.includes(transactionMerchant) || transactionMerchant.includes(receiptMerchant)) return true;
  const tokens = String(receipt.merchant || "").toLowerCase().split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4);
  return tokens.some((token) => String(transaction.merchant || "").toLowerCase().includes(token));
}

function validateReceiptInput(input) {
  if (!input || typeof input !== "object") throw new Error("Receipt details are required.");
  const merchant = String(input.merchant || "").trim();
  const date = String(input.date || "");
  const accountId = String(input.accountId || "");
  const owner = String(input.owner || "");
  const receiptTotalCents = Number(input.receiptTotalCents);
  const items = input.items;
  if (!merchant || merchant.length > 100) throw new Error("Enter a store name up to 100 characters.");
  const parsedDate = new Date(`${date}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== date) {
    throw new Error("Enter a valid receipt date.");
  }
  if (!accountId || !["Partner A", "Partner B", "Joint"].includes(owner)) throw new Error("Choose a payment account.");
  if (!Number.isSafeInteger(receiptTotalCents) || receiptTotalCents <= 0) throw new Error("Enter a receipt total greater than zero.");
  if (!Array.isArray(items) || items.length < 1 || items.length > 300) throw new Error("Add between 1 and 300 receipt items.");
  let itemsTotalCents = 0;
  const normalizedItems = items.map((item) => {
    const name = String(item.name || "").trim();
    const quantity = Number(item.quantity);
    const unitPriceCents = Number(item.unitPriceCents);
    const lineTotalCents = Number(item.lineTotalCents);
    const category = String(item.category || "");
    const classification = String(item.classification || "");
    const classificationConfirmed = item.classificationConfirmed === true;
    if (!name || name.length > 120 || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999 ||
        !Number.isSafeInteger(unitPriceCents) || unitPriceCents < 0 ||
        !Number.isSafeInteger(lineTotalCents) || lineTotalCents !== quantity * unitPriceCents ||
        !EXPENSE_CATEGORIES.has(category)) {
      throw new Error("Each item needs a name, whole-number quantity, exact unit price, line total, and expense category.");
    }
    itemsTotalCents += lineTotalCents;
    return {
      name, quantity, unitPriceCents, lineTotalCents, category,
      ...(classification === "Essentials" || classification === "Wants" ? { classification } : {}),
      classificationConfirmed,
      classificationConfidence: ["high", "medium", "low"].includes(item.classificationConfidence) ? item.classificationConfidence : "low",
      classificationSource: String(item.classificationSource || "needs owner review").slice(0, 60)
    };
  });
  if (itemsTotalCents !== receiptTotalCents) {
    throw new Error(`Items total ${formatCents(itemsTotalCents)}; receipt total is ${formatCents(receiptTotalCents)}. Difference: ${formatCents(receiptTotalCents - itemsTotalCents)}.`);
  }

  let attachment = null;
  if (input.attachment !== undefined && input.attachment !== null) {
    const type = String(input.attachment.type || "");
    const name = String(input.attachment.name || "receipt");
    const dataUrl = String(input.attachment.dataUrl || "");
    const match = dataUrl.match(/^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([a-z0-9+/=]+)$/i);
    if (!match || match[1].toLowerCase() !== type.toLowerCase() ||
        !(type === "application/pdf" || (type.startsWith("image/") && type !== "image/svg+xml"))) {
      throw new Error("Attach a supported image or PDF receipt.");
    }
    const byteLength = Buffer.from(match[2], "base64").length;
    if (byteLength > MAX_ATTACHMENT_BYTES) {
      throw new Error("Receipt files must be 1.5 MB or smaller so they can be stored with household data.");
    }
    attachment = { type, name: name.slice(0, 180), dataBase64: match[2], byteLength };
  }

  return { merchant, date, accountId, owner, receiptTotalCents, items: normalizedItems, attachment };
}

function formatCents(cents) {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  return `${sign}$${Math.floor(absolute / 100).toLocaleString("en-CA")}.${String(absolute % 100).padStart(2, "0")}`;
}

function safeReceipt(receipt) {
  const { attachmentDataBase64, ...visible } = receipt;
  return { ...visible, hasAttachment: Boolean(attachmentDataBase64) };
}

function transactionCents(transaction) {
  if (Number.isSafeInteger(transaction?.amountCents)) return transaction.amountCents;
  return HouseholdMath.toCents(transaction?.amount);
}

function suggestReceiptMatch(receipt, transaction) {
  if (!receiptCandidate(receipt, transaction) || transaction.source === "receipt") return false;
  if (receipt.matchedTransactionId || transaction.receiptId) return false;
  if ((receipt.rejectedTransactionIds || []).includes(transaction.id)) return false;
  if ((transaction.rejectedReceiptIds || []).includes(receipt.id)) return false;
  const receiptCents = Number(receipt.receiptTotalCents ?? receipt.expenseTotalCents);
  return Number.isSafeInteger(receiptCents) && receiptCents === transactionCents(transaction);
}

function receiptAgreement(receipt, transactions = []) {
  const receiptCents = Number(receipt.receiptTotalCents ?? receipt.expenseTotalCents ?? 0);
  const ledger = transactions.find((item) => item.id === receipt.expenseTransactionId);
  const ledgerCents = ledger ? transactionCents(ledger) : Number(receipt.ledgerTotalCents ?? receipt.expenseTotalCents ?? receiptCents);
  const bank = receipt.matchedTransactionId
    ? transactions.find((item) => item.id === receipt.matchedTransactionId)
    : null;
  if (!bank) {
    return {
      status: "waiting",
      label: "Waiting for a bank match",
      fault: false,
      receiptCents,
      ledgerCents,
      bankCents: null,
      differences: []
    };
  }
  const bankCents = transactionCents(bank);
  const differences = [];
  const addDifference = (left, leftCents, right, rightCents) => {
    if (leftCents === rightCents) return;
    differences.push({
      pair: `${left} and ${right}`,
      differenceCents: rightCents - leftCents,
      text: `${left} ${formatCents(leftCents)} and ${right} ${formatCents(rightCents)} differ by ${formatCents(Math.abs(rightCents - leftCents))}`
    });
  };
  addDifference("Receipt", receiptCents, "Ledger", ledgerCents);
  addDifference("Receipt", receiptCents, "Bank", bankCents);
  addDifference("Ledger", ledgerCents, "Bank", bankCents);
  return {
    status: differences.length ? "needs review" : "matched",
    label: differences.length ? "Needs review" : "Matched — all three totals agree",
    fault: differences.length > 0,
    receiptCents,
    ledgerCents,
    bankCents,
    differences
  };
}

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function isImportedExpense(transaction) {
  return Boolean(transaction && transaction.type === "expense" && transaction.source !== "receipt" &&
    (transaction.bankImported || transaction.note === "CSV import" || transaction.note === "Bank sync"));
}

function applyReceiptLink(receipt, transaction, transactions) {
  if (!receipt || !isImportedExpense(transaction)) fail(400, "Choose an imported bank expense to link.");
  if (receipt.matchedTransactionId) fail(409, "This receipt is already matched to a transaction.");
  if (transaction.receiptId && transaction.receiptId !== receipt.id) fail(409, "This transaction is already matched to another receipt.");
  receipt.matchedTransactionId = transaction.id;
  const agreement = receiptAgreement(receipt, transactions);
  receipt.bankAmountCents = agreement.bankCents;
  receipt.ledgerTotalCents = agreement.ledgerCents;
  receipt.differenceCents = agreement.differences.reduce((largest, item) => Math.max(largest, Math.abs(item.differenceCents)), 0);
  receipt.differences = agreement.differences.map(({ pair, differenceCents }) => ({ pair, differenceCents }));
  receipt.matchStatus = agreement.status === "matched" ? "matched" : "needs review";
  transaction.receiptId = receipt.id;
  transaction.matchStatus = receipt.matchStatus;
  transaction.receiptMatchRole = "bank-record";
  transaction.bankImported = true;
  delete transaction.receiptSuggestionId;
  return receipt;
}

function rejectReceiptSuggestion(receipt, transaction) {
  if (!receipt || !transaction) fail(400, "Choose the suggestion to reject.");
  receipt.rejectedTransactionIds = [...new Set([...(receipt.rejectedTransactionIds || []), transaction.id])];
  transaction.rejectedReceiptIds = [...new Set([...(transaction.rejectedReceiptIds || []), receipt.id])];
  if (transaction.receiptSuggestionId === receipt.id) delete transaction.receiptSuggestionId;
}

function applyItemCategories(state, transaction, itemCategories) {
  const receipt = (state.groceryReceipts || []).find((item) =>
    item.id === transaction.receiptId || item.expenseTransactionId === transaction.id);
  if (!receipt?.items?.length) fail(400, "This expense has no line items. Split it by category and amount instead.");
  if (!Array.isArray(itemCategories) || itemCategories.length !== receipt.items.length) fail(400, "Choose a category for every line item.");
  itemCategories.forEach((category, index) => {
    if (!EXPENSE_CATEGORIES.has(String(category))) fail(400, "Choose an existing expense category for each item.");
    receipt.items[index].category = String(category);
  });
  const total = receipt.items.reduce((sum, item) => sum + Number(item.lineTotalCents), 0);
  if (total !== transactionCents(transaction)) fail(400, "Line items must add up to the expense total.");
  transaction.splits = receipt.items.map((item) => ({
    name: item.name,
    category: item.category,
    amount: item.lineTotalCents / 100,
    amountCents: item.lineTotalCents
  }));
  const categories = [...new Set(transaction.splits.map((split) => split.category))];
  transaction.category = categories.length === 1 ? categories[0] : "Split purchase";
}

function assignReceiptSuggestion(receipts, transaction) {
  const match = (receipts || []).find((receipt) => suggestReceiptMatch(receipt, transaction));
  if (match) transaction.receiptSuggestionId = match.id;
  else delete transaction.receiptSuggestionId;
  return match || null;
}

module.exports = {
  EXPENSE_CATEGORIES,
  MAX_ATTACHMENT_BYTES,
  formatCents,
  applyItemCategories,
  applyReceiptLink,
  assignReceiptSuggestion,
  isImportedExpense,
  receiptAgreement,
  receiptCandidate,
  rejectReceiptSuggestion,
  safeReceipt,
  suggestReceiptMatch,
  transactionCents,
  validateReceiptInput
};
