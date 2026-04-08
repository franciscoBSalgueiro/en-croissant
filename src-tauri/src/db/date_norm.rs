//! Normalize PGN `[Date]` strings to canonical `YYYY.MM.DD` for storage and comparisons.
//! Handles common non-standard forms (e.g. European `DD.MM.YY`) and clamps impossible future dates.

use chrono::{Datelike, NaiveDate, Utc};

fn expand_two_digit_year(yy: u32) -> Option<i32> {
    if yy > 99 {
        return None;
    }
    // 70–99 → 1970–1999; 00–69 → 2000–2069 (then century rollback may adjust).
    let y = if yy >= 70 {
        1900 + yy as i32
    } else {
        2000 + yy as i32
    };
    Some(y)
}

fn interpret_triple(a: u32, b: u32, c: u32) -> Option<(i32, u32, u32)> {
    // YYYY.MM.DD (PGN standard)
    if a >= 1000 {
        NaiveDate::from_ymd_opt(a as i32, b, c)?;
        return Some((a as i32, b, c));
    }

    // DD.MM.YY — first token is the day (cannot be a month)
    if a > 12 && a <= 31 && b <= 12 && c < 100 {
        let y = expand_two_digit_year(c)?;
        NaiveDate::from_ymd_opt(y, b, a)?;
        return Some((y, b, a));
    }

    // YY.MM.DD (two-digit year first; e.g. 70.01.15)
    if a < 100 && b <= 12 && c <= 31 {
        let y = expand_two_digit_year(a)?;
        if NaiveDate::from_ymd_opt(y, b, c).is_some() {
            return Some((y, b, c));
        }
    }

    // DD.MM.YY — day/month both ≤12 (ambiguous with YY.MM.DD; try when YY.MM.DD failed)
    if a <= 12 && b <= 12 && c < 100 {
        let y = expand_two_digit_year(c)?;
        if NaiveDate::from_ymd_opt(y, b, a).is_some() {
            return Some((y, b, a));
        }
    }

    None
}

/// Returns canonical `YYYY.MM.DD`, or the original string when the date is incomplete/unknown (`?`).
/// Returns `None` only for empty input after trim.
pub fn normalize_pgn_date_for_storage(raw: &str) -> Option<String> {
    let s = raw.trim().trim_matches(|c| c == '"' || c == '\'');
    if s.is_empty() {
        return None;
    }
    if s.contains('?') {
        return Some(s.to_string());
    }

    let parts: Vec<&str> = s.split('.').collect();
    if parts.len() != 3 {
        return Some(s.to_string());
    }

    for p in &parts {
        if p.is_empty() || !p.chars().all(|c| c.is_ascii_digit()) {
            return Some(s.to_string());
        }
    }

    let (a, b, c) = match (
        parts[0].parse::<u32>(),
        parts[1].parse::<u32>(),
        parts[2].parse::<u32>(),
    ) {
        (Ok(a), Ok(b), Ok(c)) => (a, b, c),
        _ => return Some(s.to_string()),
    };

    let Some((y, m, d)) = interpret_triple(a, b, c) else {
        return Some(s.to_string());
    };
    let Some(mut date) = NaiveDate::from_ymd_opt(y, m, d) else {
        return Some(s.to_string());
    };

    let today = Utc::now().date_naive();
    let from_four_digit_year = a >= 1000;
    // Only roll century for two-digit-year shapes (e.g. DD.MM.29 → 2029): explicit `2029.12.31` stays 2029 and is clamped below.
    if !from_four_digit_year {
        for _ in 0..3 {
            if date > today && date.year() >= 2000 {
                let Some(rolled) = date.with_year(date.year() - 100) else {
                    break;
                };
                date = rolled;
            } else {
                break;
            }
        }
    }

    if date > today {
        date = NaiveDate::from_ymd_opt(1970, 1, 1).unwrap_or(date);
    }

    Some(format!(
        "{:04}.{:02}.{:02}",
        date.year(),
        date.month(),
        date.day()
    ))
}

/// Parse a stored canonical or legacy date string for chronological comparisons.
pub fn parse_game_date_chronological(raw: &str) -> Option<NaiveDate> {
    let s = normalize_pgn_date_for_storage(raw)?;
    if s.contains('?') {
        return None;
    }
    NaiveDate::parse_from_str(&s, "%Y.%m.%d").ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn standard_pgn_date() {
        assert_eq!(
            normalize_pgn_date_for_storage("2024.05.01").as_deref(),
            Some("2024.05.01")
        );
    }

    #[test]
    fn european_dd_mm_yy_rolls_century() {
        let n = normalize_pgn_date_for_storage("31.12.29").unwrap();
        assert_eq!(n, "1929.12.31");
    }

    #[test]
    fn unknown_preserved() {
        let u = "????.??.??";
        assert_eq!(normalize_pgn_date_for_storage(u).as_deref(), Some(u));
    }

    #[test]
    fn explicit_future_year_clamped_to_epoch() {
        assert_eq!(
            normalize_pgn_date_for_storage("2030.01.01").as_deref(),
            Some("1970.01.01")
        );
    }
}
