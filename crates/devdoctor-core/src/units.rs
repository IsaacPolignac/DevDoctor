//! Human formatting helpers shared by the CLI and the desktop app.

/// Formats bytes using decimal units, the convention used by Finder and macOS.
pub fn format_bytes(bytes: u64) -> String {
    const UNITS: [&str; 6] = ["B", "kB", "MB", "GB", "TB", "PB"];
    if bytes < 1000 {
        return format!("{bytes} B");
    }
    let mut value = bytes as f64;
    let mut unit = 0;
    while value >= 1000.0 && unit < UNITS.len() - 1 {
        value /= 1000.0;
        unit += 1;
    }
    if value >= 100.0 {
        format!("{value:.0} {}", UNITS[unit])
    } else if value >= 10.0 {
        format!("{value:.1} {}", UNITS[unit])
    } else {
        format!("{value:.2} {}", UNITS[unit])
    }
}

pub fn format_duration_ms(ms: u64) -> String {
    if ms < 1000 {
        format!("{ms} ms")
    } else if ms < 60_000 {
        format!("{:.1} s", ms as f64 / 1000.0)
    } else {
        let secs = ms / 1000;
        format!("{}m {}s", secs / 60, secs % 60)
    }
}

/// Rough "3 days ago" style description for a duration in seconds.
pub fn format_age_secs(secs: u64) -> String {
    const MINUTE: u64 = 60;
    const HOUR: u64 = 3600;
    const DAY: u64 = 86_400;
    const MONTH: u64 = 30 * DAY;
    const YEAR: u64 = 365 * DAY;
    match secs {
        s if s < MINUTE => "just now".to_string(),
        s if s < HOUR => format!("{} min ago", s / MINUTE),
        s if s < DAY => format!("{} h ago", s / HOUR),
        s if s < MONTH => format!("{} days ago", s / DAY),
        s if s < YEAR => format!("{} months ago", s / MONTH),
        s => format!("{} years ago", s / YEAR),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bytes_formatting() {
        assert_eq!(format_bytes(0), "0 B");
        assert_eq!(format_bytes(999), "999 B");
        assert_eq!(format_bytes(1_500), "1.50 kB");
        assert_eq!(format_bytes(4_800_000_000), "4.80 GB");
        assert_eq!(format_bytes(170_000_000_000), "170 GB");
    }

    #[test]
    fn duration_formatting() {
        assert_eq!(format_duration_ms(8), "8 ms");
        assert_eq!(format_duration_ms(1400), "1.4 s");
    }
}
