// Regenerates tests/fixtures/harborline-import.xlsx (the seed spreadsheet for
// the template-import path) and kai-rivera.vcf. Run: node scripts/make-fixtures.mjs
import * as XLSX from "xlsx";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "tests", "fixtures");
mkdirSync(dir, { recursive: true });

// Matches the default column spec in docs/import-template.md exactly.
// Includes: one no-street dream project (Skyline Deck concept) and one
// already-ended lease (Moira Chen, ended 2026-05-31).
const HEADERS = [
  "group_name", "group_kind", "project_name", "street", "city", "region",
  "postal", "country", "contact_name", "contact_type", "contact_phone",
  "contact_email", "preferred_contact_method", "lease_start", "lease_end", "notes",
];

const ROWS = [
  ["Cypress Court", "multi_family", "Cypress Court Unit A", "410 Cypress Ct Unit A", "Larkspur", "CA", "94939", "US",
   "Tomas Ibarra", "lessee", "+1-415-555-0201", "tomas.ibarra@example.com", "email", "2026-02-01", "2027-01-31", ""],
  ["Cypress Court", "multi_family", "Cypress Court Unit B", "410 Cypress Ct Unit B", "Larkspur", "CA", "94939", "US",
   "Renee Alvarez", "lessee", "+1-415-555-0202", "renee.alvarez@example.com", "sms", "2025-09-01", "2026-08-31", ""],
  // Already-ended lease: must surface as effective-inactive after import.
  ["Cypress Court", "multi_family", "Cypress Court Unit C", "410 Cypress Ct Unit C", "Larkspur", "CA", "94939", "US",
   "Moira Chen", "lessee", "+1-415-555-0203", "moira.chen@example.com", "email", "2025-06-01", "2026-05-31",
   "moved out end of May"],
  ["Cypress Court", "multi_family", "Cypress Court Roof Deck", "410 Cypress Ct", "Larkspur", "CA", "94939", "US",
   "Ridgeway Roofing", "vendor", "+1-415-555-0204", "bids@ridgewayroofing.example", "phone", "", "", "deck rebuild bid due"],
  ["Gate Five Annex", "commercial", "Gate Five Suite 120", "120 Gate Five Rd", "Sausalito", "CA", "94965", "US",
   "Blue Slip Design LLC", "lessee", "+1-415-555-0205", "office@blueslipdesign.example", "email", "2026-01-15", "2028-01-14", ""],
  ["Gate Five Annex", "commercial", "Gate Five Suite 200", "200 Gate Five Rd", "Sausalito", "CA", "94965", "US",
   "Ridgeway Roofing", "vendor", "+1-415-555-0204", "bids@ridgewayroofing.example", "phone", "", "", "shared vendor with Cypress"],
  // Unknown contact_type -> must become a DRAFT type (Rubicon queue).
  ["Gate Five Annex", "commercial", "Gate Five Suite 200", "200 Gate Five Rd", "Sausalito", "CA", "94965", "US",
   "Harbormaster Office", "harbormaster", "+1-415-555-0206", "", "phone", "", "", "port liaison"],
  // Dream project: no street, city/region only.
  ["", "", "Skyline Deck concept", "", "Mill Valley", "CA", "", "US",
   "", "", "", "", "", "", "", "owner sketching a hillside deck program"],
];

const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...ROWS]);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "import");
XLSX.writeFile(wb, join(dir, "harborline-import.xlsx"));

// Also a CSV twin of the same data (the endpoint accepts both).
XLSX.writeFile(wb, join(dir, "harborline-import.csv"), { bookType: "csv" });

// An iPhone-ish vCard with fields beyond our columns (they land in attrs.vcf).
const vcf = `BEGIN:VCARD
VERSION:3.0
PRODID:-//Apple Inc.//iPhone OS 19.0//EN
N:Rivera;Kai;;;
FN:Kai Rivera
ORG:Rivera & Daughters Electric;
TITLE:Master Electrician
TEL;type=CELL;type=VOICE;type=pref:+1 (415) 555-0299
EMAIL;type=INTERNET;type=WORK;type=pref:kai@riveraelectric.example
item1.ADR;type=WORK;type=pref:;;88 Liberty Ship Way;Sausalito;CA;94965;US
item1.X-ABLabel:Shop
BDAY:1987-03-14
NOTE:Licensed C-10. Prefers early texts.
END:VCARD
`;
writeFileSync(join(dir, "kai-rivera.vcf"), vcf);

console.log("fixtures written to", dir);
