import { themeQuartz, colorSchemeLight } from "ag-grid-community";

// ag-Grid dressed as Herbarium: parchment body, vellum rules, teal accents.
// The stock quartz blue is dead; light scheme is forced (never dark).
export const herbariumGridTheme = themeQuartz.withPart(colorSchemeLight).withParams({
  backgroundColor: "#F2E9D2",
  foregroundColor: "#2C2416",
  accentColor: "#3C7A8A",
  borderColor: "#E8DDB8",
  headerBackgroundColor: "#E8DDB8",
  headerTextColor: "#7C6235",
  oddRowBackgroundColor: "#F6EEDA",
  rowHoverColor: "#FAF3DE",
  selectedRowBackgroundColor: "#3C7A8A1A",
  rangeSelectionBorderColor: "#3C7A8A",
  checkboxCheckedBackgroundColor: "#3C7A8A",
  inputFocusBorder: { color: "#3C7A8A" },
  fontFamily: "var(--font-archivo), sans-serif",
  headerFontFamily: "var(--font-space-mono), monospace",
  fontSize: 13,
  headerFontSize: 11,
  headerFontWeight: 700,
  wrapperBorderRadius: 3,
  rowVerticalPaddingScale: 0.9,
});
