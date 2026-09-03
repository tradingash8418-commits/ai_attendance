import { NextRequest, NextResponse } from 'next/server';
import { WebhookProcessorServer } from '@/services/webhook-processor.server';

/**
 * POST /api/webhooks/simulate-whatsapp
 * Local developer simulation route for testing WhatsApp group photo processing end-to-end.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const senderNumber = body.senderNumber || '+918418082692';
    const mockMessageId = `sim_msg_${Date.now()}`;

    const simulatedPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '1738385663951266',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '15552037574',
                  phone_number_id: '1330066433517275',
                },
                contacts: [
                  {
                    profile: { name: 'Rohit shukla' },
                    wa_id: senderNumber.replace(/\+/g, ''),
                  },
                ],
                messages: [
                  {
                    from: senderNumber.replace(/\+/g, ''),
                    id: mockMessageId,
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    type: 'image',
                    image: {
                      mime_type: 'image/jpeg',
                      id: `media_${Date.now()}`,
                    },
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    };

    console.log('[Simulate WhatsApp Webhook] Processing simulated group photo webhook payload...');
    const result = await WebhookProcessorServer.processPayload(simulatedPayload);

    return NextResponse.json({
      success: true,
      result,
    }, { status: 200 });

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Simulation failed';
    console.error('[Simulate WhatsApp Webhook Error]:', err);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
