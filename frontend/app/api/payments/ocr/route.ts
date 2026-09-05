import { NextRequest, NextResponse } from 'next/server';
import { PaymentOcrService } from '@/services/payment-ocr.service';

/**
 * POST /api/payments/ocr
 * Server-side high-accuracy Payment Receipt OCR & Gemini Vision analyzer.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageBase64, imageUrl, mimeType } = body;

    if (!imageBase64 && !imageUrl) {
      return NextResponse.json(
        { error: 'imageBase64 or imageUrl is required' },
        { status: 400 }
      );
    }

    let buffer: Buffer | null = null;
    let cleanMime = mimeType || 'image/jpeg';

    if (imageBase64) {
      if (imageBase64.startsWith('data:application/pdf')) {
        cleanMime = 'application/pdf';
      }
      const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
      buffer = Buffer.from(cleanBase64, 'base64');
    }

    const result = await PaymentOcrService.extractPaymentFromImage(imageUrl || '', buffer, cleanMime);

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('[API /api/payments/ocr] Error processing receipt:', error);
    return NextResponse.json(
      {
        isPaymentScreenshot: false,
        amount: null,
        receiverName: null,
        upiId: null,
        timestampStr: null,
        paymentMethod: 'upi',
        confidence: 0,
        rawText: '',
        error: error?.message || 'Failed to analyze payment receipt',
      },
      { status: 500 }
    );
  }
}
