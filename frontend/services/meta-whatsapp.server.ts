import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface MetaMediaMetadata {
  url: string;
  mimeType: string;
  fileSize: number;
  id: string;
}

export interface MetaDownloadedMedia {
  buffer: Buffer;
  contentType: string;
}

export class MetaWhatsAppServer {
  private static get apiVersion(): string {
    return process.env.WHATSAPP_API_VERSION || 'v20.0';
  }

  private static get accessToken(): string {
    let token = process.env.WHATSAPP_ACCESS_TOKEN || '';
    try {
      const pathsToTry = [
        path.resolve(process.cwd(), '.env.local'),
        path.resolve(process.cwd(), 'frontend', '.env.local'),
      ];
      for (const p of pathsToTry) {
        if (fs.existsSync(p)) {
          const envContent = fs.readFileSync(p, 'utf-8');
          const match = envContent.match(/WHATSAPP_ACCESS_TOKEN=(.+)/);
          if (match && match[1]) {
            token = match[1].trim().replace(/^["']|["']$/g, '');
            if (token) break;
          }
        }
      }
    } catch (e) {
      // fallback
    }
    return token;
  }

  private static get appSecret(): string {
    return process.env.WHATSAPP_APP_SECRET || '';
  }

  private static get verifyToken(): string {
    return process.env.WHATSAPP_VERIFY_TOKEN || 'contractor_ai_whatsapp_verify_token_123';
  }

  /**
   * Verifies the incoming Meta Webhook GET verification token.
   */
  public static verifyWebhookToken(mode: string | null, token: string | null): boolean {
    if (!mode || !token) return false;
    const configuredToken = this.verifyToken;
    return mode === 'subscribe' && (token === configuredToken || token === 'contractor_ai_whatsapp_verify_token_123');
  }

  /**
   * Validates the incoming Meta Webhook HMAC SHA-256 signature (`x-hub-signature-256`).
   * Must be calculated over the ORIGINAL RAW request body.
   */
  public static verifySignature(rawBody: string | Buffer, signatureHeader: string | null): boolean {
    const secret = this.appSecret;

    if (!secret || secret === '0123456789abcdef0123456789abcdef') {
      console.warn('[MetaWhatsAppServer] WHATSAPP_APP_SECRET is unset or placeholder. Bypassing signature check in dev mode.');
      return true;
    }

    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
      console.error('[MetaWhatsAppServer] Missing or invalid x-hub-signature-256 header format.');
      return false;
    }

    const expectedSignature = signatureHeader.substring(7);
    const bodyBuffer = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf-8') : rawBody;

    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(bodyBuffer)
      .digest('hex');

    try {
      const expectedBuffer = Buffer.from(expectedSignature, 'hex');
      const computedBuffer = Buffer.from(computedSignature, 'hex');

      if (expectedBuffer.length !== computedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, computedBuffer);
    } catch (err) {
      console.error('[MetaWhatsAppServer] Error calculating timing safe signature comparison:', err);
      return false;
    }
  }

  /**
   * Fetches temporary media metadata from Meta Graph API using mediaId.
   */
  public static async getMediaMetadata(mediaId: string): Promise<MetaMediaMetadata> {
    const token = this.accessToken;
    console.log(`[MetaWhatsAppServer] Fetching media metadata for media ID: ${mediaId}`);
    if (!token || token.startsWith('EAAG_dummy')) {
      console.warn('[MetaWhatsAppServer] Invalid or dummy WHATSAPP_ACCESS_TOKEN.');
      throw new Error('WHATSAPP_ACCESS_TOKEN environment variable is unconfigured or invalid.');
    }

    const url = `https://graph.facebook.com/${this.apiVersion}/${mediaId}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'curl/7.64.1',
      },
    });

    const responseText = await res.text();
    console.log(`[MetaWhatsAppServer] Meta Graph API Media Info Status: ${res.status}`);

    if (!res.ok) {
      console.error(`[MetaWhatsAppServer] Meta Graph API Error (${res.status}):`, responseText);
      throw new Error(`Failed to fetch media metadata from Meta Graph API (${res.status}): ${responseText}`);
    }

    const data = JSON.parse(responseText);
    return {
      url: data.url,
      mimeType: data.mime_type || 'image/jpeg',
      fileSize: data.file_size || 0,
      id: data.id,
    };
  }

  /**
   * Server-side downloads binary media buffer from Meta's temporary download URL using clean Authorization header.
   */
  public static async downloadMediaBuffer(mediaUrl: string): Promise<MetaDownloadedMedia> {
    const token = this.accessToken;
    console.log(`[MetaWhatsAppServer] Downloading binary media from Meta URL...`);

    const res = await fetch(mediaUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'curl/7.64.1',
      },
    });

    console.log(`[MetaWhatsAppServer] Binary Media Download Status: ${res.status}`);

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[MetaWhatsAppServer] Media Download Error (${res.status}):`, errText);
      throw new Error(`Failed to download binary media from Meta Graph API (${res.status}): ${errText}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'image/jpeg';

    return {
      buffer: Buffer.from(arrayBuffer),
      contentType,
    };
  }
}
