import { createSignal, Show } from 'solid-js';
import type { ActiveApp } from './types';
import { DocMorph } from './components/DocMorph';
import { MediaDeduper } from './components/MediaDeduper';
import { MetaClean } from './components/MetaClean';
import {
  IconDocx,
  IconDuplicate,
  IconClean,
  IconChevronLeft,
  IconChevronRight,
  IconShieldCheck,
  IconSparkles,
  IconAppGrid,
} from './components/Icons';

export default function App() {
  const [activeApp, setActiveApp] = createSignal<ActiveApp>('doc-morph');
  const [sidebarCollapsed, setSidebarCollapsed] = createSignal<boolean>(false);

  return (
    <div class="mini-suite-shell">
      {/* ---------------- Collapsible Neo-Brutalist Sidebar ---------------- */}
      <aside class={`mini-sidebar ${sidebarCollapsed() ? 'sidebar-collapsed' : ''}`}>
        <div>
          {/* Brand Header */}
          <div class="sidebar-header">
            <div class="brand-badge">
              <div class="brand-logo-cube">M</div>
              <Show when={!sidebarCollapsed()}>
                <div class="brand-text-block">
                  <span class="brand-name">Mini</span>
                  <span class="brand-tagline">Utility Suite</span>
                </div>
              </Show>
            </div>

            <button
              type="button"
              class="btn-sidebar-toggle"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed())}
              title={sidebarCollapsed() ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <Show when={sidebarCollapsed()} fallback={<IconChevronLeft size={16} />}>
                <IconChevronRight size={16} />
              </Show>
            </button>
          </div>

          {/* Navigation Items */}
          <div class="sidebar-nav-section">
            <Show when={!sidebarCollapsed()}>
              <span class="nav-section-title">Productivity Apps</span>
            </Show>

            {/* App 1: DocMorph */}
            <button
              type="button"
              class={`nav-item-btn ${activeApp() === 'doc-morph' ? 'nav-item-active' : ''}`}
              onClick={() => setActiveApp('doc-morph')}
              title="DocMorph: DOCX & PDF to Images"
            >
              <div class="nav-icon-wrap">
                <IconDocx size={17} />
              </div>
              <Show when={!sidebarCollapsed()}>
                <div class="nav-label-wrap">
                  <span class="nav-main-title">DocMorph</span>
                  <span class="nav-sub-desc">DOCX & PDF to Image</span>
                </div>
              </Show>
            </button>

            {/* App 2: Media Deduper */}
            <button
              type="button"
              class={`nav-item-btn nav-item-dedup ${
                activeApp() === 'media-deduper' ? 'nav-item-active' : ''
              }`}
              onClick={() => setActiveApp('media-deduper')}
              title="Media Deduper: Duplicate Images & Videos"
            >
              <div class="nav-icon-wrap">
                <IconDuplicate size={17} />
              </div>
              <Show when={!sidebarCollapsed()}>
                <div class="nav-label-wrap">
                  <span class="nav-main-title">Media Deduper</span>
                  <span class="nav-sub-desc">Find Duplicates & Compare</span>
                </div>
              </Show>
            </button>

            {/* App 3: MetaClean */}
            <button
              type="button"
              class={`nav-item-btn nav-item-metaclean ${
                activeApp() === 'meta-clean' ? 'nav-item-active' : ''
              }`}
              onClick={() => setActiveApp('meta-clean')}
              title="MetaClean: Purge Metadata, Convert & Rename"
            >
              <div class="nav-icon-wrap">
                <IconClean size={17} />
              </div>
              <Show when={!sidebarCollapsed()}>
                <div class="nav-label-wrap">
                  <span class="nav-main-title">MetaClean</span>
                  <span class="nav-sub-desc">Purge, Convert & Rename</span>
                </div>
              </Show>
            </button>

            <Show when={!sidebarCollapsed()}>
              <span class="nav-section-title" style={{ 'margin-top': '14px' }}>
                Suite Roadmap
              </span>

              <div class="nav-item-disabled" title="Coming in next update">
                <div class="nav-icon-wrap" style={{ opacity: 0.6 }}>
                  <IconAppGrid size={15} />
                </div>
                <div class="nav-label-wrap">
                  <span class="nav-main-title">Audio Resampler</span>
                  <span class="nav-sub-desc">Bitrate & Format Lab</span>
                </div>
              </div>

              <div class="nav-item-disabled" title="Coming in next update">
                <div class="nav-icon-wrap" style={{ opacity: 0.6 }}>
                  <IconSparkles size={15} />
                </div>
                <div class="nav-label-wrap">
                  <span class="nav-main-title">PDF Assembler</span>
                  <span class="nav-sub-desc">Merge & Split Engine</span>
                </div>
              </div>
            </Show>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div class="sidebar-footer">
          <div class="footer-version-tag">
            <IconShieldCheck size={14} />
            <Show when={!sidebarCollapsed()}>
              <span>Tauri v2 • Native Engine</span>
            </Show>
          </div>
        </div>
      </aside>

      {/* ---------------- Main Viewport ---------------- */}
      <main class="suite-main-viewport">
        <Show when={activeApp() === 'doc-morph'}>
          <DocMorph />
        </Show>

        <Show when={activeApp() === 'media-deduper'}>
          <MediaDeduper />
        </Show>

        <Show when={activeApp() === 'meta-clean'}>
          <MetaClean />
        </Show>
      </main>
    </div>
  );
}
