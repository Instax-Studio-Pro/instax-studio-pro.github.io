/**
 * Instax Studio Pro - Export Engine
 * Handles image export (JPG, PNG, PDF), collage creation, and print mode
 */

const ExportEngine = (() => {
  // Instax film dimensions in mm (for print scaling)
  const FILM_SIZES = {
    mini: { filmW: 54, filmH: 86, imgW: 46, imgH: 62 },
    square: { filmW: 62, filmH: 62, imgW: 50, imgH: 50 },
    wide: { filmW: 108, filmH: 86, imgW: 99, imgH: 62 },
  };

  function generateTimestamp() {
    return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  }

  /**
   * Draw an Instax frame around an image on a canvas
   * @param {HTMLCanvasElement} canvas - Source image canvas
   * @param {string} filmType - Type of film (mini, square, wide)
   * @param {Object} options - Drawing options
   * @param {boolean} options.showDust - Show film dust overlay
   * @param {boolean} options.showDate - Show date stamp
   * @param {string} options.dateText - Date text to display
   * @param {boolean} options.caption - Show caption
   * @param {string} options.captionText - Caption text to display
   * @param {string} options.cropMode - 'fit' (default) or 'fill' for auto-crop
   * @param {Object} options.cropPosition - {x: 0-1, y: 0-1} for crop position when fill mode
   */
  function drawInstaxFrame(canvas, filmType, options = {}) {
    const { showDust, showDate, dateText, caption, captionText, cropMode = 'fit', cropPosition = { x: 0.5, y: 0.5 } } = options;
    const size = FILM_SIZES[filmType];
    const scale = 8; // px per mm for high-res export
    const frameW = size.filmW * scale;
    const frameH = size.filmH * scale;
    const imgW = size.imgW * scale;
    const imgH = size.imgH * scale;

    const output = document.createElement('canvas');
    output.width = frameW;
    output.height = frameH;
    const ctx = output.getContext('2d');

    // White frame background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, frameW, frameH);

    // Add subtle shadow effect on frame
    ctx.shadowColor = 'rgba(0,0,0,0.1)';
    ctx.shadowBlur = 10;
    ctx.fillRect(0, 0, frameW, frameH);
    ctx.shadowColor = 'transparent';

    // Calculate image position (centered, with larger bottom margin for mini)
    let imgX, imgY;
    if (filmType === 'mini') {
      imgX = (frameW - imgW) / 2;
      imgY = (frameW - imgW) / 2; // Top margin similar to side margin
    } else {
      imgX = (frameW - imgW) / 2;
      imgY = (frameH - imgH) / 2 - (filmType === 'wide' ? 0 : 2 * scale);
    }

    // Calculate source and destination dimensions preserving aspect ratio
    const srcW = canvas.width;
    const srcH = canvas.height;
    const srcRatio = srcW / srcH;
    const frameRatio = imgW / imgH;

    let drawX = imgX;
    let drawY = imgY;
    let drawW = imgW;
    let drawH = imgH;
    let srcX = 0;
    let srcY = 0;
    let srcDrawW = srcW;
    let srcDrawH = srcH;

    if (cropMode === 'fill') {
      // Fill mode: image fills the entire frame area, cropping as needed
      if (srcRatio > frameRatio) {
        // Image is wider than frame - crop horizontally
        srcDrawW = srcH * frameRatio;
        srcDrawH = srcH;
        // Use cropPosition.x to determine horizontal crop position (0 = left, 0.5 = center, 1 = right)
        srcX = (srcW - srcDrawW) * cropPosition.x;
        srcY = 0;
      } else {
        // Image is taller than frame - crop vertically
        srcDrawW = srcW;
        srcDrawH = srcW / frameRatio;
        // Use cropPosition.y to determine vertical crop position (0 = top, 0.5 = center, 1 = bottom)
        srcX = 0;
        srcY = (srcH - srcDrawH) * cropPosition.y;
      }
      // Draw the cropped image to fill the frame
      ctx.drawImage(canvas, srcX, srcY, srcDrawW, srcDrawH, imgX, imgY, imgW, imgH);
    } else {
      // Fit mode (default): image fits within frame, preserving aspect ratio
      if (srcRatio > frameRatio) {
        // Image is wider than frame - fit to width
        drawW = imgW;
        drawH = imgW / srcRatio;
        drawX = imgX;
        drawY = imgY + (imgH - drawH) / 2;
      } else {
        // Image is taller than frame - fit to height
        drawH = imgH;
        drawW = imgH * srcRatio;
        drawX = imgX + (imgW - drawW) / 2;
        drawY = imgY;
      }
      // Draw the image preserving aspect ratio
      ctx.drawImage(canvas, 0, 0, srcW, srcH, drawX, drawY, drawW, drawH);
    }

    // Film dust overlay
    if (showDust) {
      ctx.globalAlpha = 0.08;
      for (let i = 0; i < 50; i++) {
        const dx = Math.random() * imgW + imgX;
        const dy = Math.random() * imgH + imgY;
        const dr = Math.random() * 1.5 + 0.3;
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.8})`;
        ctx.beginPath();
        ctx.arc(dx, dy, dr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Date stamp
    if (showDate && dateText) {
      ctx.fillStyle = '#ff6600';
      ctx.font = `${8 * scale / 4}px "Courier New", monospace`;
      ctx.textAlign = 'right';
      ctx.fillText(dateText, imgX + imgW - 5, imgY + imgH - 8);
    }

    // Caption below image
    if (caption && captionText) {
      ctx.fillStyle = '#333333';
      ctx.font = `${10 * scale / 4}px "Caveat", cursive, sans-serif`;
      ctx.textAlign = 'center';
      const captionY = imgY + imgH + (frameH - imgY - imgH) / 2 + 5;
      ctx.fillText(captionText, frameW / 2, captionY);
    }

    return output;
  }

  /**
   * Export a single image as JPG or PNG
   */
  function exportImage(canvas, format = 'png', quality = 0.92) {
    const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
    const ext = format === 'jpg' ? 'jpg' : 'png';
    const timestamp = generateTimestamp();
    const filename = `instax-studio-${timestamp}.${ext}`;

    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, mimeType, quality);
  }

  /**
   * Create a collage of multiple framed images
   */
  function createCollage(framedCanvases, cols = 3) {
    if (framedCanvases.length === 0) return null;

    const padding = 20;
    const w = framedCanvases[0].width;
    const h = framedCanvases[0].height;
    const rows = Math.ceil(framedCanvases.length / cols);

    const collage = document.createElement('canvas');
    collage.width = cols * w + (cols + 1) * padding;
    collage.height = rows * h + (rows + 1) * padding;
    const ctx = collage.getContext('2d');

    ctx.fillStyle = '#FAFAFA';
    ctx.fillRect(0, 0, collage.width, collage.height);

    framedCanvases.forEach((fc, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = padding + col * (w + padding);
      const y = padding + row * (h + padding);
      ctx.drawImage(fc, x, y);
    });

    return collage;
  }

  /**
   * Export as PDF using jsPDF
   */
  function exportPDF(framedCanvases, filmType) {
    if (typeof window.jspdf === 'undefined') {
      showToast('PDF library could not be loaded. Please refresh the page or try a different browser.', 'warning');
      return;
    }

    try {
      const { jsPDF } = window.jspdf;
      const size = FILM_SIZES[filmType];

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;

      // Calculate how many frames fit per page
      const frameW = size.filmW;
      const frameH = size.filmH;
      const cols = Math.floor((pageW - 2 * margin) / (frameW + 5));
      const rows = Math.floor((pageH - 2 * margin) / (frameH + 5));
      const perPage = cols * rows;

      framedCanvases.forEach((fc, i) => {
        if (i > 0 && i % perPage === 0) {
          pdf.addPage();
        }

        const pageIdx = i % perPage;
        const col = pageIdx % cols;
        const row = Math.floor(pageIdx / cols);
        const x = margin + col * (frameW + 5);
        const y = margin + row * (frameH + 5);

        const imgData = fc.toDataURL('image/jpeg', 0.95);
        pdf.addImage(imgData, 'JPEG', x, y, frameW, frameH);
      });

      const timestamp = generateTimestamp();
      pdf.save(`instax-studio-${timestamp}.pdf`);
    } catch (error) {
      console.error('PDF export error:', error);
      showToast('Failed to export PDF. Please try again.', 'error');
    }
  }

  /**
   * Generate print-friendly layout
   */
  function generatePrintLayout(framedCanvases, filmType) {
    const printArea = document.getElementById('print-area');
    if (!printArea) return;

    printArea.innerHTML = '';
    const size = FILM_SIZES[filmType];

    framedCanvases.forEach((fc) => {
      const container = document.createElement('div');
      container.style.display = 'inline-block';
      container.style.margin = '5mm';
      container.style.width = size.filmW + 'mm';
      container.style.height = size.filmH + 'mm';

      const img = document.createElement('img');
      img.src = fc.toDataURL('image/png');
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'contain';
      container.appendChild(img);
      printArea.appendChild(container);
    });
  }

  return {
    FILM_SIZES,
    drawInstaxFrame,
    exportImage,
    createCollage,
    exportPDF,
    generatePrintLayout,
  };
})();
