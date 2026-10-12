/**
 * Product-এর storefront section গুলো।
 * Frontend-এর dropdown আর backend-এর validation — দুই জায়গাতেই এই একটি
 * তালিকা থেকে চলে, যাতে কোনোদিকে mismatch না হয়।
 *
 * কোনো section না দিলে product টি "No section" (empty string) থাকে —
 * এই অবস্থায় product টি কোনো specific section-এ restrict হয় না।
 */
const PRODUCT_SECTIONS = [
  "Today's Deals",
  "Featured Products",
  "Best Sellers",
  "New Arrivals",
];

const NO_SECTION = "";

/**
 * আসা value কে ঠিক অনুমোদিত section বানায় (case-insensitive)।
 * অজানা/খালি value হলে NO_SECTION ("") ফেরত দেয়, তাই DB তে
 * অবৈধ মান ঢুকে যায় না।
 */
const normalizeSection = (value) => {
  if (value === undefined || value === null) return NO_SECTION;
  const trimmed = String(value).trim();
  const matched = PRODUCT_SECTIONS.find(
    (section) => section.toLowerCase() === trimmed.toLowerCase(),
  );
  return matched || NO_SECTION;
};

// form থেকে আসা value গ্রহণযোগ্য কিনা। খালি মান গ্রহণযোগ্য —
// সেটাই "No section" অবস্থা (admin কোনো section রাখতে চাইলে না)।
const isValidSection = (value) =>
  String(value ?? "").trim() === "" || normalizeSection(value) !== NO_SECTION;

module.exports = {
  PRODUCT_SECTIONS,
  NO_SECTION,
  normalizeSection,
  isValidSection,
};