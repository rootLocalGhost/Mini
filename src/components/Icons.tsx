import type { Component } from 'solid-js';

export const IconFolder: Component<{ class?: string; size?: number }> = (props) => (
  <svg
    width={props.size || 20}
    height={props.size || 20}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
  >
    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
  </svg>
);

export const IconFolderOpen: Component<{ class?: string; size?: number }> = (props) => (
  <svg
    width={props.size || 20}
    height={props.size || 20}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
  >
    <path d="m6 14 1.5-6h13l-1.5 6h-13Z" />
    <path d="M6 14V6a2 2 0 0 1 2-2h3.5l2 2H18a2 2 0 0 1 2 2v2" />
    <path d="M4 20h14a2 2 0 0 0 2-1.6l1.5-6.4H7.5L5.6 19.3A2 2 0 0 1 4 20Z" />
  </svg>
);

export const IconPdf: Component<{ class?: string; size?: number }> = (props) => (
  <svg
    width={props.size || 20}
    height={props.size || 20}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="9" y1="15" x2="15" y2="15" />
  </svg>
);

export const IconDocx: Component<{ class?: string; size?: number }> = (props) => (
  <svg
    width={props.size || 20}
    height={props.size || 20}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
  >
    <path d="M4 4v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6H6a2 2 0 0 0-2 2z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M8 13h8" />
    <path d="M8 17h8" />
  </svg>
);

export const IconSparkles: Component<{ class?: string; size?: number }> = (props) => (
  <svg
    width={props.size || 20}
    height={props.size || 20}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
  >
    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
  </svg>
);

export const IconPlay: Component<{ class?: string; size?: number }> = (props) => (
  <svg
    width={props.size || 18}
    height={props.size || 18}
    viewBox="0 0 24 24"
    fill="currentColor"
    class={props.class}
  >
    <polygon points="6 3 20 12 6 21 6 3" />
  </svg>
);

export const IconCheck: Component<{ class?: string; size?: number }> = (props) => (
  <svg
    width={props.size || 16}
    height={props.size || 16}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export const IconCross: Component<{ class?: string; size?: number }> = (props) => (
  <svg
    width={props.size || 18}
    height={props.size || 18}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const IconImage: Component<{ class?: string; size?: number }> = (props) => (
  <svg
    width={props.size || 18}
    height={props.size || 18}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
  >
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
  </svg>
);

export const IconExternalLink: Component<{ class?: string; size?: number }> = (props) => (
  <svg
    width={props.size || 16}
    height={props.size || 16}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
  >
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

export const IconShieldCheck: Component<{ class?: string; size?: number }> = (props) => (
  <svg
    width={props.size || 16}
    height={props.size || 16}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

export const IconTrash: Component<{ class?: string; size?: number }> = (props) => (
  <svg
    width={props.size || 18}
    height={props.size || 18}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

export const IconVideo: Component<{ class?: string; size?: number }> = (props) => (
  <svg
    width={props.size || 18}
    height={props.size || 18}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
  >
    <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
    <polygon points="22 8 16 12 22 16 22 8" />
  </svg>
);

export const IconDuplicate: Component<{ class?: string; size?: number }> = (props) => (
  <svg
    width={props.size || 18}
    height={props.size || 18}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
  >
    <rect width="13" height="13" x="9" y="9" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

export const IconColumns: Component<{ class?: string; size?: number }> = (props) => (
  <svg
    width={props.size || 18}
    height={props.size || 18}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
  >
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <line x1="12" y1="3" x2="12" y2="21" />
  </svg>
);

export const IconRefresh: Component<{ class?: string; size?: number }> = (props) => (
  <svg
    width={props.size || 18}
    height={props.size || 18}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
  >
    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
  </svg>
);

export const IconChevronLeft: Component<{ class?: string; size?: number }> = (props) => (
  <svg
    width={props.size || 18}
    height={props.size || 18}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
  >
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

export const IconChevronRight: Component<{ class?: string; size?: number }> = (props) => (
  <svg
    width={props.size || 18}
    height={props.size || 18}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

export const IconSliders: Component<{ class?: string; size?: number }> = (props) => (
  <svg
    width={props.size || 18}
    height={props.size || 18}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
  >
    <line x1="4" y1="21" x2="4" y2="14" />
    <line x1="4" y1="10" x2="4" y2="3" />
    <line x1="12" y1="21" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12" y2="3" />
    <line x1="20" y1="21" x2="20" y2="16" />
    <line x1="20" y1="12" x2="20" y2="3" />
    <line x1="1" y1="14" x2="7" y2="14" />
    <line x1="9" y1="8" x2="15" y2="8" />
    <line x1="17" y1="16" x2="23" y2="16" />
  </svg>
);

export const IconEye: Component<{ class?: string; size?: number }> = (props) => (
  <svg
    width={props.size || 18}
    height={props.size || 18}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
  >
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const IconAppGrid: Component<{ class?: string; size?: number }> = (props) => (
  <svg
    width={props.size || 18}
    height={props.size || 18}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
  >
    <rect width="7" height="7" x="3" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="14" rx="1" />
    <rect width="7" height="7" x="3" y="14" rx="1" />
  </svg>
);

export const IconClean: Component<{ class?: string; size?: number }> = (props) => (
  <svg
    width={props.size || 18}
    height={props.size || 18}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
  >
    <path d="m15 4-2 2" />
    <path d="m17 2-3 3" />
    <path d="m21 6-3 3" />
    <path d="m18 10 3 3" />
    <path d="m9 11 3 3" />
    <path d="m3 21 8-8" />
    <path d="m3 21 3-9 6 6-9 3Z" />
  </svg>
);

export const IconTag: Component<{ class?: string; size?: number }> = (props) => (
  <svg
    width={props.size || 18}
    height={props.size || 18}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
  >
    <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
    <path d="M7 7h.01" />
  </svg>
);

export const IconEdit3: Component<{ class?: string; size?: number }> = (props) => (
  <svg
    width={props.size || 18}
    height={props.size || 18}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
  >
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);

export const IconLayers: Component<{ class?: string; size?: number }> = (props) => (
  <svg
    width={props.size || 18}
    height={props.size || 18}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
  >
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);


