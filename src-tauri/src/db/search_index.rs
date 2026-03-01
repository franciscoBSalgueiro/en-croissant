use std::{
    fs::{File, OpenOptions},
    io::{self, BufReader, BufWriter, Read, Write},
    path::{Path, PathBuf},
    sync::Arc,
};

use memmap2::Mmap;
use rayon::prelude::*;
use rkyv::{Archive, Deserialize, Serialize};

const MAGIC: &[u8; 4] = b"ECSI";
const VERSION: u32 = 3;
const HEADER_SIZE: usize = 8;

fn verify_header(header: &[u8]) -> io::Result<()> {
    if header.len() < HEADER_SIZE {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "File too small for header",
        ));
    }

    if &header[0..4] != MAGIC {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "Invalid magic bytes",
        ));
    }

    let version = u32::from_le_bytes(header[4..8].try_into().unwrap());
    if version != VERSION {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!("Unsupported version: {} (expected {})", version, VERSION),
        ));
    }

    Ok(())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Archive, Serialize, Deserialize)]
#[rkyv(compare(PartialEq), derive(Debug))]
#[repr(u8)]
pub enum GameResult {
    None = 0,
    WhiteWin = 1,
    BlackWin = 2,
    Draw = 3,
    Other = 4,
}

impl GameResult {
    pub fn from_str(s: Option<&str>) -> Self {
        match s {
            Some("1-0") => GameResult::WhiteWin,
            Some("0-1") => GameResult::BlackWin,
            Some("1/2-1/2") => GameResult::Draw,
            Some(_) => GameResult::Other,
            None => GameResult::None,
        }
    }

    pub fn to_str(self) -> Option<&'static str> {
        match self {
            GameResult::None => None,
            GameResult::WhiteWin => Some("1-0"),
            GameResult::BlackWin => Some("0-1"),
            GameResult::Draw => Some("1/2-1/2"),
            GameResult::Other => Some("*"),
        }
    }
}

#[derive(Debug, Clone, Archive, Serialize, Deserialize)]
#[rkyv(compare(PartialEq), derive(Debug))]
pub struct SearchGameEntry {
    pub id: i32,
    pub white_id: i32,
    pub black_id: i32,
    pub date: Option<String>,
    pub result: GameResult,
    pub pawn_home: u16,
    pub white_material: u8,
    pub black_material: u8,
    pub fen: Option<String>,
    pub moves: Vec<u8>,
}

#[derive(Archive, Serialize, Deserialize)]
pub struct SearchIndex {
    pub entries: Vec<SearchGameEntry>,
}

impl SearchIndex {
    pub fn new() -> Self {
        Self {
            entries: Vec::new(),
        }
    }

    pub fn with_capacity(capacity: usize) -> Self {
        Self {
            entries: Vec::with_capacity(capacity),
        }
    }

    pub fn push(&mut self, entry: SearchGameEntry) {
        self.entries.push(entry);
    }

    pub fn write_to<P: AsRef<Path>>(&self, path: P) -> io::Result<()> {
        let file = OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .open(path)?;

        let mut writer = BufWriter::new(file);

        writer.write_all(MAGIC)?;
        writer.write_all(&VERSION.to_le_bytes())?;

        let bytes = rkyv::to_bytes::<rkyv::rancor::Error>(self).map_err(|e| {
            io::Error::new(io::ErrorKind::Other, format!("Serialization error: {}", e))
        })?;

        writer.write_all(&bytes)?;
        writer.flush()
    }
}

impl Default for SearchIndex {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone, Copy)]
pub struct SearchGameEntryRef<'a> {
    pub id: i32,
    pub white_id: i32,
    pub black_id: i32,
    pub date: Option<&'a str>,
    pub result: GameResult,
    pub pawn_home: u16,
    pub white_material: u8,
    pub black_material: u8,
    pub fen: Option<&'a str>,
    pub moves: &'a [u8],
}

impl<'a> From<&'a ArchivedSearchGameEntry> for SearchGameEntryRef<'a> {
    fn from(archived: &'a ArchivedSearchGameEntry) -> Self {
        Self {
            id: archived.id.into(),
            white_id: archived.white_id.into(),
            black_id: archived.black_id.into(),
            date: archived.date.as_ref().map(|s| s.as_str()),
            result: match archived.result {
                ArchivedGameResult::None => GameResult::None,
                ArchivedGameResult::WhiteWin => GameResult::WhiteWin,
                ArchivedGameResult::BlackWin => GameResult::BlackWin,
                ArchivedGameResult::Draw => GameResult::Draw,
                ArchivedGameResult::Other => GameResult::Other,
            },
            pawn_home: archived.pawn_home.into(),
            white_material: archived.white_material,
            black_material: archived.black_material,
            fen: archived.fen.as_ref().map(|s| s.as_str()),
            moves: &archived.moves,
        }
    }
}

