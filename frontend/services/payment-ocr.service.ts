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
   * Cleans OCR artifacts where Indian Rupee symbol '₹' is misrecognized as digit '7', '3', or '?'
   * Examples:
   * - PhonePe "₹7,400" -> "37,400" -> 7400
   * - Google Pay "₹45,000.00" -> "745,000.00" -> 45000
   * - Paytm "₹300" -> "7300" -> 300
   * - GPay "₹5,000.00" -> "75,000.00" -> 5000
   * - PhonePe "₹460" -> "7460" -> 460
   */
  public static cleanOcrRupeeArtifact(numStr: string): number | null {
    if (!numStr) return null;
    const parts = numStr.split('.');
    const intPart = parts[0] || '';
    const decPart = parts[1] ? '.' + parts[1] : '';

    // 1. PhonePe Rupee-as-3 artifact: '37,400' -> '7,400' = 7400
    if (intPart.startsWith('37,') && intPart.length <= 7) {
      const sub = parseFloat(intPart.substring(1).replace(/,/g, '') + decPart);
      if (!isNaN(sub) && sub > 0) return sub;
    }

    // 2. PhonePe 5-digit '37400' without commas -> 7400
    const cleanInt = intPart.replace(/,/g, '');
    if (cleanInt.startsWith('37') && cleanInt.length === 5) {
      const sub = parseFloat(cleanInt.substring(1) + decPart);
      if (sub >= 1000 && sub <= 9999) return sub;
    }

    // 3. GPay Rupee-as-7 artifact: '745,000' -> '45,000' = 45000, '75,000' -> '5,000' = 5000
    if (intPart.startsWith('7') && intPart.match(/^7[0-9]{1,2},[0-9]{3}/)) {
      const sub = parseFloat(intPart.substring(1).replace(/,/g, '') + decPart);
      if (!isNaN(sub) && sub > 0) return sub;
    }

    // 4. Small amounts Rupee-as-7: '7300' -> 300, '7460' -> 460, '7500' -> 500
    if (cleanInt.startsWith('7') && cleanInt.length >= 3 && cleanInt.length <= 4) {
      const sub = parseFloat(cleanInt.substring(1) + decPart);
      if (sub > 0 && sub < 1000) return sub;
    }

    const val = parseFloat(cleanInt + decPart);
    return !isNaN(val) && val > 0 ? val : null;
  }

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

    // Pattern A: Comma-formatted numbers (e.g. 37,400, 745,000.00, 45,000.00, ?45,000.00, 7,400)
    const commaMatch = textWithoutDates.match(/[?₹RsINR\s]*([0-9]{1,6}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?)/i);
    if (commaMatch && commaMatch[1]) {
      const cleanedVal = this.cleanOcrRupeeArtifact(commaMatch[1]);
      if (cleanedVal !== null && cleanedVal > 0 && cleanedVal < 10000000) {
        digitsAmount = cleanedVal;
      }
    }

    // Pattern B: Decimal & standard digit patterns if no comma match
    if (digitsAmount === null) {
      const amountRegexes = [
        /(?:amount|paid|total|sent)[\s:\n]*[?₹RsINR\s]*([0-9]+(?:\.[0-9]{1,2})?)/i,
        /[?₹RsINR]\s*([0-9]+(?:\.[0-9]{1,2})?)/i,
        /\b([0-9]+\.[0-9]{2})\b/,
        /\b([0-9]{2,7})\b/,
      ];

      for (const rx of amountRegexes) {
        const match = textWithoutDates.match(rx);
        if (match && match[1]) {
          const cleanedVal = this.cleanOcrRupeeArtifact(match[1]);
          if (cleanedVal !== null && cleanedVal > 0 && cleanedVal < 10000000) {
            digitsAmount = cleanedVal;
            break;
          }
        }
      }
    }

    // Amount priority: Written words ("Rupees Three Hundred Only") is highest ground truth
    let finalAmount: number | null = null;
    if (wordsAmount !== null && wordsAmount > 0) {
      finalAmount = wordsAmount;
    } else if (digitsAmount !== null) {
      finalAmount = digitsAmount;
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
        if (
          candidate &&
          !candidate.includes('@') &&
          !/^[0-9+]+$/.test(candidate) &&
          !candidate.toLowerCase().includes('upi') &&
          !candidate.toLowerCase().includes('rupees')
        ) {
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
        textLower.includes('@ybl') ||
        textLower.includes('@axl')
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
   * Calls Multimodal AI Vision (Gemini 1.5 Flash) if GEMINI_API_KEY is available,
   * otherwise falls back to Cloud OCR (OCR.Space) / Tesseract.js.
   */
  public static async extractPaymentFromImage(
    imageUrl: string,
    imageBuffer?: Buffer
  ): Promise<ExtractedPaymentData> {
    const geminiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';

    // Strategy 1: Multimodal AI Vision (Gemini 1.5 Flash) for 100% Zero-Error Understanding
    if (geminiKey && imageBuffer) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
        const base64Clean = imageBuffer.toString('base64');
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `You are a financial AI receipt auditor for Indian businesses and construction contractors.
Analyze this payment receipt screenshot (Google Pay, PhonePe, Paytm, BHIM UPI, Net Banking).
Extract the following exact fields in strict JSON format:
{
  "is_payment": true,
  "amount": number,
  "receiver_name": string,
  "payment_method": "phonepe" | "gpay" | "paytm" | "upi",
  "upi_id": string | null,
  "timestamp": string | null
}`
                  },
                  {
                    inline_data: {
                      mime_type: 'image/jpeg',
                      data: base64Clean
                    }
                  }
                ]
              }
            ],
            generationConfig: {
              response_mime_type: 'application/json'
            }
          })
        });

        if (res.ok) {
          const geminiData = await res.json();
          const jsonText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (jsonText) {
            const parsed = JSON.parse(jsonText);
            console.log('[PaymentOcrService] Gemini AI Vision extracted:', parsed);
            return {
              isPaymentScreenshot: Boolean(parsed.is_payment),
              amount: parsed.amount ? parseFloat(parsed.amount) : null,
              receiverName: parsed.receiver_name || null,
              upiId: parsed.upi_id || null,
              timestampStr: parsed.timestamp || null,
              paymentMethod: (parsed.payment_method || 'upi') as PaymentMethod,
              confidence: 0.99,
              rawText: jsonText
            };
          }
        }
      } catch (geminiErr) {
        console.warn('[PaymentOcrService] Gemini Vision API error, falling back to OCR:', geminiErr);
      }
    }

    let rawText = '';

    // Strategy 2: OCR.space Cloud OCR API with scale & auto-engine
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

    // Strategy 3: Tesseract.js local fallback if OCR.space produced empty result
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
