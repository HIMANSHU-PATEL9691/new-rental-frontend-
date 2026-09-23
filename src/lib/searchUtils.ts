/**
 * searchUtils.ts
 * Strict, exact search matching algorithms for Items, Rentals, and Customers.
 */

// Extract purely alphanumeric lowercase string (stripping spaces, hyphens, underscores, slashes, etc.)
export function cleanCode(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return "";
  return String(val).toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Extract numeric digits from string
export function extractDigits(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return "";
  return String(val).replace(/\D/g, "");
}

// Check if a query is purely numeric (ignoring spaces/hyphens)
export function isNumericQuery(query: string): boolean {
  if (!query) return false;
  const trimmed = query.trim().replace(/[\s-_]/g, "");
  return trimmed.length > 0 && /^\d+$/.test(trimmed);
}

// Check if a query looks like an item/bill code (e.g. "L410", "L41", "VV-001", "B-102", "M12", "W5")
export function isItemCodeQuery(query: string): boolean {
  if (!query) return false;
  const trimmed = query.trim().replace(/\s+/g, "");
  return /^[a-z]{1,4}[-_]?[0-9]+$/i.test(trimmed);
}

/**
 * Checks whether an item's identifier (customId, id, barcode, itemNo) EXACTLY matches
 * an item number or item code query. NO prefix matching, NO substring matching.
 *
 * Examples:
 * - Query "L41" or "41" matches ONLY item with customId "L41" or "41". Does NOT match "L410", "L416", "L411", etc.
 * - Query "L410" or "410" matches ONLY item with customId "L410" or "410".
 * - Query "641" or "L641" matches ONLY item with customId "L641" or "641".
 */
export function isExactItemCodeMatch(
  item: { customId?: string; id?: string; barcode?: string; itemNo?: string } | null | undefined,
  query: string
): boolean {
  if (!item || !query) return false;
  const rawQuery = query.trim().toLowerCase();
  if (!rawQuery) return false;

  const cleanQ = cleanCode(rawQuery);
  const queryDigits = extractDigits(rawQuery);
  const queryNum = queryDigits ? parseInt(queryDigits, 10) : null;

  const itemCustomId = (item.customId || "").trim().toLowerCase();
  const itemId = (item.id || "").trim().toLowerCase();
  const itemBarcode = (item.barcode || "").trim().toLowerCase();
  const itemNo = (item.itemNo || "").trim().toLowerCase();

  const allItemIds = [itemCustomId, itemId, itemBarcode, itemNo].filter(Boolean);

  for (const idStr of allItemIds) {
    const cleanId = cleanCode(idStr);
    const itemDigits = extractDigits(idStr);
    const itemNum = itemDigits ? parseInt(itemDigits, 10) : null;

    // 1. Direct exact string match or exact clean match (e.g. "L41" === "l41")
    if (idStr === rawQuery || cleanId === cleanQ) return true;

    // 2. Exact numeric & code match
    // Query "41" or "L41" has numeric part 41. Item "L41" has numeric part 41.
    // Item "L410" has numeric part 410 -> 410 !== 41 -> DOES NOT MATCH.
    if (queryDigits && itemDigits) {
      if (itemDigits === queryDigits || (queryNum !== null && itemNum === queryNum)) {
        const queryLetters = cleanQ.replace(/\d/g, "");
        const itemLetters = cleanId.replace(/\d/g, "");
        if (!queryLetters || !itemLetters || queryLetters === itemLetters) {
          return true;
        }
      }
    }
  }

  return false;
}

export const isItemCodeMatch = isExactItemCodeMatch;

/**
 * Checks whether an item matches a search query.
 *
 * - If query is an item code or numeric item number (e.g. "41", "L41", "L410", "410", "VV-001"):
 *   Matches ONLY if item identifier matches EXACTLY. It will NEVER match related/prefix items
 *   (e.g. searching "L41" will ONLY match item "L41", NOT "L410" or "L416").
 *
 * - If query is a general text query (e.g. "Rama green", "Sajan Sagar", "Multi", "Lehenga"):
 *   Matches if name, designer, category, subcategory, color, size, or status contains the query terms.
 */
export function matchesItemSearch(item: any, query: string): boolean {
  if (!query || !query.trim()) return true;
  if (!item) return false;

  const rawQuery = query.trim().toLowerCase();

  // Check if query is an item code or numeric item number
  const isCodeOrNum =
    isNumericQuery(rawQuery) ||
    isItemCodeQuery(rawQuery) ||
    /^[a-z]{1,4}[0-9]+/i.test(rawQuery.replace(/[\s-_]/g, ""));

  if (isCodeOrNum) {
    return isExactItemCodeMatch(item, rawQuery);
  }

  // Check exact code match first
  if (isExactItemCodeMatch(item, rawQuery)) return true;

  // Otherwise, perform general text search across metadata fields
  const textSearchable = [
    item.name,
    item.designer,
    item.category,
    item.subcategory,
    item.color,
    item.size,
    item.status,
    item.notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const words = rawQuery.split(/\s+/).filter(Boolean);
  return words.every((word) => textSearchable.includes(word));
}

/**
 * Helper to find an item in an items array by matching its code (e.g. "410" or "L410").
 */
export function findItemByCode(items: any[], code: string) {
  if (!code || !code.trim() || !Array.isArray(items)) return undefined;
  return items.find((i) => isExactItemCodeMatch(i, code));
}

/**
 * Checks whether a rental matches a search query.
 */
export function matchesRentalSearch(
  rental: any,
  item: any,
  customer: any,
  query: string,
  extraFields?: (string | number | undefined | null)[]
): boolean {
  if (!query || !query.trim()) return true;
  if (!rental) return false;

  const rawQuery = query.trim().toLowerCase();
  const cleanQ = cleanCode(rawQuery);
  const queryDigits = extractDigits(rawQuery);

  // 1. Bill Number Match (exact match)
  const billNo = (rental.billNo || "").trim().toLowerCase();
  if (billNo) {
    const cleanBill = cleanCode(billNo);
    if (billNo === rawQuery || cleanBill === cleanQ) return true;
  }

  // 2. Exact Item Code Match on rental.itemNo, rental.itemId, or linked item
  const rentalItemObj = item || { customId: rental.itemNo, id: rental.itemId, itemNo: rental.itemNo };
  if (
    isExactItemCodeMatch(rentalItemObj, rawQuery) ||
    isExactItemCodeMatch({ customId: rental.itemNo, id: rental.itemId, itemNo: rental.itemNo }, rawQuery)
  ) {
    return true;
  }

  // If query was an item code or numeric item number or bill code, check phone match before returning false
  if (isNumericQuery(rawQuery) || isItemCodeQuery(rawQuery)) {
    if (customer?.phone && queryDigits.length >= 4) {
      const phoneDigits = extractDigits(customer.phone);
      if (phoneDigits.includes(queryDigits)) return true;
    }
    return false;
  }

  // 3. General text search across customer, item name, dates, status, remarks
  const textSearchable = [
    rental.id,
    rental.billNo,
    rental.status,
    rental.startDate,
    rental.endDate,
    rental.deliveryDate,
    rental.remark,
    item?.name,
    item?.designer,
    item?.category,
    item?.color,
    customer?.name,
    customer?.email,
    customer?.phone,
    customer?.tier,
    ...(extraFields || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const words = rawQuery.split(/\s+/).filter(Boolean);
  return words.every((word) => textSearchable.includes(word));
}

/**
 * Checks whether a customer matches a search query.
 */
export function matchesCustomerSearch(customer: any, query: string): boolean {
  if (!query || !query.trim()) return true;
  if (!customer) return false;

  const rawQuery = query.trim().toLowerCase();
  const cleanQ = cleanCode(rawQuery);
  const queryDigits = extractDigits(rawQuery);

  if (isNumericQuery(rawQuery)) {
    const phoneDigits = extractDigits(customer.phone || "");
    const secPhoneDigits = extractDigits(customer.secondaryPhone || "");
    if (phoneDigits.includes(queryDigits) || secPhoneDigits.includes(queryDigits)) {
      return true;
    }
    if (cleanCode(customer.id) === cleanQ) return true;
    return false;
  }

  const textSearchable = [
    customer.id,
    customer.name,
    customer.email,
    customer.phone,
    customer.secondaryPhone,
    customer.tier,
    customer.address,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const words = rawQuery.split(/\s+/).filter(Boolean);
  return words.every((word) => textSearchable.includes(word));
}
