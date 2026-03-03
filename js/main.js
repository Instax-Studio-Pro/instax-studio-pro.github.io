/**
 * Instax Studio Pro - Main Application
 * Core logic: upload, preview, undo/redo, crop, rotate, UI interactions
 */

const App = (() => {
  // ID counter for unique image IDs
  let nextImageId = 1;

  // State
  const state = {
    images: [],           // Array of { id, file, originalCanvas, processedCanvas, thumbnail, settings }
    selectedIndex: -1,
    filmType: 'mini',     // mini | square | wide
    currentFilter: 'none',
    adjustments: { ...FilterEngine.DEFAULT_ADJUSTMENTS },
    bgPreset: 'none',
    bgRemoved: false,
    foregroundCanvas: null,
    showDust: false,
    showDate: false,
    dateText: '',
    showCaption: false,
    captionText: '',
    history: [],
    historyIndex: -1,
    maxHistory: 30,
    darkMode: true,
    zoom: 1,
    rotation: 0,
    flipH: false,
    flipV: false,
    imageQuality: 92,
    printDPI: 300,
    cropMode: false,
    cropRect: null,
    beforeAfterMode: false,
    // Frame crop settings
    frameCropMode: 'fit',        // 'fit' or 'fill' - determines how image fits in frame
    cropPosition: { x: 0.5, y: 0.5 },  // Position for crop when in 'fill' mode (0-1 range)
  };

  // Default per-image settings
  function getDefaultImageSettings() {
    return {
      filter: 'none',
      adjustments: { ...FilterEngine.DEFAULT_ADJUSTMENTS },
      bgPreset: 'none',
      rotation: 0,
      flipH: false,
      flipV: false,
      frameCropMode: 'fit',
      cropPosition: { x: 0.5, y: 0.5 },
    };
  }

  let previewCtx = null;
  let previewCanvas = null;

  // --- Initialization ---
  function init() {
    previewCanvas = document.getElementById('preview-canvas');
    previewCtx = previewCanvas.getContext('2d');

    setupUploadArea();
    setupFilmTypeSelector();
    setupFilterPresets();
    setupSliders();
    setupBackgroundPresets();
    setupExportButtons();
    setupToolbar();
    setupMiscFeatures();
    setupKeyboardShortcuts();
    setupMobileUI();
    setupFrameCropMode();

    // Set default date
    state.dateText = formatDate(new Date());
    const dateInput = document.getElementById('date-input');
    if (dateInput) dateInput.value = state.dateText;

    showToast('Welcome to Instax Studio Pro! Upload an image to get started.', 'info');
  }

  // --- Upload Area ---
  function setupUploadArea() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const uploadBtn = document.getElementById('upload-btn');
    const addMoreBtn = document.getElementById('add-more-btn');
    const clearAllBtn = document.getElementById('clear-all-btn');

    if (uploadBtn) {
      uploadBtn.addEventListener('click', () => fileInput.click());
    }

    if (dropZone) {
      dropZone.addEventListener('click', () => fileInput.click());

      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
      });

      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
      });

      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        handleFiles(e.dataTransfer.files);
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
        e.target.value = '';
      });
    }

    // Add More button
    if (addMoreBtn) {
      addMoreBtn.addEventListener('click', () => fileInput.click());
    }

    // Clear All button
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', clearAllImages);
    }
  }

  function clearAllImages() {
    if (state.images.length === 0) {
      showToast('No images to clear.', 'warning');
      return;
    }
    
    if (confirm('Are you sure you want to remove all images?')) {
      state.images = [];
      state.selectedIndex = -1;
      state.bgRemoved = false;
      state.foregroundCanvas = null;
      state.history = [];
      state.historyIndex = -1;
      renderThumbnails();
      clearPreview();
      updateImageToolbar();
      showToast('All images cleared.', 'info');
    }
  }

  function updateImageToolbar() {
    const toolbar = document.getElementById('image-toolbar');
    const countEl = document.getElementById('image-count');
    
    if (toolbar) {
      if (state.images.length > 0) {
        toolbar.classList.remove('hidden');
      } else {
        toolbar.classList.add('hidden');
      }
    }
    
    if (countEl) {
      const count = state.images.length;
      countEl.textContent = `${count} image${count !== 1 ? 's' : ''}`;
    }
  }

  function handleFiles(fileList) {
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    const files = Array.from(fileList).filter(f => validTypes.includes(f.type));

    if (files.length === 0) {
      showToast('Please upload JPG or PNG images only.', 'error');
      return;
    }

    if (files.length !== fileList.length) {
      showToast('Some files were skipped (unsupported format).', 'warning');
    }

    showLoading(true);
    let loaded = 0;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Compress large images
          const maxDim = 2000;
          let w = img.width, h = img.height;
          if (w > maxDim || h > maxDim) {
            const ratio = Math.min(maxDim / w, maxDim / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);

          const id = nextImageId++;
          state.images.push({
            id,
            file,
            originalCanvas: canvas,
            processedCanvas: null,
            thumbnail: canvas.toDataURL('image/jpeg', 0.3),
            settings: getDefaultImageSettings(),
          });

          loaded++;
          if (loaded === files.length) {
            showLoading(false);
            renderThumbnails();
            updateImageToolbar();
            if (state.selectedIndex === -1) {
              selectImage(state.images.length - files.length);
            }
            showToast(`${files.length} image(s) uploaded successfully!`, 'success');
          }
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // --- Thumbnail Grid ---
  function renderThumbnails() {
    const grid = document.getElementById('thumbnail-grid');
    if (!grid) return;
    grid.innerHTML = '';

    state.images.forEach((img, i) => {
      const div = document.createElement('div');
      div.className = `thumbnail relative rounded-lg overflow-hidden border-2 ${i === state.selectedIndex ? 'border-yellow-600 active' : 'border-transparent'} hover:border-yellow-500 group`;
      div.style.width = '70px';
      div.style.height = '70px';
      div.innerHTML = `
        <img src="${img.thumbnail}" class="w-full h-full object-cover" alt="Image ${i + 1}">
        <span class="absolute bottom-0 left-0 bg-black bg-opacity-60 text-white text-[10px] px-1 rounded-tr">${i + 1}</span>
        <button class="remove-btn absolute top-0 right-0 bg-red-600 hover:bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-bl opacity-0 group-hover:opacity-100 transition-opacity" data-remove="${i}" title="Remove image">&times;</button>
      `;
      div.addEventListener('click', (e) => {
        if (!e.target.dataset.remove) selectImage(i);
      });
      const removeBtn = div.querySelector('[data-remove]');
      if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          removeImage(i);
        });
      }
      grid.appendChild(div);
    });
  }

  function saveCurrentImageSettings() {
    if (state.selectedIndex >= 0 && state.selectedIndex < state.images.length) {
      const img = state.images[state.selectedIndex];
      img.settings = {
        filter: state.currentFilter,
        adjustments: { ...state.adjustments },
        bgPreset: state.bgPreset,
        rotation: state.rotation,
        flipH: state.flipH,
        flipV: state.flipV,
        frameCropMode: state.frameCropMode,
        cropPosition: { ...state.cropPosition },
      };
    }
  }

  function loadImageSettings(index) {
    if (index >= 0 && index < state.images.length) {
      const img = state.images[index];
      if (img.settings) {
        state.currentFilter = img.settings.filter || 'none';
        state.adjustments = img.settings.adjustments ? { ...img.settings.adjustments } : { ...FilterEngine.DEFAULT_ADJUSTMENTS };
        state.bgPreset = img.settings.bgPreset || 'none';
        state.rotation = img.settings.rotation || 0;
        state.flipH = img.settings.flipH || false;
        state.flipV = img.settings.flipV || false;
        state.frameCropMode = img.settings.frameCropMode || 'fit';
        state.cropPosition = img.settings.cropPosition ? { ...img.settings.cropPosition } : { x: 0.5, y: 0.5 };

        // Update UI sliders
        ['brightness', 'contrast', 'saturation', 'temperature', 'sharpness'].forEach(prop => {
          const slider = document.getElementById(`slider-${prop}`);
          const label = document.getElementById(`label-${prop}`);
          if (slider) slider.value = state.adjustments[prop];
          if (label) label.textContent = state.adjustments[prop];
        });

        // Update filter button UI
        document.querySelectorAll('.filter-btn').forEach(b => {
          b.classList.remove('active', 'bg-gray-600');
          b.classList.add('bg-gray-800');
        });
        const activeFilterBtn = document.querySelector(`[data-filter="${state.currentFilter}"]`);
        if (activeFilterBtn) {
          activeFilterBtn.classList.add('active', 'bg-gray-600');
          activeFilterBtn.classList.remove('bg-gray-800');
        }

        // Update background preset UI
        document.querySelectorAll('.bg-preset').forEach(b => {
          b.classList.remove('border-yellow-600');
          b.classList.add('border-gray-600');
        });
        const activeBgBtn = document.querySelector(`[data-bg="${state.bgPreset}"]`);
        if (activeBgBtn) {
          activeBgBtn.classList.add('border-yellow-600');
          activeBgBtn.classList.remove('border-gray-600');
        }

        // Update frame crop mode UI
        updateFrameCropModeUI();
      } else {
        resetAdjustments();
        state.currentFilter = 'none';
        state.bgPreset = 'none';
        state.rotation = 0;
        state.flipH = false;
        state.flipV = false;
        state.frameCropMode = 'fit';
        state.cropPosition = { x: 0.5, y: 0.5 };
        updateFrameCropModeUI();
      }
    }
  }

  function selectImage(index) {
    if (index < 0 || index >= state.images.length) return;
    
    // Save current image settings before switching
    saveCurrentImageSettings();
    
    state.selectedIndex = index;
    state.bgRemoved = false;
    state.foregroundCanvas = null;
    state.zoom = 1;
    state.cropMode = false;
    
    // Load the new image's settings
    loadImageSettings(index);
    
    renderThumbnails();
    updateFilterPreviews();
    updatePreview();
    saveHistory();
  }

  function removeImage(index) {
    state.images.splice(index, 1);
    if (state.selectedIndex >= state.images.length) {
      state.selectedIndex = state.images.length - 1;
    }
    renderThumbnails();
    updateImageToolbar();
    if (state.images.length > 0) {
      selectImage(state.selectedIndex);
    } else {
      state.selectedIndex = -1;
      clearPreview();
    }
    showToast('Image removed.', 'info');
  }

  // --- Film Type Selector ---
  function setupFilmTypeSelector() {
    document.querySelectorAll('[data-film-type]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.filmType = btn.dataset.filmType;
        document.querySelectorAll('[data-film-type]').forEach(b =>
          b.classList.toggle('bg-yellow-700', b.dataset.filmType === state.filmType)
        );
        document.querySelectorAll('[data-film-type]').forEach(b =>
          b.classList.toggle('bg-gray-700', b.dataset.filmType !== state.filmType)
        );
        updatePreview();
      });
    });
  }

  // --- Filter Presets ---
  function setupFilterPresets() {
    const container = document.getElementById('filter-presets');
    if (!container) return;

    Object.keys(FilterEngine.PRESETS).forEach(key => {
      const preset = FilterEngine.PRESETS[key];
      const btn = document.createElement('button');
      btn.className = `filter-btn flex flex-col items-center gap-1 p-1 rounded-lg ${key === 'none' ? 'active bg-gray-600' : 'bg-gray-800'} hover:bg-gray-700 transition-all min-w-[70px]`;
      btn.dataset.filter = key;
      btn.innerHTML = `
        <div class="w-14 h-14 rounded bg-gray-700 overflow-hidden filter-preview" data-filter-preview="${key}"></div>
        <span class="text-xs text-gray-300 truncate w-full text-center">${preset.name}</span>
      `;
      btn.addEventListener('click', () => {
        state.currentFilter = key;
        document.querySelectorAll('.filter-btn').forEach(b => {
          b.classList.remove('active', 'bg-gray-600');
          b.classList.add('bg-gray-800');
        });
        btn.classList.add('active', 'bg-gray-600');
        btn.classList.remove('bg-gray-800');
        saveCurrentImageSettings();
        updatePreview();
        saveHistory();
      });
      container.appendChild(btn);
    });
  }

  function updateFilterPreviews() {
    if (state.selectedIndex < 0) return;
    const source = state.images[state.selectedIndex].originalCanvas;

    Object.keys(FilterEngine.PRESETS).forEach(key => {
      const el = document.querySelector(`[data-filter-preview="${key}"]`);
      if (el) {
        const dataUrl = FilterEngine.generatePreview(source, key);
        el.style.backgroundImage = `url(${dataUrl})`;
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
      }
    });
  }

  // --- Sliders ---
  function setupSliders() {
    ['brightness', 'contrast', 'saturation', 'temperature', 'sharpness'].forEach(prop => {
      const slider = document.getElementById(`slider-${prop}`);
      const label = document.getElementById(`label-${prop}`);
      if (slider) {
        slider.addEventListener('input', () => {
          state.adjustments[prop] = parseInt(slider.value);
          if (label) label.textContent = slider.value;
          updatePreview();
        });
        // Save settings on change (mouseup/touchend for performance)
        slider.addEventListener('change', () => {
          saveCurrentImageSettings();
        });
      }
    });

    // Quality slider
    const qualitySlider = document.getElementById('slider-quality');
    const qualityLabel = document.getElementById('label-quality');
    if (qualitySlider) {
      qualitySlider.addEventListener('input', () => {
        state.imageQuality = parseInt(qualitySlider.value);
        if (qualityLabel) qualityLabel.textContent = qualitySlider.value + '%';
      });
    }
  }

  function resetAdjustments() {
    state.adjustments = { ...FilterEngine.DEFAULT_ADJUSTMENTS };
    ['brightness', 'contrast', 'saturation', 'temperature', 'sharpness'].forEach(prop => {
      const slider = document.getElementById(`slider-${prop}`);
      const label = document.getElementById(`label-${prop}`);
      if (slider) slider.value = 0;
      if (label) label.textContent = '0';
    });
  }

  // --- Frame Crop Mode (Fit/Fill) ---
  function setupFrameCropMode() {
    const fitBtn = document.getElementById('frame-fit-btn');
    const fillBtn = document.getElementById('frame-fill-btn');
    const cropPosContainer = document.getElementById('crop-position-container');

    if (fitBtn) {
      fitBtn.addEventListener('click', () => {
        state.frameCropMode = 'fit';
        updateFrameCropModeUI();
        saveCurrentImageSettings();
        updatePreview();
        saveHistory();
      });
    }

    if (fillBtn) {
      fillBtn.addEventListener('click', () => {
        state.frameCropMode = 'fill';
        updateFrameCropModeUI();
        saveCurrentImageSettings();
        updatePreview();
        saveHistory();
      });
    }

    // Crop position sliders
    const cropPosX = document.getElementById('crop-pos-x');
    const cropPosY = document.getElementById('crop-pos-y');
    const labelCropPosX = document.getElementById('label-crop-pos-x');
    const labelCropPosY = document.getElementById('label-crop-pos-y');

    if (cropPosX) {
      cropPosX.addEventListener('input', () => {
        state.cropPosition.x = parseInt(cropPosX.value) / 100;
        if (labelCropPosX) labelCropPosX.textContent = cropPosX.value + '%';
        updatePreview();
      });
      cropPosX.addEventListener('change', () => {
        saveCurrentImageSettings();
        saveHistory();
      });
    }

    if (cropPosY) {
      cropPosY.addEventListener('input', () => {
        state.cropPosition.y = parseInt(cropPosY.value) / 100;
        if (labelCropPosY) labelCropPosY.textContent = cropPosY.value + '%';
        updatePreview();
      });
      cropPosY.addEventListener('change', () => {
        saveCurrentImageSettings();
        saveHistory();
      });
    }

    // Reset crop position button
    const resetCropPosBtn = document.getElementById('reset-crop-pos-btn');
    if (resetCropPosBtn) {
      resetCropPosBtn.addEventListener('click', () => {
        state.cropPosition = { x: 0.5, y: 0.5 };
        if (cropPosX) cropPosX.value = 50;
        if (cropPosY) cropPosY.value = 50;
        if (labelCropPosX) labelCropPosX.textContent = '50%';
        if (labelCropPosY) labelCropPosY.textContent = '50%';
        saveCurrentImageSettings();
        updatePreview();
      });
    }
  }

  function updateFrameCropModeUI() {
    const fitBtn = document.getElementById('frame-fit-btn');
    const fillBtn = document.getElementById('frame-fill-btn');
    const cropPosContainer = document.getElementById('crop-position-container');
    const cropPosX = document.getElementById('crop-pos-x');
    const cropPosY = document.getElementById('crop-pos-y');
    const labelCropPosX = document.getElementById('label-crop-pos-x');
    const labelCropPosY = document.getElementById('label-crop-pos-y');

    if (fitBtn && fillBtn) {
      if (state.frameCropMode === 'fit') {
        fitBtn.classList.add('bg-yellow-700');
        fitBtn.classList.remove('bg-gray-700');
        fillBtn.classList.remove('bg-yellow-700');
        fillBtn.classList.add('bg-gray-700');
      } else {
        fillBtn.classList.add('bg-yellow-700');
        fillBtn.classList.remove('bg-gray-700');
        fitBtn.classList.remove('bg-yellow-700');
        fitBtn.classList.add('bg-gray-700');
      }
    }

    // Show/hide crop position controls based on mode
    if (cropPosContainer) {
      cropPosContainer.style.display = state.frameCropMode === 'fill' ? 'block' : 'none';
    }

    // Update crop position sliders
    if (cropPosX) {
      cropPosX.value = Math.round(state.cropPosition.x * 100);
    }
    if (cropPosY) {
      cropPosY.value = Math.round(state.cropPosition.y * 100);
    }
    if (labelCropPosX) {
      labelCropPosX.textContent = Math.round(state.cropPosition.x * 100) + '%';
    }
    if (labelCropPosY) {
      labelCropPosY.textContent = Math.round(state.cropPosition.y * 100) + '%';
    }
  }

  // --- Background Presets ---
  function setupBackgroundPresets() {
    const container = document.getElementById('bg-presets');
    if (!container) return;

    Object.keys(BackgroundEngine.PRESETS).forEach(key => {
      const preset = BackgroundEngine.PRESETS[key];
      const btn = document.createElement('button');
      let bgStyle = '';
      if (preset.type === 'solid') {
        bgStyle = `background-color: ${preset.color}`;
      } else if (preset.type === 'gradient' && preset.gradient) {
        bgStyle = `background: linear-gradient(135deg, ${preset.gradient.join(', ')})`;
      } else if (preset.type === 'blurred') {
        bgStyle = 'background: linear-gradient(135deg, #666, #333)';
      } else {
        bgStyle = 'background: repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50%/16px 16px';
      }

      btn.className = `bg-preset w-10 h-10 rounded-lg border-2 ${key === 'none' ? 'border-yellow-600' : 'border-gray-600'} hover:border-yellow-500 transition-all`;
      btn.style.cssText = bgStyle;
      btn.title = preset.name;
      btn.dataset.bg = key;

      btn.addEventListener('click', async () => {
        state.bgPreset = key;
        document.querySelectorAll('.bg-preset').forEach(b => {
          b.classList.remove('border-yellow-600');
          b.classList.add('border-gray-600');
        });
        btn.classList.add('border-yellow-600');
        btn.classList.remove('border-gray-600');

        if (key !== 'none' && !state.bgRemoved) {
          showLoading(true);
          showToast('Removing background...', 'info');
          const source = getCurrentSourceCanvas();
          state.foregroundCanvas = await BackgroundEngine.removeBackground(source);
          state.bgRemoved = true;
          showLoading(false);
          showToast('Background removed!', 'success');
        }

        saveCurrentImageSettings();
        updatePreview();
        saveHistory();
      });
      container.appendChild(btn);
    });

    // Remove BG button
    const removeBgBtn = document.getElementById('remove-bg-btn');
    if (removeBgBtn) {
      removeBgBtn.addEventListener('click', async () => {
        if (state.selectedIndex < 0) return;
        showLoading(true);
        showToast('Removing background...', 'info');
        const source = getCurrentSourceCanvas();
        state.foregroundCanvas = await BackgroundEngine.removeBackground(source);
        state.bgRemoved = true;
        showLoading(false);
        showToast('Background removed!', 'success');
        updatePreview();
      });
    }
  }

  // --- Export & Print ---
  function setupExportButtons() {
    // Export JPG
    const exportJpg = document.getElementById('export-jpg');
    if (exportJpg) {
      exportJpg.addEventListener('click', () => {
        const framed = getFramedCanvas();
        if (!framed) return;
        playShutterSound();
        ExportEngine.exportImage(framed, 'jpg', state.imageQuality / 100);
        showToast('Image exported as JPG!', 'success');
      });
    }

    // Export PNG
    const exportPng = document.getElementById('export-png');
    if (exportPng) {
      exportPng.addEventListener('click', () => {
        const framed = getFramedCanvas();
        if (!framed) return;
        playShutterSound();
        ExportEngine.exportImage(framed, 'png');
        showToast('Image exported as PNG!', 'success');
      });
    }

    // Export PDF
    const exportPdf = document.getElementById('export-pdf');
    if (exportPdf) {
      exportPdf.addEventListener('click', () => {
        const framed = getAllFramedCanvases();
        if (framed.length === 0) return;
        playShutterSound();
        ExportEngine.exportPDF(framed, state.filmType);
        showToast('PDF exported!', 'success');
      });
    }

    // Export Collage
    const exportCollage = document.getElementById('export-collage');
    if (exportCollage) {
      exportCollage.addEventListener('click', () => {
        const framed = getAllFramedCanvases();
        if (framed.length === 0) return;
        playShutterSound();
        const collage = ExportEngine.createCollage(framed);
        if (collage) {
          ExportEngine.exportImage(collage, 'jpg', state.imageQuality / 100);
          showToast('Collage exported!', 'success');
        }
      });
    }

    // Print
    const printBtn = document.getElementById('print-btn');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        const framed = getAllFramedCanvases();
        if (framed.length === 0) return;
        ExportEngine.generatePrintLayout(framed, state.filmType);
        window.print();
      });
    }
  }

  function getFramedCanvas() {
    if (state.selectedIndex < 0) {
      showToast('Please select an image first.', 'warning');
      return null;
    }
    const processed = getProcessedCanvas();
    return ExportEngine.drawInstaxFrame(processed, state.filmType, {
      showDust: state.showDust,
      showDate: state.showDate,
      dateText: state.dateText,
      caption: state.showCaption,
      captionText: state.captionText,
      cropMode: state.frameCropMode,
      cropPosition: state.cropPosition,
    });
  }

  function getAllFramedCanvases() {
    // Save current state
    saveCurrentImageSettings();
    const savedIndex = state.selectedIndex;
    const savedFilter = state.currentFilter;
    const savedAdj = { ...state.adjustments };
    const savedBgPreset = state.bgPreset;
    const savedRotation = state.rotation;
    const savedFlipH = state.flipH;
    const savedFlipV = state.flipV;
    const savedFrameCropMode = state.frameCropMode;
    const savedCropPosition = { ...state.cropPosition };

    const framed = [];
    state.images.forEach((img, i) => {
      // Load this image's settings
      state.selectedIndex = i;
      if (img.settings) {
        state.currentFilter = img.settings.filter || 'none';
        state.adjustments = img.settings.adjustments ? { ...img.settings.adjustments } : { ...FilterEngine.DEFAULT_ADJUSTMENTS };
        state.bgPreset = img.settings.bgPreset || 'none';
        state.rotation = img.settings.rotation || 0;
        state.flipH = img.settings.flipH || false;
        state.flipV = img.settings.flipV || false;
        state.frameCropMode = img.settings.frameCropMode || 'fit';
        state.cropPosition = img.settings.cropPosition ? { ...img.settings.cropPosition } : { x: 0.5, y: 0.5 };
      }
      
      const processed = getProcessedCanvas();
      const frame = ExportEngine.drawInstaxFrame(processed, state.filmType, {
        showDust: state.showDust,
        showDate: state.showDate,
        dateText: state.dateText,
        caption: state.showCaption,
        captionText: state.captionText,
        cropMode: state.frameCropMode,
        cropPosition: state.cropPosition,
      });
      framed.push(frame);
    });

    // Restore state
    state.selectedIndex = savedIndex;
    state.currentFilter = savedFilter;
    state.adjustments = savedAdj;
    state.bgPreset = savedBgPreset;
    state.rotation = savedRotation;
    state.flipH = savedFlipH;
    state.flipV = savedFlipV;
    state.frameCropMode = savedFrameCropMode;
    state.cropPosition = savedCropPosition;
    return framed;
  }

  // --- Toolbar (Crop, Rotate, Flip, Zoom) ---
  function setupToolbar() {
    // Rotate
    const rotateLeftBtn = document.getElementById('rotate-left');
    const rotateRightBtn = document.getElementById('rotate-right');
    if (rotateLeftBtn) rotateLeftBtn.addEventListener('click', () => { state.rotation = (state.rotation - 90) % 360; saveCurrentImageSettings(); updatePreview(); saveHistory(); });
    if (rotateRightBtn) rotateRightBtn.addEventListener('click', () => { state.rotation = (state.rotation + 90) % 360; saveCurrentImageSettings(); updatePreview(); saveHistory(); });

    // Flip
    const flipHBtn = document.getElementById('flip-h');
    const flipVBtn = document.getElementById('flip-v');
    if (flipHBtn) flipHBtn.addEventListener('click', () => { state.flipH = !state.flipH; saveCurrentImageSettings(); updatePreview(); saveHistory(); });
    if (flipVBtn) flipVBtn.addEventListener('click', () => { state.flipV = !state.flipV; saveCurrentImageSettings(); updatePreview(); saveHistory(); });

    // Zoom
    const zoomInBtn = document.getElementById('zoom-in');
    const zoomOutBtn = document.getElementById('zoom-out');
    const zoomResetBtn = document.getElementById('zoom-reset');
    if (zoomInBtn) zoomInBtn.addEventListener('click', () => { state.zoom = Math.min(3, state.zoom + 0.1); updatePreviewDisplay(); });
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => { state.zoom = Math.max(0.3, state.zoom - 0.1); updatePreviewDisplay(); });
    if (zoomResetBtn) zoomResetBtn.addEventListener('click', () => { state.zoom = 1; updatePreviewDisplay(); });

    // Undo / Redo
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    if (undoBtn) undoBtn.addEventListener('click', undo);
    if (redoBtn) redoBtn.addEventListener('click', redo);

    // Reset all
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) resetBtn.addEventListener('click', () => {
      resetAdjustments();
      state.currentFilter = 'none';
      state.bgPreset = 'none';
      state.bgRemoved = false;
      state.foregroundCanvas = null;
      state.rotation = 0;
      state.flipH = false;
      state.flipV = false;
      state.zoom = 1;
      state.frameCropMode = 'fit';
      state.cropPosition = { x: 0.5, y: 0.5 };
      document.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.remove('active', 'bg-gray-600');
        b.classList.add('bg-gray-800');
      });
      const noneBtn = document.querySelector('[data-filter="none"]');
      if (noneBtn) { noneBtn.classList.add('active', 'bg-gray-600'); noneBtn.classList.remove('bg-gray-800'); }
      document.querySelectorAll('.bg-preset').forEach(b => {
        b.classList.remove('border-yellow-600');
        b.classList.add('border-gray-600');
      });
      const noneBg = document.querySelector('[data-bg="none"]');
      if (noneBg) { noneBg.classList.add('border-yellow-600'); noneBg.classList.remove('border-gray-600'); }
      updateFrameCropModeUI();
      saveCurrentImageSettings();
      updatePreview();
      saveHistory();
      showToast('All settings reset.', 'info');
    });

    // Crop
    const cropBtn = document.getElementById('crop-btn');
    if (cropBtn) {
      cropBtn.addEventListener('click', () => {
        if (state.selectedIndex < 0) return;
        state.cropMode = !state.cropMode;
        cropBtn.classList.toggle('bg-yellow-700', state.cropMode);
        if (state.cropMode) {
          showToast('Click and drag on the preview to crop. Click Crop again to apply.', 'info');
          setupCropInteraction();
        } else {
          applyCrop();
        }
      });
    }

    // Before/After toggle
    const baToggle = document.getElementById('before-after-toggle');
    if (baToggle) {
      baToggle.addEventListener('click', () => {
        state.beforeAfterMode = !state.beforeAfterMode;
        baToggle.classList.toggle('bg-yellow-700', state.beforeAfterMode);
        updatePreview();
      });
    }

    // Batch apply
    const batchBtn = document.getElementById('batch-apply');
    if (batchBtn) {
      batchBtn.addEventListener('click', () => {
        if (state.images.length < 2) { showToast('Need at least 2 images for batch apply.', 'warning'); return; }
        
        // Save current image settings first
        saveCurrentImageSettings();
        
        // Copy current settings to all images
        const currentSettings = {
          filter: state.currentFilter,
          adjustments: { ...state.adjustments },
          bgPreset: state.bgPreset,
          rotation: state.rotation,
          flipH: state.flipH,
          flipV: state.flipV,
          frameCropMode: state.frameCropMode,
          cropPosition: { ...state.cropPosition },
        };
        
        state.images.forEach((img) => {
          img.settings = { ...currentSettings, adjustments: { ...currentSettings.adjustments }, cropPosition: { ...currentSettings.cropPosition } };
        });
        
        showToast(`Settings applied to all ${state.images.length} images!`, 'success');
      });
    }
  }

  // --- Crop Interaction ---
  function setupCropInteraction() {
    const container = document.getElementById('preview-container');
    if (!container) return;

    let cropOverlay = document.getElementById('crop-overlay');
    if (!cropOverlay) {
      cropOverlay = document.createElement('div');
      cropOverlay.id = 'crop-overlay';
      cropOverlay.className = 'absolute inset-0 cursor-crosshair';
      cropOverlay.style.zIndex = '10';
      container.style.position = 'relative';
      container.appendChild(cropOverlay);
    }

    let startX, startY, isDragging = false;
    let cropBox = document.getElementById('crop-box');
    if (!cropBox) {
      cropBox = document.createElement('div');
      cropBox.id = 'crop-box';
      cropBox.className = 'absolute border-2 border-yellow-500 bg-yellow-500 bg-opacity-20';
      cropBox.style.display = 'none';
      cropOverlay.appendChild(cropBox);
    }

    const onMouseDown = (e) => {
      const rect = cropOverlay.getBoundingClientRect();
      startX = e.clientX - rect.left;
      startY = e.clientY - rect.top;
      isDragging = true;
      cropBox.style.display = 'block';
      cropBox.style.left = startX + 'px';
      cropBox.style.top = startY + 'px';
      cropBox.style.width = '0px';
      cropBox.style.height = '0px';
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const rect = cropOverlay.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const w = x - startX;
      const h = y - startY;
      cropBox.style.left = (w < 0 ? x : startX) + 'px';
      cropBox.style.top = (h < 0 ? y : startY) + 'px';
      cropBox.style.width = Math.abs(w) + 'px';
      cropBox.style.height = Math.abs(h) + 'px';
    };

    const onMouseUp = () => {
      isDragging = false;
      const rect = cropOverlay.getBoundingClientRect();
      const boxRect = cropBox.getBoundingClientRect();
      state.cropRect = {
        x: (boxRect.left - rect.left) / rect.width,
        y: (boxRect.top - rect.top) / rect.height,
        w: boxRect.width / rect.width,
        h: boxRect.height / rect.height,
      };
    };

    cropOverlay.addEventListener('mousedown', onMouseDown);
    cropOverlay.addEventListener('mousemove', onMouseMove);
    cropOverlay.addEventListener('mouseup', onMouseUp);
    // Touch support
    cropOverlay.addEventListener('touchstart', (e) => { e.preventDefault(); onMouseDown(e.touches[0]); });
    cropOverlay.addEventListener('touchmove', (e) => { e.preventDefault(); onMouseMove(e.touches[0]); });
    cropOverlay.addEventListener('touchend', onMouseUp);
  }

  function applyCrop() {
    if (!state.cropRect || state.selectedIndex < 0) {
      // Remove crop overlay
      const overlay = document.getElementById('crop-overlay');
      if (overlay) overlay.remove();
      return;
    }

    const img = state.images[state.selectedIndex];
    const src = img.originalCanvas;
    const { x, y, w, h } = state.cropRect;

    if (w < 0.01 || h < 0.01) {
      const overlay = document.getElementById('crop-overlay');
      if (overlay) overlay.remove();
      state.cropRect = null;
      return;
    }

    const cropX = Math.round(x * src.width);
    const cropY = Math.round(y * src.height);
    const cropW = Math.round(w * src.width);
    const cropH = Math.round(h * src.height);

    const cropped = document.createElement('canvas');
    cropped.width = cropW;
    cropped.height = cropH;
    const ctx = cropped.getContext('2d');
    ctx.drawImage(src, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    img.originalCanvas = cropped;
    img.thumbnail = cropped.toDataURL('image/jpeg', 0.3);
    state.cropRect = null;
    state.bgRemoved = false;
    state.foregroundCanvas = null;

    const overlay = document.getElementById('crop-overlay');
    if (overlay) overlay.remove();

    renderThumbnails();
    updatePreview();
    saveHistory();
    showToast('Image cropped!', 'success');
  }

  // --- Misc Features ---
  function setupMiscFeatures() {
    // Dark/Light mode
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        state.darkMode = !state.darkMode;
        document.body.classList.toggle('light-mode', !state.darkMode);
        themeToggle.textContent = state.darkMode ? '☀️' : '🌙';
        showToast(state.darkMode ? 'Dark mode enabled' : 'Light mode enabled', 'info');
      });
    }

    // Film dust overlay
    const dustToggle = document.getElementById('dust-toggle');
    if (dustToggle) {
      dustToggle.addEventListener('change', () => {
        state.showDust = dustToggle.checked;
        updatePreview();
      });
    }

    // Date stamp
    const dateToggle = document.getElementById('date-toggle');
    if (dateToggle) {
      dateToggle.addEventListener('change', () => {
        state.showDate = dateToggle.checked;
        updatePreview();
      });
    }

    const dateInput = document.getElementById('date-input');
    if (dateInput) {
      dateInput.addEventListener('input', () => {
        state.dateText = dateInput.value;
        updatePreview();
      });
    }

    // Caption
    const captionToggle = document.getElementById('caption-toggle');
    if (captionToggle) {
      captionToggle.addEventListener('change', () => {
        state.showCaption = captionToggle.checked;
        updatePreview();
      });
    }

    const captionInput = document.getElementById('caption-input');
    if (captionInput) {
      captionInput.addEventListener('input', () => {
        state.captionText = captionInput.value;
        updatePreview();
      });
    }

    // DPI selector
    const dpiSelect = document.getElementById('dpi-select');
    if (dpiSelect) {
      dpiSelect.addEventListener('change', () => {
        state.printDPI = parseInt(dpiSelect.value);
      });
    }

    // Save project
    const saveBtn = document.getElementById('save-project');
    if (saveBtn) {
      saveBtn.addEventListener('click', saveProject);
    }

    // Load project
    const loadBtn = document.getElementById('load-project');
    if (loadBtn) {
      loadBtn.addEventListener('click', loadProject);
    }

    // Collapsible panels
    document.querySelectorAll('[data-collapse]').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = document.getElementById(btn.dataset.collapse);
        if (target) {
          target.classList.toggle('expanded');
          const icon = btn.querySelector('.collapse-icon');
          if (icon) icon.textContent = target.classList.contains('expanded') ? '▼' : '▶';
        }
      });
    });
  }

  // --- Keyboard Shortcuts ---
  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') { e.preventDefault(); undo(); }
        if (e.key === 'y') { e.preventDefault(); redo(); }
        if (e.key === 's') { e.preventDefault(); saveProject(); }
      }

      if (e.key === '+' || e.key === '=') { state.zoom = Math.min(3, state.zoom + 0.1); updatePreviewDisplay(); }
      if (e.key === '-') { state.zoom = Math.max(0.3, state.zoom - 0.1); updatePreviewDisplay(); }
      if (e.key === '0') { state.zoom = 1; updatePreviewDisplay(); }
      
      // Arrow key navigation for images
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (state.images.length > 0 && state.selectedIndex > 0) {
          selectImage(state.selectedIndex - 1);
        }
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (state.images.length > 0 && state.selectedIndex < state.images.length - 1) {
          selectImage(state.selectedIndex + 1);
        }
      }
      
      // Delete key to remove selected image
      if (e.key === 'Delete') {
        if (state.selectedIndex >= 0) {
          e.preventDefault();
          removeImage(state.selectedIndex);
        }
      }
    });
  }

  // --- Mobile UI ---
  function setupMobileUI() {
    // Collapsible filter panel on mobile
    const filterToggle = document.getElementById('mobile-filter-toggle');
    if (filterToggle) {
      filterToggle.addEventListener('click', () => {
        const panel = document.getElementById('left-panel');
        if (panel) panel.classList.toggle('hidden');
      });
    }
  }

  // --- Preview Rendering ---
  function getCurrentSourceCanvas() {
    if (state.selectedIndex < 0) return null;
    let canvas = state.images[state.selectedIndex].originalCanvas;

    // Apply rotation and flip
    if (state.rotation !== 0 || state.flipH || state.flipV) {
      const rotated = document.createElement('canvas');
      const isRotated90 = Math.abs(state.rotation) === 90 || Math.abs(state.rotation) === 270;
      rotated.width = isRotated90 ? canvas.height : canvas.width;
      rotated.height = isRotated90 ? canvas.width : canvas.height;
      const ctx = rotated.getContext('2d');
      ctx.save();
      ctx.translate(rotated.width / 2, rotated.height / 2);
      ctx.rotate((state.rotation * Math.PI) / 180);
      if (state.flipH) ctx.scale(-1, 1);
      if (state.flipV) ctx.scale(1, -1);
      ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
      ctx.restore();
      canvas = rotated;
    }

    return canvas;
  }

  function getProcessedCanvas() {
    const source = getCurrentSourceCanvas();
    if (!source) return null;

    // Apply filter
    let processed = FilterEngine.processImage(source, state.currentFilter, state.adjustments);

    // Apply background if removed
    if (state.bgRemoved && state.bgPreset !== 'none' && state.foregroundCanvas) {
      const filteredFg = FilterEngine.processImage(state.foregroundCanvas, state.currentFilter, state.adjustments);
      processed = BackgroundEngine.applyBackground(filteredFg, state.bgPreset, source);
    }

    return processed;
  }

  function updatePreview() {
    if (state.selectedIndex < 0) { clearPreview(); return; }
    const emptyState = document.getElementById('empty-state');
    if (emptyState) {
      emptyState.classList.add('hidden');
      emptyState.style.display = 'none';
    }

    const processed = getProcessedCanvas();
    if (!processed) return;

    // Get film type dimensions for preview aspect ratio
    const filmSizes = {
      mini: { w: 46, h: 62 },
      square: { w: 50, h: 50 },
      wide: { w: 99, h: 62 },
    };
    const filmSize = filmSizes[state.filmType];
    const aspectRatio = filmSize.w / filmSize.h;

    // Set canvas size for preview
    const maxPreviewW = 400;
    const maxPreviewH = 500;
    let pw, ph;
    if (aspectRatio > 1) {
      pw = Math.min(maxPreviewW, 380);
      ph = pw / aspectRatio;
    } else {
      ph = Math.min(maxPreviewH, 450);
      pw = ph * aspectRatio;
    }

    previewCanvas.width = pw;
    previewCanvas.height = ph;

    // Draw the processed image fitted to the preview area
    const srcRatio = processed.width / processed.height;
    let dw, dh, dx, dy;
    if (srcRatio > aspectRatio) {
      dw = pw;
      dh = pw / srcRatio;
      dx = 0;
      dy = (ph - dh) / 2;
    } else {
      dh = ph;
      dw = ph * srcRatio;
      dx = (pw - dw) / 2;
      dy = 0;
    }

    previewCtx.clearRect(0, 0, pw, ph);
    previewCtx.drawImage(processed, dx, dy, dw, dh);

    // Before/After mode
    if (state.beforeAfterMode && state.selectedIndex >= 0) {
      const original = getCurrentSourceCanvas();
      const halfW = pw / 2;
      previewCtx.save();
      previewCtx.beginPath();
      previewCtx.rect(0, 0, halfW, ph);
      previewCtx.clip();
      previewCtx.drawImage(original, dx, dy, dw, dh);
      previewCtx.restore();

      // Divider line
      previewCtx.strokeStyle = '#C6A75E';
      previewCtx.lineWidth = 2;
      previewCtx.beginPath();
      previewCtx.moveTo(halfW, 0);
      previewCtx.lineTo(halfW, ph);
      previewCtx.stroke();

      // Labels
      previewCtx.fillStyle = '#C6A75E';
      previewCtx.font = '12px sans-serif';
      previewCtx.fillText('Before', 10, 20);
      previewCtx.fillText('After', halfW + 10, 20);
    }

    updatePreviewDisplay();
    updateFramePreview();
  }

  function updateFramePreview() {
    const frameContainer = document.getElementById('frame-preview');
    if (!frameContainer || state.selectedIndex < 0) return;

    const processed = getProcessedCanvas();
    if (!processed) return;

    const framed = ExportEngine.drawInstaxFrame(processed, state.filmType, {
      showDust: state.showDust,
      showDate: state.showDate,
      dateText: state.dateText,
      caption: state.showCaption,
      captionText: state.captionText,
      cropMode: state.frameCropMode,
      cropPosition: state.cropPosition,
    });

    // Display framed version
    const existingImg = frameContainer.querySelector('img');
    const dataUrl = framed.toDataURL('image/png');

    if (existingImg) {
      existingImg.src = dataUrl;
    } else {
      const img = document.createElement('img');
      img.src = dataUrl;
      img.className = 'max-w-full max-h-full object-contain animate-film-develop';
      img.alt = 'Instax Frame Preview';
      frameContainer.innerHTML = '';
      frameContainer.appendChild(img);
    }
  }

  function updatePreviewDisplay() {
    const container = document.getElementById('preview-container');
    if (container) {
      previewCanvas.style.transform = `scale(${state.zoom})`;
      previewCanvas.style.transformOrigin = 'center center';
    }
  }

  function clearPreview() {
    if (previewCanvas && previewCtx) {
      previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    }
    const emptyState = document.getElementById('empty-state');
    if (emptyState) {
      emptyState.classList.remove('hidden');
      emptyState.style.display = 'flex';
    }
    const frameContainer = document.getElementById('frame-preview');
    if (frameContainer) frameContainer.innerHTML = '<p class="text-gray-500 text-sm">No image selected</p>';
  }

  // --- Undo / Redo ---
  function saveHistory() {
    const snapshot = {
      selectedIndex: state.selectedIndex,
      currentFilter: state.currentFilter,
      adjustments: { ...state.adjustments },
      bgPreset: state.bgPreset,
      rotation: state.rotation,
      flipH: state.flipH,
      flipV: state.flipV,
      frameCropMode: state.frameCropMode,
      cropPosition: { ...state.cropPosition },
    };
    // Remove future states
    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push(JSON.stringify(snapshot));
    if (state.history.length > state.maxHistory) state.history.shift();
    state.historyIndex = state.history.length - 1;
  }

  function undo() {
    if (state.historyIndex <= 0) { showToast('Nothing to undo', 'warning'); return; }
    state.historyIndex--;
    restoreHistory();
    showToast('Undo', 'info');
  }

  function redo() {
    if (state.historyIndex >= state.history.length - 1) { showToast('Nothing to redo', 'warning'); return; }
    state.historyIndex++;
    restoreHistory();
    showToast('Redo', 'info');
  }

  function restoreHistory() {
    const snapshot = JSON.parse(state.history[state.historyIndex]);
    state.currentFilter = snapshot.currentFilter;
    state.adjustments = { ...snapshot.adjustments };
    state.bgPreset = snapshot.bgPreset;
    state.rotation = snapshot.rotation;
    state.flipH = snapshot.flipH;
    state.flipV = snapshot.flipV;
    state.frameCropMode = snapshot.frameCropMode || 'fit';
    state.cropPosition = snapshot.cropPosition ? { ...snapshot.cropPosition } : { x: 0.5, y: 0.5 };

    // Update UI
    ['brightness', 'contrast', 'saturation', 'temperature', 'sharpness'].forEach(prop => {
      const slider = document.getElementById(`slider-${prop}`);
      const label = document.getElementById(`label-${prop}`);
      if (slider) slider.value = state.adjustments[prop];
      if (label) label.textContent = state.adjustments[prop];
    });

    updateFrameCropModeUI();
    updatePreview();
  }

  // --- Save / Load Project ---
  function saveProject() {
    try {
      // Save current image settings first
      saveCurrentImageSettings();
      
      const projectData = {
        filmType: state.filmType,
        currentFilter: state.currentFilter,
        adjustments: state.adjustments,
        bgPreset: state.bgPreset,
        showDust: state.showDust,
        showDate: state.showDate,
        dateText: state.dateText,
        showCaption: state.showCaption,
        captionText: state.captionText,
        imageQuality: state.imageQuality,
        printDPI: state.printDPI,
        images: state.images.map(img => ({
          thumbnail: img.thumbnail,
          data: img.originalCanvas.toDataURL('image/jpeg', 0.8),
          settings: img.settings || getDefaultImageSettings(),
        })),
      };
      localStorage.setItem('instax-studio-project', JSON.stringify(projectData));
      showToast('Project saved to local storage!', 'success');
    } catch (e) {
      showToast('Failed to save project (storage full?)', 'error');
    }
  }

  function loadProject() {
    try {
      const data = localStorage.getItem('instax-studio-project');
      if (!data) { showToast('No saved project found.', 'warning'); return; }

      const project = JSON.parse(data);
      state.filmType = project.filmType || 'mini';
      state.currentFilter = project.currentFilter || 'none';
      state.adjustments = project.adjustments || { ...FilterEngine.DEFAULT_ADJUSTMENTS };
      state.bgPreset = project.bgPreset || 'none';
      state.showDust = project.showDust || false;
      state.showDate = project.showDate || false;
      state.dateText = project.dateText || '';
      state.showCaption = project.showCaption || false;
      state.captionText = project.captionText || '';
      state.imageQuality = project.imageQuality || 92;
      state.printDPI = project.printDPI || 300;

      showLoading(true);
      let loaded = 0;
      state.images = [];

      if (!project.images || project.images.length === 0) {
        showLoading(false);
        updateImageToolbar();
        showToast('Project loaded (no images).', 'info');
        return;
      }

      project.images.forEach((imgData, idx) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);

          state.images.push({
            id: nextImageId++,
            file: null,
            originalCanvas: canvas,
            processedCanvas: null,
            thumbnail: imgData.thumbnail,
            settings: imgData.settings || getDefaultImageSettings(),
          });

          loaded++;
          if (loaded === project.images.length) {
            showLoading(false);
            renderThumbnails();
            updateImageToolbar();
            selectImage(0);
            showToast('Project loaded!', 'success');
          }
        };
        img.src = imgData.data;
      });
    } catch (e) {
      showToast('Failed to load project.', 'error');
    }
  }

  // --- Utility Functions ---
  function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}.${m}.${d}`;
  }

  function playShutterSound() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.15);

      // Flash effect
      const flash = document.getElementById('shutter-flash');
      if (flash) {
        flash.style.display = 'block';
        flash.classList.remove('hidden');
        flash.classList.add('animate-shutter-flash');
        setTimeout(() => {
          flash.style.display = 'none';
          flash.classList.add('hidden');
          flash.classList.remove('animate-shutter-flash');
        }, 500);
      }
    } catch (e) {
      // Audio not supported, skip
    }
  }

  return { init };
})();

// --- Global Toast Notification ---
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const colors = {
    info: 'bg-blue-600',
    success: 'bg-green-600',
    warning: 'bg-yellow-600',
    error: 'bg-red-600',
  };
  const icons = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌',
  };

  const toast = document.createElement('div');
  toast.className = `toast ${colors[type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm max-w-sm`;
  toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// --- Global Loading Spinner ---
function showLoading(show) {
  const loader = document.getElementById('loading-overlay');
  if (loader) {
    loader.classList.toggle('hidden', !show);
    loader.style.display = show ? 'flex' : 'none';
  }
}

// --- Initialize on DOM Ready ---
document.addEventListener('DOMContentLoaded', App.init);
