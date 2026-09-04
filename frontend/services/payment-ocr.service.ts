import type { ExtractedPaymentData, PaymentMethod } from '@/types/payment';

const WORDS_MAP: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
  thousand: 1000,
  lakh: 100000,
  lakhs: 100000,
  lac: 100000,
  lacs: 100000,
  crore: 10000000,
  crores: 10000000,
};

export class PaymentOcrService {
  /**
   * Converts written currency words (e.g. "Rupees Three Hundred Only" -> 300)
   * into a numeric amount.
   */
  public static parseWordsToNumber(text: string): number | null {
    const match = text.match(/(?:rupees?|inr|rs\.?)\s+([a-z\s]+?)(?:\s+only|\.|\n|$)/i);
    if (!match || !match[1]) return null;

    const words = match[1].toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean);
    let total = 0;
    let current = 0;
    let hasValidWord = false;

    for (const w of words) {
      if (WORDS_MAP[w] !== undefined) {
        hasValidWord = true;
        const val = WORDS_MAP[w];
        if (val === 100) {
          current = (current === 0 ? 1 : current) * 100;
        } else if (val === 1000 || val === 100000 || val === 10000000) {
          current = (current === 0 ? 1 : current) * val;
          total += current;
          current = 0;
        } else {
          current += val;
        }
      }
    }
    total += current;
    return hasValidWord && total > 0 ? total : null;
  }

  /**
   * Parses raw OCR text from a payment receipt screenshot (Google Pay, PhonePe, Paytm, BHIM, UPI)
   * and extracts structured financial data with regex pattern matching and cross-validation.
   */
  public static parsePaymentReceiptText(rawText: string): ExtractedPaymentData {
    if (!rawText || rawText.trim().length === 0) {
      return {
        isPaymentScreenshot: false,
        amount: null,
        receiverName: null,
        upiId: null,
        timestampStr: null,
        paymentMethod: 'upi',
        confidence: 0,
        rawText: '',
      };
    }

    const text = rawText.replace(/\r\n/g, '\n');
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const textLower = text.toLowerCase();

    // 1. Detect Payment Method
    let paymentMethod: PaymentMethod = 'upi';
    if (
      textLower.includes('google pay') ||
      textLower.includes('gpay') ||
      textLower.includes('@yespop') ||
      textLower.includes('@okaxis') ||
      textLower.includes('@okhdfcbank') ||
      textLower.includes('@oksbi') ||
      textLower.includes('@okicici')
    ) {
      paymentMethod = 'gpay';
    } else if (
      textLower.includes('phonepe') ||
      textLower.includes('@ybl') ||
      textLower.includes('@ibl') ||
      textLower.includes('@axl')
    ) {
      paymentMethod = 'phonepe';
    } else if (
      textLower.includes('paytm') ||
      textLower.includes('@paytm') ||
      textLower.includes('@ptyes') ||
      textLower.includes('@pthdfc') ||
      textLower.includes('@ptaxis') ||
      textLower.includes('@ptsbi')
    ) {
      paymentMethod = 'paytm';
    }

    // 2. Extract Date & Time FIRST so day numbers (e.g. '2' in '2 September 2026') never get parsed as ₹2 Amount
    let timestampStr: string | null = null;
    const fullDateMatch = text.match(
      /\b([0-3]?[0-9]\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+202[4-9](?:[,\s\-at]+[0-1]?[0-9]:[0-5][0-9]\s*(?:am|pm|AM|PM)?)?)\b/i
    );
    if (fullDateMatch && fullDateMatch[1]) {
      timestampStr = fullDateMatch[1].trim();
    } else {
      const timeMatch = text.match(/\b([0-1]?[0-9]:[0-5][0-9]\s*(?:am|pm|AM|PM))\b/);
      if (timeMatch && timeMatch[1]) {
        timestampStr = timeMatch[1].trim();
      }
    }

    // Strip date strings and time strings to prevent day of month or hours from matching as amount
    const textWithoutDates = text
      .replace(/\b[0-3]?[0-9]\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+202[4-9]\b/gi, '')
      .replace(/\b[0-1]?[0-9]:[0-5][0-9]\s*(?:am|pm|AM|PM)\b/gi, '');

    // 3. Extract Amount (Cross-validated against written words & digits)
    const wordsAmount = this.parseWordsToNumber(text);

    let digitsAmount: number | null = null;
    const amountRegexes = [
      // Handles ?45,000.00, ₹45,000.00, Rs. 45,000.00, 45,000.00, 45,000
      /[?₹RsINR\s]*([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?)/i,
      /(?:amount|paid|total|sent)[\s:\n]*[?₹RsINR\s]*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i,
      /[?₹RsINR]\s*([0-9]+(?:\.[0-9]{1,2})?)/i,
      /\b([0-9]+(?:\.[0-9]{2}))\b/,
      /\b([0-9]{2,7})\b/,
    ];

    for (const rx of amountRegexes) {
      const match = textWithoutDates.match(rx);
      if (match && match[1]) {
        const cleaned = match[1].replace(/,/g, '');
        const val = parseFloat(cleaned);
        if (!isNaN(val) && val > 0 && val < 10000000) {
          digitsAmount = val;
          break;
        }
      }
    }

    // Amount priority: Written words ("Rupees Three Hundred Only") is highest ground truth
    let finalAmount: number | null = null;
    if (wordsAmount !== null && wordsAmount > 0) {
      finalAmount = wordsAmount;
    } else if (digitsAmount !== null) {
      // Fix common OCR artifact where Indian Rupee symbol '₹' is misread as digit '7' (e.g. ₹300 -> 7300)
      if (digitsAmount >= 7000 && digitsAmount < 8000) {
        const sub = digitsAmount - 7000;
        if (sub > 0 && sub < 1000 && text.includes(String(sub))) {
          finalAmount = sub;
        } else {
          finalAmount = digitsAmount;
        }
      } else {
        finalAmount = digitsAmount;
      }
    }

    // 4. Extract Receiver Name
    let receiverName: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const lineStr = lines[i] || '';
      const line = lineStr.toLowerCase();
      if (
        line === 'to' ||
        line === 'paid to' ||
        line === 'transfer to' ||
        line === 'transferred to' ||
        line.startsWith('paid to ') ||
        line.startsWith('transfer to ') ||
        line.startsWith('transferred to ')
      ) {
        let candidate = '';
        if (line.startsWith('paid to ') || line.startsWith('transfer to ') || line.startsWith('transferred to ')) {
          candidate = lineStr.substring(line.indexOf('to') + 2).trim();
        } else if (lines[i + 1]) {
          candidate = (lines[i + 1] || '').trim();
        }

        // Clean candidate
        candidate = candidate.replace(/^banking name:?\s*/i, '').trim();
        if (candidate && !candidate.includes('@') && !/^[0-9+]+$/.test(candidate) && !candidate.toLowerCase().includes('upi')) {
          receiverName = candidate;
          break;
        }
      }
    }

    // Fallback: search for Banking name
    if (!receiverName) {
      const bankMatch = text.match(/banking\s+name:?\s*([^\n\r]+)/i);
      if (bankMatch && bankMatch[1]) {
        receiverName = bankMatch[1].trim();
      }
    }

    // Fallback: search for 'paid to' pattern
    if (!receiverName) {
      const paidMatch = text.match(/paid\s+to\s*[:\-\n]*([A-Za-z\s]{2,35})/i);
      if (paidMatch && paidMatch[1]) {
        receiverName = paidMatch[1].replace(/\n.*/g, '').trim();
      }
    }

    // 5. Extract UPI ID
    let upiId: string | null = null;
    const upiMatch = text.match(/([a-zA-Z0-9._*#-]+@[a-zA-Z0-9]+)/i);
    if (upiMatch && upiMatch[1]) {
      upiId = upiMatch[1].trim();
    }

    const isPaymentScreenshot = Boolean(
      (finalAmount !== null && (receiverName !== null || upiId !== null)) ||
        textLower.includes('paid to') ||
        textLower.includes('banking name') ||
        textLower.includes('payment successful') ||
        textLower.includes('transaction successful') ||
        textLower.includes('pay again') ||
        textLower.includes('view history') ||
        textLower.includes('@yespop') ||
        textLower.includes('@okhdfcbank') ||
        textLower.includes('@okaxis') ||
        textLower.includes('@ptyes') ||
        textLower.includes('@pthdfc') ||
        textLower.includes('@ybl')
    );

    let confidence = 0.5;
    if (finalAmount !== null) confidence += 0.25;
    if (receiverName !== null) confidence += 0.15;
    if (upiId !== null) confidence += 0.1;

    return {
      isPaymentScreenshot,
      amount: finalAmount,
      receiverName: receiverName ? receiverName.replace(/\n.*/g, '').trim() : null,
      upiId,
      timestampStr,
      paymentMethod,
      confidence: Math.min(confidence, 1.0),
      rawText,
    };
  }

  /**
   * Calls Cloud OCR (OCR.Space) / Tesseract.js to extract text from a payment image.
   */
  public static async extractPaymentFromImage(
    imageUrl: string,
    imageBuffer?: Buffer
  ): Promise<ExtractedPaymentData> {
    let rawText = '';

    // Strategy 1: OCR.space Cloud OCR API with scale & auto-engine
    try {
      const form = new URLSearchParams();
      if (imageBuffer) {
        form.append('base64Image', `data:image/jpeg;base64,${imageBuffer.toString('base64')}`);
      } else if (imageUrl) {
        form.append('url', imageUrl);
      }
      form.append('apikey', 'helloworld');
      form.append('scale', 'true');
      form.append('detectOrientation', 'true');
      form.append('OCREngine', '2');

      const ocrRes = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form,
      });

      if (ocrRes.ok) {
        const ocrData = await ocrRes.json();
        if (ocrData.ParsedResults && ocrData.ParsedResults.length > 0) {
          rawText = ocrData.ParsedResults[0].ParsedText || '';
          console.log('[PaymentOcrService] OCR.space (Engine 2) extracted text:', rawText.slice(0, 150));
        }
      }
    } catch (ocrErr) {
      console.warn('[PaymentOcrService] OCR.space API failed, attempting local Tesseract OCR:', ocrErr);
    }

    // Strategy 2: Tesseract.js local fallback if OCR.space produced empty result
    if (!rawText && imageBuffer) {
      try {
        const { createWorker } = await import('tesseract.js');
        const worker = await createWorker('eng');
        const ret = await worker.recognize(imageBuffer);
        await worker.terminate();
        rawText = ret.data.text || '';
        console.log('[PaymentOcrService] Tesseract.js extracted text:', rawText.slice(0, 150));
      } catch (tessErr) {
        console.warn('[PaymentOcrService] Tesseract.js local OCR error:', tessErr);
      }
    }

    // Parse extracted text
    if (rawText && rawText.trim().length > 0) {
      return this.parsePaymentReceiptText(rawText);
    }

    // Fallback if OCR completely failed
    return {
      isPaymentScreenshot: true,
      amount: null,
      receiverName: null,
      upiId: null,
      timestampStr: null,
      paymentMethod: 'upi',
      confidence: 0,
      rawText: '',
    };
  }

  /**
   * Client-side OCR extract from base64 string
   */
  public static async extractPaymentFromBase64(base64Data: string): Promise<ExtractedPaymentData> {
    const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    const buf = Buffer.from(cleanBase64 || '', 'base64');
    return this.extractPaymentFromImage('', buf);
  }

  /**
   * Helper to normalize 10-digit Indian phone numbers for comparison
   */
  public static normalizePhone(phone: string): string {
    if (!phone) return '';
    const clean = phone.replace(/[^0-9]/g, '');
    if (clean.length > 10) return clean.slice(-10);
    return clean;
  }
}
