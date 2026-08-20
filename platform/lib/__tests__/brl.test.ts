import { describe, expect, it } from "vitest";
import {
  formatBrlCurrency,
  formatBrlInput,
  formatBrlNumber,
  parseBrlInput,
  parseBrlNumber,
} from "@/lib/brl";

describe("parseBrlNumber", () => {
  it("parses pt-BR formatted amounts", () => {
    expect(parseBrlNumber("1.234,56")).toBe(1234.56);
    expect(parseBrlNumber("1000")).toBe(1000);
    expect(parseBrlNumber("0,5")).toBe(0.5);
  });

  it("returns null on invalid input", () => {
    expect(parseBrlNumber("abc")).toBeNull();
    expect(parseBrlNumber("")).toBeNull();
  });
});

describe("parseBrlInput", () => {
  it("returns 0 for empty input and parses numbers otherwise", () => {
    expect(parseBrlInput("")).toBe(0);
    expect(parseBrlInput("2.500,00")).toBe(2500);
  });
});

describe("format helpers", () => {
  it("formatBrlInput keeps only digits with thousands separators", () => {
    expect(formatBrlInput("12ab34")).toBe("1.234");
  });

  it("formatBrlNumber formats integers", () => {
    expect(formatBrlNumber(2500)).toBe("2.500");
    expect(formatBrlNumber(0)).toBe("");
  });

  it("formatBrlCurrency adds R$ and 2 decimals", () => {
    expect(formatBrlCurrency(1234.5)).toBe("R$1.234,50");
  });
});
