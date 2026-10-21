use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use rayon::prelude::*;

const IMAGE_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "webp", "bmp", "gif", "tiff", "tif"];
const VIDEO_EXTENSIONS: &[&str] = &["mp4", "mkv", "avi", "mov", "wmv", "flv", "webm", "m4v", "3gp"];

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MediaFile {
    pub id: String,
    pub path: String,
    pub name: String,
    pub ext: String,
    pub is_video: bool,
    pub size_bytes: u64,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub modified_time: u64,
    pub exact_hash: String,
    pub perceptual_hash: Option<u64>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DuplicateGroup {
    pub group_id: String,
    pub match_type: String, // "exact_byte" | "perceptual_visual" | "video_match"
    pub similarity_pct: u32,
    pub files: Vec<MediaFile>,
    pub recommended_keep_id: String,
    pub reclaimable_bytes: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DuplicateScanResult {
    pub folder_path: String,
    pub total_files_scanned: usize,
    pub duplicate_files_count: usize,
    pub total_groups: usize,
    pub reclaimable_bytes: u64,
    pub groups: Vec<DuplicateGroup>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TrashResult {
    pub trashed_paths: Vec<String>,
    pub failed_paths: Vec<(String, String)>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MoveResult {
    pub moved_files: Vec<(String, String)>,
    pub failed_files: Vec<(String, String)>,
    pub destination_folder: String,
}


/// Compute fast BLAKE3 hash of a file
pub fn compute_blake3_hash(path: &Path) -> Result<String, String> {
    let mut file = fs::File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
    let mut hasher = blake3::Hasher::new();
    let mut buffer = [0u8; 65536];

    loop {
        let bytes_read = file.read(&mut buffer).map_err(|e| format!("Read error: {}", e))?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }

    Ok(hasher.finalize().to_hex().to_string())
}

/// Compute 64-bit difference hash (dHash) for perceptual visual similarity
pub fn compute_dhash(path: &Path) -> Option<u64> {
    let img = image::open(path).ok()?;
    let gray = img.thumbnail_exact(9, 8).to_luma8();
    let mut hash: u64 = 0;

    for y in 0..8 {
        for x in 0..8 {
            let left = gray.get_pixel(x, y)[0];
            let right = gray.get_pixel(x + 1, y)[0];
            if left > right {
                hash |= 1 << (y * 8 + x);
            }
        }
    }

    Some(hash)
}

/// Calculate Hamming distance between two 64-bit hashes
pub fn hamming_distance(h1: u64, h2: u64) -> u32 {
    (h1 ^ h2).count_ones()
}

/// Scan a directory and find all duplicate images and videos
pub fn scan_duplicates(
    folder_path: String,
    recursive: bool,
    max_dhash_distance: u32, // default 5 for ~92%+ similarity
    check_images: bool,
    check_videos: bool,
) -> Result<DuplicateScanResult, String> {
    let root = Path::new(&folder_path);
    if !root.exists() || !root.is_dir() {
        return Err("Directory does not exist.".to_string());
    }

    // 1. Collect all matching media file paths
    let mut candidate_paths: Vec<PathBuf> = Vec::new();

    fn walk_dir(dir: &Path, recursive: bool, candidates: &mut Vec<PathBuf>) {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_dir() {
                    let dir_name = p.file_name().unwrap_or_default().to_string_lossy();
                    if !dir_name.starts_with('.') && recursive {
                        walk_dir(&p, recursive, candidates);
                    }
                } else if p.is_file() {
                    candidates.push(p);
                }
            }
        }
    }

    walk_dir(root, recursive, &mut candidate_paths);

    // 2. Filter files by extensions
    let media_paths: Vec<PathBuf> = candidate_paths
        .into_iter()
        .filter(|p| {
            if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
                let ext_lower = ext.to_lowercase();
                let is_img = IMAGE_EXTENSIONS.contains(&ext_lower.as_str());
                let is_vid = VIDEO_EXTENSIONS.contains(&ext_lower.as_str());
                (check_images && is_img) || (check_videos && is_vid)
            } else {
                false
            }
        })
        .collect();

    let total_scanned = media_paths.len();

    // 3. Process media files in parallel using Rayon
    let media_files: Vec<MediaFile> = media_paths
        .par_iter()
        .filter_map(|p| {
            let metadata = fs::metadata(p).ok()?;
            let size = metadata.len();
            if size == 0 {
                return None;
            }

            let ext = p
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or_default()
                .to_lowercase();

            let is_vid = VIDEO_EXTENSIONS.contains(&ext.as_str());
            let name = p.file_name().unwrap_or_default().to_string_lossy().to_string();
            let path_str = p.to_string_lossy().to_string();

            let modified = metadata
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0);

            // Compute BLAKE3 exact hash
            let exact_hash = compute_blake3_hash(p).ok()?;

            // For images: get dimensions cheaply from header without decoding pixels
            let (width, height) = if !is_vid {
                let dims = image::image_dimensions(p).ok();
                dims.map(|(w, h)| (Some(w), Some(h))).unwrap_or((None, None))
            } else {
                (None, None)
            };

            let file_id = blake3::hash(path_str.as_bytes()).to_hex()[..16].to_string();

            Some(MediaFile {
                id: file_id,
                path: path_str,
                name,
                ext,
                is_video: is_vid,
                size_bytes: size,
                width,
                height,
                modified_time: modified,
                exact_hash,
                perceptual_hash: None, // lazily computed below only if needed
            })
        })
        .collect();

    // 4. Group by Exact Hash first (100% byte-for-byte identical duplicates)
    let mut exact_groups: HashMap<String, Vec<MediaFile>> = HashMap::new();
    for file in &media_files {
        exact_groups
            .entry(file.exact_hash.clone())
            .or_default()
            .push(file.clone());
    }

    let mut duplicate_groups: Vec<DuplicateGroup> = Vec::new();
    let mut handled_file_paths: std::collections::HashSet<String> = std::collections::HashSet::new();

    // Add exact duplicate groups
    for (hash, files) in exact_groups {
        if files.len() > 1 {
            for f in &files {
                handled_file_paths.insert(f.path.clone());
            }

            // Decide best file to keep:
            // 1) Highest resolution
            // 2) Largest file size
            // 3) Oldest file (original creation date)
            // 4) Shorter/cleaner filename (prefer photo.jpg over photo (1).jpg or photo_copy.jpg)
            let best_id = files
                .iter()
                .max_by(|a, b| {
                    let res_a = a.width.unwrap_or(0) * a.height.unwrap_or(0);
                    let res_b = b.width.unwrap_or(0) * b.height.unwrap_or(0);
                    res_a
                        .cmp(&res_b)
                        .then_with(|| a.size_bytes.cmp(&b.size_bytes))
                        .then_with(|| b.modified_time.cmp(&a.modified_time))
                        .then_with(|| b.name.len().cmp(&a.name.len()))
                })
                .map(|f| (f.id.clone(), f.size_bytes))
                .unwrap();

            let total_size: u64 = files.iter().map(|f| f.size_bytes).sum();
            let keep_size = best_id.1;
            let reclaimable = total_size.saturating_sub(keep_size);

            duplicate_groups.push(DuplicateGroup {
                group_id: format!("exact_{}", &hash[..12]),
                match_type: "exact_byte".to_string(),
                similarity_pct: 100,
                files,
                recommended_keep_id: best_id.0,
                reclaimable_bytes: reclaimable,
            });
        }
    }

    // 5. Perceptual Similarity Detection for remaining images (only if threshold > 0)
    if max_dhash_distance > 0 {
        let mut remaining_images: Vec<MediaFile> = media_files
            .into_iter()
            .filter(|f| !f.is_video && !handled_file_paths.contains(&f.path))
            .collect();

        // Compute dHash in parallel only for the remaining un-grouped images
        remaining_images.par_iter_mut().for_each(|f| {
            f.perceptual_hash = compute_dhash(Path::new(&f.path));
        });

        let mut visual_handled: std::collections::HashSet<usize> = std::collections::HashSet::new();

        for i in 0..remaining_images.len() {
            if visual_handled.contains(&i) || remaining_images[i].perceptual_hash.is_none() {
                continue;
            }

            let base_img = &remaining_images[i];
            let base_phash = base_img.perceptual_hash.unwrap();
            let mut cluster = vec![base_img.clone()];
            let mut min_distance = 64;

            for j in (i + 1)..remaining_images.len() {
                if visual_handled.contains(&j) || remaining_images[j].perceptual_hash.is_none() {
                    continue;
                }

                let other_img = &remaining_images[j];
                let other_phash = other_img.perceptual_hash.unwrap();
                let dist = hamming_distance(base_phash, other_phash);

                if dist <= max_dhash_distance {
                    cluster.push(other_img.clone());
                    visual_handled.insert(j);
                    if dist < min_distance {
                        min_distance = dist;
                    }
                }
            }

            if cluster.len() > 1 {
                visual_handled.insert(i);

                // Calculate similarity percentage: (64 - dist) / 64 * 100
                let sim_pct = ((64 - min_distance) * 100) / 64;

                let best_id = cluster
                    .iter()
                    .max_by(|a, b| {
                        let res_a = a.width.unwrap_or(0) * a.height.unwrap_or(0);
                        let res_b = b.width.unwrap_or(0) * b.height.unwrap_or(0);
                        res_a
                            .cmp(&res_b)
                            .then_with(|| a.size_bytes.cmp(&b.size_bytes))
                            .then_with(|| b.modified_time.cmp(&a.modified_time))
                            .then_with(|| b.name.len().cmp(&a.name.len()))
                    })
                    .map(|f| (f.id.clone(), f.size_bytes))
                    .unwrap();

                let total_size: u64 = cluster.iter().map(|f| f.size_bytes).sum();
                let keep_size = best_id.1;
                let reclaimable = total_size.saturating_sub(keep_size);

                duplicate_groups.push(DuplicateGroup {
                    group_id: format!("visual_{}", &cluster[0].id),
                    match_type: "visual_similar".to_string(),
                    similarity_pct: sim_pct,
                    files: cluster,
                    recommended_keep_id: best_id.0,
                    reclaimable_bytes: reclaimable,
                });
            }
        }
    }
    // Sort groups by reclaimable space descending (show biggest disk savers first!)
    duplicate_groups.sort_by(|a, b| b.reclaimable_bytes.cmp(&a.reclaimable_bytes));


    let total_reclaimable: u64 = duplicate_groups.iter().map(|g| g.reclaimable_bytes).sum();
    let total_duplicates: usize = duplicate_groups.iter().map(|g| g.files.len() - 1).sum();

    Ok(DuplicateScanResult {
        folder_path,
        total_files_scanned: total_scanned,
        duplicate_files_count: total_duplicates,
        total_groups: duplicate_groups.len(),
        reclaimable_bytes: total_reclaimable,
        groups: duplicate_groups,
    })
}

