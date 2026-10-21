use base64::Engine;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::time::UNIX_EPOCH;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DocumentFile {
    pub id: String,
    pub name: String,
    pub path: String,
    pub extension: String,
    pub size_bytes: u64,
    pub modified_time: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SavedImageInfo {
    pub file_name: String,
    pub full_path: String,
    pub size_bytes: u64,
    pub page_number: usize,
    pub total_pages: usize,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FolderScanResult {
    pub folder_path: String,
    pub total_files: usize,
    pub docx_count: usize,
    pub pdf_count: usize,
    pub files: Vec<DocumentFile>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct OutputDirResult {
    pub output_path: String,
    pub created: bool,
}

#[tauri::command]
fn select_folder() -> Option<String> {
    let dialog = rfd::FileDialog::new()
        .set_title("Select Folder with DOCX and/or PDF Files");
    
    dialog.pick_folder().map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
fn scan_folder(folder_path: String, recursive: bool) -> Result<FolderScanResult, String> {
    let root = Path::new(&folder_path);
    if !root.exists() || !root.is_dir() {
        return Err("The specified path does not exist or is not a directory.".to_string());
    }

    let mut files = Vec::new();
    let mut docx_count = 0;
    let mut pdf_count = 0;

    fn visit_dir(
        dir: &Path,
        recursive: bool,
        files: &mut Vec<DocumentFile>,
        docx_count: &mut usize,
        pdf_count: &mut usize,
    ) {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    // Skip hidden directories or typical output folder names
                    let dir_name = path.file_name().unwrap_or_default().to_string_lossy();
                    if dir_name.starts_with('.') || dir_name == "converted_images" || dir_name == "output" {
                        continue;
                    }
                    if recursive {
                        visit_dir(&path, recursive, files, docx_count, pdf_count);
                    }
                } else if path.is_file() {
                    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                        let lower_ext = ext.to_lowercase();
                        if lower_ext == "docx" || lower_ext == "pdf" {
                            let metadata = fs::metadata(&path).ok();
                            let size = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
                            let modified = metadata
                                .and_then(|m| m.modified().ok())
                                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                                .map(|d| d.as_secs())
                                .unwrap_or(0);

                            let file_name = path
                                .file_name()
                                .unwrap_or_default()
                                .to_string_lossy()
                                .to_string();

                            if lower_ext == "docx" {
                                *docx_count += 1;
                            } else {
                                *pdf_count += 1;
                            }

                            files.push(DocumentFile {
                                id: format!("{}_{}", path.to_string_lossy(), size),
                                name: file_name,
                                path: path.to_string_lossy().to_string(),
                                extension: lower_ext,
                                size_bytes: size,
                                modified_time: modified,
                            });
                        }
                    }
                }
            }
        }
    }

    visit_dir(root, recursive, &mut files, &mut docx_count, &mut pdf_count);

    // Sort files by name for consistent predictable processing
    files.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    Ok(FolderScanResult {
        folder_path,
        total_files: files.len(),
        docx_count,
        pdf_count,
        files,
    })
}

#[tauri::command]
fn create_output_dir(parent_folder: String, folder_name: Option<String>) -> Result<OutputDirResult, String> {
    let parent = Path::new(&parent_folder);
    if !parent.exists() || !parent.is_dir() {
        return Err("Selected folder does not exist.".to_string());
    }

    let sub_name = folder_name.unwrap_or_else(|| "converted_images".to_string());
    let clean_sub_name = if sub_name.trim().is_empty() {
        "converted_images".to_string()
    } else {
        sub_name.trim().to_string()
    };

    let target_dir = parent.join(&clean_sub_name);
    let created = if !target_dir.exists() {
        fs::create_dir_all(&target_dir).map_err(|e| format!("Failed to create output directory: {}", e))?;
        true
    } else {
        false
    };

    Ok(OutputDirResult {
        output_path: target_dir.to_string_lossy().to_string(),
        created,
    })
}

#[tauri::command]
fn read_file_bytes(file_path: String) -> Result<Vec<u8>, String> {
    fs::read(&file_path).map_err(|e| format!("Failed to read file '{}': {}", file_path, e))
}

