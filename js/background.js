/**
 * Instax Studio Pro - Background Engine
 * Background removal and preset backgrounds
 */

const BackgroundEngine = (() => {
  // Background preset definitions
  const PRESETS = {
    none: { name: 'Original', color: null, type: 'none' },
    white: { name: 'White', color: '#FFFFFF', type: 'solid' },
    cream: { name: 'Cream Studio', color: '#FDF6E3', type: 'solid' },
    pastelPink: { name: 'Pastel Pink', color: '#FFD6E0', type: 'solid' },
    skyBlue: { name: 'Sky Blue', color: '#C5E8F7', type: 'solid' },
    gold: { name: 'Gold', color: '#C6A75E', type: 'solid' },
    marble: { name: 'Soft Marble', color: '#E8E4DF', type: 'gradient', gradient: ['#F5F0EB', '#E8E4DF', '#D5CEC7'] },
    blurred: { name: 'Blurred', color: null, type: 'blurred' },
    gradientSunset: { name: 'Sunset', color: null, type: 'gradient', gradient: ['#FF6B6B', '#FFE66D'] },
    gradientOcean: { name: 'Ocean', color: null, type: 'gradient', gradient: ['#667EEA', '#764BA2'] },
  };

  const BG_REMOVAL_THRESHOLD = 60;

  /**
   * Simple foreground segmentation using color-based approach
   * This is a basic implementation; for production, use TensorFlow.js or remove.bg API
   */
  function removeBackground(sourceCanvas) {
    return new Promise((resolve) => {
      const width = sourceCanvas.width;
      const height = sourceCanvas.height;
      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = width;
      outputCanvas.height = height;
      const ctx = outputCanvas.getContext('2d');
      ctx.drawImage(sourceCanvas, 0, 0);

      const imageData = ctx.getImageData(0, 0, width, height);
      const d = imageData.data;

      // Sample corners to estimate background color
      const samples = [];
      const sampleSize = Math.min(20, Math.floor(width * 0.05));
      for (let y = 0; y < sampleSize; y++) {
        for (let x = 0; x < sampleSize; x++) {
          const idx = (y * width + x) * 4;
          samples.push([d[idx], d[idx + 1], d[idx + 2]]);
        }
      }
      for (let y = 0; y < sampleSize; y++) {
        for (let x = width - sampleSize; x < width; x++) {
          const idx = (y * width + x) * 4;
          samples.push([d[idx], d[idx + 1], d[idx + 2]]);
        }
      }

      // Calculate average background color
      let avgR = 0, avgG = 0, avgB = 0;
      samples.forEach(s => { avgR += s[0]; avgG += s[1]; avgB += s[2]; });
      avgR /= samples.length;
      avgG /= samples.length;
      avgB /= samples.length;

      // Remove pixels similar to background
      const threshold = BG_REMOVAL_THRESHOLD;
      for (let i = 0; i < d.length; i += 4) {
        const dr = d[i] - avgR;
        const dg = d[i + 1] - avgG;
        const db = d[i + 2] - avgB;
        const dist = Math.sqrt(dr * dr + dg * dg + db * db);
        if (dist < threshold) {
          d[i + 3] = 0; // Make transparent
        } else if (dist < threshold * 1.5) {
          d[i + 3] = Math.floor(255 * ((dist - threshold) / (threshold * 0.5)));
        }
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(outputCanvas);
    });
  }

  /**
   * Apply a background preset to a foreground canvas
   */
  function applyBackground(foregroundCanvas, presetKey, originalCanvas) {
    const width = foregroundCanvas.width;
    const height = foregroundCanvas.height;
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = width;
    outputCanvas.height = height;
    const ctx = outputCanvas.getContext('2d');

    const preset = PRESETS[presetKey];

    if (!preset || preset.type === 'none') {
      ctx.drawImage(originalCanvas || foregroundCanvas, 0, 0);
      return outputCanvas;
    }

    if (preset.type === 'solid') {
      ctx.fillStyle = preset.color;
      ctx.fillRect(0, 0, width, height);
    } else if (preset.type === 'gradient') {
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      const colors = preset.gradient;
      colors.forEach((c, i) => {
        gradient.addColorStop(i / (colors.length - 1), c);
      });
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    } else if (preset.type === 'blurred' && originalCanvas) {
      ctx.filter = 'blur(15px)';
      ctx.drawImage(originalCanvas, -20, -20, width + 40, height + 40);
      ctx.filter = 'none';
    }

    // Draw foreground on top
    ctx.drawImage(foregroundCanvas, 0, 0);
    return outputCanvas;
  }

  return {
    PRESETS,
    removeBackground,
    applyBackground,
  };
})();