impl SearchGameEntry {
    pub fn from_game_data(
        id: i32,
        white_id: i32,
        black_id: i32,
        date: Option<String>,
        result: Option<String>,
        moves: Vec<u8>,
        fen: Option<String>,
        pawn_home: i32,
        white_material: i32,
        black_material: i32,
    ) -> Self {
        Self {
            id,
            white_id,
            black_id,
            date,
            result: GameResult::from_str(result.as_deref()),
            pawn_home: pawn_home as u16,
            white_material: white_material as u8,
            black_material: black_material as u8,
            fen,
            moves,
        }
    }
}

#[derive(Clone)]
pub struct MmapSearchIndex {
    #[allow(dead_code)] // mmap must be kept alive to back the archived reference
    mmap: Arc<Mmap>,
    archived: &'static ArchivedSearchIndex,
}

unsafe impl Send for MmapSearchIndex {}
unsafe impl Sync for MmapSearchIndex {}

impl MmapSearchIndex {
    pub fn open<P: AsRef<Path>>(path: P) -> io::Result<Self> {
        let file = File::open(path)?;
        let mmap = unsafe { Mmap::map(&file)? };

        verify_header(&mmap)?;

        let mmap = Arc::new(mmap);

        let archived_bytes = &mmap[HEADER_SIZE..];
        let archived = unsafe { rkyv::access_unchecked::<ArchivedSearchIndex>(archived_bytes) };

        let archived: &'static ArchivedSearchIndex = unsafe { std::mem::transmute(archived) };

        Ok(Self { mmap, archived })
    }

    #[inline]
    pub fn len(&self) -> usize {
        self.archived.entries.len()
    }

    #[inline]
    #[allow(dead_code)]
    pub fn is_empty(&self) -> bool {
        self.archived.entries.is_empty()
    }

    #[inline]
    #[allow(dead_code)]
    pub fn get_entry_ref(&self, index: usize) -> Option<SearchGameEntryRef<'_>> {
        self.archived.entries.get(index).map(SearchGameEntryRef::from)
    }

    #[allow(dead_code)]
    pub fn iter(&self) -> impl Iterator<Item = SearchGameEntryRef<'_>> + ExactSizeIterator {
        self.archived.entries.iter().map(SearchGameEntryRef::from)
    }

    pub fn par_iter(&self) -> impl ParallelIterator<Item = SearchGameEntryRef<'_>> + '_ {
        self.archived
            .entries
            .par_iter()
            .map(SearchGameEntryRef::from)
    }

    pub fn is_valid<P: AsRef<Path>>(path: P) -> bool {
        let path = path.as_ref();
        if !path.exists() {
            return false;
        }

        let Ok(file) = File::open(path) else {
            return false;
        };

        let mut header = [0u8; HEADER_SIZE];
        let mut reader = BufReader::new(file);
        if reader.read_exact(&mut header).is_err() {
            return false;
        }

        verify_header(&header).is_ok()
    }

    #[allow(dead_code)]
    pub fn is_up_to_date<P: AsRef<Path>>(db_path: P) -> bool {
        let db_path = db_path.as_ref();
        let index_path = get_index_path(db_path);

        if !Self::is_valid(&index_path) {
            return false;
        }

        let Ok(db_meta) = std::fs::metadata(db_path) else {
            return false;
        };
        let Ok(index_meta) = std::fs::metadata(&index_path) else {
            return false;
        };

        let Ok(db_modified) = db_meta.modified() else {
            return false;
        };
        let Ok(index_modified) = index_meta.modified() else {
            return false;
        };

        index_modified >= db_modified
    }
}