#[tauri::command]
fn save_image_page(
    output_folder: String,
    original_file_name: String,
    page_number: usize,
    total_pages: usize,
    format: String,
    image_bytes: Vec<u8>,
) -> Result<SavedImageInfo, String> {
    let out_dir = Path::new(&output_folder);
    if !out_dir.exists() {
        fs::create_dir_all(out_dir).map_err(|e| format!("Failed to create output folder: {}", e))?;
    }

    // Extract file stem (e.g., "Report" from "Report.docx")
    let original_path = Path::new(&original_file_name);
    let stem = original_path
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "document".to_string());
    
    // Also get extension to disambiguate e.g. "sample.docx" and "sample.pdf"
    let orig_ext = original_path
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    // Determine padding for page numbers: at least 3 digits if total_pages >= 100, 2 digits minimum
    let pad_width = if total_pages >= 100 {
        3
    } else {
        2
    };

    let page_str = format!("{:0width$}", page_number, width = pad_width);
    let ext = format.trim_start_matches('.').to_lowercase();
    let ext = if ext == "jpeg" { "jpg" } else { &ext };

    // Candidate 1: standard naming: "<stem>_page_<num>.<ext>"
    // If there might be collision between same stem with different doc extensions,
    // we use `<stem>_page_<num>.<ext>` first. If that exists, we try with extension or sequence suffix.
    let base_candidate = format!("{}_page_{}.{}", stem, page_str, ext);
    let mut candidate_name = base_candidate.clone();
    let mut target_path = out_dir.join(&candidate_name);

    // Collision avoidance loop: if file already exists in output folder, append increment counter `_1`, `_2`, etc.
    let mut counter = 1;
    while target_path.exists() {
        // If it's a conflict, we could also differentiate with source ext if helpful
        if counter == 1 && !orig_ext.is_empty() {
            let disambiguated = format!("{}_{}_page_{}.{}", stem, orig_ext, page_str, ext);
            let dis_path = out_dir.join(&disambiguated);
            if !dis_path.exists() {
                candidate_name = disambiguated;
                target_path = dis_path;
                break;
            }
        }
        candidate_name = format!("{}_page_{}_{}.{}", stem, page_str, counter, ext);
        target_path = out_dir.join(&candidate_name);
        counter += 1;
    }

    // Write file
    fs::write(&target_path, &image_bytes)
        .map_err(|e| format!("Failed to write image file '{}': {}", target_path.display(), e))?;

    let file_size = image_bytes.len() as u64;

    Ok(SavedImageInfo {
        file_name: candidate_name,
        full_path: target_path.to_string_lossy().to_string(),
        size_bytes: file_size,
        page_number,
        total_pages,
    })
}

