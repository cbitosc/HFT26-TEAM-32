import { NextRequest, NextResponse } from 'next/server';
import { uploadToCloudinaryServer } from '@/lib/face/server';

/**
 * Extract profile image URL from a portfolio/GitHub page
 */
async function extractImageFromUrl(portfolioUrl: string): Promise<string | null> {
  try {
    const urlObj = new URL(portfolioUrl);
    const host = urlObj.hostname.toLowerCase();

    // GitHub direct avatar
    if (host === 'github.com') {
      const username = urlObj.pathname.split('/').filter(Boolean)[0];
      if (username) return `https://github.com/${username}.png?size=400`;
    }

    // Try fetching page and finding og:image or profile images
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(portfolioUrl)}`;
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
    const html = await res.text();

    // Open Graph image
    const ogMatch = html.match(/<meta\s+(?:property|name)="og:image"\s+content="([^"]+)"/i);
    if (ogMatch?.[1]) return ogMatch[1];

    // Twitter image
    const twMatch = html.match(/<meta\s+(?:property|name)="twitter:image"\s+content="([^"]+)"/i);
    if (twMatch?.[1]) return twMatch[1];

    // Profile image patterns
    const imgPatterns = [
      /src="([^"]*(?:avatar|profile|headshot|photo)[^"]*)"/i,
      /src="([^"]*(?:\.jpg|\.jpeg|\.png|\.webp)[^"]*)"/i,
    ];
    for (const pattern of imgPatterns) {
      const match = html.match(pattern);
      if (match?.[1] && !match[1].includes('icon') && !match[1].includes('favicon') && !match[1].includes('logo')) {
        try {
          return new URL(match[1], portfolioUrl).href;
        } catch {
          return match[1];
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let photoUrl: string | null = null;
    let source = 'unknown';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const portfolioUrl = formData.get('portfolioUrl') as string | null;

      if (file && file.type.startsWith('image/')) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const base64 = `data:${file.type};base64,${buffer.toString('base64')}`;
        const cloudResult = await uploadToCloudinaryServer(base64);
        photoUrl = cloudResult.url;
        source = 'direct_upload';
      } else if (portfolioUrl) {
        const extracted = await extractImageFromUrl(portfolioUrl);
        if (!extracted) {
          return NextResponse.json({
            success: false,
            error: 'Could not find a profile photo on that URL. Please upload a photo directly.',
            requiresManualPhoto: true,
          }, { status: 400 });
        }
        const cloudResult = await uploadToCloudinaryServer(extracted);
        photoUrl = cloudResult.url;
        source = 'portfolio_url';
      }
    } else {
      const body = await req.json();
      if (body.portfolioUrl) {
        const extracted = await extractImageFromUrl(body.portfolioUrl);
        if (!extracted) {
          return NextResponse.json({
            success: false,
            error: 'Could not find a profile photo on that URL.',
            requiresManualPhoto: true,
          }, { status: 400 });
        }
        const cloudResult = await uploadToCloudinaryServer(extracted);
        photoUrl = cloudResult.url;
        source = 'portfolio_url';
      } else if (body.base64Image) {
        const cloudResult = await uploadToCloudinaryServer(body.base64Image);
        photoUrl = cloudResult.url;
        source = 'base64_upload';
      }
    }

    if (!photoUrl) {
      return NextResponse.json({ success: false, error: 'No image provided' }, { status: 400 });
    }

    return NextResponse.json({ success: true, photoUrl, source });
  } catch (err: any) {
    console.error('[Extract Photo] Error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Photo extraction failed' }, { status: 500 });
  }
}
