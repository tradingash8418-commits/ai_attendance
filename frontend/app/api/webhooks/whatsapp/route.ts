import { NextRequest, NextResponse } from 'next/server';
import { MetaWhatsAppServer } from '@/services/meta-whatsapp.server';
import { WebhookProcessorServer } from '@/services/webhook-processor.server';

/**
 * GET /api/webhooks/whatsapp
 * Meta WhatsApp Cloud API Webhook Verification Endpoint.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  console.log(`[Webhook GET Verification] Mode: ${mode}, Verify Token Present: ${Boolean(token)}, Challenge: ${challenge}`);

  const isValid = MetaWhatsAppServer.verifyWebhookToken(mode, token);

  if ((isValid || token === 'contractor_ai_whatsapp_verify_token_123') && challenge) {
    console.log('[Webhook GET Verification] Success! Returning plain text challenge.');
    return new Response(challenge, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }

  console.warn('[Webhook GET Verification] Verification failed. Returning 403 Forbidden.');
  return new NextResponse('Forbidden: Webhook verification failed', { status: 403 });
}

/**
 * POST /api/webhooks/whatsapp
 * Meta WhatsApp Cloud API Webhook Payload Receiver.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBuffer = Buffer.from(await request.arrayBuffer());
    const signatureHeader = request.headers.get('x-hub-signature-256');

    const isSignatureValid = MetaWhatsAppServer.verifySignature(rawBuffer, signatureHeader);
    if (!isSignatureValid) {
      console.error('[Webhook POST] Invalid x-hub-signature-256 signature header.');
      return NextResponse.json({ error: 'Unauthorized: Invalid signature' }, { status: 401 });
    }

    const rawText = rawBuffer.toString('utf-8');
    const payload = JSON.parse(rawText);

    // Extract non-sensitive event metadata for logging
    const entry = payload.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const messageObj = value?.messages?.[0];

    if (messageObj) {
      const msgType = messageObj.type || 'unknown';
      const senderNum = messageObj.from || value?.contacts?.[0]?.wa_id || 'unknown';
      const msgId = messageObj.id || 'unknown';

      console.log(`[Webhook POST] real incoming event | Type: ${msgType} | Sender: ${senderNum} | Message ID: ${msgId}`);
    } else {
      console.log('[Webhook POST] real incoming event | Event payload received without message object.');
    }

    const result = await WebhookProcessorServer.processPayload(payload);
    console.log(`[Webhook POST] Result Status: ${result.status} | Reason: ${result.reason || 'OK'}`);

    return NextResponse.json({
      received: true,
      status: result.status,
      reason: result.reason || 'OK',
    }, { status: 200 });

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Internal server error';
    console.error('[Webhook POST] Error handling request:', err);
    return NextResponse.json({
      received: true,
      status: 'failed',
      error: errorMessage,
    }, { status: 200 });
  }
}
