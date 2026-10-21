import { createSignal, createMemo, For, Show } from 'solid-js';
import { convertFileSrc, isTauri } from '@tauri-apps/api/core';
import { tauriBridge } from '../services/tauriBridge';
import type { DuplicateGroup, DuplicateScanResult } from '../types';
import {
  IconFolder,
  IconFolderOpen,
  IconTrash,
  IconVideo,
  IconDuplicate,
  IconRefresh,
  IconChevronLeft,
  IconChevronRight,
  IconCheck,
  IconCross,
  IconExternalLink,
  IconShieldCheck,
  IconEye,
} from './Icons';


export function MediaDeduper() {
  // Folder & Scan Configuration
  const [selectedFolder, setSelectedFolder] = createSignal<string>('');
  const [recursiveScan, setRecursiveScan] = createSignal<boolean>(true);
  const [checkImages, setCheckImages] = createSignal<boolean>(true);
  const [checkVideos, setCheckVideos] = createSignal<boolean>(true);
  const [similarityThreshold, setSimilarityThreshold] = createSignal<number>(5);
  const [isScanning, setIsScanning] = createSignal<boolean>(false);
  const [scanResult, setScanResult] = createSignal<DuplicateScanResult | null>(null);

  // Group Navigation & Search
  const [activeGroupIndex, setActiveGroupIndex] = createSignal<number>(0);
  const [searchQuery, setSearchQuery] = createSignal<string>('');
  const [filterMode, setFilterMode] = createSignal<'all' | 'exact' | 'visual'>('all');

  // Map of fileId -> boolean (true = marked for Recycle Bin)
  const [trashMarkedIds, setTrashMarkedIds] = createSignal<Record<string, boolean>>({});

  // Trashing & Removal Execution State
  const [isTrashing, setIsTrashing] = createSignal<boolean>(false);
  const [showTrashConfirm, setShowTrashConfirm] = createSignal<boolean>(false);
  const [trashSuccessMessage, setTrashSuccessMessage] = createSignal<string>('');
  const [removalMode, setRemovalMode] = createSignal<'recycle' | 'custom_folder'>('recycle');
  const [customFolderPath, setCustomFolderPath] = createSignal<string>('');
  const [lastMovedFolder, setLastMovedFolder] = createSignal<string>('');

  // Helper to suggest default archive folder inside the scanned directory
  function getSuggestedArchiveFolder(baseFolder: string): string {
    if (!baseFolder) return '';
    const sep = baseFolder.includes('/') ? '/' : '\\';
    return `${baseFolder}${sep}_duplicates_archive`;
  }

  // Format bytes helper
  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  // Format date helper
  function formatDate(unixSeconds: number): string {
    if (!unixSeconds) return 'Unknown';
    const d = new Date(unixSeconds * 1000);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Safe file URL resolver for Tauri desktop
  function getMediaUrl(filePath: string): string {
    if (!filePath) return '';
    return isTauri() ? convertFileSrc(filePath) : filePath;
  }

  // Handle Folder Selection
  async function handleSelectFolder() {
    try {
      const folder = await tauriBridge.selectFolder();
      if (folder) {
        setSelectedFolder(folder);
        setTrashSuccessMessage('');
        setLastMovedFolder('');
        if (!customFolderPath() || customFolderPath().includes('_duplicates_archive')) {
          setCustomFolderPath(getSuggestedArchiveFolder(folder));
        }
      }
    } catch (err) {
      console.error('Failed to select folder:', err);
    }
  }

  // Handle Custom Folder Browse
  async function handleSelectCustomFolder() {
    try {
      const folder = await tauriBridge.selectFolder();
      if (folder) {
        setCustomFolderPath(folder);
      }
    } catch (err) {
      console.error('Failed to select custom folder:', err);
    }
  }

  // Run Duplicate Scan
  async function handleScan() {
    const folder = selectedFolder();
    if (!folder) return;

    setIsScanning(true);
    setTrashSuccessMessage('');

    try {
      const res = await tauriBridge.scanMediaDuplicates(
        folder,
        recursiveScan(),
        similarityThreshold(),
        checkImages(),
        checkVideos()
      );

      setScanResult(res);
      setActiveGroupIndex(0);

      // Pre-mark duplicate copies for the Recycle Bin
      // Rule: Keep recommended_keep_id, mark ALL OTHER files in the group for trash!
      const initialMarks: Record<string, boolean> = {};
      for (const grp of res.groups) {
        for (const file of grp.files) {
          // If this file is NOT the single chosen keep file, mark it for trash!
          if (file.id !== grp.recommended_keep_id) {
            initialMarks[file.id] = true;
          } else {
            initialMarks[file.id] = false;
          }
        }
      }
      setTrashMarkedIds(initialMarks);
    } catch (err: any) {
      console.error('Scan failed:', err);
      alert(`Scan failed: ${err?.message || err}`);
    } finally {
      setIsScanning(false);
    }
  }

  // Filtered Groups
  const filteredGroups = createMemo(() => {
    const res = scanResult();
    if (!res) return [];

    const q = searchQuery().toLowerCase().trim();
    const mode = filterMode();

    return res.groups.filter((grp) => {
      if (mode === 'exact' && grp.match_type !== 'exact_byte') return false;
      if (mode === 'visual' && grp.match_type === 'exact_byte') return false;
      if (q) {
        const matchesName = grp.files.some((f) => f.name.toLowerCase().includes(q));
        if (!matchesName) return false;
      }
      return true;
    });
  });

  // Current active group
  const currentGroup = createMemo<DuplicateGroup | null>(() => {
    const groups = filteredGroups();
    if (groups.length === 0) return null;
    const idx = Math.min(activeGroupIndex(), groups.length - 1);
    return groups[idx] || null;
  });

  // Action: Designate a specific file as KEEP (marks all other files in the group to Trash)
  function setKeepFile(group: DuplicateGroup, keepFileId: string) {
    setTrashMarkedIds((prev) => {
      const next = { ...prev };
      for (const f of group.files) {
        next[f.id] = f.id !== keepFileId;
      }
      return next;
    });
  }

  // Action: Keep both (do not trash any file in this group)
  function setKeepBothInGroup(group: DuplicateGroup) {
    setTrashMarkedIds((prev) => {
      const next = { ...prev };
      for (const f of group.files) {
        next[f.id] = false;
      }
      return next;
    });
  }

  // Action: Toggle individual file recycle mark
  function toggleFileTrash(fileId: string) {
    setTrashMarkedIds((prev) => ({
      ...prev,
      [fileId]: !prev[fileId],
    }));
  }

  // Calculate overall files marked for recycle
  const trashSummary = createMemo(() => {
    const res = scanResult();
    if (!res) return { count: 0, bytes: 0, filePaths: [] as string[] };

    const marks = trashMarkedIds();
    let count = 0;
    let bytes = 0;
    const filePaths: string[] = [];

    for (const grp of res.groups) {
      for (const f of grp.files) {
        if (marks[f.id]) {
          count++;
          bytes += f.size_bytes;
          filePaths.push(f.path);
        }
      }
    }

    return { count, bytes, filePaths };
  });

  // Execute Removal (Windows Recycle Bin OR Custom Quarantine Folder)
  async function handleConfirmTrash() {
    const summary = trashSummary();
    if (summary.filePaths.length === 0) return;

    if (removalMode() === 'custom_folder') {
      const dest = customFolderPath().trim();
      if (!dest) {
        alert('Please specify or browse for a destination folder.');
        return;
      }
    }

    setIsTrashing(true);
    try {
      let removedSet = new Set<string>();

      if (removalMode() === 'recycle') {
        const res = await tauriBridge.trashFiles(summary.filePaths);
        setShowTrashConfirm(false);

        const trashedPaths = res?.trashed_paths || [];
        const failedPaths = res?.failed_paths || [];
        removedSet = new Set(trashedPaths);
        setLastMovedFolder('');

        let msg = `Successfully moved ${trashedPaths.length} file${
          trashedPaths.length === 1 ? '' : 's'
        } (${formatBytes(summary.bytes)}) to the Windows Recycle Bin!`;
        if (failedPaths.length > 0) {
          msg += ` (${failedPaths.length} files could not be recycled)`;
        }
        setTrashSuccessMessage(msg);
      } else {
        const dest = customFolderPath().trim();
        const res = await tauriBridge.moveFilesToFolder(summary.filePaths, dest);
        setShowTrashConfirm(false);

        const movedFiles = res?.moved_files || [];
        const failedFiles = res?.failed_files || [];
        removedSet = new Set(movedFiles);
        setLastMovedFolder(res?.destination_folder || dest);

        let msg = `Successfully moved ${movedFiles.length} file${
          movedFiles.length === 1 ? '' : 's'
        } (${formatBytes(summary.bytes)}) to "${res?.destination_folder || dest}"!`;
        if (failedFiles.length > 0) {
          msg += ` (${failedFiles.length} files failed to move)`;
        }
        setTrashSuccessMessage(msg);
      }

      // Re-filter the current scan result to remove trashed or moved files
      const oldScan = scanResult();
      if (oldScan) {
        const updatedGroups = oldScan.groups
          .map((grp) => {
            const remainingFiles = grp.files.filter((f) => !removedSet.has(f.path));
            return {
              ...grp,
              files: remainingFiles,
              reclaimable_bytes:
                remainingFiles.length > 1
                  ? remainingFiles.slice(1).reduce((acc, f) => acc + f.size_bytes, 0)
                  : 0,
            };
          })
          .filter((grp) => grp.files.length > 1);

        const newDupCount = updatedGroups.reduce((acc, g) => acc + (g.files.length - 1), 0);
        const newReclaimable = updatedGroups.reduce((acc, g) => acc + g.reclaimable_bytes, 0);

        setScanResult({
          ...oldScan,
          duplicate_files_count: newDupCount,
          total_groups: updatedGroups.length,
          reclaimable_bytes: newReclaimable,
          groups: updatedGroups,
        });

        if (activeGroupIndex() >= updatedGroups.length) {
          setActiveGroupIndex(Math.max(0, updatedGroups.length - 1));
        }
      }
    } catch (err: any) {
      console.error('Failed to move files:', err);
      alert(`Error moving files: ${err?.message || err}`);
    } finally {
      setIsTrashing(false);
    }
  }

  // Quick actions
  async function handleOpenFile(path: string) {
    try {
      await tauriBridge.openFileDefault(path);
    } catch (err) {
      console.error('Failed to open file:', err);
    }
  }

  async function handleOpenInExplorer(path: string) {
    try {
      await tauriBridge.openInExplorer(path);
    } catch (err) {
      console.error('Failed to open explorer:', err);
    }
  }

  return (
    <div class="dedup-studio-layout">
      {/* ---------------- Top Scan Header ---------------- */}
      <header class="dedup-top-banner">
        <div class="banner-left">
          <div class="brand-app-icon">
            <IconDuplicate size={22} />
          </div>
          <div>
            <div class="banner-title-row">
              <h2 class="banner-title">Media Deduper</h2>
              <span class="badge-engine">BLAKE3 & Visual Engine</span>
            </div>
            <p class="banner-subtitle">
              Quickly compare and safely clean duplicate images & videos. Pre-selects redundant copies for the Windows Recycle Bin.
            </p>
          </div>
        </div>

        <div class="banner-controls">
          <button
            type="button"
            class="btn-select-folder-neo"
            onClick={handleSelectFolder}
            disabled={isScanning()}
          >
            <IconFolderOpen size={17} />
            <span>{selectedFolder() ? 'Change Folder' : 'Select Folder'}</span>
          </button>

          <button
            type="button"
            class="btn-run-scan-neo"
            onClick={handleScan}
            disabled={isScanning() || !selectedFolder()}
          >
            <Show
              when={isScanning()}
              fallback={
                <>
                  <IconRefresh size={17} />
                  <span>Scan Duplicates</span>
                </>
              }
            >
              <span class="spinner" />
              <span>Scanning...</span>
            </Show>
          </button>
        </div>
      </header>

      {/* ---------------- Config & Options Strip ---------------- */}
      <section class="dedup-options-strip">
        <div class="current-folder-chip" title={selectedFolder() || 'No folder chosen'}>
          <IconFolder size={15} />
          <span class="folder-chip-text">
            {selectedFolder() || 'Choose a folder above to start scanning for duplicate images and videos...'}
          </span>
        </div>

        <div class="options-toggle-group">
          <label class="toggle-chip">
            <input
              type="checkbox"
              checked={recursiveScan()}
              onChange={(e) => setRecursiveScan(e.currentTarget.checked)}
              disabled={isScanning()}
            />
            <span>Include Subfolders</span>
          </label>

          <label class="toggle-chip">
            <input
              type="checkbox"
              checked={checkImages()}
              onChange={(e) => setCheckImages(e.currentTarget.checked)}
              disabled={isScanning()}
            />
            <span>Images</span>
          </label>

          <label class="toggle-chip">
            <input
              type="checkbox"
              checked={checkVideos()}
              onChange={(e) => setCheckVideos(e.currentTarget.checked)}
              disabled={isScanning()}
            />
            <span>Videos</span>
          </label>

          <div
            style={{
              display: 'flex',
              'align-items': 'center',
              gap: '6px',
              'margin-left': '6px',
            }}
            title="Tolerance: 0 = 100% exact only, 1-10 = visual match sensitivity"
          >
            <span style={{ 'font-size': '0.74rem', 'font-weight': '700', color: 'var(--text-dim)' }}>
              Sensitivity:
            </span>
            <input
              type="range"
              min="0"
              max="10"
              value={similarityThreshold()}
              onInput={(e) => setSimilarityThreshold(parseInt(e.currentTarget.value))}
              disabled={isScanning()}
              style={{ width: '65px', 'accent-color': 'var(--nb-cyan)', cursor: 'pointer' }}
            />
            <span
              style={{
                'font-family': 'var(--font-mono)',
                'font-size': '0.72rem',
                color: 'var(--nb-cyan)',
                'font-weight': '800',
              }}
            >
              {similarityThreshold() === 0 ? 'Exact' : `±${similarityThreshold()}`}
            </span>
          </div>
        </div>
      </section>


      {/* ---------------- Success Alert ---------------- */}
      <Show when={trashSuccessMessage()}>
        <div class="dedup-success-strip">
          <IconShieldCheck size={18} />
          <span style={{ flex: '1' }}>{trashSuccessMessage()}</span>
          <Show when={lastMovedFolder()}>
            <button
              type="button"
              class="btn-open-quarantine-neo"
              onClick={() => handleOpenInExplorer(lastMovedFolder())}
              title="Open quarantine folder in File Explorer"
            >
              <IconFolderOpen size={14} />
              <span>Open Folder</span>
            </button>
          </Show>
          <button
            type="button"
            class="btn-dismiss-alert"
            onClick={() => {
              setTrashSuccessMessage('');
              setLastMovedFolder('');
            }}
          >
            <IconCross size={15} />
          </button>
        </div>
      </Show>

      {/* ---------------- Empty State ---------------- */}
      <Show when={!scanResult() && !isScanning()}>
        <div class="dedup-workspace-empty">
          <div class="empty-icon-shield">
            <IconDuplicate size={44} />
          </div>
          <h3>Ready to Scan for Duplicates</h3>
          <p>
            Pick any folder containing your media files. The engine scans both exact byte duplicates and modified/resized copies in parallel, pre-selecting redundant files so you can clean up with one click.
          </p>
          <button type="button" class="btn-select-folder-neo" onClick={handleSelectFolder}>
            <IconFolderOpen size={18} />
            <span>Select Media Folder</span>
          </button>
        </div>
      </Show>

      {/* ---------------- Zero Duplicates Found State ---------------- */}
      <Show when={scanResult() && scanResult()!.total_groups === 0 && !isScanning()}>
        <div class="dedup-workspace-empty clean-state">
          <div class="empty-icon-shield shield-green">
            <IconShieldCheck size={44} />
          </div>
          <h3>All Clean — 0 Duplicates Detected!</h3>
          <p>
            Scanned {scanResult()!.total_files_scanned} files in <strong>{selectedFolder()}</strong> and found zero redundant copies.
          </p>
        </div>
      </Show>

      {/* ---------------- Main Studio Workstation ---------------- */}
      <Show when={scanResult() && scanResult()!.total_groups > 0}>
        <div class="dedup-workstation-body">
          {/* ========== Left Pane: Group Explorer ========== */}
          <aside class="group-explorer-pane">
            <div class="explorer-header">
              <div class="explorer-stats-row">
                <span class="explorer-title">Duplicate Groups</span>
                <span class="explorer-count-badge">{filteredGroups().length}</span>
              </div>

              {/* Filter Tabs */}
              <div class="filter-pills-row">
                <button
                  type="button"
                  class={`pill-btn ${filterMode() === 'all' ? 'pill-active' : ''}`}
                  onClick={() => { setFilterMode('all'); setActiveGroupIndex(0); }}
                >
                  All ({scanResult()!.total_groups})
                </button>
                <button
                  type="button"
                  class={`pill-btn ${filterMode() === 'exact' ? 'pill-active' : ''}`}
                  onClick={() => { setFilterMode('exact'); setActiveGroupIndex(0); }}
                >
                  100% Exact
                </button>
                <button
                  type="button"
                  class={`pill-btn ${filterMode() === 'visual' ? 'pill-active' : ''}`}
                  onClick={() => { setFilterMode('visual'); setActiveGroupIndex(0); }}
                >
                  Visual
                </button>
              </div>

              {/* Search Box */}
              <input
                type="text"
                placeholder="Filter by filename..."
                value={searchQuery()}
                onInput={(e) => { setSearchQuery(e.currentTarget.value); setActiveGroupIndex(0); }}
                class="explorer-search-input"
              />
            </div>

            {/* Scrollable Groups List */}
            <div class="explorer-list-scroll">
              <For each={filteredGroups()}>
                {(grp, idx) => {
                  const isSelected = () => activeGroupIndex() === idx();
                  const primaryFile = grp.files[0];
                  const trashedCount = () => grp.files.filter((f) => trashMarkedIds()[f.id]).length;

                  return (
                    <div
                      class={`group-card-item ${isSelected() ? 'group-item-active' : ''}`}
                      onClick={() => setActiveGroupIndex(idx())}
                    >
                      <div class="item-thumb-box">
                        <Show
                          when={primaryFile.is_video}
                          fallback={
                            <img
                              src={getMediaUrl(primaryFile.path)}
                              alt={primaryFile.name}
                              class="item-thumb-img"
                              loading="eager"
                            />
                          }
                        >
                          <IconVideo size={20} class="thumb-vid-icon" />
                        </Show>
                      </div>

                      <div class="item-info-col">
                        <span class="item-primary-name" title={primaryFile.name}>
                          {primaryFile.name}
                        </span>

                        <div class="item-meta-sub">
                          <span class="item-copies-tag">{grp.files.length} copies</span>
                          <span class="item-savings-tag">+{formatBytes(grp.reclaimable_bytes)}</span>
                        </div>

                        <div class="item-status-strip">
                          <Show
                            when={trashedCount() > 0}
                            fallback={<span class="badge-kept-both">Keeping All</span>}
                          >
                            <span class="badge-recycle-ready">
                              ✓ {trashedCount()} to Recycle
                            </span>
                          </Show>
                          <Show when={grp.match_type === 'exact_byte'} fallback={<span class="badge-vis">Visual</span>}>
                            <span class="badge-exact">Exact</span>
                          </Show>
                        </div>
                      </div>
                    </div>
                  );
                }}
              </For>
            </div>
          </aside>

          {/* ========== Right Pane: Side-by-Side Review Arena ========== */}
          <main class="review-arena-pane">
            <Show when={currentGroup()}>
              {(group) => {
                return (
                  <div class="arena-content-wrap">
                    {/* Arena Top Toolbar */}
                    <div class="arena-top-toolbar">
                      <div class="toolbar-left">
                        <button
                          type="button"
                          class="btn-arrow-nav"
                          onClick={() => setActiveGroupIndex(Math.max(0, activeGroupIndex() - 1))}
                          disabled={activeGroupIndex() === 0}
                          title="Previous duplicate group"
                        >
                          <IconChevronLeft size={17} />
                        </button>
                        <span class="group-page-text">
                          Group <strong>{activeGroupIndex() + 1}</strong> of <strong>{filteredGroups().length}</strong>
                        </span>
                        <button
                          type="button"
                          class="btn-arrow-nav"
                          onClick={() => setActiveGroupIndex(Math.min(filteredGroups().length - 1, activeGroupIndex() + 1))}
                          disabled={activeGroupIndex() >= filteredGroups().length - 1}
                          title="Next duplicate group"
                        >
                          <IconChevronRight size={17} />
                        </button>

                        <div class="match-indicator">
                          <Show
                            when={group().match_type === 'exact_byte'}
                            fallback={<span class="badge-vis-full">⚡ {group().similarity_pct}% Visual Similarity</span>}
                          >
                            <span class="badge-exact-full">🔒 100% Exact Bit-for-Bit Duplicate</span>
                          </Show>
                        </div>
                      </div>

                      {/* Quick Decision Overrides */}
                      <div class="toolbar-right">
                        <button
                          type="button"
                          class="btn-override-tool"
                          onClick={() => setKeepBothInGroup(group())}
                          title="Do not recycle any copy from this group"
                        >
                          <IconCheck size={14} />
                          <span>Keep Both Files</span>
                        </button>
                      </div>
                    </div>

                    {/* Side-by-Side Comparison Grid */}
                    <div class="side-by-side-grid">
                      <For each={group().files}>
                        {(file) => {
                          const isMarkedForTrash = () => !!trashMarkedIds()[file.id];
                          const isKeep = () => !isMarkedForTrash();


                          return (
                            <div class={`stage-card ${isKeep() ? 'stage-card-keep' : 'stage-card-recycle'}`}>
                              {/* Card Header Status */}
                              <div class="stage-card-header">
                                <Show
                                  when={isKeep()}
                                  fallback={
                                    <div class="status-indicator-tag tag-recycle">
                                      <IconTrash size={16} />
                                      <span>WILL BE RECYCLED</span>
                                    </div>
                                  }
                                >
                                  <div class="status-indicator-tag tag-keep">
                                    <IconCheck size={16} />
                                    <span>KEEP THIS FILE</span>
                                    <Show when={file.id === group().recommended_keep_id}>
                                      <span class="original-crown">👑 PREFERRED ORIGINAL</span>
                                    </Show>
                                  </div>
                                </Show>

                                <button
                                  type="button"
                                  class={`btn-action-decision ${isKeep() ? 'btn-mark-recycle-btn' : 'btn-mark-keep-btn'}`}
                                  onClick={() => setKeepFile(group(), file.id)}
                                >
                                  {isKeep() ? 'Keep (Active)' : 'Keep This Copy Instead'}
                                </button>
                              </div>

                              {/* Media Visual Stage */}
                              <div class="stage-media-viewport">
                                <Show
                                  when={file.is_video}
                                  fallback={
                                    <img
                                      src={getMediaUrl(file.path)}
                                      alt={file.name}
                                      class="stage-full-img"
                                      loading="eager"
                                    />
                                  }
                                >
                                  <video
                                    src={getMediaUrl(file.path)}
                                    controls
                                    preload="metadata"
                                    class="stage-full-video"
                                  >
                                    <track kind="captions" />
                                  </video>
                                </Show>

                                <Show when={file.width && file.height}>
                                  <span class="stage-dim-pill">
                                    {file.width} × {file.height} px
                                  </span>
                                </Show>
                              </div>

                              {/* Spec Table */}
                              <div class="stage-spec-table">
                                <div class="spec-row">
                                  <span class="spec-label">Filename</span>
                                  <span class="spec-value filename-highlight" title={file.name}>
                                    {file.name}
                                  </span>
                                </div>

                                <div class="spec-row">
                                  <span class="spec-label">File Size</span>
                                  <span class="spec-value size-highlight">
                                    <strong>{formatBytes(file.size_bytes)}</strong>
                                  </span>
                                </div>

                                <div class="spec-row">
                                  <span class="spec-label">Resolution</span>
                                  <span class="spec-value">
                                    {file.width && file.height ? (
                                      <span class="dim-color">{file.width} × {file.height} px</span>
                                    ) : (
                                      'N/A'
                                    )}
                                  </span>
                                </div>

                                <div class="spec-row">
                                  <span class="spec-label">Modified Date</span>
                                  <span class="spec-value">{formatDate(file.modified_time)}</span>
                                </div>

                                <div class="spec-row">
                                  <span class="spec-label">Path</span>
                                  <div class="spec-path-box">
                                    <span class="spec-path-text" title={file.path}>
                                      {file.path}
                                    </span>
                                    <div class="spec-path-actions">
                                      <button
                                        type="button"
                                        class="btn-spec-action"
                                        title="Open file in default app"
                                        onClick={() => handleOpenFile(file.path)}
                                      >
                                        <IconEye size={13} />
                                        <span>Open</span>
                                      </button>
                                      <button
                                        type="button"
                                        class="btn-spec-action"
                                        title="Show in Windows Explorer"
                                        onClick={() => handleOpenInExplorer(file.path)}
                                      >
                                        <IconExternalLink size={13} />
                                        <span>Folder</span>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Card Footer Toggle */}
                              <div class="stage-card-footer">
                                <label class="checkbox-trash-label">
                                  <input
                                    type="checkbox"
                                    checked={isMarkedForTrash()}
                                    onChange={() => toggleFileTrash(file.id)}
                                  />
                                  <span class="checkbox-danger-box" />
                                  <span>{isMarkedForTrash() ? 'Marked for Recycle Bin' : 'Keep (Do not recycle)'}</span>
                                </label>
                              </div>
                            </div>
                          );
                        }}
                      </For>
                    </div>
                  </div>
                );
              }}
            </Show>
          </main>
        </div>
      </Show>

      {/* ---------------- Fixed Bottom Action Footer ---------------- */}
      <Show when={scanResult() && scanResult()!.total_groups > 0}>
        <footer class="dedup-bottom-bar">
          <div class="bottom-stats-block">
            <div class="stat-bubble">
              <span class="stat-bubble-label">Duplicate Groups</span>
              <span class="stat-bubble-val">{scanResult()!.total_groups}</span>
            </div>
            <div class="stat-bubble">
              <span class="stat-bubble-label">Files Marked</span>
              <span class="stat-bubble-val highlight-coral">{trashSummary().count}</span>
            </div>
            <div class="stat-bubble bubble-emerald">
              <span class="stat-bubble-label">Space to Recover</span>
              <span class="stat-bubble-val highlight-green">{formatBytes(trashSummary().bytes)}</span>
            </div>
          </div>

          <div class="bottom-action-block">
            <div class="bottom-dest-toggle" title="Select removal destination">
              <button
                type="button"
                class={`dest-toggle-btn ${removalMode() === 'recycle' ? 'active' : ''}`}
                onClick={() => setRemovalMode('recycle')}
              >
                <IconTrash size={14} />
                <span>Recycle Bin</span>
              </button>
              <button
                type="button"
                class={`dest-toggle-btn ${removalMode() === 'custom_folder' ? 'active' : ''}`}
                onClick={() => setRemovalMode('custom_folder')}
              >
                <IconFolder size={14} />
                <span>Custom Folder</span>
              </button>
            </div>

            <button
              type="button"
              class={`btn-master-recycle ${removalMode() === 'custom_folder' ? 'btn-mode-folder' : ''}`}
              onClick={() => setShowTrashConfirm(true)}
              disabled={trashSummary().count === 0 || isTrashing()}
            >
              <Show
                when={removalMode() === 'custom_folder'}
                fallback={<IconTrash size={18} />}
              >
                <IconFolderOpen size={18} />
              </Show>
              <span>
                {removalMode() === 'custom_folder' ? 'Move' : 'Send'} {trashSummary().count} Duplicate{trashSummary().count === 1 ? '' : 's'} to {removalMode() === 'custom_folder' ? 'Custom Folder' : 'Recycle Bin'} ({formatBytes(trashSummary().bytes)})
              </span>
            </button>
          </div>
        </footer>
      </Show>

      {/* ---------------- Removal / Quarantine Confirmation Modal ---------------- */}
      <Show when={showTrashConfirm()}>
        <div class="modal-backdrop" onClick={() => setShowTrashConfirm(false)}>
          <div class="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div class="modal-header">
              <div class={`modal-title-wrap ${removalMode() === 'custom_folder' ? 'title-folder' : ''}`}>
                <Show when={removalMode() === 'custom_folder'} fallback={<IconTrash size={22} />}>
                  <IconFolderOpen size={22} />
                </Show>
                <h3>
                  {removalMode() === 'custom_folder'
                    ? `Move ${trashSummary().count} Files to Custom Folder?`
                    : `Send ${trashSummary().count} Files to Recycle Bin?`}
                </h3>
              </div>
              <button
                type="button"
                class="btn-icon-close"
                onClick={() => setShowTrashConfirm(false)}
              >
                <IconCross size={18} />
              </button>
            </div>

            <div class="modal-body">
              {/* Destination Mode Switcher inside modal */}
              <div class="modal-mode-tabs">
                <span class="mode-tabs-label">Action Target:</span>
                <div class="mode-pills-row">
                  <button
                    type="button"
                    class={`modal-mode-pill ${removalMode() === 'recycle' ? 'active' : ''}`}
                    onClick={() => setRemovalMode('recycle')}
                  >
                    <IconTrash size={15} />
                    <span>Windows Recycle Bin</span>
                  </button>
                  <button
                    type="button"
                    class={`modal-mode-pill ${removalMode() === 'custom_folder' ? 'active' : ''}`}
                    onClick={() => setRemovalMode('custom_folder')}
                  >
                    <IconFolder size={15} />
                    <span>Separate Custom Folder</span>
                  </button>
                </div>
              </div>

              <Show
                when={removalMode() === 'custom_folder'}
                fallback={
                  <div class="recycle-safety-notice">
                    <IconShieldCheck size={20} />
                    <div>
                      <strong>Safe & Reversible Action</strong>
                      <p>
                        All selected duplicates are safely sent directly to your <strong>Windows Recycle Bin</strong>. If you ever change your mind, you can restore any file right from your desktop Recycle Bin.
                      </p>
                    </div>
                  </div>
                }
              >
                <div class="folder-safety-notice">
                  <IconShieldCheck size={20} />
                  <div>
                    <strong>Quarantine / Review Folder</strong>
                    <p>
                      Files will be safely organized and moved into your chosen folder without deletion. If a file with the same name already exists in the destination, it is automatically saved with an index suffix (e.g. <code>photo_1.jpg</code>) without overwriting.
                    </p>
                  </div>
                </div>

                <div class="modal-custom-folder-box">
                  <div class="custom-folder-header-row">
                    <span class="custom-folder-label">Destination Folder Path:</span>
                    <button
                      type="button"
                      class="btn-folder-browse-sm"
                      onClick={handleSelectCustomFolder}
                    >
                      <IconFolderOpen size={14} />
                      <span>Browse...</span>
                    </button>
                  </div>
                  <div class="folder-input-row">
                    <input
                      type="text"
                      class="input-custom-folder"
                      value={customFolderPath()}
                      onInput={(e) => setCustomFolderPath(e.currentTarget.value)}
                      placeholder="e.g. C:\Users\...\Duplicates_Archive"
                    />
                  </div>
                </div>
              </Show>

              <div class="trash-stat-box">
                <div class="stat-line">
                  <span>Selected Files to Move:</span>
                  <strong>{trashSummary().count} files</strong>
                </div>
                <div class="stat-line">
                  <span>Reclaimable Disk Space:</span>
                  <strong class="highlight-green">{formatBytes(trashSummary().bytes)}</strong>
                </div>
                <div class="stat-line">
                  <span>Target Destination:</span>
                  <strong class="highlight-destination">
                    {removalMode() === 'recycle'
                      ? 'Windows Recycle Bin'
                      : customFolderPath() || 'Custom Folder (Not specified)'}
                  </strong>
                </div>
              </div>
            </div>

            <div class="modal-footer">
              <button
                type="button"
                class="btn-secondary"
                onClick={() => setShowTrashConfirm(false)}
                disabled={isTrashing()}
              >
                Cancel
              </button>
              <button
                type="button"
                class={removalMode() === 'custom_folder' ? 'btn-confirm-move-folder' : 'btn-danger-confirm'}
                onClick={handleConfirmTrash}
                disabled={isTrashing() || (removalMode() === 'custom_folder' && !customFolderPath().trim())}
              >
                <Show
                  when={isTrashing()}
                  fallback={
                    removalMode() === 'custom_folder' ? (
                      <IconFolderOpen size={18} />
                    ) : (
                      <IconTrash size={18} />
                    )
                  }
                >
                  <span class="spinner" />
                </Show>
                <span>
                  {isTrashing()
                    ? removalMode() === 'custom_folder'
                      ? 'Moving to Folder...'
                      : 'Moving to Recycle Bin...'
                    : removalMode() === 'custom_folder'
                    ? 'Yes, Move to Custom Folder'
                    : 'Yes, Move to Recycle Bin'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
