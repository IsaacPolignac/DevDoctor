//! A tolerant, line-oriented parser for zsh and bash startup files.
//!
//! The parser does not try to be a full shell grammar. It recognises the statements that matter
//! for diagnostics (assignments, exports, `path` arrays, `source`, `alias`, `eval`) and tracks
//! enough block structure (`if`/`case`/loops/functions) to know whether a statement runs
//! unconditionally. Everything else is preserved as [`StatementKind::Other`].

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum QuoteWrap {
    None,
    Double,
    Single,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Assignment {
    pub name: String,
    /// Raw right-hand side exactly as written (including quotes). `None` for `export NAME`.
    pub value_raw: Option<String>,
    pub exported: bool,
    /// `+=` appends (bash/zsh string append).
    pub append: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ArrayOp {
    Set,
    Append,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum StatementKind {
    /// `NAME=value`, `export NAME=value`, `typeset -x NAME=value`, ...
    Assign(Assignment),
    /// zsh array form: `path=(...)` / `path+=(...)`.
    ArrayAssign {
        name: String,
        op: ArrayOp,
        elements_raw: Vec<String>,
    },
    /// `source file` or `. file`.
    Source {
        target_raw: String,
        guarded: bool,
    },
    Alias {
        name: String,
        value_raw: String,
    },
    /// `eval "$(cmd ...)"`; `command` is the text inside `$( )` when recognisable.
    Eval {
        command: String,
    },
    /// A command that is not otherwise classified. `command` is the first word.
    Other {
        command: String,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Statement {
    pub file: PathBuf,
    /// 1-based first line of the logical line that contains the statement.
    pub line: u32,
    /// 1-based last line (differs from `line` with backslash continuations).
    pub end_line: u32,
    /// Raw text of the segment (trimmed).
    pub raw: String,
    /// Raw text of the whole logical line (all segments), untrimmed, without the newline.
    pub logical_line_raw: String,
    /// True when this statement is the only statement on its logical line.
    pub exclusive_line: bool,
    /// Inside an `if`, `case` or loop body.
    pub conditional: bool,
    /// Inside a function body (does not run at startup).
    pub in_function: bool,
    pub kind: StatementKind,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ParseWarning {
    pub line: u32,
    pub message: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ParsedFile {
    pub statements: Vec<Statement>,
    pub warnings: Vec<ParseWarning>,
    pub line_count: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Block {
    If,
    Case,
    Loop,
    Function,
    Group,
}

/// A logical line: physical lines joined by trailing backslashes.
#[derive(Debug)]
struct LogicalLine {
    start: u32,
    end: u32,
    text: String,
}

fn logical_lines(content: &str) -> Vec<LogicalLine> {
    let mut out = Vec::new();
    let mut current: Option<LogicalLine> = None;
    for (idx, raw_line) in content.split('\n').enumerate() {
        let line_no = idx as u32 + 1;
        let line = raw_line.strip_suffix('\r').unwrap_or(raw_line);
        let continues = ends_with_unescaped_backslash(line);
        let body = if continues { &line[..line.len() - 1] } else { line };
        match current.as_mut() {
            Some(cur) => {
                cur.text.push_str(body);
                cur.end = line_no;
            }
            None => {
                current = Some(LogicalLine { start: line_no, end: line_no, text: body.to_string() });
            }
        }
        if !continues {
            if let Some(cur) = current.take() {
                out.push(cur);
            }
        }
    }
    if let Some(cur) = current.take() {
        out.push(cur);
    }
    out
}

fn ends_with_unescaped_backslash(line: &str) -> bool {
    let trailing = line.chars().rev().take_while(|c| *c == '\\').count();
    trailing % 2 == 1
}

/// Splits a logical line into top-level segments separated by `;`, `&&`, `||`, `|` or `&`.
/// Returns (segment text, operator that preceded it). Comments are stripped.
fn split_segments(text: &str) -> (Vec<(String, Option<String>)>, Vec<String>) {
    let mut segments = Vec::new();
    let mut warnings = Vec::new();
    let mut buf = String::new();
    let mut prev_op: Option<String> = None;
    let chars: Vec<char> = text.chars().collect();
    let mut i = 0;
    let mut in_single = false;
    let mut in_double = false;
    let mut depth_paren: i32 = 0;
    let mut depth_brace: i32 = 0;
    let mut depth_bracket: i32 = 0;
    let mut at_word_start = true;
    while i < chars.len() {
        let c = chars[i];
        if in_single {
            buf.push(c);
            if c == '\'' {
                in_single = false;
            }
            i += 1;
            continue;
        }
        if in_double {
            buf.push(c);
            if c == '\\' && i + 1 < chars.len() {
                buf.push(chars[i + 1]);
                i += 2;
                continue;
            }
            if c == '"' {
                in_double = false;
            }
            i += 1;
            continue;
        }
        match c {
            '\\' => {
                buf.push(c);
                if i + 1 < chars.len() {
                    buf.push(chars[i + 1]);
                }
                i += 2;
                at_word_start = false;
                continue;
            }
            '\'' => {
                in_single = true;
                buf.push(c);
            }
            '"' => {
                in_double = true;
                buf.push(c);
            }
            '#' if at_word_start && depth_paren == 0 && depth_brace == 0 => {
                break;
            }
            '(' => {
                depth_paren += 1;
                buf.push(c);
            }
            ')' => {
                depth_paren -= 1;
                buf.push(c);
            }
            '{' => {
                depth_brace += 1;
                buf.push(c);
            }
            '}' => {
                depth_brace -= 1;
                buf.push(c);
            }
            '[' => {
                depth_bracket += 1;
                buf.push(c);
            }
            ']' => {
                depth_bracket -= 1;
                buf.push(c);
            }
            ';' | '&' | '|' if depth_paren <= 0 && depth_brace <= 0 && depth_bracket <= 0 => {
                // ';;' (case) is treated like ';'
                let mut op = c.to_string();
                if (c == '&' || c == '|') && i + 1 < chars.len() && chars[i + 1] == c {
                    op.push(c);
                    i += 1;
                }
                if c == ';' && i + 1 < chars.len() && chars[i + 1] == ';' {
                    i += 1;
                }
                let seg = buf.trim().to_string();
                if !seg.is_empty() {
                    segments.push((seg, prev_op.take()));
                }
                buf.clear();
                prev_op = Some(op);
                at_word_start = true;
                i += 1;
                continue;
            }
            _ => buf.push(c),
        }
        at_word_start = c.is_whitespace();
        i += 1;
    }
    if in_single || in_double {
        warnings.push(format!("unterminated {} quote", if in_single { "single" } else { "double" }));
    }
    let seg = buf.trim().to_string();
    if !seg.is_empty() {
        segments.push((seg, prev_op.take()));
    }
    (segments, warnings)
}

/// A shell word with its raw spelling and its unquoted text (expansions are kept verbatim).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Word {
    pub raw: String,
    pub text: String,
}

/// Splits a segment into words, honouring quotes, escapes and `$( )`/`${ }`/`( )` grouping.
pub fn split_words(input: &str) -> Vec<Word> {
    let mut words = Vec::new();
    let chars: Vec<char> = input.chars().collect();
    let mut i = 0;
    let mut raw = String::new();
    let mut text = String::new();
    let mut in_word = false;
    let mut depth: i32 = 0;
    while i < chars.len() {
        let c = chars[i];
        match c {
            '\'' => {
                in_word = true;
                raw.push(c);
                i += 1;
                while i < chars.len() && chars[i] != '\'' {
                    raw.push(chars[i]);
                    text.push(chars[i]);
                    i += 1;
                }
                if i < chars.len() {
                    raw.push('\'');
                    i += 1;
                }
                continue;
            }
            '"' => {
                in_word = true;
                raw.push(c);
                i += 1;
                while i < chars.len() && chars[i] != '"' {
                    if chars[i] == '\\' && i + 1 < chars.len() && matches!(chars[i + 1], '"' | '\\' | '$' | '`') {
                        raw.push(chars[i]);
                        raw.push(chars[i + 1]);
                        text.push(chars[i + 1]);
                        i += 2;
                        continue;
                    }
                    raw.push(chars[i]);
                    text.push(chars[i]);
                    i += 1;
                }
                if i < chars.len() {
                    raw.push('"');
                    i += 1;
                }
                continue;
            }
            '\\' if i + 1 < chars.len() => {
                in_word = true;
                raw.push(c);
                raw.push(chars[i + 1]);
                text.push(chars[i + 1]);
                i += 2;
                continue;
            }
            '(' | '{' => {
                depth += 1;
            }
            ')' | '}' => {
                depth -= 1;
            }
            _ => {}
        }
        if c.is_whitespace() && depth <= 0 {
            if in_word {
                words.push(Word { raw: std::mem::take(&mut raw), text: std::mem::take(&mut text) });
                in_word = false;
            }
            i += 1;
            continue;
        }
        in_word = true;
        raw.push(c);
        text.push(c);
        i += 1;
    }
    if in_word {
        words.push(Word { raw, text });
    }
    words
}

/// Recognises `NAME=value` / `NAME+=value` at the start of a word. Returns (name, append, raw value).
fn parse_assignment_word(word: &str) -> Option<(String, bool, String)> {
    let bytes = word.as_bytes();
    let mut i = 0;
    while i < bytes.len() && (bytes[i].is_ascii_alphanumeric() || bytes[i] == b'_') {
        i += 1;
    }
    if i == 0 || bytes[0].is_ascii_digit() {
        return None;
    }
    let name = &word[..i];
    let rest = &word[i..];
    if let Some(v) = rest.strip_prefix("+=") {
        return Some((name.to_string(), true, v.to_string()));
    }
    if let Some(v) = rest.strip_prefix('=') {
        return Some((name.to_string(), false, v.to_string()));
    }
    None
}

/// Parses `(a b "c")` into raw element spellings.
fn parse_array_literal(raw: &str) -> Option<Vec<String>> {
    let inner = raw.strip_prefix('(')?.strip_suffix(')')?;
    Some(split_words(inner).into_iter().map(|w| w.raw).collect())
}

const KEYWORDS_PUSH_IF: &[&str] = &["if"];
const KEYWORDS_STRIP: &[&str] = &["then", "do", "else", "elif", "!"];

fn classify_segment(seg: &str, prev_op: Option<&str>, prev_was_condition: bool) -> (Option<StatementKind>, bool) {
    let words = split_words(seg);
    if words.is_empty() {
        return (None, false);
    }
    let mut idx = 0;
    while idx < words.len() && KEYWORDS_STRIP.contains(&words[idx].text.as_str()) {
        idx += 1;
    }
    if idx >= words.len() {
        return (None, false);
    }
    let first = words[idx].text.as_str();
    let is_condition = matches!(first, "[" | "[[" | "test" | "command" | "type" | "which" | "hash" | "whence")
        || (first == "command" && words.get(idx + 1).is_some_and(|w| w.text == "-v"));
    let guarded = prev_was_condition && prev_op == Some("&&");

    // export / typeset / declare / local family.
    if matches!(first, "export" | "typeset" | "declare" | "local" | "readonly") {
        let exported = first == "export" || words[idx + 1..].iter().any(|w| w.text.starts_with('-') && w.text.contains('x'));
        let mut result: Option<StatementKind> = None;
        for w in &words[idx + 1..] {
            if w.text.starts_with('-') {
                continue;
            }
            if let Some((name, append, value)) = parse_assignment_word(&w.raw) {
                if value.starts_with('(') && value.ends_with(')') {
                    if let Some(elements) = parse_array_literal(&value) {
                        result = Some(StatementKind::ArrayAssign {
                            name,
                            op: if append { ArrayOp::Append } else { ArrayOp::Set },
                            elements_raw: elements,
                        });
                        break;
                    }
                }
                result = Some(StatementKind::Assign(Assignment { name, value_raw: Some(value), exported, append }));
                // Only the first PATH-like assignment matters; keep the first assignment.
                break;
            } else if !w.text.is_empty() {
                result = Some(StatementKind::Assign(Assignment { name: w.text.clone(), value_raw: None, exported, append: false }));
                break;
            }
        }
        return (result.or(Some(StatementKind::Other { command: first.to_string() })), is_condition);
    }

    if let Some((name, append, value)) = parse_assignment_word(&words[idx].raw) {
        // A plain assignment followed by a command (`FOO=1 cmd`) is an environment prefix.
        if words.len() > idx + 1 && !words[idx + 1].text.starts_with('#') {
            // Multiple assignments in a row are still assignments; a real command word ends it.
            let all_assignments = words[idx..].iter().all(|w| parse_assignment_word(&w.raw).is_some());
            if !all_assignments {
                return (Some(StatementKind::Other { command: words.last().map(|w| w.text.clone()).unwrap_or_default() }), false);
            }
        }
        if value.starts_with('(') && value.ends_with(')') {
            if let Some(elements) = parse_array_literal(&value) {
                return (
                    Some(StatementKind::ArrayAssign {
                        name,
                        op: if append { ArrayOp::Append } else { ArrayOp::Set },
                        elements_raw: elements,
                    }),
                    false,
                );
            }
        }
        return (Some(StatementKind::Assign(Assignment { name, value_raw: Some(value), exported: false, append })), false);
    }

    match first {
        "source" | "." => {
            let target = words.get(idx + 1).map(|w| w.text.clone()).unwrap_or_default();
            (Some(StatementKind::Source { target_raw: target, guarded }), false)
        }
        "alias" => {
            for w in &words[idx + 1..] {
                if w.text.starts_with('-') {
                    continue;
                }
                if let Some((name, _, value)) = parse_assignment_word(&w.raw) {
                    return (Some(StatementKind::Alias { name, value_raw: value }), false);
                }
            }
            (Some(StatementKind::Other { command: "alias".into() }), false)
        }
        "eval" => {
            let rest: Vec<String> = words[idx + 1..].iter().map(|w| w.text.clone()).collect();
            let joined = rest.join(" ");
            let command = joined
                .trim()
                .strip_prefix("$(")
                .and_then(|s| s.strip_suffix(')'))
                .map(|s| s.trim().to_string())
                .unwrap_or(joined.trim().to_string());
            (Some(StatementKind::Eval { command }), false)
        }
        _ => (Some(StatementKind::Other { command: first.to_string() }), is_condition),
    }
}

/// Parses a shell startup file.
pub fn parse_shell_file(path: &std::path::Path, content: &str) -> ParsedFile {
    let mut parsed = ParsedFile::default();
    let mut blocks: Vec<Block> = Vec::new();
    let lines = logical_lines(content);
    parsed.line_count = lines.last().map(|l| l.end).unwrap_or(0);

    for ll in &lines {
        let (segments, warnings) = split_segments(&ll.text);
        for w in warnings {
            parsed.warnings.push(ParseWarning { line: ll.start, message: w });
        }
        let exclusive = segments.len() == 1;
        let mut prev_condition = false;
        for (seg, prev_op) in &segments {
            let words = split_words(seg);
            let first = words.first().map(|w| w.text.as_str()).unwrap_or("");
            // Block structure.
            match first {
                w if KEYWORDS_PUSH_IF.contains(&w) => blocks.push(Block::If),
                "case" => blocks.push(Block::Case),
                "for" | "while" | "until" | "select" => blocks.push(Block::Loop),
                "function" => blocks.push(Block::Function),
                "fi" => pop_block(&mut blocks, Block::If),
                "esac" => pop_block(&mut blocks, Block::Case),
                "done" => pop_block(&mut blocks, Block::Loop),
                "}" => {
                    if let Some(last) = blocks.last() {
                        if matches!(last, Block::Function | Block::Group) {
                            blocks.pop();
                        }
                    }
                }
                "{" => blocks.push(Block::Group),
                _ => {}
            }
            // `name() {` / `name () {` function definitions.
            if first != "function" && seg.contains("()") {
                let before = seg.split("()").next().unwrap_or("").trim();
                if !before.is_empty() && before.chars().all(|c| c.is_alphanumeric() || matches!(c, '_' | '-' | '.' | ':')) {
                    blocks.push(Block::Function);
                }
            }
            // Statements inside `while`/`if` conditions are evaluated; `then`/`do` bodies are
            // conditional. The block push above happens before classification, so the condition
            // segment itself is already inside the block; that is acceptable for our purposes.
            let conditional = blocks.iter().any(|b| matches!(b, Block::If | Block::Case | Block::Loop));
            let in_function = blocks.iter().any(|b| matches!(b, Block::Function));
            let (kind, is_condition) = classify_segment(seg, prev_op.as_deref(), prev_condition);
            // The `if [ ... ]` condition itself marks the following segments as guarded too.
            prev_condition = is_condition || first == "if" || first == "elif";
            if matches!(first, "fi" | "esac" | "done" | "}" | "{" | "then" | "do" | "else") && words.len() == 1 {
                continue;
            }
            if let Some(kind) = kind {
                parsed.statements.push(Statement {
                    file: path.to_path_buf(),
                    line: ll.start,
                    end_line: ll.end,
                    raw: seg.clone(),
                    logical_line_raw: ll.text.clone(),
                    exclusive_line: exclusive,
                    conditional,
                    in_function,
                    kind,
                });
            }
            // A trailing `{` on a function/group line was already handled; a trailing `}`
            // closing a one-line function (`foo() { ...; }`) closes the block.
            if seg.ends_with('}') && first != "}" && seg.len() > 1 {
                if let Some(Block::Function | Block::Group) = blocks.last() {
                    blocks.pop();
                }
            }
        }
    }
    parsed
}

fn pop_block(blocks: &mut Vec<Block>, expected: Block) {
    if let Some(pos) = blocks.iter().rposition(|b| *b == expected) {
        blocks.truncate(pos);
    }
}

/// Splits an assignment value into `:`-separated components, respecting quotes and
/// `${ }`/`$( )` groups. Returns the quote wrapping of the whole value and the components with
/// their raw spelling and unquoted text.
pub fn split_path_value(value_raw: &str) -> (QuoteWrap, Vec<Word>) {
    let (wrap, inner) = if value_raw.len() >= 2 && value_raw.starts_with('"') && value_raw.ends_with('"') && !has_unquoted_quote(value_raw)
    {
        (QuoteWrap::Double, &value_raw[1..value_raw.len() - 1])
    } else if value_raw.len() >= 2
        && value_raw.starts_with('\'')
        && value_raw.ends_with('\'')
        && !value_raw[1..value_raw.len() - 1].contains('\'')
    {
        (QuoteWrap::Single, &value_raw[1..value_raw.len() - 1])
    } else {
        (QuoteWrap::None, value_raw)
    };
    let mut components = Vec::new();
    let chars: Vec<char> = inner.chars().collect();
    let mut i = 0;
    let mut raw = String::new();
    let mut depth = 0i32;
    let mut in_single = false;
    let mut in_double = false;
    while i < chars.len() {
        let c = chars[i];
        if in_single {
            raw.push(c);
            if c == '\'' {
                in_single = false;
            }
            i += 1;
            continue;
        }
        if in_double {
            raw.push(c);
            if c == '\\' && i + 1 < chars.len() {
                raw.push(chars[i + 1]);
                i += 2;
                continue;
            }
            if c == '"' {
                in_double = false;
            }
            i += 1;
            continue;
        }
        match c {
            '\'' if wrap == QuoteWrap::None => in_single = true,
            '"' if wrap == QuoteWrap::None => in_double = true,
            '\\' if i + 1 < chars.len() => {
                raw.push(c);
                raw.push(chars[i + 1]);
                i += 2;
                continue;
            }
            '{' | '(' => depth += 1,
            '}' | ')' => depth -= 1,
            ':' if depth <= 0 => {
                components.push(word_from_raw(std::mem::take(&mut raw), wrap));
                i += 1;
                continue;
            }
            _ => {}
        }
        raw.push(c);
        i += 1;
    }
    components.push(word_from_raw(raw, wrap));
    (wrap, components)
}

fn has_unquoted_quote(value: &str) -> bool {
    // A value like "a":"b" starts and ends with quotes but is not a single quoted string.
    let inner = &value[1..value.len() - 1];
    let mut escaped = false;
    for c in inner.chars() {
        if escaped {
            escaped = false;
            continue;
        }
        if c == '\\' {
            escaped = true;
            continue;
        }
        if c == '"' {
            return true;
        }
    }
    false
}

fn word_from_raw(raw: String, wrap: QuoteWrap) -> Word {
    let text = match wrap {
        QuoteWrap::Double | QuoteWrap::Single => raw.clone(),
        QuoteWrap::None => split_words(&raw).into_iter().map(|w| w.text).collect::<Vec<_>>().join(""),
    };
    Word { raw, text }
}

/// Re-assembles a value from raw components using the original quote wrapping.
pub fn join_path_value(wrap: QuoteWrap, components: &[String]) -> String {
    let inner = components.join(":");
    match wrap {
        QuoteWrap::Double => format!("\"{inner}\""),
        QuoteWrap::Single => format!("'{inner}'"),
        QuoteWrap::None => inner,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    fn parse(content: &str) -> ParsedFile {
        parse_shell_file(Path::new("/tmp/.zshrc"), content)
    }

    #[test]
    fn parses_exports_and_assignments() {
        let p = parse("export PATH=\"/opt/homebrew/bin:$PATH\"\nFOO=bar\nexport BAZ\n");
        assert_eq!(p.statements.len(), 3);
        match &p.statements[0].kind {
            StatementKind::Assign(a) => {
                assert_eq!(a.name, "PATH");
                assert!(a.exported);
                assert_eq!(a.value_raw.as_deref(), Some("\"/opt/homebrew/bin:$PATH\""));
            }
            other => panic!("unexpected {other:?}"),
        }
        assert!(p.statements[0].exclusive_line);
        assert_eq!(p.statements[1].line, 2);
    }

    #[test]
    fn strips_comments_and_handles_continuations() {
        let p = parse("# comment\nexport PATH=\"$HOME/bin:\\\n$PATH\" # trailing\n");
        assert_eq!(p.statements.len(), 1);
        assert_eq!(p.statements[0].line, 2);
        assert_eq!(p.statements[0].end_line, 3);
    }

    #[test]
    fn recognises_guarded_sources() {
        let p = parse("[ -s \"$NVM_DIR/nvm.sh\" ] && \\. \"$NVM_DIR/nvm.sh\"\nsource ~/.aliases\n");
        let sources: Vec<_> = p
            .statements
            .iter()
            .filter_map(|s| match &s.kind {
                StatementKind::Source { target_raw, guarded } => Some((target_raw.clone(), *guarded)),
                _ => None,
            })
            .collect();
        assert_eq!(sources, vec![("$NVM_DIR/nvm.sh".to_string(), true), ("~/.aliases".to_string(), false)]);
        assert!(!p.statements[1].exclusive_line, "guard and source share the line");
    }

    #[test]
    fn tracks_conditionals_and_functions() {
        let p = parse(
            "if [ -d ~/.foo ]; then\n  export PATH=~/.foo/bin:$PATH\nfi\nmyfn() {\n  export PATH=/x:$PATH\n}\nexport PATH=/y:$PATH\n",
        );
        let path_stmts: Vec<&Statement> =
            p.statements.iter().filter(|s| matches!(&s.kind, StatementKind::Assign(a) if a.name == "PATH")).collect();
        assert_eq!(path_stmts.len(), 3);
        assert!(path_stmts[0].conditional);
        assert!(path_stmts[1].in_function);
        assert!(!path_stmts[2].conditional && !path_stmts[2].in_function);
    }

    #[test]
    fn parses_zsh_path_arrays_and_eval() {
        let p = parse("typeset -U path\npath=(/opt/homebrew/bin $path)\npath+=(~/.cargo/bin)\neval \"$(/opt/homebrew/bin/brew shellenv)\"\nalias ll='ls -la'\n");
        assert!(
            matches!(&p.statements[1].kind, StatementKind::ArrayAssign { name, op: ArrayOp::Set, elements_raw } if name == "path" && elements_raw == &vec!["/opt/homebrew/bin".to_string(), "$path".to_string()])
        );
        assert!(matches!(&p.statements[2].kind, StatementKind::ArrayAssign { op: ArrayOp::Append, .. }));
        assert!(matches!(&p.statements[3].kind, StatementKind::Eval { command } if command == "/opt/homebrew/bin/brew shellenv"));
        assert!(matches!(&p.statements[4].kind, StatementKind::Alias { name, value_raw } if name == "ll" && value_raw == "'ls -la'"));
    }

    #[test]
    fn splits_path_values() {
        let (wrap, comps) = split_path_value("\"/opt/homebrew/bin:$HOME/.local/bin:$PATH\"");
        assert_eq!(wrap, QuoteWrap::Double);
        let raws: Vec<_> = comps.iter().map(|c| c.raw.as_str()).collect();
        assert_eq!(raws, vec!["/opt/homebrew/bin", "$HOME/.local/bin", "$PATH"]);
        assert_eq!(join_path_value(wrap, &["/opt/homebrew/bin".into(), "$PATH".into()]), "\"/opt/homebrew/bin:$PATH\"");

        let (wrap, comps) = split_path_value("$PATH:\"$HOME/my dir/bin\"");
        assert_eq!(wrap, QuoteWrap::None);
        assert_eq!(comps[1].raw, "\"$HOME/my dir/bin\"");
        assert_eq!(comps[1].text, "$HOME/my dir/bin");

        let (_, comps) = split_path_value("\"${PYENV_ROOT}/bin:${PATH}\"");
        assert_eq!(comps.len(), 2);
    }

    #[test]
    fn reports_unterminated_quotes() {
        let p = parse("export FOO=\"unterminated\n");
        assert_eq!(p.warnings.len(), 1);
        assert!(p.warnings[0].message.contains("double"));
    }

    #[test]
    fn env_prefix_is_not_an_assignment() {
        let p = parse("FOO=1 some-command --flag\n");
        assert!(matches!(&p.statements[0].kind, StatementKind::Other { .. }));
    }
}