/// Safely moves a list of files to the Windows Recycle Bin
pub fn trash_media_files(paths: Vec<String>) -> Result<TrashResult, String> {
    let mut trashed = Vec::new();
    let mut failed = Vec::new();

    for path_str in paths {
        let p = Path::new(&path_str);
        if p.exists() {
            match trash::delete(p) {
                Ok(_) => trashed.push(path_str),
                Err(e) => failed.push((path_str, format!("{}", e))),
            }
        } else {
            failed.push((path_str, "File not found".to_string()));
        }
    }

    Ok(TrashResult {
        trashed_paths: trashed,
        failed_paths: failed,
    })
}

/// Safely moves duplicate files to a custom/quarantine folder with collision-proof naming
pub fn move_media_files_to_folder(paths: Vec<String>, dest_folder: String) -> Result<MoveResult, String> {
    let dest_dir = Path::new(&dest_folder);
    if !dest_dir.exists() {
        fs::create_dir_all(dest_dir).map_err(|e| format!("Failed to create destination folder: {}", e))?;
    }

    let mut moved = Vec::new();
    let mut failed = Vec::new();

    for src_path_str in paths {
        let src_path = Path::new(&src_path_str);
        if !src_path.exists() {
            failed.push((src_path_str, "File does not exist".to_string()));
            continue;
        }

        let file_stem = src_path
            .file_stem()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        let extension = src_path
            .extension()
            .map(|ext| ext.to_string_lossy().to_string())
            .unwrap_or_default();

        // Non-colliding target filename
        let mut target_filename = if extension.is_empty() {
            file_stem.clone()
        } else {
            format!("{}.{}", file_stem, extension)
        };
        let mut target_path = dest_dir.join(&target_filename);

        let mut counter = 1;
        while target_path.exists() {
            target_filename = if extension.is_empty() {
                format!("{}_{}", file_stem, counter)
            } else {
                format!("{}_{}.{}", file_stem, counter, extension)
            };
            target_path = dest_dir.join(&target_filename);
            counter += 1;
        }

        let target_str = target_path.to_string_lossy().to_string();
        // Try fast atomic rename first, fallback to copy+delete for cross-drive moves
        match fs::rename(&src_path, &target_path) {
            Ok(_) => {
                moved.push((src_path_str, target_str));
            }
            Err(_) => {
                match fs::copy(&src_path, &target_path) {
                    Ok(_) => {
                        let _ = fs::remove_file(&src_path);
                        moved.push((src_path_str, target_str));
                    }
                    Err(e) => {
                        failed.push((src_path_str, format!("Failed to move: {}", e)));
                    }
                }
            }
        }
    }

    Ok(MoveResult {
        moved_files: moved,
        failed_files: failed,
        destination_folder: dest_folder,
    })
}

