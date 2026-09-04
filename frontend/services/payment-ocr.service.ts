import type { ExtractedPaymentData, PaymentMethod } from '@/types/payment';

export class PaymentOcrService {
  /**
   * Parses raw OCR text from a payment receipt screenshot (Google Pay, PhonePe, Paytm, BHIM, UPI)
   * and extracts structured financial data with regex pattern matching.
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
      textLower.includes('paid to') ||
      textLower.includes('@yespop') ||
      textLower.includes('@okaxis') ||
      textLower.includes('@okhdfcbank') ||
      textLower.includes('@oksbi') ||
      textLower.includes('@okicici')
    ) {
      paymentMethod = 'gpay';
    } else if (
      textLower.includes('phonepe') ||
      textLower.includes('transfer to') ||
      textLower.includes('@ybl') ||
      textLower.includes('@ibl') ||
      textLower.includes('@axl')
    ) {
      paymentMethod = 'phonepe';
    } else if (
      textLower.includes('paytm') ||
      textLower.includes('money sent to') ||
      textLower.includes('@paytm')
    ) {
      paymentMethod = 'paytm';
    }

    // 2. Extract Amount (e.g. ₹5,000.00, ₹ 5,000, Rs. 5000, R460.00, 5000.00)
    let amount: number | null = null;
    const amountRegexes = [
      /[₹RsINR\s]{1,4}([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i,
      /([0-9]+(?:,[0-9]{3})*\.[0-9]{2})/,
      /(?:paid|amount|transfer|sent)[\s:]*[₹RsINR\s]*([0-9]+(?:\.[0-9]{1,2})?)/i,
      /\b([0-9]{2,7}(?:\.[0-9]{2})?)\b/,
    ];

    for (const rx of amountRegexes) {
      const match = text.match(rx);
      if (match && match[1]) {
        const cleaned = match[1].replace(/,/g, '');
        const val = parseFloat(cleaned);
        if (!isNaN(val) && val > 0 && val < 10000000) {
          amount = val;
          break;
        }
      }
    }

    // 3. Extract Receiver Name
    let receiverName: string | null = null;

    // Search lines around 'paid to', 'to', 'transfer to'
    for (let i = 0; i < lines.length; i++) {
      const lineStr = lines[i] || '';
      const line = lineStr.toLowerCase();
      if (
        line === 'paid to' ||
        line === 'to' ||
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
        if (candidate && !candidate.includes('@') && !/^[0-9+]+$/.test(candidate)) {
          receiverName = candidate;
          break;
        }
      }
    }

    // Fallback search for Banking name:
    if (!receiverName) {
      const bankMatch = text.match(/banking\s+name:?\s*([^\n\r]+)/i);
      if (bankMatch && bankMatch[1]) {
        receiverName = bankMatch[1].trim();
      }
    }

    // Fallback search for paid to pattern
    if (!receiverName) {
      const paidMatch = text.match(/paid\s+to\s*[:\-\n]*([A-Za-z\s]{2,35})/i);
      if (paidMatch && paidMatch[1]) {
        receiverName = paidMatch[1].replace(/\n.*/g, '').trim();
      }
    }

    // 4. Extract UPI ID
    let upiId: string | null = null;
    const upiMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9]+)/i);
    if (upiMatch && upiMatch[1]) {
      upiId = upiMatch[1].trim();
    }

    // 5. Extract Timestamp / Date String
    let timestampStr: string | null = null;
    const dateMatch = text.match(
      /([0-9]{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+[0-9]{4}(?:[,\s]+[0-9]{1,2}:[0-9]{2}\s*(?:am|pm)?)?)/i
    );
    if (dateMatch && dateMatch[1]) {
      timestampStr = dateMatch[1].trim();
    }

    const isPaymentScreenshot = Boolean(
      (amount !== null && (receiverName !== null || upiId !== null)) ||
        textLower.includes('paid to') ||
        textLower.includes('banking name') ||
        textLower.includes('payment successful') ||
        textLower.includes('transaction successful') ||
        textLower.includes('@yespop') ||
        textLower.includes('@okhdfcbank') ||
        textLower.includes('@okaxis') ||
        textLower.includes('@ybl')
    );

    let confidence = 0.5;
    if (amount !== null) confidence += 0.25;
    if (receiverName !== null) confidence += 0.15;
    if (upiId !== null) confidence += 0.1;

    return {
      isPaymentScreenshot,
      amount,
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

    // Strategy 1: OCR.space Cloud OCR API
    try {
      const form = new URLSearchParams();
      if (imageBuffer) {
        form.append('base64Image', `data:image/jpeg;base64,${imageBuffer.toString('base64')}`);
      } else if (imageUrl) {
        form.append('url', imageUrl);
      }
      form.append('apikey', 'helloworld');
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
          console.log('[PaymentOcrService] OCR.space extracted text:', rawText.slice(0, 150));
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
