import { parseCsv, parseChf } from "../utils/csvParser";

describe("parseCsv", () => {
  it("parses a simple CSV into header-keyed rows", () => {
    const { headers, rows } = parseCsv("a,b,c\n1,2,3\n4,5,6");
    expect(headers).toEqual(["a", "b", "c"]);
    expect(rows).toEqual([
      { a: "1", b: "2", c: "3" },
      { a: "4", b: "5", c: "6" },
    ]);
  });

  it("handles quoted fields with embedded commas and newlines", () => {
    const text = 'name,note\n"Doe, John","line1\nline2"\nAlice,ok';
    const { rows } = parseCsv(text);
    expect(rows[0]).toEqual({ name: "Doe, John", note: "line1\nline2" });
    expect(rows[1]).toEqual({ name: "Alice", note: "ok" });
  });

  it("unescapes doubled quotes inside quoted fields", () => {
    const { rows } = parseCsv('q\n"she said ""hi"""');
    expect(rows[0].q).toBe('she said "hi"');
  });

  it("handles CRLF line endings and a leading BOM", () => {
    const { headers, rows } = parseCsv("﻿a,b\r\n1,2\r\n");
    expect(headers).toEqual(["a", "b"]);
    expect(rows).toEqual([{ a: "1", b: "2" }]);
  });

  it("ignores a trailing newline and blank lines", () => {
    const { rows } = parseCsv("a\n1\n\n2\n");
    expect(rows).toEqual([{ a: "1" }, { a: "2" }]);
  });

  it("pads short rows and trims headers", () => {
    const { headers, rows } = parseCsv(" a , b , c \n1,2");
    expect(headers).toEqual(["a", "b", "c"]);
    expect(rows[0]).toEqual({ a: "1", b: "2", c: "" });
  });

  it("throws on empty input", () => {
    expect(() => parseCsv("")).toThrow(/no header row/);
    expect(() => parseCsv("\n\n")).toThrow(/no header row/);
  });

  it("auto-detects a semicolon delimiter (Swiss/European Excel export)", () => {
    const csv = "accountCode;accountName;balanceChf\n1000;Caisse;1234,50\n2000;Créanciers;5000";
    const { headers, rows } = parseCsv(csv);
    expect(headers).toEqual(["accountCode", "accountName", "balanceChf"]);
    expect(rows[0]).toEqual({ accountCode: "1000", accountName: "Caisse", balanceChf: "1234,50" });
    expect(rows[1].accountName).toBe("Créanciers");
  });

  it("auto-detects a tab delimiter", () => {
    const csv = "a\tb\tc\n1\t2\t3";
    const { headers, rows } = parseCsv(csv);
    expect(headers).toEqual(["a", "b", "c"]);
    expect(rows[0]).toEqual({ a: "1", b: "2", c: "3" });
  });

  it("keeps commas inside a semicolon-delimited file as data (European decimals)", () => {
    const { rows } = parseCsv("desc;amount\nPlumbing, urgent;1'077.00");
    expect(rows[0]).toEqual({ desc: "Plumbing, urgent", amount: "1'077.00" });
  });
});

describe("parseChf", () => {
  it("parses Swiss apostrophe thousands + dot decimal", () => {
    expect(parseChf("1'234.50")).toBe(1234.5);
  });

  it("parses European format (dot thousands, comma decimal)", () => {
    expect(parseChf("1.234,50")).toBe(1234.5);
  });

  it("parses space thousands and comma decimal", () => {
    expect(parseChf("1 234,50")).toBe(1234.5);
  });

  it("parses a plain number and strips a CHF label", () => {
    expect(parseChf("1234.5")).toBe(1234.5);
    expect(parseChf("CHF 42")).toBe(42);
  });

  it("returns null for blank or unparseable input", () => {
    expect(parseChf("")).toBeNull();
    expect(parseChf("   ")).toBeNull();
    expect(parseChf(null)).toBeNull();
    expect(parseChf("abc")).toBeNull();
  });
});
