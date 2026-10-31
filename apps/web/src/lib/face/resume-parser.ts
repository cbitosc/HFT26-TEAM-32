// Client-side resume photo extractor using PDF.js

declare global {
  interface Window {
    pdfjsLib: any;
  }
}

async function loadPdfJs(): Promise<any> {
  if (typeof window === 'undefined') return null;
  if (window.pdfjsLib) return window.pdfjsLib;

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      } else {
        reject(new Error('PDF.js failed to initialize'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load PDF.js'));
    document.head.appendChild(script);
  });
}

/**
 * Extract photo from an uploaded resume file (PDF or direct image)
 * Returns a base64 JPEG data URL, or null if no photo found
 */
export async function extractPhotoFromResumeFile(file: File): Promise<string | null> {
  // If user uploaded an image directly (JPG/PNG)
  if (file.type.startsWith('image/')) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    });
  }

  // If user uploaded a PDF
  if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
    try {
      const pdfjs = await loadPdfJs();
      if (!pdfjs) return null;

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

      let bestImage: string | null = null;
      let bestImageSize = 0;

      const pagesToScan = Math.min(pdf.numPages, 2);

      // Strategy 1: Look for embedded raster images (XObjects)
      for (let pageNum = 1; pageNum <= pagesToScan; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const operatorList = await page.getOperatorList();

        for (let i = 0; i < operatorList.fnArray.length; i++) {
          // 85 = paintImageXObject in PDF.js
          if (operatorList.fnArray[i] === 85) {
            const imgName = operatorList.argsArray[i][0];
            try {
              const img = await page.objs.get(imgName);
              if (img && img.data && img.width && img.height) {
                const size = img.width * img.height;
                // Look for portrait photo dimensions (at least 60x60, not tiny icons)
                if (size >= 3600 && size > bestImageSize) {
                  const canvas = document.createElement('canvas');
                  canvas.width = img.width;
                  canvas.height = img.height;
                  const ctx = canvas.getContext('2d');
                  if (!ctx) continue;

                  const imageData = ctx.createImageData(img.width, img.height);
                  if (img.data.length === img.width * img.height * 4) {
                    imageData.data.set(img.data);
                  } else if (img.data.length === img.width * img.height * 3) {
                    for (let j = 0, k = 0; j < img.data.length; j += 3, k += 4) {
                      imageData.data[k] = img.data[j];
                      imageData.data[k + 1] = img.data[j + 1];
                      imageData.data[k + 2] = img.data[j + 2];
                      imageData.data[k + 3] = 255;
                    }
                  }
                  ctx.putImageData(imageData, 0, 0);
                  bestImage = canvas.toDataURL('image/jpeg', 0.9);
                  bestImageSize = size;
                }
              }
            } catch (e) {
              console.warn('Could not extract image object from page', pageNum, e);
            }
          }
        }
      }

      if (bestImage) {
        return bestImage;
      }

      // Strategy 2: If no XObject image was extracted, render Page 1 to canvas.
      // Face++ Detect API is designed to find faces on full documents/pages!
      const page1 = await pdf.getPage(1);
      const viewport = page1.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        await page1.render({ canvasContext: ctx, viewport }).promise;
        return canvas.toDataURL('image/jpeg', 0.85);
      }
    } catch (err) {
      console.warn('PDF photo extraction failed:', err);
    }
  }

  return null;
}


/**
 * Extract full readable text from an uploaded PDF resume on the client side using PDF.js
 */
export async function extractTextFromPdfClient(file: File): Promise<string> {
  if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
    return '';
  }

  try {
    const pdfjs = await loadPdfJs();
    if (!pdfjs) return '';

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';
    const pagesToScan = Math.min(pdf.numPages, 5);

    for (let pageNum = 1; pageNum <= pagesToScan; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str || '')
        .join(' ');
      fullText += pageText + '\n';
    }

    return fullText.trim();
  } catch (err) {
    console.warn('[PDF Client] Text extraction notice:', err);
    return '';
  }
}
