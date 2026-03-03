/**
 * Instax Studio Pro - Filter Engine
 * Canvas-based image processing with preset filters and adjustable sliders
 */

const FilterEngine = (() => {
  // Default adjustment values
  const DEFAULT_ADJUSTMENTS = {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    temperature: 0,
    sharpness: 0,
  };

  // Preset filter definitions
  const PRESETS = {
    none: { name: 'Original', adjustments: { ...DEFAULT_ADJUSTMENTS }, apply: null },
    polarized: {
      name: 'Polarized',
      adjustments: { brightness: 5, contrast: 25, saturation: -10, temperature: -15, sharpness: 10 },
      apply: (ctx, w, h) => {
        const imageData = ctx.getImageData(0, 0, w, h);
        const d = imageData.data;
        for (let i = 0; i < d.length; i += 4) {
          d[i] = Math.min(255, d[i] * 1.1);       // R - slight boost
          d[i + 1] = Math.min(255, d[i + 1] * 1.05); // G
          d[i + 2] = Math.min(255, d[i + 2] * 1.2);  // B - cool tone
        }
        ctx.putImageData(imageData, 0, 0);
      }
    },
    warmVintage: {
      name: 'Warm Vintage',
      adjustments: { brightness: 5, contrast: 10, saturation: -15, temperature: 25, sharpness: 0 },
      apply: (ctx, w, h) => {
        const imageData = ctx.getImageData(0, 0, w, h);
        const d = imageData.data;
        for (let i = 0; i < d.length; i += 4) {
          d[i] = Math.min(255, d[i] * 1.15 + 10);    // Warm R
          d[i + 1] = Math.min(255, d[i + 1] * 1.05 + 5); // Warm G
          d[i + 2] = Math.max(0, d[i + 2] * 0.85);     // Reduce B
          // Slight fade
          d[i] = d[i] + (255 - d[i]) * 0.05;
          d[i + 1] = d[i + 1] + (255 - d[i + 1]) * 0.05;
          d[i + 2] = d[i + 2] + (255 - d[i + 2]) * 0.05;
        }
        ctx.putImageData(imageData, 0, 0);
      }
    },
    bw: {
      name: 'B&W',
      adjustments: { brightness: 5, contrast: 15, saturation: -100, temperature: 0, sharpness: 5 },
      apply: (ctx, w, h) => {
        const imageData = ctx.getImageData(0, 0, w, h);
        const d = imageData.data;
        for (let i = 0; i < d.length; i += 4) {
          const gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
          d[i] = d[i + 1] = d[i + 2] = gray;
        }
        ctx.putImageData(imageData, 0, 0);
      }
    },
    sepia: {
      name: 'Sepia',
      adjustments: { brightness: 5, contrast: 5, saturation: -50, temperature: 20, sharpness: 0 },
      apply: (ctx, w, h) => {
        const imageData = ctx.getImageData(0, 0, w, h);
        const d = imageData.data;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2];
          d[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
          d[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
          d[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
        }
        ctx.putImageData(imageData, 0, 0);
      }
    },
    highExposure: {
      name: 'High Exposure',
      adjustments: { brightness: 30, contrast: 10, saturation: 10, temperature: 5, sharpness: 0 },
      apply: (ctx, w, h) => {
        const imageData = ctx.getImageData(0, 0, w, h);
        const d = imageData.data;
        for (let i = 0; i < d.length; i += 4) {
          d[i] = Math.min(255, d[i] * 1.3 + 20);
          d[i + 1] = Math.min(255, d[i + 1] * 1.3 + 20);
          d[i + 2] = Math.min(255, d[i + 2] * 1.3 + 20);
        }
        ctx.putImageData(imageData, 0, 0);
      }
    },
    mattePastel: {
      name: 'Matte Pastel',
      adjustments: { brightness: 10, contrast: -10, saturation: -20, temperature: 5, sharpness: 0 },
      apply: (ctx, w, h) => {
        const imageData = ctx.getImageData(0, 0, w, h);
        const d = imageData.data;
        for (let i = 0; i < d.length; i += 4) {
          // Lift shadows, compress highlights
          d[i] = d[i] + (255 - d[i]) * 0.15 + 15;
          d[i + 1] = d[i + 1] + (255 - d[i + 1]) * 0.15 + 15;
          d[i + 2] = d[i + 2] + (255 - d[i + 2]) * 0.15 + 20;
          // Clamp
          d[i] = Math.min(255, d[i]);
          d[i + 1] = Math.min(255, d[i + 1]);
          d[i + 2] = Math.min(255, d[i + 2]);
        }
        ctx.putImageData(imageData, 0, 0);
      }
    },
    softSkin: {
      name: 'Soft Skin',
      adjustments: { brightness: 8, contrast: -5, saturation: -5, temperature: 10, sharpness: -10 },
      apply: (ctx, w, h) => {
        const imageData = ctx.getImageData(0, 0, w, h);
        const d = imageData.data;
        for (let i = 0; i < d.length; i += 4) {
          d[i] = Math.min(255, d[i] * 1.05 + 8);
          d[i + 1] = Math.min(255, d[i + 1] * 1.02 + 5);
          d[i + 2] = Math.min(255, d[i + 2] * 0.98 + 3);
        }
        ctx.putImageData(imageData, 0, 0);
        // Slight blur for skin smoothing
        ctx.filter = 'blur(0.5px)';
        ctx.drawImage(ctx.canvas, 0, 0);
        ctx.filter = 'none';
      }
    },
    retroGrain: {
      name: 'Retro Film Grain',
      adjustments: { brightness: -5, contrast: 15, saturation: -25, temperature: 10, sharpness: 5 },
      apply: (ctx, w, h) => {
        const imageData = ctx.getImageData(0, 0, w, h);
        const d = imageData.data;
        // Color shift
        for (let i = 0; i < d.length; i += 4) {
          d[i] = Math.min(255, d[i] * 1.1 + 5);
          d[i + 1] = Math.min(255, d[i + 1] * 1.0);
          d[i + 2] = Math.max(0, d[i + 2] * 0.9 - 5);
        }
        // Add grain
        for (let i = 0; i < d.length; i += 4) {
          const grain = (Math.random() - 0.5) * 40;
          d[i] = Math.max(0, Math.min(255, d[i] + grain));
          d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + grain));
          d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + grain));
        }
        ctx.putImageData(imageData, 0, 0);
      }
    },
    cinematicFade: {
      name: 'Cinematic Fade',
      adjustments: { brightness: -5, contrast: 20, saturation: -15, temperature: -5, sharpness: 5 },
      apply: (ctx, w, h) => {
        const imageData = ctx.getImageData(0, 0, w, h);
        const d = imageData.data;
        for (let i = 0; i < d.length; i += 4) {
          // Teal shadows, orange highlights
          const lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
          if (lum < 128) {
            d[i] = Math.max(0, d[i] * 0.9);
            d[i + 1] = Math.min(255, d[i + 1] * 1.05);
            d[i + 2] = Math.min(255, d[i + 2] * 1.15);
          } else {
            d[i] = Math.min(255, d[i] * 1.1);
            d[i + 1] = Math.min(255, d[i + 1] * 1.02);
            d[i + 2] = Math.max(0, d[i + 2] * 0.9);
          }
          // Fade blacks
          d[i] = d[i] + 15;
          d[i + 1] = d[i + 1] + 12;
          d[i + 2] = d[i + 2] + 18;
        }
        ctx.putImageData(imageData, 0, 0);
      }
    },
  };

  /**
   * Apply adjustments (brightness, contrast, saturation, temperature, sharpness) to canvas
   */
  function applyAdjustments(ctx, width, height, adjustments) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const d = imageData.data;
    const { brightness, contrast, saturation, temperature, sharpness } = adjustments;

    const bFactor = brightness / 100;
    const cFactor = (contrast + 100) / 100;
    const sFactor = (saturation + 100) / 100;
    const tFactor = temperature / 100;

    for (let i = 0; i < d.length; i += 4) {
      let r = d[i], g = d[i + 1], b = d[i + 2];

      // Brightness
      r += 255 * bFactor;
      g += 255 * bFactor;
      b += 255 * bFactor;

      // Contrast
      r = ((r / 255 - 0.5) * cFactor + 0.5) * 255;
      g = ((g / 255 - 0.5) * cFactor + 0.5) * 255;
      b = ((b / 255 - 0.5) * cFactor + 0.5) * 255;

      // Saturation
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = gray + (r - gray) * sFactor;
      g = gray + (g - gray) * sFactor;
      b = gray + (b - gray) * sFactor;

      // Temperature
      if (tFactor > 0) {
        r += 255 * tFactor * 0.3;
        g += 255 * tFactor * 0.1;
        b -= 255 * tFactor * 0.2;
      } else {
        r += 255 * tFactor * 0.2;
        b -= 255 * tFactor * 0.3;
      }

      // Clamp values
      d[i] = Math.max(0, Math.min(255, r));
      d[i + 1] = Math.max(0, Math.min(255, g));
      d[i + 2] = Math.max(0, Math.min(255, b));
    }

    ctx.putImageData(imageData, 0, 0);

    // Sharpness via unsharp mask approximation
    if (sharpness > 0) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
      tempCtx.filter = `blur(${1 + sharpness / 30}px)`;
      tempCtx.drawImage(ctx.canvas, 0, 0);
      tempCtx.filter = 'none';

      const sharpData = ctx.getImageData(0, 0, width, height);
      const blurData = tempCtx.getImageData(0, 0, width, height);
      const sd = sharpData.data;
      const bd = blurData.data;
      const amount = sharpness / 50;

      for (let i = 0; i < sd.length; i += 4) {
        sd[i] = Math.max(0, Math.min(255, sd[i] + (sd[i] - bd[i]) * amount));
        sd[i + 1] = Math.max(0, Math.min(255, sd[i + 1] + (sd[i + 1] - bd[i + 1]) * amount));
        sd[i + 2] = Math.max(0, Math.min(255, sd[i + 2] + (sd[i + 2] - bd[i + 2]) * amount));
      }
      ctx.putImageData(sharpData, 0, 0);
    }
  }

  /**
   * Process an image with a preset filter and manual adjustments
   */
  function processImage(sourceCanvas, presetKey, manualAdjustments) {
    if (!sourceCanvas) return null;
    
    try {
      const width = sourceCanvas.width;
      const height = sourceCanvas.height;

      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = width;
      outputCanvas.height = height;
      const ctx = outputCanvas.getContext('2d', { willReadFrequently: true });

      // Draw source image
      ctx.drawImage(sourceCanvas, 0, 0);

      // Apply preset filter if any
      const preset = PRESETS[presetKey];
      if (preset && preset.apply) {
        preset.apply(ctx, width, height);
      }

      // Apply manual adjustments on top
      if (manualAdjustments) {
        applyAdjustments(ctx, width, height, manualAdjustments);
      }

      return outputCanvas;
    } catch (error) {
      console.error('Error processing image:', error);
      return sourceCanvas;
    }
  }

  /**
   * Generate a small preview thumbnail for a filter preset
   */
  function generatePreview(sourceCanvas, presetKey, size = 60) {
    if (!sourceCanvas) return '';
    
    try {
      const preview = document.createElement('canvas');
      preview.width = size;
      preview.height = size;
      const ctx = preview.getContext('2d', { willReadFrequently: true });

      // Draw scaled source
      const srcRatio = sourceCanvas.width / sourceCanvas.height;
      let sw = size, sh = size;
      if (srcRatio > 1) { sh = size / srcRatio; } else { sw = size * srcRatio; }
      const sx = (size - sw) / 2;
      const sy = (size - sh) / 2;
      ctx.drawImage(sourceCanvas, sx, sy, sw, sh);

      // Apply preset
      const preset = PRESETS[presetKey];
      if (preset && preset.apply) {
        preset.apply(ctx, size, size);
      }

      return preview.toDataURL('image/jpeg', 0.6);
    } catch (error) {
      console.error('Error generating preview:', error);
      return '';
    }
  }

  return {
    PRESETS,
    DEFAULT_ADJUSTMENTS,
    processImage,
    applyAdjustments,
    generatePreview,
  };
})();
