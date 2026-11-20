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
    if (!name || name.length > 120 || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999 ||
        !Number.isSafeInteger(unitPriceCents) || unitPriceCents < 0 ||
        !Number.isSafeInteger(lineTotalCents) || lineTotalCents !== quantity * unitPriceCents ||
        !EXPENSE_CATEGORIES.has(category)) {
      throw new Error("Each item needs a name, whole-number quantity, exact unit price, line total, and expense category.");
    }
    itemsTotalCents += lineTotalCents;
    return { name, quantity, unitPriceCents, lineTotalCents, category };
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

module.exports = {
  EXPENSE_CATEGORIES,
  MAX_ATTACHMENT_BYTES,
  formatCents,
  receiptCandidate,
  safeReceipt,
  validateReceiptInput
};
