use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CleanableFileInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub extension: String,
    pub size_bytes: u64,
    pub file_type: String, // "image" or "video"
    pub has_metadata: bool,
    pub detected_tags: Vec<String>,
    pub status: String,
    pub cleaned_size_bytes: Option<u64>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MetaScanResult {
    pub folder_path: String,
    pub total_files: usize,
    pub image_count: usize,
    pub video_count: usize,
    pub files_with_metadata: usize,
    pub files: Vec<CleanableFileInfo>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RenameConfig {
    pub enabled: bool,
    pub mode: String, // "template" | "find_replace" | "prefix_suffix"
    pub template: String,
    pub find_text: String,
    pub replace_text: String,
    pub case_sensitive: bool,
    pub prefix: String,
    pub suffix: String,
    pub start_index: usize,
    pub padding: usize,
    pub case_transform: String, // "none" | "lowercase" | "uppercase" | "titlecase" | "snake_case" | "kebab_case"
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RenamePreviewItem {
    pub original_path: String,
    pub original_name: String,
    pub new_name: String,
    pub new_extension: String,
    pub will_change: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ProcessBatchOptions {
    pub file_paths: Vec<String>,
    pub strip_metadata: bool,
    pub convert_format: String, // "same" | "jpeg" | "png" | "webp"
    pub image_quality: u8,      // 1..100
    pub rename_config: Option<RenameConfig>,
    pub in_place: bool,
    pub destination_folder: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ProcessedFileResult {
    pub original_path: String,
    pub output_path: String,
    pub original_name: String,
    pub output_name: String,
    pub original_size: u64,
    pub output_size: u64,
    pub metadata_stripped: bool,
    pub format_converted: bool,
    pub renamed: bool,
    pub status: String, // "success" | "skipped" | "failed"
    pub error_message: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct BatchProcessResult {
    pub total_processed: usize,
    pub success_count: usize,
    pub failed_count: usize,
    pub total_bytes_saved: u64,
    pub destination_folder: String,
    pub files: Vec<ProcessedFileResult>,
    pub failed_files: Vec<String>,
}

/// Detect what metadata tags might be present by inspecting headers
pub fn inspect_file_metadata(path: &Path) -> (bool, Vec<String>) {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    let mut tags = Vec::new();

    let bytes = match fs::read(path) {
        Ok(b) => b,
        Err(_) => return (false, tags),
    };

    match ext.as_str() {
        "jpg" | "jpeg" => {
            if bytes.len() > 4 && bytes[0] == 0xFF && bytes[1] == 0xD8 {
                let mut i = 2;
                while i + 4 <= bytes.len() {
                    if bytes[i] == 0xFF {
                        let marker = bytes[i + 1];
                        if marker == 0xDA || marker == 0xD9 {
                            break;
                        }
                        let length = ((bytes[i + 2] as usize) << 8) | (bytes[i + 3] as usize);
                        if marker == 0xE1 {
                            if i + 10 <= bytes.len() && &bytes[i + 4..i + 8] == b"Exif" {
                                if !tags.contains(&"EXIF Data".to_string()) {
                                    tags.push("EXIF Data".to_string());
                                }
                                if bytes[i..std::cmp::min(bytes.len(), i + length + 2)]
                                    .windows(4)
                                    .any(|w| w == b"GPS " || w == [0x25, 0x88, 0, 0])
                                {
                                    if !tags.contains(&"GPS Location".to_string()) {
                                        tags.push("GPS Location".to_string());
                                    }
                                }
                            } else if !tags.contains(&"XMP Metadata".to_string()) {
                                tags.push("XMP Metadata".to_string());
                            }
                        } else if marker == 0xED {
                            if !tags.contains(&"IPTC / Photoshop".to_string()) {
                                tags.push("IPTC / Photoshop".to_string());
                            }
                        } else if marker == 0xFE {
                            if !tags.contains(&"User Comments".to_string()) {
                                tags.push("User Comments".to_string());
                            }
                        } else if marker == 0xE2 {
                            if i + 16 <= bytes.len() && &bytes[i + 4..i + 15] == b"ICC_PROFILE" {
                                if !tags.contains(&"ICC Color Profile".to_string()) {
                                    tags.push("ICC Color Profile".to_string());
                                }
                            }
                        }
                        i += 2 + length;
                    } else {
                        i += 1;
                    }
                }
            }
        }
        "png" => {
            if bytes.len() >= 8 && &bytes[0..8] == b"\x89PNG\r\n\x1a\n" {
                let mut offset = 8;
                while offset + 8 <= bytes.len() {
                    let len = u32::from_be_bytes([
                        bytes[offset],
                        bytes[offset + 1],
                        bytes[offset + 2],
                        bytes[offset + 3],
                    ]) as usize;
                    let chunk_type = &bytes[offset + 4..offset + 8];

                    if chunk_type == b"eXIf" && !tags.contains(&"EXIF Data".to_string()) {
                        tags.push("EXIF Data".to_string());
                    } else if (chunk_type == b"tEXt" || chunk_type == b"zTXt" || chunk_type == b"iTXt")
                        && !tags.contains(&"Text / Author Tags".to_string())
                    {
                        tags.push("Text / Author Tags".to_string());
                    } else if chunk_type == b"tIME" && !tags.contains(&"Timestamp".to_string()) {
                        tags.push("Timestamp".to_string());
                    }
                    offset += 12 + len;
                }
            }
        }
        "webp" => {
            if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
                let mut offset = 12;
                while offset + 8 <= bytes.len() {
                    let fourcc = &bytes[offset..offset + 4];
                    let chunk_size = u32::from_le_bytes([
                        bytes[offset + 4],
                        bytes[offset + 5],
                        bytes[offset + 6],
                        bytes[offset + 7],
                    ]) as usize;
                    if fourcc == b"EXIF" && !tags.contains(&"EXIF Data".to_string()) {
                        tags.push("EXIF Data".to_string());
                    } else if fourcc == b"XMP " && !tags.contains(&"XMP Metadata".to_string()) {
                        tags.push("XMP Metadata".to_string());
                    }
                    offset += 8 + ((chunk_size + 1) & !1);
                }
            }
        }
        "mp4" | "mov" | "m4v" | "m4a" => {
            if let Ok(tag) = mp4ameta::Tag::read_from_path(path) {
                if !tag.is_empty() {
                    tags.push("QuickTime/MP4 Tags".to_string());
                }
            }
            if bytes.windows(4).any(|w| w == b"udta" || w == b"@xyz") {
                if !tags.contains(&"Location / User Data".to_string()) {
                    tags.push("Location / User Data".to_string());
                }
            }
        }
        _ => {}
    }

    let has_metadata = !tags.is_empty();
    (has_metadata, tags)
}

/// Fallback lossless JPEG cleaner: drops APP1 (Exif/XMP), APP13 (IPTC), COM,
/// keeping JFIF, DQT, DHT, SOF, SOS 100% intact without any recompression.
pub fn clean_jpeg_lossless(bytes: &[u8]) -> Result<Vec<u8>, String> {
    if bytes.len() < 4 || bytes[0] != 0xFF || bytes[1] != 0xD8 {
        return Err("Not a valid JPEG image".to_string());
    }

    let mut output = Vec::with_capacity(bytes.len());
    output.push(0xFF);
    output.push(0xD8);

    let mut i = 2;
    while i < bytes.len() {
        if bytes[i] == 0xFF {
            if i + 1 >= bytes.len() {
                output.push(bytes[i]);
                break;
            }
            let marker = bytes[i + 1];

            if marker == 0xDA || marker == 0xD9 {
                output.extend_from_slice(&bytes[i..]);
                break;
            }

            if (marker >= 0xD0 && marker <= 0xD7) || marker == 0x01 {
                output.push(0xFF);
                output.push(marker);
                i += 2;
                continue;
            }

            if i + 3 >= bytes.len() {
                return Err("Truncated JPEG marker".to_string());
            }

            let length = ((bytes[i + 2] as usize) << 8) | (bytes[i + 3] as usize);
            let segment_end = i + 2 + length;

            if segment_end > bytes.len() {
                return Err("Invalid JPEG marker segment length".to_string());
            }

            let is_metadata = marker == 0xE1 || marker == 0xED || marker == 0xFE;

            if !is_metadata {
                output.extend_from_slice(&bytes[i..segment_end]);
            }

            i = segment_end;
        } else {
            output.push(bytes[i]);
            i += 1;
        }
    }

    Ok(output)
}

/// Fallback lossless PNG cleaner: removes tEXt, zTXt, iTXt, eXIf, tIME,
/// keeping IHDR, PLTE, IDAT, tRNS, IEND 100% intact with original checksums.
pub fn clean_png_lossless(bytes: &[u8]) -> Result<Vec<u8>, String> {
    if bytes.len() < 8 || &bytes[0..8] != b"\x89PNG\r\n\x1a\n" {
        return Err("Not a valid PNG image".to_string());
    }

    let mut output = Vec::with_capacity(bytes.len());
    output.extend_from_slice(&bytes[0..8]);

    let mut offset = 8;
    while offset + 8 <= bytes.len() {
        let chunk_len = u32::from_be_bytes([
            bytes[offset],
            bytes[offset + 1],
            bytes[offset + 2],
            bytes[offset + 3],
        ]) as usize;

        let total_chunk_len = 12 + chunk_len;
        if offset + total_chunk_len > bytes.len() {
            return Err("Truncated PNG chunk".to_string());
        }

        let chunk_type = &bytes[offset + 4..offset + 8];
        let is_meta = chunk_type == b"eXIf"
            || chunk_type == b"tEXt"
            || chunk_type == b"zTXt"
            || chunk_type == b"iTXt"
            || chunk_type == b"tIME"
            || chunk_type == b"dSIG";

        if !is_meta {
            output.extend_from_slice(&bytes[offset..offset + total_chunk_len]);
        }

        offset += total_chunk_len;
    }

    Ok(output)
}

/// Clean WebP metadata (strips EXIF and XMP chunks from RIFF stream)
pub fn clean_webp_lossless(bytes: &[u8]) -> Result<Vec<u8>, String> {
    if bytes.len() < 12 || &bytes[0..4] != b"RIFF" || &bytes[8..12] != b"WEBP" {
        return Err("Not a valid WebP image".to_string());
    }

    let mut output = Vec::with_capacity(bytes.len());
    output.extend_from_slice(&bytes[0..12]);

    let mut offset = 12;
    while offset + 8 <= bytes.len() {
        let fourcc = &bytes[offset..offset + 4];
        let chunk_size = u32::from_le_bytes([
            bytes[offset + 4],
            bytes[offset + 5],
            bytes[offset + 6],
            bytes[offset + 7],
        ]) as usize;

        let padded_size = (chunk_size + 1) & !1;
        let total_chunk_len = 8 + padded_size;

        if offset + 8 + chunk_size > bytes.len() {
            return Err("Truncated WebP chunk".to_string());
        }

        let is_meta = fourcc == b"EXIF" || fourcc == b"XMP ";

        if !is_meta {
            let slice_end = std::cmp::min(bytes.len(), offset + total_chunk_len);
            output.extend_from_slice(&bytes[offset..slice_end]);
        }

        offset += total_chunk_len;
    }

    if output.len() >= 8 {
        let riff_payload = (output.len() - 8) as u32;
        output[4..8].copy_from_slice(&riff_payload.to_le_bytes());
    }

    Ok(output)
}

/// Clean image file completely without damage, verifying decode capability
pub fn clean_image_file(input_bytes: &[u8], ext: &str) -> Result<Vec<u8>, String> {
    let cleaned_opt = metastrip::strip_metadata(input_bytes).ok();

    let final_bytes = match cleaned_opt {
        Some(b) if !b.is_empty() => b,
        _ => match ext {
            "jpg" | "jpeg" => clean_jpeg_lossless(input_bytes)?,
            "png" => clean_png_lossless(input_bytes)?,
            "webp" => clean_webp_lossless(input_bytes)?,
            _ => input_bytes.to_vec(),
        },
    };

    // CRITICAL SAFETY VERIFICATION: verify decode capability
    if let Err(e) = image::load_from_memory(&final_bytes) {
        return Err(format!(
            "Safety check failed: Cleaned file cannot be decoded by image viewers ({}). Aborting to protect file.",
            e
        ));
    }

    Ok(final_bytes)
}

/// Convert image format and optionally strip metadata
pub fn convert_and_clean_image(
    input_bytes: &[u8],
    source_ext: &str,
    target_format: &str,
    quality: u8,
    strip_metadata: bool,
) -> Result<Vec<u8>, String> {
    let clean_target = target_format.to_lowercase();

    // If format is "same" or matching source format
    if clean_target == "same" || clean_target.is_empty() || clean_target == source_ext {
        if strip_metadata {
            return clean_image_file(input_bytes, source_ext);
        } else {
            return Ok(input_bytes.to_vec());
        }
    }

    // Decode with image crate
    let img = image::load_from_memory(input_bytes)
        .map_err(|e| format!("Failed to decode image for conversion: {}", e))?;

    let mut out_bytes = Vec::new();
    let mut cursor = std::io::Cursor::new(&mut out_bytes);

    match clean_target.as_str() {
        "jpeg" | "jpg" => {
            let rgb = img.to_rgb8();
            let q = quality.clamp(1, 100);
            let mut encoder =
                image::codecs::jpeg::JpegEncoder::new_with_quality(&mut cursor, q);
            encoder
                .encode(
                    rgb.as_raw(),
                    rgb.width(),
                    rgb.height(),
                    image::ExtendedColorType::Rgb8,
                )
                .map_err(|e| format!("Failed to encode JPEG: {}", e))?;
        }
        "png" => {
            img.write_to(&mut cursor, image::ImageFormat::Png)
                .map_err(|e| format!("Failed to encode PNG: {}", e))?;
        }
        "webp" => {
            img.write_to(&mut cursor, image::ImageFormat::WebP)
                .map_err(|e| format!("Failed to encode WebP: {}", e))?;
        }
        _ => {
            return Err(format!("Unsupported target format: {}", target_format));
        }
    }

    // SAFETY CHECK: Verify converted image is valid and viewable
    if let Err(e) = image::load_from_memory(&out_bytes) {
        return Err(format!(
            "Safety check failed: Converted image cannot be opened ({}). Aborting to protect file.",
            e
        ));
    }

    Ok(out_bytes)
}

/// Clean MP4 / MOV video file metadata using mp4ameta and tag clearing
pub fn clean_video_file(src_path: &Path, target_path: &Path) -> Result<u64, String> {
    if src_path != target_path {
        fs::copy(src_path, target_path)
            .map_err(|e| format!("Failed to copy video to destination: {}", e))?;
    }

    if let Ok(mut tag) = mp4ameta::Tag::read_from_path(target_path) {
        tag.clear_meta_items();
        let write_cfg = mp4ameta::WriteConfig {
            write_meta_items: true,
            write_chapter_list: false,
            write_chapter_track: false,
            ..Default::default()
        };
        let _ = tag.write_with_path(target_path, &write_cfg);
    }

    let meta = fs::metadata(target_path)
        .map_err(|e| format!("Failed to verify cleaned video: {}", e))?;
    if meta.len() < 16 {
        return Err("Video file too small after cleaning".to_string());
    }

    Ok(meta.len())
}

/// Compute new filename and extension given a file path, index, format, and rename config
pub fn compute_new_name(
    file_path: &Path,
    index: usize,
    target_format: &str,
    config: Option<&RenameConfig>,
) -> (String, String) {
    let original_stem = file_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_string();

    let original_ext = file_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let target_ext = match target_format.to_lowercase().as_str() {
        "jpeg" | "jpg" => "jpg".to_string(),
        "png" => "png".to_string(),
        "webp" => "webp".to_string(),
        _ => original_ext,
    };

    let cfg = match config {
        Some(c) if c.enabled => c,
        _ => return (format!("{}.{}", original_stem, target_ext), target_ext),
    };

    let num_val = cfg.start_index + index;
    let formatted_index = if cfg.padding > 0 {
        format!("{:0width$}", num_val, width = cfg.padding)
    } else {
        format!("{}", num_val)
    };

    let date_str = fs::metadata(file_path)
        .and_then(|m| m.modified())
        .map(|t| {
            let dur = t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
            let secs = dur.as_secs();
            let days = secs / 86400;
            let year = 1970 + days / 365;
            format!("{:04}", year)
        })
        .unwrap_or_else(|_| "2026".to_string());

    let mut name = match cfg.mode.as_str() {
        "find_replace" => {
            if !cfg.find_text.is_empty() {
                if cfg.case_sensitive {
                    original_stem.replace(&cfg.find_text, &cfg.replace_text)
                } else {
                    let mut result = original_stem.clone();
                    let find_lower = cfg.find_text.to_lowercase();
                    loop {
                        if let Some(pos) = result.to_lowercase().find(&find_lower) {
                            result.replace_range(pos..pos + cfg.find_text.len(), &cfg.replace_text);
                        } else {
                            break;
                        }
                    }
                    result
                }
            } else {
                original_stem
            }
        }
        "prefix_suffix" => {
            format!("{}{}{}", cfg.prefix, original_stem, cfg.suffix)
        }
        "template" => {
            let t = if cfg.template.is_empty() {
                "{name}_{index}"
            } else {
                &cfg.template
            };
            t.replace("{name}", &original_stem)
                .replace("{index}", &formatted_index)
                .replace("{num}", &formatted_index)
                .replace("{date}", &date_str)
        }
        _ => original_stem,
    };

    // Case transformation
    name = match cfg.case_transform.as_str() {
        "lowercase" => name.to_lowercase(),
        "uppercase" => name.to_uppercase(),
        "titlecase" => name
            .split_whitespace()
            .map(|w| {
                let mut chars = w.chars();
                match chars.next() {
                    None => String::new(),
                    Some(f) => f.to_uppercase().collect::<String>() + chars.as_str(),
                }
            })
            .collect::<Vec<_>>()
            .join(" "),
        "snake_case" => name.replace([' ', '-'], "_").to_lowercase(),
        "kebab_case" | "kebab-case" => name.replace([' ', '_'], "-").to_lowercase(),
        _ => name,
    };

    if name.trim().is_empty() {
        name = format!("file_{}", formatted_index);
    }

    (format!("{}.{}", name, target_ext), target_ext)
}

/// Generate live preview of renaming results
pub fn preview_renaming(
    file_paths: Vec<String>,
    target_format: String,
    config: RenameConfig,
) -> Vec<RenamePreviewItem> {
    let mut previews = Vec::with_capacity(file_paths.len());

    for (idx, path_str) in file_paths.iter().enumerate() {
        let p = Path::new(path_str);
        let orig_name = p
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();

        let (new_name, new_ext) = compute_new_name(p, idx, &target_format, Some(&config));
        let will_change = orig_name != new_name;

        previews.push(RenamePreviewItem {
            original_path: path_str.clone(),
            original_name: orig_name,
            new_name,
            new_extension: new_ext,
            will_change,
        });
    }

    previews
}

/// Scan a folder for media files and inspect their metadata
pub fn scan_media_metadata(
    folder_path: &str,
    recursive: bool,
) -> Result<MetaScanResult, String> {
    let root = Path::new(folder_path);
    if !root.exists() || !root.is_dir() {
        return Err("Folder does not exist or is not a directory".to_string());
    }

    let mut files = Vec::new();
    let mut image_count = 0;
    let mut video_count = 0;
    let mut files_with_metadata = 0;

    let walker = walkdir::WalkDir::new(root).max_depth(if recursive { 20 } else { 1 });

    for entry in walker.into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        let is_image = matches!(
            ext.as_str(),
            "jpg" | "jpeg" | "png" | "webp" | "tiff" | "tif" | "gif"
        );
        let is_video = matches!(
            ext.as_str(),
            "mp4" | "mov" | "m4v" | "m4a" | "mkv" | "webm"
        );

        if !is_image && !is_video {
            continue;
        }

        let file_type = if is_image {
            image_count += 1;
            "image".to_string()
        } else {
            video_count += 1;
            "video".to_string()
        };

        let size_bytes = fs::metadata(path).map(|m| m.len()).unwrap_or(0);
        let (has_meta, detected_tags) = inspect_file_metadata(path);

        if has_meta {
            files_with_metadata += 1;
        }

        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        files.push(CleanableFileInfo {
            id: blake3::hash(path.to_string_lossy().as_bytes()).to_hex().to_string(),
            name,
            path: path.to_string_lossy().to_string(),
            extension: ext,
            size_bytes,
            file_type,
            has_metadata: has_meta,
            detected_tags,
            status: "ready".to_string(),
            cleaned_size_bytes: None,
        });
    }

    Ok(MetaScanResult {
        folder_path: folder_path.to_string(),
        total_files: files.len(),
        image_count,
        video_count,
        files_with_metadata,
        files,
    })
}

/// Unified batch processor: Metadata Stripping + Format Conversion + Renaming
pub fn process_media_batch(opts: ProcessBatchOptions) -> Result<BatchProcessResult, String> {
    if opts.file_paths.is_empty() {
        return Err("No files specified for batch processing".to_string());
    }

    let dest_dir = if opts.in_place {
        None
    } else {
        let dest = opts.destination_folder.trim();
        if dest.is_empty() {
            return Err("Destination folder must be provided when not editing in-place".to_string());
        }
        let p = PathBuf::from(dest);
        fs::create_dir_all(&p)
            .map_err(|e| format!("Failed to create destination directory: {}", e))?;
        Some(p)
    };

    let mut total_bytes_saved: u64 = 0;
    let mut success_count = 0;
    let mut failed_count = 0;
    let mut results = Vec::new();
    let mut failed_files = Vec::new();

    let rename_cfg = opts.rename_config.as_ref();

    for (idx, path_str) in opts.file_paths.iter().enumerate() {
        let src_path = Path::new(path_str);
        if !src_path.exists() || !src_path.is_file() {
            failed_count += 1;
            failed_files.push(format!("{}: file not found", path_str));
            results.push(ProcessedFileResult {
                original_path: path_str.clone(),
                output_path: String::new(),
                original_name: String::new(),
                output_name: String::new(),
                original_size: 0,
                output_size: 0,
                metadata_stripped: false,
                format_converted: false,
                renamed: false,
                status: "failed".to_string(),
                error_message: Some("File not found".to_string()),
            });
            continue;
        }

        let orig_name = src_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();
        let orig_ext = src_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        let original_size = fs::metadata(src_path).map(|m| m.len()).unwrap_or(0);

        let is_image = matches!(
            orig_ext.as_str(),
            "jpg" | "jpeg" | "png" | "webp" | "tiff" | "tif" | "gif"
        );

        // Compute output filename and format
        let effective_format = if is_image {
            &opts.convert_format
        } else {
            "same"
        };

        let (new_file_name, new_ext) = compute_new_name(
            src_path,
            idx,
            effective_format,
            rename_cfg,
        );

        let is_renamed = orig_name != new_file_name;
        let is_converted = is_image && effective_format != "same" && !effective_format.is_empty() && effective_format != orig_ext;

        let target_path = if let Some(ref d) = dest_dir {
            d.join(&new_file_name)
        } else {
            src_path.with_file_name(&new_file_name)
        };

        if is_image {
            let original_bytes = match fs::read(src_path) {
                Ok(b) => b,
                Err(e) => {
                    failed_count += 1;
                    failed_files.push(format!("{}: read error {}", path_str, e));
                    results.push(ProcessedFileResult {
                        original_path: path_str.clone(),
                        output_path: String::new(),
                        original_name: orig_name,
                        output_name: new_file_name,
                        original_size,
                        output_size: 0,
                        metadata_stripped: false,
                        format_converted: false,
                        renamed: is_renamed,
                        status: "failed".to_string(),
                        error_message: Some(format!("Read error: {}", e)),
                    });
                    continue;
                }
            };

            let clean_result = convert_and_clean_image(
                &original_bytes,
                &orig_ext,
                effective_format,
                opts.image_quality,
                opts.strip_metadata,
            );

            match clean_result {
                Ok(out_bytes) => {
                    // Safe atomic write via temporary file
                    let temp_target = target_path.with_extension(format!("{}.tmp", new_ext));
                    if let Err(e) = fs::write(&temp_target, &out_bytes) {
                        failed_count += 1;
                        failed_files.push(format!("{}: write error {}", path_str, e));
                        continue;
                    }

                    if let Err(_) = fs::rename(&temp_target, &target_path) {
                        let _ = fs::copy(&temp_target, &target_path);
                        let _ = fs::remove_file(&temp_target);
                    }

                    // If in_place and the filename changed or extension changed, delete the old file
                    if opts.in_place && src_path != target_path {
                        let _ = fs::remove_file(src_path);
                    }

                    let new_size = out_bytes.len() as u64;
                    if original_size > new_size {
                        total_bytes_saved += original_size - new_size;
                    }
                    success_count += 1;

                    results.push(ProcessedFileResult {
                        original_path: path_str.clone(),
                        output_path: target_path.to_string_lossy().to_string(),
                        original_name: orig_name,
                        output_name: new_file_name,
                        original_size,
                        output_size: new_size,
                        metadata_stripped: opts.strip_metadata,
                        format_converted: is_converted,
                        renamed: is_renamed,
                        status: "success".to_string(),
                        error_message: None,
                    });
                }
                Err(e) => {
                    failed_count += 1;
                    failed_files.push(format!("{}: {}", path_str, e));
                    results.push(ProcessedFileResult {
                        original_path: path_str.clone(),
                        output_path: String::new(),
                        original_name: orig_name,
                        output_name: new_file_name,
                        original_size,
                        output_size: 0,
                        metadata_stripped: false,
                        format_converted: false,
                        renamed: is_renamed,
                        status: "failed".to_string(),
                        error_message: Some(e),
                    });
                }
            }
        } else {
            // Video file processing (safe copy/move and metadata stripping)
            let temp_target = target_path.with_extension(format!("{}.tmp", new_ext));
            let write_res = if opts.strip_metadata {
                clean_video_file(src_path, &temp_target)
            } else {
                fs::copy(src_path, &temp_target)
                    .map_err(|e| format!("Copy failed: {}", e))
                    .and_then(|_| {
                        fs::metadata(&temp_target)
                            .map(|m| m.len())
                            .map_err(|e| format!("Meta failed: {}", e))
                    })
            };

            match write_res {
                Ok(new_size) => {
                    if let Err(_) = fs::rename(&temp_target, &target_path) {
                        let _ = fs::copy(&temp_target, &target_path);
                        let _ = fs::remove_file(&temp_target);
                    }

                    if opts.in_place && src_path != target_path {
                        let _ = fs::remove_file(src_path);
                    }

                    if original_size > new_size {
                        total_bytes_saved += original_size - new_size;
                    }
                    success_count += 1;

                    results.push(ProcessedFileResult {
                        original_path: path_str.clone(),
                        output_path: target_path.to_string_lossy().to_string(),
                        original_name: orig_name,
                        output_name: new_file_name,
                        original_size,
                        output_size: new_size,
                        metadata_stripped: opts.strip_metadata,
                        format_converted: false,
                        renamed: is_renamed,
                        status: "success".to_string(),
                        error_message: None,
                    });
                }
                Err(e) => {
                    failed_count += 1;
                    failed_files.push(format!("{}: {}", path_str, e));
                    results.push(ProcessedFileResult {
                        original_path: path_str.clone(),
                        output_path: String::new(),
                        original_name: orig_name,
                        output_name: new_file_name,
                        original_size,
                        output_size: 0,
                        metadata_stripped: false,
                        format_converted: false,
                        renamed: is_renamed,
                        status: "failed".to_string(),
                        error_message: Some(e),
                    });
                }
            }
        }
    }

    let final_dest = if let Some(d) = dest_dir {
        d.to_string_lossy().to_string()
    } else {
        "In-Place (Original Files Updated)".to_string()
    };

    Ok(BatchProcessResult {
        total_processed: opts.file_paths.len(),
        success_count,
        failed_count,
        total_bytes_saved,
        destination_folder: final_dest,
        files: results,
        failed_files,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_new_name_template() {
        let p = Path::new("C:/photos/vacation_shot.jpeg");
        let cfg = RenameConfig {
            enabled: true,
            mode: "template".to_string(),
            template: "Holiday_{index}_{name}".to_string(),
            find_text: "".to_string(),
            replace_text: "".to_string(),
            case_sensitive: false,
            prefix: "".to_string(),
            suffix: "".to_string(),
            start_index: 1,
            padding: 3,
            case_transform: "none".to_string(),
        };

        let (new_name, new_ext) = compute_new_name(p, 0, "png", Some(&cfg));
        assert_eq!(new_name, "Holiday_001_vacation_shot.png");
        assert_eq!(new_ext, "png");
    }

    #[test]
    fn test_compute_new_name_find_replace_and_casing() {
        let p = Path::new("C:/photos/IMG_TEST_FILE.jpg");
        let cfg = RenameConfig {
            enabled: true,
            mode: "find_replace".to_string(),
            template: "".to_string(),
            find_text: "IMG_".to_string(),
            replace_text: "Photo_".to_string(),
            case_sensitive: false,
            prefix: "".to_string(),
            suffix: "".to_string(),
            start_index: 1,
            padding: 0,
            case_transform: "lowercase".to_string(),
        };

        let (new_name, new_ext) = compute_new_name(p, 0, "same", Some(&cfg));
        assert_eq!(new_name, "photo_test_file.jpg");
        assert_eq!(new_ext, "jpg");
    }

    #[test]
    fn test_clean_and_convert_png_to_jpeg() {
        // Create 20x20 test image in memory
        let img = image::RgbImage::new(20, 20);
        let mut png_bytes = Vec::new();
        let mut cursor = std::io::Cursor::new(&mut png_bytes);
        img.write_to(&mut cursor, image::ImageFormat::Png).unwrap();

        // Convert to jpeg
        let converted = convert_and_clean_image(&png_bytes, "png", "jpeg", 85, true).unwrap();
        assert!(!converted.is_empty());
        assert_eq!(converted[0], 0xFF);
        assert_eq!(converted[1], 0xD8); // Valid JPEG SOI

        // Verify decoded without error
        let decoded = image::load_from_memory(&converted).unwrap();
        assert_eq!(decoded.width(), 20);
        assert_eq!(decoded.height(), 20);
    }
}
