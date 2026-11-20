(function (root, factory) {
  const math = factory();
  if (typeof module === "object" && module.exports) module.exports = math;
  else root.HouseholdMath = math;
})(globalThis, function () {
  function toCents(value) {
    const text = String(value ?? "0").trim();
    const match = text.match(/^(-?)(\d+)(?:\.(\d*))?$/);
    if (!match) return Math.round((Number(value) || 0) * 100);
    const fraction = (match[3] || "").padEnd(3, "0");
    return (match[1] === "-" ? -1 : 1) *
      (Number(match[2]) * 100 + Number(fraction.slice(0, 2)) + (Number(fraction[2]) >= 5 ? 1 : 0));
  }

  function fixedDecimal(value, places = 2) {
    const text = String(value ?? "0").trim();
    const match = text.match(/^(-?)(\d+)(?:\.(\d*))?$/);
    if (!match) {
      const number = Number(value);
      return (Number.isFinite(number) ? number : 0).toFixed(places);
    }
    const scale = 10 ** places;
    const fraction = match[3] || "";
    const kept = fraction.slice(0, places).padEnd(places, "0");
    const next = Number(fraction[places] || 0);
    const scaled = Number(match[2]) * scale + Number(kept || 0) + (next >= 5 ? 1 : 0);
    return `${match[1] === "-" ? "-" : ""}${(scaled / scale).toFixed(places)}`;
  }

  function centsFor(record, key) {
    const cents = record?.[`${key}Cents`];
    return Number.isSafeInteger(cents) ? cents : toCents(record?.[key]);
  }

  function roundDivision(numerator, denominator) {
    const sign = numerator < 0 ? -1 : 1;
    return sign * Math.floor((Math.abs(numerator) + Math.floor(denominator / 2)) / denominator);
  }

  function shareCents(cents, owner, view = "Combined Household", jointShare = 50) {
    if (view === "Combined Household" || owner !== "Joint") {
      if (view === "Combined Household" || owner === view.replace(" Only", "")) return cents;
      return 0;
    }
    const basisPoints = Math.max(0, Math.min(10000, toCents(jointShare)));
    return roundDivision(cents * basisPoints, 10000);
  }

  function splitShares(splits, owner, view, jointShare, targetCents) {
    if (view === "Combined Household" || owner !== "Joint") {
      return splits.map((split) => view === "Combined Household" || owner === view.replace(" Only", "")
        ? centsFor(split, "amount")
        : 0);
    }
    const basisPoints = Math.max(0, Math.min(10000, toCents(jointShare)));
    const allocations = splits.map((split, index) => {
      const numerator = centsFor(split, "amount") * basisPoints;
      return { index, cents: Math.floor(numerator / 10000), remainder: numerator % 10000 };
    });
    let remaining = targetCents - allocations.reduce((sum, allocation) => sum + allocation.cents, 0);
    allocations.slice().sort((left, right) => right.remainder - left.remainder || left.index - right.index)
      .slice(0, remaining)
      .forEach((allocation) => { allocations[allocation.index].cents += 1; });
    return allocations.map((allocation) => allocation.cents);
  }

  function transactionCategoryCents(transaction, categories, view = "Combined Household", jointShare = 50) {
    const amountCents = centsFor(transaction, "amount");
    const shownAmountCents = shareCents(amountCents, transaction.owner, view, jointShare);
    const splits = Array.isArray(transaction.splits) && transaction.splits.length ? transaction.splits : null;
    if (!splits || splits.reduce((sum, split) => sum + centsFor(split, "amount"), 0) !== amountCents) {
      return categories.includes(transaction.category) ? shownAmountCents : 0;
    }
    const shownSplits = splitShares(splits, transaction.owner, view, jointShare, shownAmountCents);
    return splits.reduce((sum, split, index) =>
      sum + (categories.includes(split.category) ? shownSplits[index] : 0), 0);
  }

  function calculateLedger(state, view = "Combined Household", jointShare = 50) {
    const incomeByCategory = {};
    const expensesByCategory = {};
    const splitMismatches = [];
    let incomeCents = 0;
    let expenseCents = 0;

    for (const transaction of state.transactions || []) {
      if (transaction.status !== "Actual" || !["income", "expense"].includes(transaction.type)) continue;
      const amountCents = shareCents(centsFor(transaction, "amount"), transaction.owner, view, jointShare);
      if (!amountCents) continue;
      if (transaction.type === "income") {
        incomeCents += amountCents;
        const category = transaction.category || "Uncategorized";
        incomeByCategory[category] = (incomeByCategory[category] || 0) + amountCents;
        continue;
      }

      expenseCents += amountCents;
      const splits = Array.isArray(transaction.splits) && transaction.splits.length ? transaction.splits : null;
      const splitTotal = splits ? splits.reduce((sum, split) => sum + centsFor(split, "amount"), 0) : amountCents;
      if (splits && splitTotal !== centsFor(transaction, "amount")) {
        splitMismatches.push(transaction.id);
      }
      if (!splits || splitTotal !== centsFor(transaction, "amount")) {
        const category = transaction.category || "Uncategorized";
        expensesByCategory[category] = (expensesByCategory[category] || 0) + amountCents;
        continue;
      }
      const shownSplits = splitShares(splits, transaction.owner, view, jointShare, amountCents);
      for (const [index, split] of splits.entries()) {
        const category = split.category || "Uncategorized";
        expensesByCategory[category] = (expensesByCategory[category] || 0) + shownSplits[index];
      }
    }

    return {
      incomeCents,
      expenseCents,
      netCents: incomeCents - expenseCents,
      incomeByCategoryCents: incomeByCategory,
      expensesByCategoryCents: expensesByCategory,
      splitMismatches
    };
  }

  function signedTransactionCents(transaction, view = "Combined Household", jointShare = 50) {
    const amount = shareCents(centsFor(transaction, "amount"), transaction.owner, view, jointShare);
    if (transaction.type === "income") return amount;
    if (transaction.type === "expense") return -amount;
    return 0;
  }

  function sortTransactionsBySignedAmount(records, direction = "asc", view = "Combined Household", jointShare = 50) {
    const multiplier = direction === "asc" ? 1 : -1;
    return records.slice().sort((left, right) => {
      const difference = signedTransactionCents(left, view, jointShare) -
        signedTransactionCents(right, view, jointShare);
      return (difference || String(left.id).localeCompare(String(right.id))) * multiplier;
    });
  }

  return {
    calculateLedger,
    centsFor,
    fixedDecimal,
    shareCents,
    splitShares,
    transactionCategoryCents,
    signedTransactionCents,
    sortTransactionsBySignedAmount,
    toCents
  };
});
