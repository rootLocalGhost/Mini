# Mini ⚡📑
**Modern Neo-Brutalist DOCX & PDF Batch Image Rasterizer**  
Built with **Rust**, **Tauri v2**, **TypeScript**, **SolidJS**, and **Raw Neo-Brutalist CSS** (Powered by Bun).

---

## 🚀 Key Features

- **Folder Selection**:
  - Select any directory containing one or multiple files: only DOCX, only PDFs, or mixed.
  - Optional recursive subfolder scanning.
  - Real-time file counting, format detection, and total size metrics.

- **Collision-Proof Output Guarantee**:
  - Automatically creates a dedicated output folder (e.g. `converted_images/`) inside the chosen directory.
  - **Zero Overwriting**: Uses smart sequential indexing (`<filename>_page_01.png`, `<filename>_page_01_1.png`, etc.) ensuring previously generated images and duplicate document names are never overwritten.

- **Quality Slider (Up to Very Very High Quality)**:
  - From **96 DPI (Web Standard)** to **600 DPI (Archival Master / Ultra Max)**.
  - One-click presets: `96 DPI (Web)`, `192 DPI (Crisp)`, `300 DPI (Print)`, `400 DPI (Ultra)`, `600 DPI (Max)`.
  - Live dimension calculations for standard pages (e.g., up to `4960 × 7016 px`).
  - Output formats: **PNG (Lossless)** or **JPEG** with quality tuning.

- **Batch Processing & Interactive UI**:
  - Multi-select, select all, or selective document conversion.
  - Per-file progress tracking with live page render thumbnails.
  - Instant **"Open Output Folder"** action launching the native Windows Explorer directly in the destination folder.
  - Built-in **Generated Images Gallery Drawer** to review converted pages and file sizes.

---

## 🛠️ Tech Stack Architecture

| Layer | Technology | Details |
|---|---|---|
| **Desktop Shell & Native Backend** | Rust + Tauri v2 | Native folder dialogs (`rfd`), collision-proof file I/O, OS process launcher |
| **Frontend Framework** | SolidJS + TypeScript | High-performance reactive UI without virtual DOM overhead |
| **Styling** | Vanilla CSS (Raw CSS) | HSL design tokens, glassmorphism, responsive grid, micro-animations |
| **PDF Rasterization Engine** | Mozilla `pdfjs-dist` | Vector-accurate text, font glyphs, and high-DPI canvas rendering |
| **DOCX Layout Engine** | `docx-preview` + Canvas | Native OpenXML formatting, styles, tables, and pagination |

---

## 📦 How to Run with Bun

### Install Dependencies
```bash
bun install
```

### Development Mode
```bash
bun run tauri dev
```

### Production Build
```bash
bun run tauri build
```
The standalone executable will be located in:
`src-tauri/target/release/doc-to-image.exe`
