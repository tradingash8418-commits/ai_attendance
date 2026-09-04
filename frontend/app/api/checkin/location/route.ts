import { NextRequest, NextResponse } from 'next/server';
import { SitesService } from '@/services/sites.service';
import { PendingCheckinService } from '@/services/pending-checkin.service';
import { calculateHaversineDistance } from '@/lib/geoutils';
import { normalizeWhatsAppNumber } from '@/lib/formatters';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const siteToken = (body.siteToken || '').trim();
    const rawLat = parseFloat(body.latitude);
    const rawLon = parseFloat(body.longitude);

    if (!siteToken) {
      return NextResponse.json(
        { verified: false, error: 'MISSING_SITE_TOKEN', message: 'Site token is required.' },
        { status: 400 }
      );
    }

    if (isNaN(rawLat) || isNaN(rawLon)) {
      return NextResponse.json(
        { verified: false, error: 'INVALID_COORDINATES', message: 'Valid GPS coordinates are required.' },
        { status: 400 }
      );
    }

    // 1. Resolve site by token
    const site = await SitesService.getSiteByCheckInToken(siteToken);
    if (!site) {
      return NextResponse.json(
        { verified: false, error: 'SITE_NOT_FOUND', message: 'Construction site not found.' },
        { status: 404 }
      );
    }

    if (!site.active) {
      return NextResponse.json(
        { verified: false, error: 'SITE_INACTIVE', message: 'Check-in is currently unavailable for this site.' },
        { status: 403 }
      );
    }

    // 2. Verify site has location configured
    if (site.latitude === undefined || site.latitude === null || site.longitude === undefined || site.longitude === null) {
      return NextResponse.json(
        {
          verified: false,
          error: 'LOCATION_NOT_CONFIGURED',
          message: 'Site location is not configured. Please contact the supervisor.',
        },
        { status: 422 }
      );
    }

    const radiusMeters = site.radiusMeters || 150;
    const distanceMeters = calculateHaversineDistance(rawLat, rawLon, site.latitude, site.longitude);

    console.log(
      `[Checkin Location API] Worker at (${rawLat.toFixed(6)}, ${rawLon.toFixed(6)}) vs ` +
      `Site "${site.name}" at (${site.latitude.toFixed(6)}, ${site.longitude.toFixed(6)}) -> ` +
      `Distance: ${distanceMeters}m, Allowed Radius: ${radiusMeters}m`
    );

    // 3. Server-side Geofence Decision
    if (distanceMeters > radiusMeters) {
      return NextResponse.json({
        verified: false,
        error: 'OUTSIDE_GEOFENCE',
        message: "You're outside the allowed site area.",
        distanceMeters,
        radiusMeters,
        siteName: site.name,
      });
    }

    // 4. Create short-lived pending checkin session (10-min TTL)
    const pendingSession = await PendingCheckinService.createPendingCheckin({
      siteId: site.id,
      siteToken: site.checkInToken || siteToken,
      latitude: rawLat,
      longitude: rawLon,
      distanceMeters,
    });

    // 5. Construct official WhatsApp click-to-chat URL
    const rawBotNumber = process.env.META_WHATSAPP_PHONE_NUMBER_ID || process.env.WHATSAPP_BOT_NUMBER || '919876543210';
    const cleanBotPhone = normalizeWhatsAppNumber(rawBotNumber);
    const prefilledText = encodeURIComponent(`CHECKIN_${pendingSession.token}`);
    const whatsappUrl = `https://wa.me/${cleanBotPhone}?text=${prefilledText}`;

    return NextResponse.json({
      verified: true,
      siteName: site.name,
      siteAddress: site.address || '',
      distanceMeters,
      radiusMeters,
      checkInToken: pendingSession.token,
      whatsappUrl,
    });
  } catch (err: any) {
    console.error('[Checkin Location API Error]:', err);
    return NextResponse.json(
      { verified: false, error: 'SERVER_ERROR', message: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
