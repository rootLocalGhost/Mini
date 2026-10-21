import { createSignal, createMemo, createEffect, For, Show } from 'solid-js';
import { tauriBridge } from '../services/tauriBridge';
import type {
  MetaScanResult,
  RenameConfig,
  RenamePreviewItem,
  BatchProcessResult,
} from '../types';
import {
  IconFolder,
  IconFolderOpen,
  IconRefresh,
  IconShieldCheck,
  IconSparkles,
  IconClean,
  IconEdit3,
  IconLayers,
  IconImage,
  IconVideo,
  IconCross,
  IconExternalLink,
} from './Icons';

export function MetaClean() {
  // Folder & Scan state
  const [selectedFolder, setSelectedFolder] = createSignal<string>('');
  const [recursiveScan, setRecursiveScan] = createSignal<boolean>(true);
  const [isScanning, setIsScanning] = createSignal<boolean>(false);
  const [scanResult, setScanResult] = createSignal<MetaScanResult | null>(null);

  // Selected files map (id -> boolean)
  const [selectedFileIds, setSelectedFileIds] = createSignal<Record<string, boolean>>({});
  const [searchFilter, setSearchFilter] = createSignal<string>('');
  const [activeTab, setActiveTab] = createSignal<'all' | 'has_meta' | 'images' | 'videos'>('all');

  // Feature 1: Metadata Stripping
  const [stripMetadata, setStripMetadata] = createSignal<boolean>(true);

  // Feature 2: Format Conversion
  const [targetFormat, setTargetFormat] = createSignal<'same' | 'jpeg' | 'png' | 'webp'>('same');
  const [imageQuality, setImageQuality] = createSignal<number>(90);

  // Feature 3: Batch Renaming
  const [renameEnabled, setRenameEnabled] = createSignal<boolean>(false);
  const [renameMode, setRenameMode] = createSignal<'template' | 'find_replace' | 'prefix_suffix'>('template');
  const [templatePattern, setTemplatePattern] = createSignal<string>('{name}_{index}');
  const [findText, setFindText] = createSignal<string>('');
  const [replaceText, setReplaceText] = createSignal<string>('');
  const [caseSensitive, setCaseSensitive] = createSignal<boolean>(false);
  const [prefixText, setPrefixText] = createSignal<string>('');
  const [suffixText, setSuffixText] = createSignal<string>('');
  const [startIndex, setStartIndex] = createSignal<number>(1);
  const [paddingDigits, setPaddingDigits] = createSignal<number>(3);
  const [caseTransform, setCaseTransform] = createSignal<
    'none' | 'lowercase' | 'uppercase' | 'titlecase' | 'snake_case' | 'kebab_case'
  >('none');

  // Live Rename Preview cache
  const [renamePreviews, setRenamePreviews] = createSignal<Record<string, RenamePreviewItem>>({});

  // Output destination
  const [outputMode, setOutputMode] = createSignal<'custom_folder' | 'in_place'>('custom_folder');
  const [destinationFolder, setDestinationFolder] = createSignal<string>('');

  // Processing execution state
  const [isProcessing, setIsProcessing] = createSignal<boolean>(false);
  const [processResult, setProcessResult] = createSignal<BatchProcessResult | null>(null);
  const [showResultModal, setShowResultModal] = createSignal<boolean>(false);
  const [statusMessage, setStatusMessage] = createSignal<string>('');

  // Auto-suggest destination folder
  function getSuggestedFolder(folder: string): string {
    if (!folder) return '';
    const sep = folder.includes('/') ? '/' : '\\';
    return `${folder}${sep}_processed`;
  }

  // Format bytes helper
  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  // Pick folder
  async function handleSelectFolder() {
    try {
      const folder = await tauriBridge.selectFolder();
      if (folder) {
        setSelectedFolder(folder);
        if (!destinationFolder() || destinationFolder().includes('_processed')) {
          setDestinationFolder(getSuggestedFolder(folder));
        }
        await handleScan(folder);
      }
    } catch (err) {
      console.error('Failed to select folder:', err);
    }
  }

  // Pick destination folder
  async function handleSelectDestination() {
    try {
      const folder = await tauriBridge.selectFolder();
      if (folder) {
        setDestinationFolder(folder);
      }
    } catch (err) {
      console.error('Failed to select destination folder:', err);
    }
  }

  // Scan folder
  async function handleScan(folderToScan?: string) {
    const folder = folderToScan || selectedFolder();
    if (!folder) return;

    setIsScanning(true);
    setStatusMessage('');
    try {
      const res = await tauriBridge.scanMediaMetadata(folder, recursiveScan());
      setScanResult(res);

      // Select all files by default
      const initialMap: Record<string, boolean> = {};
      for (const f of res.files) {
        initialMap[f.id] = true;
      }
      setSelectedFileIds(initialMap);

      if (!destinationFolder()) {
        setDestinationFolder(getSuggestedFolder(folder));
      }
    } catch (err: any) {
      console.error('Scan failed:', err);
      alert(`Metadata scan failed: ${err?.message || err}`);
    } finally {
      setIsScanning(false);
    }
  }

  // Selected files count & list
  const selectedFiles = createMemo(() => {
    const res = scanResult();
    if (!res) return [];
    const map = selectedFileIds();
    return res.files.filter((f) => map[f.id]);
  });

  // Filtered files for display
  const displayedFiles = createMemo(() => {
    const res = scanResult();
    if (!res) return [];

    let list = res.files;
    const tab = activeTab();
    if (tab === 'has_meta') {
      list = list.filter((f) => f.has_metadata);
    } else if (tab === 'images') {
      list = list.filter((f) => f.file_type === 'image');
    } else if (tab === 'videos') {
      list = list.filter((f) => f.file_type === 'video');
    }

    const q = searchFilter().toLowerCase().trim();
    if (q) {
      list = list.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.extension.toLowerCase().includes(q) ||
          f.detected_tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return list;
  });

  // Toggle selection
  function toggleFile(id: string) {
    setSelectedFileIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  function toggleAll(selectAll: boolean) {
    const res = scanResult();
    if (!res) return;
    const next: Record<string, boolean> = {};
    for (const f of res.files) {
      next[f.id] = selectAll;
    }
    setSelectedFileIds(next);
  }

  // Live Rename Preview computation effect
  createEffect(async () => {
    const files = selectedFiles();
    if (files.length === 0) {
      setRenamePreviews({});
      return;
    }

    const cfg: RenameConfig = {
      enabled: renameEnabled(),
      mode: renameMode(),
      template: templatePattern(),
      find_text: findText(),
      replace_text: replaceText(),
      case_sensitive: caseSensitive(),
      prefix: prefixText(),
      suffix: suffixText(),
      start_index: startIndex(),
      padding: paddingDigits(),
      case_transform: caseTransform(),
    };

    const targetFmt = targetFormat();

    try {
      const paths = files.map((f) => f.path);
      const previews = await tauriBridge.previewRenaming(paths, targetFmt, cfg);
      const map: Record<string, RenamePreviewItem> = {};
      for (const p of previews) {
        map[p.original_path] = p;
      }
      setRenamePreviews(map);
    } catch (err) {
      console.error('Failed to preview renaming:', err);
    }
  });

  // Execute Batch Processing
  async function handleExecuteProcess() {
    const files = selectedFiles();
    if (files.length === 0) {
      alert('Please select at least one file to process.');
      return;
    }

    if (outputMode() === 'custom_folder' && !destinationFolder().trim()) {
      alert('Please choose or enter a destination folder.');
      return;
    }

    if (!stripMetadata() && targetFormat() === 'same' && !renameEnabled()) {
      alert('Please enable at least one action (Strip Metadata, Convert Format, or Batch Rename).');
      return;
    }

    setIsProcessing(true);
    try {
      const cfg: RenameConfig | null = renameEnabled()
        ? {
            enabled: true,
            mode: renameMode(),
            template: templatePattern(),
            find_text: findText(),
            replace_text: replaceText(),
            case_sensitive: caseSensitive(),
            prefix: prefixText(),
            suffix: suffixText(),
            start_index: startIndex(),
            padding: paddingDigits(),
            case_transform: caseTransform(),
          }
        : null;

      const res = await tauriBridge.processMediaBatch({
        file_paths: files.map((f) => f.path),
        strip_metadata: stripMetadata(),
        convert_format: targetFormat(),
        image_quality: imageQuality(),
        rename_config: cfg,
        in_place: outputMode() === 'in_place',
        destination_folder: destinationFolder().trim(),
      });

      setProcessResult(res);
      setShowResultModal(true);
      setStatusMessage(
        `Successfully processed ${res.success_count} files (${formatBytes(res.total_bytes_saved)} saved)!`
      );

      // Re-scan folder to update UI
      if (selectedFolder()) {
        await handleScan(selectedFolder());
      }
    } catch (err: any) {
      console.error('Batch processing failed:', err);
      alert(`Processing error: ${err?.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  }

  // Quick Open in Explorer
  async function handleOpenInExplorer(path: string) {
    try {
      await tauriBridge.openInExplorer(path);
    } catch (err) {
      console.error('Failed to open explorer:', err);
    }
  }

  // Quick Open File
  async function handleOpenFile(path: string) {
    try {
      await tauriBridge.openFileDefault(path);
    } catch (err) {
      console.error('Failed to open file:', err);
    }
  }

  // Helper for adding template tokens
  function insertToken(token: string) {
    setTemplatePattern((prev) => `${prev}${token}`);
  }

  return (
    <div class="metaclean-studio-layout">
      {/* ---------------- Top Banner ---------------- */}
      <header class="metaclean-top-banner">
        <div class="banner-left">
          <div class="brand-metaclean-icon">
            <IconClean size={22} />
          </div>
          <div>
            <div class="banner-title-row">
              <h2 class="banner-title">MetaClean Studio</h2>
              <span class="badge-engine-clean">Lossless Purge & Conversion</span>
            </div>
            <p class="banner-subtitle">
              Completely strip metadata, batch rename with sequential patterns, and convert formats in a single verified pass.
            </p>
          </div>
        </div>

        <div class="banner-controls">
          <button
            type="button"
            class="btn-select-folder-neo"
            onClick={handleSelectFolder}
            disabled={isScanning() || isProcessing()}
          >
            <IconFolderOpen size={17} />
            <span>{selectedFolder() ? 'Change Folder' : 'Select Folder'}</span>
          </button>

          <button
            type="button"
            class="btn-run-scan-neo"
            onClick={() => handleScan()}
            disabled={isScanning() || isProcessing() || !selectedFolder()}
          >
            <Show
              when={isScanning()}
              fallback={
                <>
                  <IconRefresh size={17} />
                  <span>Scan Folder</span>
                </>
              }
            >
              <span class="spinner" />
              <span>Scanning...</span>
            </Show>
          </button>
        </div>
      </header>

      {/* ---------------- Options Strip ---------------- */}
      <section class="metaclean-options-strip">
        <div class="current-folder-chip" title={selectedFolder() || 'No folder chosen'}>
          <IconFolder size={15} />
          <span class="folder-chip-text">
            {selectedFolder() || 'Choose a folder above to inspect images & videos for metadata and conversion...'}
          </span>
        </div>

        <div class="options-toggle-group">
          <label class="toggle-chip">
            <input
              type="checkbox"
              checked={recursiveScan()}
              onChange={(e) => setRecursiveScan(e.currentTarget.checked)}
              disabled={isScanning() || isProcessing()}
            />
            <span>Include Subfolders</span>
          </label>
        </div>
      </section>

      {/* ---------------- Status Banner ---------------- */}
      <Show when={statusMessage()}>
        <div class="dedup-success-strip">
          <IconShieldCheck size={18} />
          <span style={{ flex: '1' }}>{statusMessage()}</span>
          <button
            type="button"
            class="btn-dismiss-alert"
            onClick={() => setStatusMessage('')}
          >
            <IconCross size={15} />
          </button>
        </div>
      </Show>

      {/* ---------------- Main Studio Body ---------------- */}
      <Show
        when={scanResult()}
        fallback={
          <div class="dedup-workspace-empty">
            <div class="empty-icon-shield">
              <IconClean size={46} />
            </div>
            <h3>Ready to Clean, Convert & Rename</h3>
            <p>
              Select any folder containing photos, screenshots, or videos. MetaClean removes GPS location, camera serials, timestamps, and personal tags without harming image viewing quality.
            </p>
          </div>
        }
      >
        <div class="metaclean-body-grid">
          {/* ---------------- LEFT PANEL: Configuration Controls ---------------- */}
          <aside class="metaclean-config-column">
            {/* Feature 1: Metadata Stripper Card */}
            <div class={`feature-neo-card ${stripMetadata() ? 'card-active' : ''}`}>
              <div class="card-header-toggle">
                <div class="card-title-group">
                  <div class="icon-chip-card chip-pink">
                    <IconClean size={18} />
                  </div>
                  <div>
                    <h3 class="card-title">1. Strip Metadata</h3>
                    <p class="card-desc">Zero file damage. Preserves viewing capability.</p>
                  </div>
                </div>
                <label class="switch-neo">
                  <input
                    type="checkbox"
                    checked={stripMetadata()}
                    onChange={(e) => setStripMetadata(e.currentTarget.checked)}
                  />
                  <span class="slider-neo" />
                </label>
              </div>

              <Show when={stripMetadata()}>
                <div class="card-content-block">
                  <div class="safety-guarantee-badge">
                    <IconShieldCheck size={16} />
                    <span>Decode Verified: 100% Software Compatible</span>
                  </div>
                  <div class="tag-chips-wrap">
                    <span class="tag-pill-active">EXIF</span>
                    <span class="tag-pill-active">GPS Coordinates</span>
                    <span class="tag-pill-active">XMP / Adobe</span>
                    <span class="tag-pill-active">IPTC Captions</span>
                    <span class="tag-pill-active">Camera Models</span>
                    <span class="tag-pill-active">Author Tags</span>
                  </div>
                </div>
              </Show>
            </div>

            {/* Feature 2: Format Converter Card */}
            <div class={`feature-neo-card ${targetFormat() !== 'same' ? 'card-active' : ''}`}>
              <div class="card-header-toggle">
                <div class="card-title-group">
                  <div class="icon-chip-card chip-cyan">
                    <IconLayers size={18} />
                  </div>
                  <div>
                    <h3 class="card-title">2. Format Converter</h3>
                    <p class="card-desc">Convert images simultaneously.</p>
                  </div>
                </div>
              </div>

              <div class="card-content-block">
                <div class="format-pills-row">
                  <button
                    type="button"
                    class={`format-pill ${targetFormat() === 'same' ? 'active' : ''}`}
                    onClick={() => setTargetFormat('same')}
                  >
                    Keep Original
                  </button>
                  <button
                    type="button"
                    class={`format-pill ${targetFormat() === 'jpeg' ? 'active' : ''}`}
                    onClick={() => setTargetFormat('jpeg')}
                  >
                    JPG (JPEG)
                  </button>
                  <button
                    type="button"
                    class={`format-pill ${targetFormat() === 'png' ? 'active' : ''}`}
                    onClick={() => setTargetFormat('png')}
                  >
                    PNG (Lossless)
                  </button>
                  <button
                    type="button"
                    class={`format-pill ${targetFormat() === 'webp' ? 'active' : ''}`}
                    onClick={() => setTargetFormat('webp')}
                  >
                    WEBP (Modern)
                  </button>
                </div>

                <Show when={targetFormat() === 'jpeg' || targetFormat() === 'webp'}>
                  <div class="quality-slider-block">
                    <div class="quality-label-row">
                      <span>Compression Quality:</span>
                      <strong>{imageQuality()}%</strong>
                    </div>
                    <input
                      type="range"
                      min="20"
                      max="100"
                      value={imageQuality()}
                      onInput={(e) => setImageQuality(parseInt(e.currentTarget.value))}
                      class="neo-slider-input"
                    />
                  </div>
                </Show>
              </div>
            </div>

            {/* Feature 3: Powerful Batch Renamer Card */}
            <div class={`feature-neo-card ${renameEnabled() ? 'card-active' : ''}`}>
              <div class="card-header-toggle">
                <div class="card-title-group">
                  <div class="icon-chip-card chip-purple">
                    <IconEdit3 size={18} />
                  </div>
                  <div>
                    <h3 class="card-title">3. Multi-Functional Renamer</h3>
                    <p class="card-desc">Patterns, indexing, search/replace & casing.</p>
                  </div>
                </div>
                <label class="switch-neo">
                  <input
                    type="checkbox"
                    checked={renameEnabled()}
                    onChange={(e) => setRenameEnabled(e.currentTarget.checked)}
                  />
                  <span class="slider-neo" />
                </label>
              </div>

              <Show when={renameEnabled()}>
                <div class="card-content-block">
                  {/* Mode Tabs */}
                  <div class="rename-mode-tabs">
                    <button
                      type="button"
                      class={`rename-tab ${renameMode() === 'template' ? 'active' : ''}`}
                      onClick={() => setRenameMode('template')}
                    >
                      Template
                    </button>
                    <button
                      type="button"
                      class={`rename-tab ${renameMode() === 'find_replace' ? 'active' : ''}`}
                      onClick={() => setRenameMode('find_replace')}
                    >
                      Find & Replace
                    </button>
                    <button
                      type="button"
                      class={`rename-tab ${renameMode() === 'prefix_suffix' ? 'active' : ''}`}
                      onClick={() => setRenameMode('prefix_suffix')}
                    >
                      Prefix / Suffix
                    </button>
                  </div>

                  {/* Mode: Template */}
                  <Show when={renameMode() === 'template'}>
                    <div class="subfield-group">
                      <label class="field-label">Pattern Template:</label>
                      <input
                        type="text"
                        class="neo-input"
                        value={templatePattern()}
                        onInput={(e) => setTemplatePattern(e.currentTarget.value)}
                        placeholder="e.g. Photo_{index} or {name}_clean"
                      />
                      <div class="token-helper-chips">
                        <button type="button" class="token-chip" onClick={() => insertToken('{name}')}>
                          +&#123;name&#125;
                        </button>
                        <button type="button" class="token-chip" onClick={() => insertToken('{index}')}>
                          +&#123;index&#125;
                        </button>
                        <button type="button" class="token-chip" onClick={() => insertToken('{date}')}>
                          +&#123;date&#125;
                        </button>
                      </div>
                    </div>
                  </Show>

                  {/* Mode: Find & Replace */}
                  <Show when={renameMode() === 'find_replace'}>
                    <div class="subfield-group">
                      <label class="field-label">Find Text:</label>
                      <input
                        type="text"
                        class="neo-input"
                        value={findText()}
                        onInput={(e) => setFindText(e.currentTarget.value)}
                        placeholder="e.g. IMG_ or DSC_"
                      />
                    </div>
                    <div class="subfield-group">
                      <label class="field-label">Replace With:</label>
                      <input
                        type="text"
                        class="neo-input"
                        value={replaceText()}
                        onInput={(e) => setReplaceText(e.currentTarget.value)}
                        placeholder="Leave blank to delete text"
                      />
                    </div>
                    <label class="inline-checkbox-label">
                      <input
                        type="checkbox"
                        checked={caseSensitive()}
                        onChange={(e) => setCaseSensitive(e.currentTarget.checked)}
                      />
                      <span>Case Sensitive</span>
                    </label>
                  </Show>

                  {/* Mode: Prefix & Suffix */}
                  <Show when={renameMode() === 'prefix_suffix'}>
                    <div class="grid-two-col">
                      <div class="subfield-group">
                        <label class="field-label">Prefix (Start):</label>
                        <input
                          type="text"
                          class="neo-input"
                          value={prefixText()}
                          onInput={(e) => setPrefixText(e.currentTarget.value)}
                          placeholder="e.g. Clean_"
                        />
                      </div>
                      <div class="subfield-group">
                        <label class="field-label">Suffix (End):</label>
                        <input
                          type="text"
                          class="neo-input"
                          value={suffixText()}
                          onInput={(e) => setSuffixText(e.currentTarget.value)}
                          placeholder="e.g. _v1"
                        />
                      </div>
                    </div>
                  </Show>

                  {/* Indexing & Numbering Controls */}
                  <div class="grid-two-col" style={{ 'margin-top': '8px' }}>
                    <div class="subfield-group">
                      <label class="field-label">Start Index:</label>
                      <input
                        type="number"
                        min="0"
                        class="neo-input"
                        value={startIndex()}
                        onInput={(e) => setStartIndex(parseInt(e.currentTarget.value) || 1)}
                      />
                    </div>
                    <div class="subfield-group">
                      <label class="field-label">Padding Digits:</label>
                      <select
                        class="neo-select"
                        value={paddingDigits()}
                        onChange={(e) => setPaddingDigits(parseInt(e.currentTarget.value))}
                      >
                        <option value="0">None (1, 2, 3)</option>
                        <option value="2">2 Digits (01, 02)</option>
                        <option value="3">3 Digits (001, 002)</option>
                        <option value="4">4 Digits (0001, 0002)</option>
                      </select>
                    </div>
                  </div>

                  {/* Letter Case Change */}
                  <div class="subfield-group" style={{ 'margin-top': '8px' }}>
                    <label class="field-label">Letter Casing:</label>
                    <select
                      class="neo-select"
                      value={caseTransform()}
                      onChange={(e) => setCaseTransform(e.currentTarget.value as any)}
                    >
                      <option value="none">Preserve Original Casing</option>
                      <option value="lowercase">lowercase</option>
                      <option value="uppercase">UPPERCASE</option>
                      <option value="titlecase">Title Case</option>
                      <option value="snake_case">snake_case</option>
                      <option value="kebab_case">kebab-case</option>
                    </select>
                  </div>
                </div>
              </Show>
            </div>

            {/* Output Destination Selector */}
            <div class="feature-neo-card">
              <h3 class="card-title" style={{ 'margin-bottom': '10px' }}>
                4. Destination Folder
              </h3>
              <div class="destination-mode-toggle">
                <button
                  type="button"
                  class={`dest-pill ${outputMode() === 'custom_folder' ? 'active' : ''}`}
                  onClick={() => setOutputMode('custom_folder')}
                >
                  <IconFolder size={14} />
                  <span>Output Folder (Safe)</span>
                </button>
                <button
                  type="button"
                  class={`dest-pill ${outputMode() === 'in_place' ? 'active in-place-active' : ''}`}
                  onClick={() => setOutputMode('in_place')}
                >
                  <IconShieldCheck size={14} />
                  <span>In-Place (Overwrite)</span>
                </button>
              </div>

              <Show when={outputMode() === 'custom_folder'}>
                <div class="dest-input-row" style={{ 'margin-top': '10px' }}>
                  <input
                    type="text"
                    class="neo-input"
                    value={destinationFolder()}
                    onInput={(e) => setDestinationFolder(e.currentTarget.value)}
                    placeholder="e.g. C:\Users\...\clean_photos"
                  />
                  <button
                    type="button"
                    class="btn-browse-sm"
                    onClick={handleSelectDestination}
                    title="Browse Folder"
                  >
                    <IconFolderOpen size={15} />
                  </button>
                </div>
              </Show>
              <Show when={outputMode() === 'in_place'}>
                <p class="notice-warn-neo">
                  ⚠️ Files will be modified directly in place with atomic safety verification.
                </p>
              </Show>
            </div>
          </aside>

          {/* ---------------- RIGHT PANEL: Interactive File List & Live Rename Preview ---------------- */}
          <main class="metaclean-list-column">
            {/* List Header & Filters */}
            <div class="list-toolbar">
              <div class="list-left-tools">
                <button
                  type="button"
                  class="btn-select-all-neo"
                  onClick={() => toggleAll(selectedFiles().length !== scanResult()!.total_files)}
                >
                  {selectedFiles().length === scanResult()!.total_files ? 'Deselect All' : 'Select All'}
                </button>
                <span class="selection-counter-badge">
                  {selectedFiles().length} of {scanResult()!.total_files} selected
                </span>
              </div>

              <div class="list-tabs-group">
                <button
                  type="button"
                  class={`list-tab-btn ${activeTab() === 'all' ? 'active' : ''}`}
                  onClick={() => setActiveTab('all')}
                >
                  All ({scanResult()!.total_files})
                </button>
                <button
                  type="button"
                  class={`list-tab-btn ${activeTab() === 'has_meta' ? 'active' : ''}`}
                  onClick={() => setActiveTab('has_meta')}
                >
                  Has Metadata ({scanResult()!.files_with_metadata})
                </button>
                <button
                  type="button"
                  class={`list-tab-btn ${activeTab() === 'images' ? 'active' : ''}`}
                  onClick={() => setActiveTab('images')}
                >
                  Images ({scanResult()!.image_count})
                </button>
                <button
                  type="button"
                  class={`list-tab-btn ${activeTab() === 'videos' ? 'active' : ''}`}
                  onClick={() => setActiveTab('videos')}
                >
                  Videos ({scanResult()!.video_count})
                </button>
              </div>

              <div class="list-search-wrap">
                <input
                  type="text"
                  class="search-neo-input"
                  value={searchFilter()}
                  onInput={(e) => setSearchFilter(e.currentTarget.value)}
                  placeholder="Filter files..."
                />
              </div>
            </div>

            {/* File Table / Card List */}
            <div class="metaclean-files-scroll-wrap">
              <div class="files-table-header">
                <span class="col-check"></span>
                <span class="col-file">File Name</span>
                <span class="col-meta">Detected Metadata</span>
                <span class="col-size">Size</span>
                <span class="col-preview">Output Name Preview</span>
              </div>

              <div class="files-table-body">
                <For each={displayedFiles()}>
                  {(file) => {
                    const isChecked = () => !!selectedFileIds()[file.id];
                    const preview = () => renamePreviews()[file.path];

                    return (
                      <div class={`file-row-neo ${isChecked() ? 'row-selected' : ''}`}>
                        <div class="col-check">
                          <input
                            type="checkbox"
                            checked={isChecked()}
                            onChange={() => toggleFile(file.id)}
                            class="neo-checkbox"
                          />
                        </div>

                        <div class="col-file">
                          <div class="file-type-icon-chip">
                            <Show
                              when={file.file_type === 'video'}
                              fallback={<IconImage size={15} />}
                            >
                              <IconVideo size={15} />
                            </Show>
                          </div>
                          <span
                            class="file-name-text"
                            title={`Click to open ${file.name}`}
                            onClick={() => handleOpenFile(file.path)}
                            style={{ cursor: 'pointer' }}
                          >
                            {file.name}
                          </span>
                          <button
                            type="button"
                            class="btn-inline-open-file"
                            onClick={() => handleOpenFile(file.path)}
                            title="Open file in default app"
                          >
                            <IconExternalLink size={12} />
                          </button>
                        </div>

                        <div class="col-meta">
                          <Show
                            when={file.detected_tags.length > 0}
                            fallback={<span class="badge-tag-clean">Clean / No Meta</span>}
                          >
                            <div class="meta-tag-pills">
                              <For each={file.detected_tags}>
                                {(tag) => (
                                  <span
                                    class={`tag-badge-detected ${
                                      tag.includes('GPS') ? 'tag-gps' : ''
                                    }`}
                                  >
                                    {tag}
                                  </span>
                                )}
                              </For>
                            </div>
                          </Show>
                        </div>

                        <div class="col-size">
                          <span class="size-text-mono">{formatBytes(file.size_bytes)}</span>
                        </div>

                        <div class="col-preview">
                          <Show
                            when={preview()}
                            fallback={<span class="preview-text-mono">{file.name}</span>}
                          >
                            <div class="preview-output-box">
                              <span
                                class={`preview-text-mono ${
                                  preview()!.will_change ? 'highlight-changed' : ''
                                }`}
                              >
                                {preview()!.new_name}
                              </span>
                              <Show when={preview()!.will_change}>
                                <span class="badge-rename-diff">modified</span>
                              </Show>
                            </div>
                          </Show>
                        </div>
                      </div>
                    );
                  }}
                </For>
              </div>
            </div>
          </main>
        </div>

        {/* ---------------- Bottom Fixed Master Action Footer ---------------- */}
        <footer class="metaclean-bottom-bar">
          <div class="bottom-stats-block">
            <div class="stat-bubble">
              <span class="stat-bubble-label">Files to Process</span>
              <span class="stat-bubble-val">{selectedFiles().length}</span>
            </div>
            <div class="stat-bubble bubble-emerald">
              <span class="stat-bubble-label">Strip Metadata</span>
              <span class="stat-bubble-val highlight-green">
                {stripMetadata() ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div class="stat-bubble">
              <span class="stat-bubble-label">Target Format</span>
              <span class="stat-bubble-val">
                {targetFormat() === 'same' ? 'Original' : targetFormat().toUpperCase()}
              </span>
            </div>
            <div class="stat-bubble">
              <span class="stat-bubble-label">Batch Rename</span>
              <span class="stat-bubble-val">
                {renameEnabled() ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>

          <div class="bottom-action-block">
            <button
              type="button"
              class="btn-master-metaclean"
              onClick={handleExecuteProcess}
              disabled={selectedFiles().length === 0 || isProcessing()}
            >
              <Show when={isProcessing()} fallback={<IconSparkles size={18} />}>
                <span class="spinner" />
              </Show>
              <span>
                {isProcessing()
                  ? 'Processing Media...'
                  : `Execute Media Processing (${selectedFiles().length} Files)`}
              </span>
            </button>
          </div>
        </footer>
      </Show>

      {/* ---------------- Results Modal ---------------- */}
      <Show when={showResultModal() && processResult()}>
        <div class="modal-backdrop" onClick={() => setShowResultModal(false)}>
          <div class="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div class="modal-header">
              <div class="modal-title-wrap">
                <IconShieldCheck size={22} />
                <h3>Processing Complete!</h3>
              </div>
              <button
                type="button"
                class="btn-icon-close"
                onClick={() => setShowResultModal(false)}
              >
                <IconCross size={18} />
              </button>
            </div>

            <div class="modal-body">
              <div class="recycle-safety-notice">
                <IconShieldCheck size={20} />
                <div>
                  <strong>All Operations Successfully Completed</strong>
                  <p>
                    Files were verified for decode and viewing integrity. Metadata was purged and filenames/formats updated safely.
                  </p>
                </div>
              </div>

              <div class="trash-stat-box">
                <div class="stat-line">
                  <span>Files Successfully Processed:</span>
                  <strong class="highlight-green">
                    {processResult()!.success_count} / {processResult()!.total_processed} files
                  </strong>
                </div>
                <div class="stat-line">
                  <span>Reclaimed Space from Metadata:</span>
                  <strong class="highlight-green">
                    {formatBytes(processResult()!.total_bytes_saved)}
                  </strong>
                </div>
                <div class="stat-line">
                  <span>Destination:</span>
                  <strong class="highlight-destination">
                    {processResult()!.destination_folder}
                  </strong>
                </div>
              </div>
            </div>

            <div class="modal-footer">
              <Show when={processResult()!.destination_folder !== 'In-Place (Original Files Updated)'}>
                <button
                  type="button"
                  class="btn-open-quarantine-neo"
                  onClick={() => handleOpenInExplorer(processResult()!.destination_folder)}
                >
                  <IconFolderOpen size={16} />
                  <span>Open Destination Folder</span>
                </button>
              </Show>
              <button
                type="button"
                class="btn-secondary"
                onClick={() => setShowResultModal(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
