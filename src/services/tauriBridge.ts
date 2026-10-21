import { invoke, isTauri } from '@tauri-apps/api/core';
import type { FolderScanResult, OutputDirResult, SavedImageInfo } from '../types';

export const tauriBridge = {
  isAvailable(): boolean {
    return isTauri();
  },

  async selectFolder(): Promise<string | null> {
    if (!isTauri()) {
      console.warn('Tauri environment not detected. Running in mock browser mode.');
      // Browser fallback for testing/demo
      return 'C:\\Users\\MockUser\\Documents\\SampleFolder';
    }
    try {
      return await invoke<string | null>('select_folder');
    } catch (err) {
      console.error('Failed to select folder:', err);
      throw err;
    }
  },

  async scanFolder(folderPath: string, recursive: boolean = false): Promise<FolderScanResult> {
    if (!isTauri()) {
      return {
        folder_path: folderPath,
        total_files: 3,
        docx_count: 2,
        pdf_count: 1,
        files: [
          {
            id: 'mock_1',
            name: 'Financial_Quarterly_Report_2026.docx',
            path: `${folderPath}\\Financial_Quarterly_Report_2026.docx`,
            extension: 'docx',
            size_bytes: 1425000,
            modified_time: Date.now() - 3600000,
          },
          {
            id: 'mock_2',
            name: 'Product_Specification_Final.pdf',
            path: `${folderPath}\\Product_Specification_Final.pdf`,
            extension: 'pdf',
            size_bytes: 3890000,
            modified_time: Date.now() - 7200000,
          },
          {
            id: 'mock_3',
            name: 'Client_Contract_Signed.docx',
            path: `${folderPath}\\Client_Contract_Signed.docx`,
            extension: 'docx',
            size_bytes: 845000,
            modified_time: Date.now() - 10800000,
          },
        ],
      };
    }
    return await invoke<FolderScanResult>('scan_folder', {
      folderPath,
      recursive,
    });
  },

  async createOutputDir(parentFolder: string, folderName?: string): Promise<OutputDirResult> {
    if (!isTauri()) {
      const sub = folderName || 'converted_images';
      return {
        output_path: `${parentFolder}\\${sub}`,
        created: true,
      };
    }
    return await invoke<OutputDirResult>('create_output_dir', {
      parentFolder,
      folderName: folderName || null,
    });
  },

  async readFileBytes(filePath: string): Promise<Uint8Array> {
    if (!isTauri()) {
      throw new Error('Reading local file bytes requires the desktop Tauri application.');
    }
    // Tauri deserializes byte arrays into number array or Uint8Array
    const bytes = await invoke<number[] | Uint8Array>('read_file_bytes', {
      filePath,
    });
    return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  },

  async saveImagePage(
    outputFolder: string,
    originalFileName: string,
    pageNumber: number,
    totalPages: number,
    format: string,
    imageBytes: Uint8Array
  ): Promise<SavedImageInfo> {
    if (!isTauri()) {
      return {
        file_name: `${originalFileName.replace(/\.[^/.]+$/, '')}_page_${pageNumber}.${format}`,
        full_path: `${outputFolder}\\${originalFileName.replace(/\.[^/.]+$/, '')}_page_${pageNumber}.${format}`,
        size_bytes: imageBytes.byteLength,
        page_number: pageNumber,
        total_pages: totalPages,
      };
    }
    return await invoke<SavedImageInfo>('save_image_page', {
      outputFolder,
      originalFileName,
      pageNumber,
      totalPages,
      format,
      imageBytes: Array.from(imageBytes),
    });
  },

  async openInExplorer(path: string): Promise<void> {
    if (!isTauri()) {
      console.log('Mock: openInExplorer called for', path);
      return;
    }
    return await invoke<void>('open_in_explorer', { path });
  },

  async convertDocxToPdfNative(docxPath: string): Promise<Uint8Array> {
    if (!isTauri()) {
      throw new Error('Native Word conversion requires Tauri desktop environment.');
    }
    const bytes = await invoke<number[] | Uint8Array>('convert_docx_to_pdf_native', {
      docxPath,
    });
    return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  },

  async scanMediaDuplicates(
    folderPath: string,
    recursive: boolean = false,
    similarityThreshold: number = 5,
    checkImages: boolean = true,
    checkVideos: boolean = true
  ): Promise<import('../types').DuplicateScanResult> {
    if (!isTauri()) {
      console.warn('Tauri environment not detected. Running mock scan.');
      return {
        folder_path: folderPath,
        total_files_scanned: 12,
        duplicate_files_count: 4,
        total_groups: 2,
        reclaimable_bytes: 8450000,
        groups: [
          {
            group_id: 'grp_mock_1',
            match_type: 'exact_byte',
            similarity_pct: 100,
            files: [
              {
                id: 'm1',
                name: 'hero_banner_original.png',
                path: `${folderPath}\\hero_banner_original.png`,
                extension: 'png',
                is_video: false,
                size_bytes: 4200000,
                width: 1920,
                height: 1080,
                modified_time: Date.now() - 3600000,
                blake3_hash: 'abc123hash',
                dhash: null,
              },
              {
                id: 'm2',
                name: 'hero_banner_copy.png',
                path: `${folderPath}\\hero_banner_copy.png`,
                extension: 'png',
                is_video: false,
                size_bytes: 4200000,
                width: 1920,
                height: 1080,
                modified_time: Date.now() - 1800000,
                blake3_hash: 'abc123hash',
                dhash: null,
              },
            ],
            recommended_keep_id: 'm1',
            reclaimable_bytes: 4200000,
          },
        ],
        duration_ms: 120,
      };
    }
    return await invoke<import('../types').DuplicateScanResult>('scan_media_duplicates', {
      folderPath,
      recursive,
      similarityThreshold,
      checkImages,
      checkVideos,
    });
  },

  async trashFiles(paths: string[]): Promise<import('../types').TrashResult> {
    if (!isTauri()) {
      console.log('Mock: trashed paths', paths);
      return { trashed_paths: paths, failed_paths: [] };
    }
    return await invoke<import('../types').TrashResult>('trash_files', { paths });
  },

  async readMediaThumbnail(filePath: string): Promise<string> {
    if (!isTauri()) {
      return '';
    }
    return await invoke<string>('read_media_thumbnail', { filePath });
  },

  async openFileDefault(filePath: string): Promise<void> {
    if (!isTauri()) {
      console.log('Mock: openFileDefault', filePath);
      return;
    }
    return await invoke<void>('open_file_default', { filePath });
  },

  async moveFilesToFolder(paths: string[], destinationFolder: string): Promise<import('../types').MoveResult> {
    if (!isTauri()) {
      console.log('Mock: moveFilesToFolder', paths, destinationFolder);
      return {
        moved_files: paths.map((p) => [p, `${destinationFolder}\\${p.split('\\').pop()}`]),
        failed_files: [],
        destination_folder: destinationFolder,
      };
    }
    return await invoke<import('../types').MoveResult>('move_files_to_folder', {
      paths,
      destinationFolder,
    });
  },

  async scanMediaMetadata(
    folderPath: string,
    recursive: boolean = false
  ): Promise<import('../types').MetaScanResult> {
    if (!isTauri()) {
      return {
        folder_path: folderPath,
        total_files: 2,
        image_count: 2,
        video_count: 0,
        files_with_metadata: 2,
        files: [
          {
            id: 'mock_1',
            name: 'IMG_2026_Camera_Sample.jpg',
            path: `${folderPath}\\IMG_2026_Camera_Sample.jpg`,
            extension: 'jpg',
            size_bytes: 4200000,
            file_type: 'image',
            has_metadata: true,
            detected_tags: ['EXIF Data', 'GPS Location', 'Camera Model', 'Timestamp'],
            status: 'ready',
          },
          {
            id: 'mock_2',
            name: 'Screenshot_Raw.png',
            path: `${folderPath}\\Screenshot_Raw.png`,
            extension: 'png',
            size_bytes: 1200000,
            file_type: 'image',
            has_metadata: true,
            detected_tags: ['Text / Author Tags', 'Timestamp'],
            status: 'ready',
          },
        ],
      };
    }
    return await invoke<import('../types').MetaScanResult>('scan_media_metadata', {
      folderPath,
      recursive,
    });
  },

  async previewRenaming(
    filePaths: string[],
    targetFormat: string,
    config: import('../types').RenameConfig
  ): Promise<import('../types').RenamePreviewItem[]> {
    if (!isTauri()) {
      return filePaths.map((p, idx) => ({
        original_path: p,
        original_name: p.split('\\').pop() || '',
        new_name: `Renamed_${idx + 1}.${targetFormat === 'same' ? 'jpg' : targetFormat}`,
        new_extension: targetFormat === 'same' ? 'jpg' : targetFormat,
        will_change: true,
      }));
    }
    return await invoke<import('../types').RenamePreviewItem[]>('preview_renaming', {
      filePaths,
      targetFormat,
      config,
    });
  },

  async processMediaBatch(
    opts: import('../types').ProcessBatchOptions
  ): Promise<import('../types').BatchProcessResult> {
    if (!isTauri()) {
      return {
        total_processed: opts.file_paths.length,
        success_count: opts.file_paths.length,
        failed_count: 0,
        total_bytes_saved: 250000,
        destination_folder: opts.destination_folder || 'In-Place',
        files: [],
        failed_files: [],
      };
    }
    return await invoke<import('../types').BatchProcessResult>('process_media_batch', {
      opts,
    });
  },
};