pub fn get_index_path(db_path: &Path) -> PathBuf {
    db_path.with_extension("ecsi")
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_roundtrip() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("test.ecsi");

        // Create test entries
        let entries = vec![
            SearchGameEntry {
                id: 1,
                white_id: 100,
                black_id: 200,
                date: Some("2024.01.15".to_string()),
                result: GameResult::WhiteWin,
                pawn_home: 0xFFFF,
                white_material: 39,
                black_material: 39,
                fen: None,
                moves: vec![12, 12, 9, 9], // e4 e5 Nf3 Nc6
            },
            SearchGameEntry {
                id: 2,
                white_id: 150,
                black_id: 250,
                date: None,
                result: GameResult::Draw,
                pawn_home: 0xF0F0,
                white_material: 30,
                black_material: 28,
                fen: Some(
                    "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2".to_string(),
                ),
                moves: vec![15, 10],
            },
        ];

        // Write
        let index = SearchIndex { entries: entries.clone() };
        index.write_to(&path).unwrap();

        // Verify valid
        assert!(MmapSearchIndex::is_valid(&path));

        // Read back using mmap
        let index = MmapSearchIndex::open(&path).unwrap();
        assert_eq!(index.len(), entries.len());

        for (i, original) in entries.iter().enumerate() {
            let loaded = index.get_entry_ref(i).unwrap();
            assert_eq!(loaded.id, original.id);
            assert_eq!(loaded.white_id, original.white_id);
            assert_eq!(loaded.black_id, original.black_id);
            assert_eq!(loaded.result, original.result);
            assert_eq!(loaded.pawn_home, original.pawn_home);
            assert_eq!(loaded.white_material, original.white_material);
            assert_eq!(loaded.black_material, original.black_material);
            assert_eq!(loaded.fen, original.fen.as_deref());
            assert_eq!(loaded.moves, original.moves);
        }

        // Test iterator
        let loaded_vec: Vec<_> = index.iter().collect();
        assert_eq!(loaded_vec.len(), entries.len());
    }

    #[test]
    fn test_game_result_encoding() {
        assert_eq!(GameResult::from_str(Some("1-0")), GameResult::WhiteWin);
        assert_eq!(GameResult::from_str(Some("0-1")), GameResult::BlackWin);
        assert_eq!(GameResult::from_str(Some("1/2-1/2")), GameResult::Draw);
        assert_eq!(GameResult::from_str(Some("*")), GameResult::Other);
        assert_eq!(GameResult::from_str(None), GameResult::None);

        assert_eq!(GameResult::WhiteWin.to_str(), Some("1-0"));
        assert_eq!(GameResult::BlackWin.to_str(), Some("0-1"));
        assert_eq!(GameResult::Draw.to_str(), Some("1/2-1/2"));
        assert_eq!(GameResult::None.to_str(), None);
    }

    #[test]
    fn test_large_index() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("large.ecsi");

        let results = [
            GameResult::None,
            GameResult::WhiteWin,
            GameResult::BlackWin,
            GameResult::Draw,
            GameResult::Other,
        ];

        // Create many entries
        let mut index = SearchIndex::with_capacity(1000);
        for i in 0..1000 {
            index.push(SearchGameEntry {
                id: i,
                white_id: i * 2,
                black_id: i * 2 + 1,
                date: if i % 2 == 0 {
                    Some("2024.01.15".to_string())
                } else {
                    None
                },
                result: results[(i % 5) as usize],
                pawn_home: 0xFFFF,
                white_material: 39,
                black_material: 39,
                fen: if i % 3 == 0 {
                    Some("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1".to_string())
                } else {
                    None
                },
                moves: vec![12, 12, 9, 9],
            });
        }
        index.write_to(&path).unwrap();

        // Load with mmap
        let index = MmapSearchIndex::open(&path).unwrap();
        assert_eq!(index.len(), 1000);

        // Verify random access
        let entry = index.get_entry_ref(500).unwrap();
        assert_eq!(entry.id, 500);
        assert_eq!(entry.white_id, 1000);
        assert_eq!(entry.black_id, 1001);
    }

    #[test]
    fn test_parallel_iteration() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("parallel.ecsi");

        let mut index = SearchIndex::with_capacity(100);
        for i in 0..100 {
            index.push(SearchGameEntry {
                id: i,
                white_id: i,
                black_id: i,
                date: None,
                result: GameResult::None,
                pawn_home: 0,
                white_material: 0,
                black_material: 0,
                fen: None,
                moves: vec![],
            });
        }
        index.write_to(&path).unwrap();

        let mmap_index = MmapSearchIndex::open(&path).unwrap();

        // Test parallel iteration
        let sum: i32 = mmap_index.par_iter().map(|e| e.id).sum();
        assert_eq!(sum, (0..100i32).sum::<i32>());
    }
}
