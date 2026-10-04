import { NextRequest, NextResponse } from 'next/server';
import { OrgContextService } from '@/services/org-context.service';
import { supabase } from '@/lib/supabase';
import { setDoc, serverTimestamp } from 'firebase/firestore';

const SETTINGS_COLLECTION = 'settings';
const WHATSAPP_SETTINGS_DOC = 'whatsapp';

/**
 * GET /api/company/header-logo
 * Retrieves active company WhatsApp header logo URL from Firestore settings
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId') || OrgContextService.getOrgId();

    const docRes = await OrgContextService.getDocWithFallback(SETTINGS_COLLECTION, WHATSAPP_SETTINGS_DOC, orgId);
    const headerImageUrl = docRes.data?.headerImageUrl || process.env.WHATSAPP_HEADER_IMAGE_URL || 'https://ai-attendance-flax.vercel.app/icon.png';

    return NextResponse.json({
      success: true,
      headerImageUrl,
      updatedAt: docRes.data?.updatedAt || null,
    });
  } catch (error: any) {
    console.error('[API /api/company/header-logo GET] Error fetching header logo:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/company/header-logo
 * Uploads company logo image file to Supabase Cloud Storage and saves public HTTPS URL to Firestore
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const orgId = (formData.get('orgId') as string) || OrgContextService.getOrgId();

    if (!file) {
      return NextResponse.json({ success: false, error: 'No image file provided' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const ext = file.name.split('.').pop() || 'png';
    const cleanExt = ext.toLowerCase().replace(/[^a-z0-9]/g, '');
    const fileName = `company_header_${Date.now()}.${cleanExt}`;
    const filePath = `company_logos/${fileName}`;
    const mimeType = file.type || 'image/png';

    // Upload to Supabase Cloud Storage
    const { error: uploadError } = await supabase.storage
      .from('attendance-photos')
      .upload(filePath, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      console.error('[API /api/company/header-logo POST] Supabase upload error:', uploadError);
      return NextResponse.json({ success: false, error: uploadError.message }, { status: 500 });
    }

    // Get public HTTPS URL
    const { data: publicUrlData } = supabase.storage.from('attendance-photos').getPublicUrl(filePath);
    const publicUrl = publicUrlData.publicUrl;

    // Save public URL to Firestore Settings for active Organization
    const docRef = OrgContextService.getDocRef(SETTINGS_COLLECTION, WHATSAPP_SETTINGS_DOC, orgId);
    await setDoc(
      docRef,
      {
        headerImageUrl: publicUrl,
        updatedAt: serverTimestamp(),
        updatedBy: 'admin',
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      headerImageUrl: publicUrl,
      message: 'Company header logo uploaded and active for Meta WhatsApp templates!',
    });
  } catch (error: any) {
    console.error('[API /api/company/header-logo POST] Error uploading header logo:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