#[tauri::command]
fn open_in_explorer(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open explorer: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
fn convert_docx_to_pdf_native(docx_path: String) -> Result<Vec<u8>, String> {
    let docx = Path::new(&docx_path);
    if !docx.exists() {
        return Err(format!("DOCX file does not exist: {}", docx_path));
    }

    // Resolve to clean absolute path without \\?\ UNC prefix
    let canonical = fs::canonicalize(docx).map_err(|e| format!("Path error: {}", e))?;
    let canonical_str = canonical.to_string_lossy();
    let clean_docx_path = canonical_str.strip_prefix(r"\\?\").unwrap_or(&canonical_str).replace('/', "\\");

    let temp_dir = std::env::temp_dir();
    let temp_pdf_name = format!(
        "mini_conv_{}_{}.pdf",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    );
    let temp_pdf_path = temp_dir.join(&temp_pdf_name);
    let clean_pdf_path = temp_pdf_path.to_string_lossy().replace('/', "\\");

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let script = format!(
            r#"$docx = '{}'; $pdf = '{}'; $w = New-Object -ComObject Word.Application; $w.Visible = $false; $w.DisplayAlerts = 0; try {{ $d = $w.Documents.Open($docx, $false, $true); $d.SaveAs([ref]$pdf, [ref]17); $d.Close(); }} finally {{ $w.Quit(); }}"#,
            clean_docx_path.replace('\'', "''"),
            clean_pdf_path.replace('\'', "''")
        );

        let output = std::process::Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", &script])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| format!("Failed to execute Word automation: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Word conversion error: {}", stderr));
        }

        if temp_pdf_path.exists() {
            let bytes = fs::read(&temp_pdf_path).map_err(|e| format!("Failed to read converted PDF: {}", e))?;
            let _ = fs::remove_file(&temp_pdf_path);
            return Ok(bytes);
        } else {
            return Err("Word did not produce an output PDF.".to_string());
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Native Word conversion is only supported on Windows.".to_string())
    }
}

pub mod dedup;
pub mod metaclean;

#[tauri::command]
fn scan_media_metadata(
    folder_path: String,
    recursive: bool,
) -> Result<metaclean::MetaScanResult, String> {
    metaclean::scan_media_metadata(&folder_path, recursive)
}

#[tauri::command]
fn preview_renaming(
    file_paths: Vec<String>,
    target_format: String,
    config: metaclean::RenameConfig,
) -> Vec<metaclean::RenamePreviewItem> {
    metaclean::preview_renaming(file_paths, target_format, config)
}

#[tauri::command]
fn process_media_batch(
    opts: metaclean::ProcessBatchOptions,
) -> Result<metaclean::BatchProcessResult, String> {
    metaclean::process_media_batch(opts)
}

#[tauri::command]
fn scan_media_duplicates(
    folder_path: String,
    recursive: bool,
    similarity_threshold: Option<u32>,
    check_images: Option<bool>,
    check_videos: Option<bool>,
) -> Result<dedup::DuplicateScanResult, String> {
    let thresh = similarity_threshold.unwrap_or(5);
    let images = check_images.unwrap_or(true);
    let videos = check_videos.unwrap_or(true);
    dedup::scan_duplicates(folder_path, recursive, thresh, images, videos)
}

#[tauri::command]
fn trash_files(paths: Vec<String>) -> Result<dedup::TrashResult, String> {
    dedup::trash_media_files(paths)
}

#[tauri::command]
fn move_files_to_folder(paths: Vec<String>, destination_folder: String) -> Result<dedup::MoveResult, String> {
    dedup::move_media_files_to_folder(paths, destination_folder)
}

#[tauri::command]
fn read_media_thumbnail(file_path: String) -> Result<String, String> {
    let p = Path::new(&file_path);
    if !p.exists() {
        return Err("File does not exist".to_string());
    }

    if let Ok(img) = image::open(p) {
        let thumb = img.thumbnail(600, 600);
        let mut bytes: Vec<u8> = Vec::new();
        let mut cursor = std::io::Cursor::new(&mut bytes);
        thumb
            .write_to(&mut cursor, image::ImageFormat::Jpeg)
            .map_err(|e| format!("Failed to encode thumbnail: {}", e))?;
        
        let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
        Ok(format!("data:image/jpeg;base64,{}", b64))
    } else {
        Err("Cannot decode preview".to_string())
    }
}

#[tauri::command]
fn open_file_default(file_path: String) -> Result<(), String> {
    let p = Path::new(&file_path);
    if !p.exists() {
        return Err("File does not exist".to_string());
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&file_path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            select_folder,
            scan_folder,
            create_output_dir,
            read_file_bytes,
            save_image_page,
            open_in_explorer,
            convert_docx_to_pdf_native,
            scan_media_duplicates,
            trash_files,
            move_files_to_folder,
            read_media_thumbnail,
            open_file_default,
            scan_media_metadata,
            preview_renaming,
            process_media_batch
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scan_and_no_overwrite_saving() {
        let test_dir = Path::new("../test_documents");
        if !test_dir.exists() {
            fs::create_dir_all(test_dir).unwrap();
        }

        // Test scan_folder
        let scan_res = scan_folder(test_dir.to_string_lossy().to_string(), false).expect("Scan failed");
        assert!(scan_res.total_files >= 2);
        assert!(scan_res.docx_count >= 1);
        assert!(scan_res.pdf_count >= 1);

        // Test create_output_dir
        let out_res = create_output_dir(test_dir.to_string_lossy().to_string(), Some("test_output".into())).unwrap();
        let _ = fs::remove_dir_all(&out_res.output_path); // ensure clean start
        let _ = fs::create_dir_all(&out_res.output_path);
        assert!(Path::new(&out_res.output_path).exists());

        // Test collision-proof saving: first save
        let dummy_bytes_1 = vec![1, 2, 3, 4];
        let save_1 = save_image_page(
            out_res.output_path.clone(),
            "Sample_Doc.docx".to_string(),
            1,
            5,
            "png".to_string(),
            dummy_bytes_1.clone(),
        ).unwrap();

        assert_eq!(save_1.file_name, "Sample_Doc_page_01.png");
        assert!(Path::new(&save_1.full_path).exists());

        // Test collision-proof saving: second save of SAME page -> must NOT overwrite!
        let dummy_bytes_2 = vec![5, 6, 7, 8];
        let save_2 = save_image_page(
            out_res.output_path.clone(),
            "Sample_Doc.docx".to_string(),
            1,
            5,
            "png".to_string(),
            dummy_bytes_2,
        ).unwrap();

        assert_ne!(save_1.full_path, save_2.full_path, "Existing file should NOT be overwritten!");
        assert!(save_2.file_name.contains("page_01"));
        assert!(Path::new(&save_2.full_path).exists());
        assert!(Path::new(&save_1.full_path).exists());

        // Test collision-proof saving: 3rd save of SAME page -> appends counter suffix
        let dummy_bytes_3 = vec![9, 10, 11, 12];
        let save_3 = save_image_page(
            out_res.output_path.clone(),
            "Sample_Doc.docx".to_string(),
            1,
            5,
            "png".to_string(),
            dummy_bytes_3,
        ).unwrap();

        assert_ne!(save_3.full_path, save_1.full_path);
        assert_ne!(save_3.full_path, save_2.full_path);
        assert!(Path::new(&save_3.full_path).exists());

        // Verify original file 1 content wasn't altered
        let content_1 = fs::read(&save_1.full_path).unwrap();
        assert_eq!(content_1, dummy_bytes_1);

        // Cleanup test output folder
        let _ = fs::remove_dir_all(&out_res.output_path);
    }

    #[test]
    fn test_convert_docx_native() {
        let test_docx = Path::new("../test_documents/Project_Specification.docx");
        if test_docx.exists() {
            let res = convert_docx_to_pdf_native(test_docx.to_string_lossy().to_string());
            println!("convert_docx_to_pdf_native result: {:?}", res.as_ref().map(|b| b.len()));
            match res {
                Ok(bytes) => {
                    assert!(bytes.len() > 100);
                    println!("Native Word conversion succeeded! Bytes: {}", bytes.len());
                }
                Err(err) => {
                    println!("Native Word conversion failed with error: {}", err);
                    panic!("Native Word conversion failed: {}", err);
                }
            }
        }
    }

    #[test]
    fn test_scan_duplicates() {
        let dedup_test_dir = Path::new("../test_dedup_sandbox");
        let _ = fs::remove_dir_all(dedup_test_dir);
        fs::create_dir_all(dedup_test_dir).unwrap();

        // Create a small PNG image
        let img = image::RgbImage::new(100, 100);
        let img_path_1 = dedup_test_dir.join("image_original.png");
        img.save(&img_path_1).unwrap();

        // Copy exact duplicate
        let img_path_2 = dedup_test_dir.join("image_copy.png");
        fs::copy(&img_path_1, &img_path_2).unwrap();

        // Run duplicate scanner
        let scan_res = dedup::scan_duplicates(
            dedup_test_dir.to_string_lossy().to_string(),
            false,
            5,
            true,
            true,
        ).expect("Scan failed");

        assert_eq!(scan_res.total_files_scanned, 2);
        assert_eq!(scan_res.total_groups, 1);
        assert_eq!(scan_res.duplicate_files_count, 1);
        assert!(scan_res.reclaimable_bytes > 0);
        assert_eq!(scan_res.groups[0].match_type, "exact_byte");
        assert_eq!(scan_res.groups[0].similarity_pct, 100);

        // Cleanup
        let _ = fs::remove_dir_all(dedup_test_dir);
    }
}
