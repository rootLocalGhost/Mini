import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure local worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export interface PageRenderResult {
  pageNumber: number;
  totalPages: number;
  imageBytes: Uint8Array;
  previewDataUrl: string;
  width: number;
  height: number;
}

export async function convertPdf(
  data: Uint8Array,
  options: {
    scale: number;
    format: 'png' | 'jpg';
    jpegQuality: number;
  },
  onProgress?: (current: number, total: number, previewUrl?: string) => void
): Promise<PageRenderResult[]> {
  // Use local cmaps and standard fonts for 100% offline, faithful glyph and font rendering
  const loadingTask = pdfjsLib.getDocument({
    data: data.slice(),
    cMapUrl: './cmaps/',
    cMapPacked: true,
    standardFontDataUrl: './standard_fonts/',
    enableXfa: true,
    useSystemFonts: true,
    isEvalSupported: false,
  });

  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;
  const results: PageRenderResult[] = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: options.scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      throw new Error(`Failed to create 2D canvas context for page ${pageNum}`);
    }

    // High quality raster settings
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Solid white background for consistent document look
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Render with print intent and all annotations/form fields enabled
    await page.render({
      canvasContext: ctx,
      viewport: viewport,
      intent: 'print',
      annotationMode: pdfjsLib.AnnotationMode.ENABLE_FORMS,
    }).promise;

    const mimeType = options.format === 'jpg' ? 'image/jpeg' : 'image/png';
    const quality = options.format === 'jpg' ? options.jpegQuality : undefined;

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error(`Failed to convert canvas to blob for page ${pageNum}`));
        },
        mimeType,
        quality
      );
    });

    const arrayBuffer = await blob.arrayBuffer();
    const imageBytes = new Uint8Array(arrayBuffer);

    // Thumbnail for live UI feedback
    const previewDataUrl = canvas.toDataURL('image/jpeg', 0.45);

    results.push({
      pageNumber: pageNum,
      totalPages,
      imageBytes,
      previewDataUrl,
      width: canvas.width,
      height: canvas.height,
    });

    if (onProgress) {
      onProgress(pageNum, totalPages, previewDataUrl);
    }
  }

  return results;
}
