export interface DocumentFile {
  id: string;
  name: string;
  path: string;
  extension: 'docx' | 'pdf' | string;
  size_bytes: number;
  modified_time: number;
}

export interface FolderScanResult {
  folder_path: string;
  total_files: number;
  docx_count: number;
  pdf_count: number;
  files: DocumentFile[];
}

export interface OutputDirResult {
  output_path: string;
  created: boolean;
}

export interface SavedImageInfo {
  file_name: string;
  full_path: string;
  size_bytes: number;
  page_number: number;
  total_pages: number;
}

export interface ConversionOptions {
  scale: number; // 1.0 to 5.0 (DPI: 96 to 500+)
  format: 'png' | 'jpg';
  jpegQuality: number; // 0.6 to 1.0
  outputFolderName: string;
  recursive: boolean;
  autoOpenFolder: boolean;
}

export type FileStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';

export interface FileItemState {
  file: DocumentFile;
  selected: boolean;
  status: FileStatus;
  progress: number; // 0 to 100
  currentPage: number;
  totalPages: number;
  savedImages: SavedImageInfo[];
  errorMessage?: string;
  thumbnailUrl?: string;
}

export interface ConversionLog {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
  detail?: string;
}

// Multi-app Navigation
export type ActiveApp = 'doc-morph' | 'media-deduper' | 'meta-clean';

// Media Deduplication Types
export interface MediaFile {
  id: string;
  name: string;
  path: string;
  extension: string;
  is_video: boolean;
  size_bytes: number;
  width: number | null;
  height: number | null;
  modified_time: number;
  blake3_hash: string;
  dhash: string | null;
}

export interface DuplicateGroup {
  group_id: string;
  match_type: 'exact_byte' | 'visual_similar';
  similarity_pct: number;
  files: MediaFile[];
  recommended_keep_id: string;
  reclaimable_bytes: number;
}

export interface DuplicateScanResult {
  folder_path: string;
  total_files_scanned: number;
  duplicate_files_count: number;
  total_groups: number;
  reclaimable_bytes: number;
  groups: DuplicateGroup[];
  duration_ms: number;
}

export interface TrashResult {
  trashed_paths: string[];
  failed_paths: [string, string][];
}

export interface MoveResult {
  moved_files: [string, string][];
  failed_files: [string, string][];
  destination_folder: string;
}

// MetaClean: Metadata Stripper, Batch Renamer & Format Converter Types
export interface CleanableFileInfo {
  id: string;
  name: string;
  path: string;
  extension: string;
  size_bytes: number;
  file_type: 'image' | 'video';
  has_metadata: boolean;
  detected_tags: string[];
  status: 'ready' | 'cleaned' | 'skipped' | 'failed';
  cleaned_size_bytes?: number | null;
}

export interface MetaScanResult {
  folder_path: string;
  total_files: number;
  image_count: number;
  video_count: number;
  files_with_metadata: number;
  files: CleanableFileInfo[];
}

export interface RenameConfig {
  enabled: boolean;
  mode: 'template' | 'find_replace' | 'prefix_suffix';
  template: string;
  find_text: string;
  replace_text: string;
  case_sensitive: boolean;
  prefix: string;
  suffix: string;
  start_index: number;
  padding: number;
  case_transform: 'none' | 'lowercase' | 'uppercase' | 'titlecase' | 'snake_case' | 'kebab_case';
}

export interface RenamePreviewItem {
  original_path: string;
  original_name: string;
  new_name: string;
  new_extension: string;
  will_change: boolean;
}

export interface ProcessBatchOptions {
  file_paths: string[];
  strip_metadata: boolean;
  convert_format: 'same' | 'jpeg' | 'png' | 'webp';
  image_quality: number;
  rename_config?: RenameConfig | null;
  in_place: boolean;
  destination_folder: string;
}

export interface ProcessedFileResult {
  original_path: string;
  output_path: string;
  original_name: string;
  output_name: string;
  original_size: number;
  output_size: number;
  metadata_stripped: boolean;
  format_converted: boolean;
  renamed: boolean;
  status: 'success' | 'skipped' | 'failed';
  error_message?: string | null;
}

export interface BatchProcessResult {
  total_processed: number;
  success_count: number;
  failed_count: number;
  total_bytes_saved: number;
  destination_folder: string;
  files: ProcessedFileResult[];
  failed_files: string[];
}


