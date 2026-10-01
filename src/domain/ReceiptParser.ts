import type { OcrResult } from "./Payment";

/** Words that introduce a reference number on GCash, Maya, InstaPay/PESONet and bank receipts. */
const REF_WORDS = String.raw`(?:ref(?:erence)?\.?\s*(?:no|number|id|code|#)?\.?|(?:transaction|txn|trans)\.?\s*(?:no|number|id|ref)\.?|trace\s*(?:no|number)\.?|confirmation\s*(?:no|number|code)\.?|instapay\s*ref(?:erence)?\.?\s*(?:no)?\.?|invoice\s*(?:no|number)\.?)`;
const REF_VALUE = String.raw`([A-Z0-9][A-Z0-9 -]{5,30})`;

/**
 * Extracts the amount and reference number from OCR text of an e-wallet/bank receipt
 * (GCash, Maya, bank transfers). Prefers numbers on lines labelled "amount"/"total",
 * falling back to the largest peso-looking value on the receipt.
 */
export class ReceiptParser {
  private static readonly AMOUNT = /(?:₱|PHP|P)?\s*(\d{1,3}(?:,\d{3})+(?:\.\d{2})?|\d+\.\d{2})/gi;
  private static readonly AMOUNT_LABEL = /(total\s+amount|amount\s+sent|amount\s+paid|amount|total)/i;
  /** Label followed by the value on the same line. */
  private static readonly REF_LABEL = new RegExp(String.raw`${REF_WORDS}\s*[:#]?\s*${REF_VALUE}`, "i");
  /** Label alone on its line (the value is on the next line). */
  private static readonly REF_LABEL_ONLY = new RegExp(String.raw`^\s*${REF_WORDS}\s*[:#]?\s*$`, "i");
  private static readonly VALUE_LINE = new RegExp(String.raw`^\s*${REF_VALUE}`, "i");

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
    return ReceiptParser.REF_LABEL.test(line) || ReceiptParser.REF_LABEL_ONLY.test(line);
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
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      // Try the value on the label's own line first, then the next line (label alone on its line).
      const candidates = [
        lines[i].match(ReceiptParser.REF_LABEL)?.[1],
        ReceiptParser.REF_LABEL_ONLY.test(lines[i]) ? (lines[i + 1] ?? "").match(ReceiptParser.VALUE_LINE)?.[1] : undefined,
      ];
      for (const candidate of candidates) {
        if (!candidate) continue;
        const ref = candidate.replace(/\s+/g, " ").trim();
        // A real reference has a run of digits; this skips labels followed by plain words.
        if (/\d{4,}/.test(ref.replace(/[\s-]/g, ""))) return ref;
      }
    }
    return null;
  }
}
