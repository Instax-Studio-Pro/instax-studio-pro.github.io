**Instax Studio Pro – Web Based Instant Photo Print Designer**

---

## 📌 Prompt to Generate the Application

---

**Prompt:**

> Develop a professional single-page web application called **“Instax Studio”** using **HTML5, Vanilla JavaScript (ES6+), and Tailwind CSS (CDN version)**.
> The application must be fully mobile responsive, modern, and optimized for both desktop and tablet usage.
>
> The purpose of this application is to:
>
> * Upload single or multiple images (JPG, PNG, JPEG)
> * Apply Fuji Instax-style filters
> * Remove background
> * Apply monochrome or preset backgrounds
> * Preview images in real Fuji Instax film size frames
> * Export images individually or combined
> * Print in real Fuji Instax film dimensions
> * Export as JPG, PNG, or PDF
>
> The application must look like a **professional photography studio dashboard** with smooth animations and subtle glassmorphism UI.

---

# 🎨 UI & Design Requirements

### 🎭 Theme

* Studio vibe (dark charcoal background with soft gradient)
* Color palette:

  * Charcoal Black (#111827)
  * Warm Cream (#FDF6E3)
  * Soft Gold Accent (#C6A75E)
  * Fuji-inspired pastel highlights
* Use Tailwind CSS utility classes
* Use smooth transitions and hover animations
* Add fade-in animation on image preview
* Add soft drop shadows for photo frames

---

# 📷 Core Functional Features

## 1️⃣ Image Upload

* Drag & drop area
* Multi-file upload support
* Show thumbnail preview grid
* Allow selecting image to edit
* File validation (JPG, PNG, JPEG only)

---

## 2️⃣ Instax Film Size Simulation

Include accurate aspect ratio for:

### 📸 Instax Mini

![Image](https://cdn.shopify.com/s/files/1/0005/1435/9356/files/Blog_Covers_2_1024x1024.jpg?v=1676639478)

![Image](https://m.media-amazon.com/images/I/61vZFp1sm9L._AC_UF1000%2C1000_QL80_.jpg)

![Image](https://images.squarespace-cdn.com/content/v1/58e1391bc534a5778c4cff76/1509230010037-N8OIT1LOVVVHFXOP1YCW/EverythingInstax.com-Fujifilm-Instax-Film-Size-Square-vs.-Wide-vs.-Mini.jpg)

![Image](https://i.pinimg.com/originals/8c/cb/4a/8ccb4a8f54a5c3cc798b0b5f19bcf9de.jpg)

* Film size: 54mm × 86mm
* Image area: 46mm × 62mm
* Add realistic white border
* Larger bottom margin like real Instax film

---

### 📸 Instax Square

![Image](https://instax.com/squareformat/assets/images/image_01.png)

![Image](https://m.media-amazon.com/images/I/71eM4Vz7wKL.jpg)

![Image](https://images.squarespace-cdn.com/content/v1/58e1391bc534a5778c4cff76/1492564247706-2XQP8VA6JU4RCBE6L7Q7/Fuji-Instax-Mini-Photo-Size-Detailed.jpg)

![Image](https://m.media-amazon.com/images/I/51TCKENlsaL._AC_UF1000%2C1000_QL80_.jpg)

* Film size: 62mm × 62mm
* Symmetrical borders

---

### 📸 Instax Wide

![Image](https://cdn.assets.lomography.com/f7/5c2e5966a3d47ae17aed31edb02e0a84bab113/694x576x2.jpg?auth=71371402c7b1c1c05479c723c1dd67199c9e151e)

![Image](https://m.media-amazon.com/images/I/61jTwI4HKXL.jpg)

![Image](https://i.pinimg.com/736x/32/3b/a3/323ba386f2c514ee7fbc7df761b76920.jpg)

![Image](https://asset.fujifilm.com/www/us/files/2024-06/44a774874ab29676e6f107e3565b9224/pic_instaxwide400_spec_01.jpg)

* Film size: 86mm × 108mm
* Landscape layout
* Wide white border

---

User must be able to:

* Switch between Mini / Square / Wide
* See real-time preview

---

# 🎨 Filter Engine (Canvas Based)

Use HTML5 Canvas for processing.

## Include Preset Filters:

* Polarized effect (increase contrast + cool tones)
* Warm Vintage Fuji tone
* Black & White
* Sepia
* High Exposure
* Matte Pastel
* Soft Skin tone
* Retro Film Grain
* Cinematic Fade

Allow:

* Slider controls (Brightness, Contrast, Saturation, Temperature, Sharpness)
* Real-time preview update

---

# 🧠 Advanced Features

## ✂️ Background Removal

* Integrate background removal using:

  * remove.bg API (optional)
  * OR TensorFlow.js segmentation model
* Replace background with:

  * Solid monochrome colors
  * Soft gradients
  * Studio preset images
  * Blurred version of original

---

## 🖼 Background Presets Section

Include:

* Minimal white
* Cream studio
* Soft pastel pink
* Sky blue
* Gold textured
* Soft marble

---

# 🖨 Export & Print Options

User must be able to:

### Export Options:

* Download selected image as:

  * JPG
  * PNG
* Export all images combined:

  * Single JPG collage
  * Multi-page PDF
  * ZIP package (optional)

Use:

* jsPDF for PDF export
* Canvas toBlob for image export

---

### Print Mode

* Generate print-friendly layout
* Use CSS @media print
* Remove UI elements when printing
* Show crop guides optionally
* Accurate physical size scaling

---

# 📊 Layout Structure

## Header

* Logo: “Instax Studio”
* Studio styled navbar
* Export button
* Print button

## Main Layout

Responsive 2-column layout:

Left Panel:

* Upload area
* Film type selector
* Filter presets
* Sliders
* Background presets

Right Panel:

* Large live preview
* Zoom option
* Before / After toggle

---

# ✨ Animations & UX Enhancements

* Fade in on image load
* Smooth scaling on hover
* Gold highlight glow on active filter
* Subtle film developing animation effect
* Loading spinner during processing
* Toast notifications

---

# 📱 Mobile Responsiveness

* Stack panels vertically on mobile
* Bottom sticky action bar (Export / Print)
* Collapsible filter panel
* Touch-friendly sliders

---

# 🧩 Additional Professional Features (Recommended)

Include:

* Undo / Redo
* Image crop tool
* Rotate / Flip
* Zoom & pan
* Batch apply filters
* Image quality control slider
* Print DPI selector (300 DPI option)
* Save project locally (LocalStorage)
* Dark/Light mode toggle
* Download with timestamp naming

---

# 🧱 Technical Constraints

* No heavy frameworks (no React)
* Only:

  * HTML5
  * Tailwind CSS (CDN)
  * Vanilla JS
* Use modular JS structure
* Optimize performance
* Compress large images before processing
* Ensure smooth canvas rendering

---

# 📁 Suggested File Structure

```
/instax-studio
   index.html
   /css
   /js
      main.js
      filters.js
      export.js
      background.js
   /assets
      presets/
```

---

# 🏁 Final Deliverables Required

The generated solution must include:

* Complete HTML file
* Fully working JavaScript
* Responsive Tailwind layout
* Filter engine
* Background removal logic
* Export functionality
* Print CSS styling
* Clean commented code
* Professional UI

---

# 🌟 Branding & Studio Feel Enhancements

Add:

* Soft film dust overlay option
* Film date stamp option
* Editable caption below photo
* Polaroid-style handwritten font
* Camera shutter sound effect on export
* Subtle background ambient studio gradient

---

# 💡 Optional Monetization Idea

Add:

* “Premium Filters” lock
* Watermark toggle
* Custom branding footer
