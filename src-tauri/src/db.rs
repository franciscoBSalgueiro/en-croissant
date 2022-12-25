
use pgn_reader::{BufferedReader, Nag, Outcome, RawComment, RawHeader, SanPlus, Visitor};

#[derive(Debug, Default)]
struct Stats {
    games: usize,
    headers: usize,
    sans: usize,
    nags: usize,
    comments: usize,
    variations: usize,
    outcomes: usize,
}

impl Stats {
    fn new() -> Stats {
        Stats::default()
    }
}

impl Visitor for Stats {
    type Result = ();

    fn header(&mut self, _key: &[u8], _value: RawHeader<'_>) {
        self.headers += 1;
    }

    fn san(&mut self, _san: SanPlus) {
        self.sans += 1;
    }

    fn nag(&mut self, _nag: Nag) {
        self.nags += 1;
    }

    fn comment(&mut self, _comment: RawComment<'_>) {
        self.comments += 1;
    }

    fn end_variation(&mut self) {
        self.variations += 1;
    }

    fn outcome(&mut self, _outcome: Option<Outcome>) {
        self.outcomes += 1;
    }

    fn end_game(&mut self) {
        self.games += 1;
    }
}

#[tauri::command]
pub fn read_pgn(file: &str) -> usize {
    let file = std::fs::File::open(file).unwrap();
    let mut reader = BufferedReader::new(file);

    let mut stats = Stats::new();
    reader.read_all(&mut stats).unwrap();
    stats.games
}
