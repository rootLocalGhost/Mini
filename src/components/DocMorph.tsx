import { createSignal, createMemo, For, Show } from 'solid-js';
import { tauriBridge } from '../services/tauriBridge';
import { convertPdf } from '../services/pdfConverter';
import { convertDocx } from '../services/docxConverter';
import type { FileItemState, SavedImageInfo } from '../types';
import {
  IconFolder,
  IconFolderOpen,
  IconPdf,
  IconDocx,
  IconSparkles,
  IconPlay,
  IconCheck,
  IconCross,
  IconImage,
  IconExternalLink,
  IconShieldCheck,
} from './Icons';

export function DocMorph() {

  // Folder & File selection state
  const [selectedFolder, setSelectedFolder] = createSignal<string>('');
  const [isScanning, setIsScanning] = createSignal<boolean>(false);
  const [fileItems, setFileItems] = createSignal<FileItemState[]>([]);
  const [filterType, setFilterType] = createSignal<'all' | 'docx' | 'pdf'>('all');
  const [recursiveScan, setRecursiveScan] = createSignal<boolean>(false);

  // Conversion Options
  const [scale, setScale] = createSignal<number>(2.0); // 1.0 to 6.0
  const [format, setFormat] = createSignal<'png' | 'jpg'>('png');
  const [jpegQuality, setJpegQuality] = createSignal<number>(0.92);
  const [outputFolderName, setOutputFolderName] = createSignal<string>('converted_images');
  const [resolvedOutputDir, setResolvedOutputDir] = createSignal<string>('');

  // Conversion Progress & Execution State
  const [isConverting, setIsConverting] = createSignal<boolean>(false);
  const [isCancelled, setIsCancelled] = createSignal<boolean>(false);
  const [overallProgress, setOverallProgress] = createSignal<number>(0);
  const [currentFileIndex, setCurrentFileIndex] = createSignal<number>(0);
  const [currentFileName, setCurrentFileName] = createSignal<string>('');
  const [activeThumbnail, setActiveThumbnail] = createSignal<string>('');
  const [allSavedImages, setAllSavedImages] = createSignal<SavedImageInfo[]>([]);

  // Drawer / Modal for viewing generated images
  const [isGalleryOpen, setIsGalleryOpen] = createSignal<boolean>(false);

  // Format bytes helper
  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  // Calculate resolution & DPI estimate for standard A4 document
  const qualityStats = createMemo(() => {
    const s = scale();
    const dpi = Math.round(96 * s);
    // Standard A4: 8.27 x 11.69 inches
    const a4Width = Math.round(8.27 * dpi);
    const a4Height = Math.round(11.69 * dpi);

    let tierLabel = 'Standard';
    if (s >= 5.0) tierLabel = 'Very Very High (Archival 600 DPI)';
    else if (s >= 4.0) tierLabel = 'Ultra Max (400 DPI)';
    else if (s >= 3.0) tierLabel = 'Standard Print (300 DPI)';
    else if (s >= 2.0) tierLabel = 'Crisp High-Res (192 DPI)';
    else tierLabel = 'Standard Web (96 DPI)';

    return {
      dpi,
      width: a4Width,
      height: a4Height,
      tierLabel,
      scaleFactor: s.toFixed(1),
    };
  });

  // Filtered files view
  const filteredFiles = createMemo(() => {
    const filter = filterType();
    const items = fileItems();
    if (filter === 'all') return items;
    return items.filter((item) => item.file.extension === filter);
  });

  // Selected files count
  const selectedCount = createMemo(() => fileItems().filter((f) => f.selected).length);

  // Folder metrics
  const folderMetrics = createMemo(() => {
    const items = fileItems();
    let docx = 0;
    let pdf = 0;
    let totalBytes = 0;
    for (const item of items) {
      if (item.file.extension === 'docx') docx++;
      else if (item.file.extension === 'pdf') pdf++;
      totalBytes += item.file.size_bytes;
    }
    return { docx, pdf, total: items.length, totalBytesFormatted: formatBytes(totalBytes) };
  });

  // Handle Select Folder Dialog
  async function handleSelectFolder() {
    try {
      const folder = await tauriBridge.selectFolder();
      if (!folder) return;

      setSelectedFolder(folder);
      await scanSelectedFolder(folder, recursiveScan());
    } catch (err) {
      console.error('Folder selection failed:', err);
    }
  }

  // Scan folder
  async function scanSelectedFolder(path: string, recursive: boolean) {
    setIsScanning(true);
    try {
      const result = await tauriBridge.scanFolder(path, recursive);
      const items: FileItemState[] = result.files.map((file) => ({
        file,
        selected: true,
        status: 'pending',
        progress: 0,
        currentPage: 0,
        totalPages: 0,
        savedImages: [],
      }));

      setFileItems(items);
      setResolvedOutputDir(`${path}\\${outputFolderName()}`);
    } catch (err) {
      console.error('Scan failed:', err);
    } finally {
      setIsScanning(false);
    }
  }

  // Handle select all / deselect all
  function toggleSelectAll(select: boolean) {
    setFileItems((prev) =>
      prev.map((item) => ({
        ...item,
        selected: select,
      }))
    );
  }

  // Toggle single file selection
  function toggleFileSelection(id: string) {
    setFileItems((prev) =>
      prev.map((item) => (item.file.id === id ? { ...item, selected: !item.selected } : item))
    );
  }

  // Handle start batch conversion
  async function handleStartConversion() {
    const folder = selectedFolder();
    if (!folder) return;

    const itemsToConvert = fileItems().filter((item) => item.selected);
    if (itemsToConvert.length === 0) return;

    setIsConverting(true);
    setIsCancelled(false);
    setOverallProgress(0);
    setAllSavedImages([]);

    try {
      // 1. Ensure output folder is created inside the selected folder
      const dirRes = await tauriBridge.createOutputDir(folder, outputFolderName());
      setResolvedOutputDir(dirRes.output_path);

      const totalItems = itemsToConvert.length;
      let completedFiles = 0;

      for (let i = 0; i < itemsToConvert.length; i++) {
        if (isCancelled()) {
          break;
        }

        const currentItem = itemsToConvert[i];
        setCurrentFileIndex(i + 1);
        setCurrentFileName(currentItem.file.name);

        // Update status to processing
        setFileItems((prev) =>
          prev.map((item) =>
            item.file.id === currentItem.file.id
              ? { ...item, status: 'processing', progress: 0 }
              : item
          )
        );

        try {
          const opts = {
            scale: scale(),
            format: format(),
            jpegQuality: jpegQuality(),
          };

          let pageResults: {
            pageNumber: number;
            totalPages: number;
            imageBytes: Uint8Array;
            previewDataUrl: string;
          }[] = [];

          const onProgress = (currPage: number, totalPages: number, previewUrl?: string) => {
            if (previewUrl) setActiveThumbnail(previewUrl);
            const filePct = Math.round((currPage / totalPages) * 100);
            setFileItems((prev) =>
              prev.map((item) =>
                item.file.id === currentItem.file.id
                  ? {
                      ...item,
                      currentPage: currPage,
                      totalPages,
                      progress: filePct,
                      thumbnailUrl: previewUrl || item.thumbnailUrl,
                    }
                  : item
              )
            );
          };

          // Convert based on document extension
          if (currentItem.file.extension === 'pdf') {
            const fileBytes = await tauriBridge.readFileBytes(currentItem.file.path);
            pageResults = await convertPdf(fileBytes, opts, onProgress);
          } else if (currentItem.file.extension === 'docx') {
            // Priority 1: Native Microsoft Word automation for 100% faithful formatting and page breaks
            let convertedViaNativeWord = false;
            try {
              const pdfBytes = await tauriBridge.convertDocxToPdfNative(currentItem.file.path);
              if (pdfBytes && pdfBytes.length > 0) {
                pageResults = await convertPdf(pdfBytes, opts, onProgress);
                convertedViaNativeWord = true;
              }
            } catch (nativeWordErr) {
              console.warn('Native Word export unavailable, using webview docx parser:', nativeWordErr);
            }

            // Priority 2: Webview multi-page parser fallback
            if (!convertedViaNativeWord) {
              const fileBytes = await tauriBridge.readFileBytes(currentItem.file.path);
              pageResults = await convertDocx(fileBytes, opts, onProgress);
            }
          } else {
            throw new Error(`Unsupported format: .${currentItem.file.extension}`);
          }

          // Save each page to disk with collision-proof naming
          const savedList: SavedImageInfo[] = [];
          for (const page of pageResults) {
            const savedInfo = await tauriBridge.saveImagePage(
              dirRes.output_path,
              currentItem.file.name,
              page.pageNumber,
              page.totalPages,
              opts.format,
              page.imageBytes
            );
            savedList.push(savedInfo);
            setAllSavedImages((prev) => [...prev, savedInfo]);
          }

          // Mark file as completed
          completedFiles++;
          setFileItems((prev) =>
            prev.map((item) =>
              item.file.id === currentItem.file.id
                ? {
                    ...item,
                    status: 'completed',
                    progress: 100,
                    savedImages: savedList,
                    thumbnailUrl: pageResults[0]?.previewDataUrl || item.thumbnailUrl,
                  }
                : item
            )
          );
        } catch (itemErr) {
          console.error(`Failed to convert ${currentItem.file.name}:`, itemErr);
          setFileItems((prev) =>
            prev.map((item) =>
              item.file.id === currentItem.file.id
                ? {
                    ...item,
                    status: 'failed',
                    errorMessage: String(itemErr),
                  }
                : item
            )
          );
        }

        // Update overall progress
        setOverallProgress(Math.round((completedFiles / totalItems) * 100));
      }
    } catch (err) {
      console.error('Batch conversion error:', err);
    } finally {
      setIsConverting(false);
      setCurrentFileName('');
    }
  }

  // Cancel conversion
  function handleCancelConversion() {
    setIsCancelled(true);
    setIsConverting(false);
  }

  // Open output folder in native Windows Explorer
  async function handleOpenOutputFolder() {
    const path = resolvedOutputDir();
    if (!path) return;
    try {
      await tauriBridge.openInExplorer(path);
    } catch (err) {
      console.error('Failed to open explorer:', err);
    }
  }

  return (
    <div class="app-container">
      {/* ----------------- Top Header ----------------- */}
      <header class="app-header">
        <div class="brand-wrapper">
          <div class="brand-icon-box">
            <IconSparkles size={22} />
          </div>
          <div class="brand-info">
            <h1>Mini<span class="brand-dot">.</span></h1>
            <span class="brand-badge">DOCX & PDF RASTER ENGINE</span>
          </div>
        </div>

        <div class="header-status-group">
          <div class="engine-pill">
            <span class="engine-dot" />
            <span>Rust Tauri v2 Engine Active</span>
          </div>

          <Show when={allSavedImages().length > 0}>
            <button
              id="btn-view-gallery"
              class="btn-secondary"
              onClick={() => setIsGalleryOpen(true)}
            >
              <IconImage size={16} />
              <span>Generated Images ({allSavedImages().length})</span>
            </button>
          </Show>
        </div>
      </header>

      {/* ----------------- Main Workspace ----------------- */}
      <main class="app-main">
        {/* Step 1: Folder Selection Banner */}
        <section class="folder-selection-card">
          <div class="folder-card-header">
            <div class="folder-title-row">
              <span class="folder-icon-box">
                <IconFolder size={18} />
              </span>
              <h2>Source Directory</h2>
            </div>

            <div class="folder-actions-row">
              <label class="toggle-switch-wrapper">
                <input
                  type="checkbox"
                  checked={recursiveScan()}
                  onChange={(e) => {
                    const checked = e.currentTarget.checked;
                    setRecursiveScan(checked);
                    if (selectedFolder()) {
                      scanSelectedFolder(selectedFolder(), checked);
                    }
                  }}
                />
                <span>Include Subfolders</span>
              </label>

              <button
                id="btn-select-folder"
                class="btn-select-folder"
                onClick={handleSelectFolder}
                disabled={isConverting() || isScanning()}
              >
                <Show when={isScanning()} fallback={<IconFolderOpen size={18} />}>
                  <span class="spinner" />
                </Show>
                <span>{isScanning() ? 'Scanning...' : selectedFolder() ? 'Change Folder' : 'Select Folder'}</span>
              </button>
            </div>
          </div>

          {/* Folder Path Bar & File Type Counters */}
          <div class="path-display-bar">
            <span class="path-text">
              {selectedFolder() || 'No directory selected. Click "Select Folder" to choose a folder with DOCX or PDF files.'}
            </span>

            <Show when={fileItems().length > 0}>
              <div class="path-metrics">
                <span class="badge badge-docx">{folderMetrics().docx} DOCX</span>
                <span class="badge badge-pdf">{folderMetrics().pdf} PDF</span>
                <span class="badge badge-total">{folderMetrics().total} Files ({folderMetrics().totalBytesFormatted})</span>
              </div>
            </Show>
          </div>
        </section>

        {/* Step 2: Quality Slider & Output Settings Deck */}
        <section class="settings-grid">
          {/* Quality Slider Panel */}
          <div class="control-panel">
            <div class="panel-header">
              <div class="panel-title">
                <IconSparkles size={18} />
                <span>Rasterization Quality</span>
              </div>
              <div class="quality-readout-pill">
                <span>{qualityStats().scaleFactor}x Scale</span>
                <span>•</span>
                <span>{qualityStats().dpi} DPI</span>
              </div>
            </div>

            <div class="slider-container">
              <input
                id="quality-range-slider"
                type="range"
                min="1.0"
                max="6.0"
                step="0.25"
                value={scale()}
                onInput={(e) => setScale(parseFloat(e.currentTarget.value))}
                class="range-slider"
                disabled={isConverting()}
              />

              {/* Quality Preset Buttons */}
              <div class="quality-presets-row">
                <button
                  type="button"
                  class={`preset-chip ${scale() === 1.0 ? 'active' : ''}`}
                  onClick={() => setScale(1.0)}
                >
                  96 DPI (Web)
                </button>
                <button
                  type="button"
                  class={`preset-chip ${scale() === 2.0 ? 'active' : ''}`}
                  onClick={() => setScale(2.0)}
                >
                  192 DPI (Crisp)
                </button>
                <button
                  type="button"
                  class={`preset-chip ${scale() === 3.0 ? 'active' : ''}`}
                  onClick={() => setScale(3.0)}
                >
                  300 DPI (Print)
                </button>
                <button
                  type="button"
                  class={`preset-chip ${scale() === 4.0 ? 'active' : ''}`}
                  onClick={() => setScale(4.0)}
                >
                  400 DPI (Ultra)
                </button>
                <button
                  type="button"
                  class={`preset-chip ${scale() >= 5.0 ? 'active' : ''}`}
                  onClick={() => setScale(6.0)}
                  title="Master archival rendering up to 600 DPI"
                >
                  600 DPI (Max)
                </button>
              </div>
            </div>

            {/* Live estimated resolution readout */}
            <div class="resolution-preview-card">
              <span>Estimated standard A4 output:</span>
              <span class="resolution-val">
                {qualityStats().width} × {qualityStats().height} px ({qualityStats().tierLabel})
              </span>
            </div>
          </div>

          {/* Output Format & Directory Config Panel */}
          <div class="control-panel">
            <div class="panel-header">
              <div class="panel-title">
                <IconFolder size={18} />
                <span>Output & Format</span>
              </div>

              <div class="protection-guarantee-pill">
                <IconShieldCheck size={14} />
                <span>Never Overwrites</span>
              </div>
            </div>

            <div class="output-form-group">
              <div class="output-label">
                <span>Output Subfolder (inside selected directory)</span>
              </div>
              <div class="output-input-box">
                <span class="folder-prefix-text">/</span>
                <input
                  id="output-folder-input"
                  type="text"
                  value={outputFolderName()}
                  onInput={(e) => {
                    const val = e.currentTarget.value;
                    setOutputFolderName(val);
                    if (selectedFolder()) {
                      setResolvedOutputDir(`${selectedFolder()}\\${val}`);
                    }
                  }}
                  class="output-folder-input"
                  placeholder="converted_images"
                  disabled={isConverting()}
                />
              </div>
            </div>

            <div class="format-selection-group">
              <button
                type="button"
                class={`format-btn ${format() === 'png' ? 'active' : ''}`}
                onClick={() => setFormat('png')}
                disabled={isConverting()}
              >
                <span>PNG (Lossless)</span>
              </button>

              <button
                type="button"
                class={`format-btn ${format() === 'jpg' ? 'active' : ''}`}
                onClick={() => setFormat('jpg')}
                disabled={isConverting()}
              >
                <span>JPEG (Standard)</span>
              </button>
            </div>

            <Show when={format() === 'jpg'}>
              <div class="output-form-group" style={{ "margin-top": "6px" }}>
                <div class="output-label">
                  <span>JPEG Compression: {Math.round(jpegQuality() * 100)}%</span>
                </div>
                <input
                  id="jpeg-quality-slider"
                  type="range"
                  min="0.6"
                  max="1.0"
                  step="0.05"
                  value={jpegQuality()}
                  onInput={(e) => setJpegQuality(parseFloat(e.currentTarget.value))}
                  class="range-slider"
                  disabled={isConverting()}
                />
              </div>
            </Show>
          </div>
        </section>

        {/* Step 3: Document Queue & File List */}
        <section class="queue-section">
          <div class="queue-header">
            <div class="queue-title-row">
              <h3>Document Queue</h3>
              <Show when={fileItems().length > 0}>
                <span class="badge badge-total">{selectedCount()} of {fileItems().length} Selected</span>
              </Show>
            </div>

            <div class="filter-btn-group">
              <button
                type="button"
                class={`filter-chip ${filterType() === 'all' ? 'active' : ''}`}
                onClick={() => setFilterType('all')}
              >
                All Files ({fileItems().length})
              </button>
              <button
                type="button"
                class={`filter-chip ${filterType() === 'docx' ? 'active' : ''}`}
                onClick={() => setFilterType('docx')}
              >
                DOCX ({folderMetrics().docx})
              </button>
              <button
                type="button"
                class={`filter-chip ${filterType() === 'pdf' ? 'active' : ''}`}
                onClick={() => setFilterType('pdf')}
              >
                PDF ({folderMetrics().pdf})
              </button>

              <Show when={fileItems().length > 0}>
                <button
                  type="button"
                  class="filter-chip"
                  onClick={() => toggleSelectAll(selectedCount() < fileItems().length)}
                  disabled={isConverting()}
                >
                  {selectedCount() < fileItems().length ? 'Select All' : 'Deselect All'}
                </button>
              </Show>
            </div>
          </div>

          <div class="queue-scroll-area">
            <Show
              when={filteredFiles().length > 0}
              fallback={
                <div class="empty-queue-placeholder">
                  <div class="empty-queue-icon">
                    <IconFolder size={48} />
                  </div>
                  <p>
                    {selectedFolder()
                      ? 'No matching DOCX or PDF files found in this folder.'
                      : 'Please select a folder above to scan and load DOCX and PDF documents.'}
                  </p>
                </div>
              }
            >
              <For each={filteredFiles()}>
                {(item) => (
                  <div class={`file-card-item ${item.status}`}>
                    <div class="file-card-left">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={() => toggleFileSelection(item.file.id)}
                        disabled={isConverting()}
                        class="checkbox-custom"
                      />

                      <span
                        class={`file-format-badge ${
                          item.file.extension === 'pdf' ? 'badge-pdf' : 'badge-docx'
                        }`}
                        style={{ display: 'inline-flex', 'align-items': 'center', gap: '4px' }}
                      >
                        <Show
                          when={item.file.extension === 'pdf'}
                          fallback={<IconDocx size={13} />}
                        >
                          <IconPdf size={13} />
                        </Show>
                        <span>{item.file.extension}</span>
                      </span>

                      <div class="file-info-group">
                        <span class="file-name-text" title={item.file.path}>
                          {item.file.name}
                        </span>
                        <div class="file-submeta">
                          <span>{formatBytes(item.file.size_bytes)}</span>
                          <Show when={item.totalPages > 0}>
                            <span>•</span>
                            <span>
                              {item.status === 'processing'
                                ? `Page ${item.currentPage} / ${item.totalPages}`
                                : `${item.totalPages} Pages`}
                            </span>
                          </Show>
                          <Show when={item.savedImages.length > 0}>
                            <span>•</span>
                            <span style={{ color: 'var(--nb-emerald)', 'font-weight': '700' }}>
                              ✓ {item.savedImages.length} images saved
                            </span>
                          </Show>
                        </div>
                      </div>
                    </div>

                    <div class="file-card-right">
                      {/* Status indicator */}
                      <Show when={item.status === 'pending'}>
                        <span class="item-status-pill status-pending">Ready</span>
                      </Show>
                      <Show when={item.status === 'processing'}>
                        <span class="item-status-pill status-processing">
                          <span class="spinner" />
                          <span>Converting {item.progress}%</span>
                        </span>
                      </Show>
                      <Show when={item.status === 'completed'}>
                        <span class="item-status-pill status-completed">
                          <IconCheck size={14} />
                          <span>Done</span>
                        </span>
                      </Show>
                      <Show when={item.status === 'failed'}>
                        <span class="item-status-pill status-failed" title={item.errorMessage}>
                          <IconCross size={14} />
                          <span>Failed</span>
                        </span>
                      </Show>

                      {/* Small thumbnail preview */}
                      <Show when={item.thumbnailUrl}>
                        <img
                          src={item.thumbnailUrl}
                          alt="Page preview"
                          class="item-thumb-preview"
                        />
                      </Show>
                    </div>
                  </div>
                )}
              </For>
            </Show>
          </div>
        </section>
      </main>

      {/* ----------------- Bottom Action Bar & Progress ----------------- */}
      <footer class="app-footer">
        <Show when={isConverting() || overallProgress() > 0}>
          <div class="footer-top-progress">
            <div style={{ display: 'flex', 'align-items': 'center', gap: '12px' }}>
              <Show when={activeThumbnail()}>
                <img
                  src={activeThumbnail()}
                  alt="Current rendering preview"
                  class="item-thumb-preview"
                  style={{ width: '28px', height: '36px', 'flex-shrink': '0' }}
                />
              </Show>
              <div style={{ flex: 1, display: 'flex', 'flex-direction': 'column', gap: '6px' }}>
                <div class="progress-labels-row">
                  <span>
                    {isConverting()
                      ? `Converting ${currentFileName()} (File ${currentFileIndex()} of ${selectedCount()})...`
                      : overallProgress() === 100
                      ? 'Batch conversion completed successfully!'
                      : 'Batch conversion paused.'}
                  </span>
                  <span>{overallProgress()}%</span>
                </div>
                <div class="progress-bar-track">
                  <div class="progress-bar-fill" style={{ width: `${overallProgress()}%` }} />
                </div>
              </div>
            </div>
          </div>
        </Show>

        <div class="footer-action-row">
          <div class="footer-left-stats">
            <Show when={selectedFolder()}>
              <button
                id="btn-open-output-folder"
                type="button"
                class="btn-secondary"
                onClick={handleOpenOutputFolder}
                title="Open destination output folder in Windows Explorer"
              >
                <IconExternalLink size={16} />
                <span>Open Output Folder</span>
              </button>
            </Show>

            <Show when={allSavedImages().length > 0}>
              <span style={{ color: 'var(--text-muted)' }}>
                Total Generated: <strong style={{ color: 'var(--text-primary)' }}>{allSavedImages().length} images</strong>
              </span>
            </Show>
          </div>

          <div class="footer-right-buttons">
            <Show when={isConverting()}>
              <button
                id="btn-cancel-conversion"
                type="button"
                class="btn-secondary"
                onClick={handleCancelConversion}
              >
                <IconCross size={16} />
                <span>Cancel</span>
              </button>
            </Show>

            <button
              id="btn-start-conversion"
              type="button"
              class="btn-primary-convert"
              onClick={handleStartConversion}
              disabled={isConverting() || selectedCount() === 0}
            >
              <Show
                when={isConverting()}
                fallback={
                  <>
                    <IconPlay size={18} />
                    <span>Convert {selectedCount()} Selected Document{selectedCount() === 1 ? '' : 's'}</span>
                  </>
                }
              >
                <span class="spinner" />
                <span>Processing...</span>
              </Show>
            </button>
          </div>
        </div>
      </footer>

      {/* ----------------- Generated Images Gallery Drawer ----------------- */}
      <Show when={isGalleryOpen()}>
        <div class="drawer-backdrop" onClick={() => setIsGalleryOpen(false)}>
          <div class="drawer-content" onClick={(e) => e.stopPropagation()}>
            <div class="drawer-header">
              <h3>Converted Images ({allSavedImages().length})</h3>
              <div style={{ display: 'flex', gap: '10px', 'align-items': 'center' }}>
                <button
                  type="button"
                  class="btn-secondary"
                  onClick={handleOpenOutputFolder}
                >
                  <IconExternalLink size={14} />
                  <span>Open Folder</span>
                </button>
                <button
                  type="button"
                  class="btn-icon-close"
                  onClick={() => setIsGalleryOpen(false)}
                >
                  <IconCross size={20} />
                </button>
              </div>
            </div>

            <div class="drawer-body">
              <div class="image-gallery-grid">
                <For each={allSavedImages()}>
                  {(img) => (
                    <div class="gallery-card">
                      <div class="gallery-card-meta">
                        <span class="gallery-card-name" title={img.file_name}>
                          {img.file_name}
                        </span>
                        <span>
                          Page {img.page_number} of {img.total_pages} • {formatBytes(img.size_bytes)}
                        </span>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
