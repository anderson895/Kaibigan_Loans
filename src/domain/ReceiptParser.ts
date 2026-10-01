import type { OcrResult } from "./Payment";

/**
 * Extracts the amount and reference number from OCR text of an e-wallet/bank receipt
 * (GCash, Maya, bank transfers). Prefers numbers on lines labelled "amount"/"total",
 * falling back to the largest peso-looking value on the receipt.
 */
export class ReceiptParser {
  private static readonly AMOUNT = /(?:₱|PHP|P)?\s*(\d{1,3}(?:,\d{3})+(?:\.\d{2})?|\d+\.\d{2})/gi;
  private static readonly AMOUNT_LABEL = /(total\s+amount|amount\s+sent|amount\s+paid|amount|total)/i;
  private static readonly REF_LABEL =
    /(?:ref(?:erence)?\.?\s*(?:no|number|id|#)?\.?|transaction\s+(?:no|id)\.?|trace\s+no\.?)\s*[:#]?\s*([A-Z0-9][A-Z0-9 -]{5,30})/i;

  parse(text: string): OcrResult {
    const normalized = text.replace(/\r/g, "");
    return {
      amount: this.findAmount(normalized),
      referenceNo: this.findReference(normalized),
      text: normalized.trim().slice(0, 1000),
    };
  }

  private amountsIn(line: string): number[] {
    return [...line.matchAll(ReceiptParser.AMOUNT)]
      .map((m) => Number(m[1].replace(/,/g, "")))
      .filter((n) => n > 0 && n < 10_000_000);
  }

  private isReferenceLine(line: string): boolean {
    return ReceiptParser.REF_LABEL.test(line);
  }

  private findAmount(text: string): number | null {
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (this.isReferenceLine(lines[i]) || !ReceiptParser.AMOUNT_LABEL.test(lines[i])) continue;
      // The value is usually on the same line as the label, sometimes on the next one.
      const sameLine = this.amountsIn(lines[i]);
      if (sameLine.length) return sameLine[0];
      const nextLine = lines[i + 1] && !this.isReferenceLine(lines[i + 1]) ? this.amountsIn(lines[i + 1]) : [];
      if (nextLine.length) return nextLine[0];
    }
    const all = lines.filter((l) => !this.isReferenceLine(l)).flatMap((l) => this.amountsIn(l));
    return all.length ? Math.max(...all) : null;
  }

  private findReference(text: string): string | null {
    for (const line of text.split("\n")) {
      const match = line.match(ReceiptParser.REF_LABEL);
      if (!match) continue;
      const ref = match[1].replace(/\s+/g, " ").trim();
      if (/\d{4,}/.test(ref.replace(/[\s-]/g, ""))) return ref;
    }
    return null;
  }
}
