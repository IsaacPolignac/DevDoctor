//! How startup files build `PATH`, and which duplicate occurrences can be removed without
//! changing command precedence.
//!
//! The key rule ("dominance"): the *first* occurrence of a directory in the final `PATH` string
//! is what determines its precedence. Prepends go to the front, so the **last** unconditional
//! prepend of a directory wins; appends go to the back, so only the **first** append matters and
//! every append is already shadowed by any prepend or by the initial system PATH. Removing a
//! dominated occurrence therefore never changes the de-duplicated order of `PATH`.

use super::parser::{join_path_value, split_path_value, split_words, ArrayOp, QuoteWrap, Statement, StatementKind};
use crate::fixer::{LineChange, LineChangeKind};
use crate::fs_util::normalize_lexical;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PathOp {
    Prepend,
    Append,
    /// Replaces PATH entirely (no `$PATH` reference).
    Set,
    /// `$PATH` appears in the middle or several times; not modelled.
    Complex,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PathComponent {
    pub raw: String,
    pub text: String,
    /// Expanded absolute path when every variable could be resolved statically.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expanded: Option<PathBuf>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exists: Option<bool>,
    /// True for the `$PATH` / `$path` marker.
    pub is_path_ref: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", tag = "form")]
pub enum MutationForm {
    Scalar { wrap: QuoteWrap, exported: bool },
    ZshArray { op: ArrayOp },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathMutation {
    pub file: PathBuf,
    pub line: u32,
    pub end_line: u32,
    pub op: PathOp,
    pub components: Vec<PathComponent>,
    pub conditional: bool,
    pub in_function: bool,
    pub exclusive_line: bool,
    pub raw: String,
    pub logical_line_raw: String,
    pub form: MutationForm,
    /// Whether DevDoctor knows how to rewrite this statement safely.
    pub rewritable: bool,
}

impl PathMutation {
    pub fn added_dirs(&self) -> impl Iterator<Item = &PathComponent> {
        self.components.iter().filter(|c| !c.is_path_ref)
    }

    /// Unconditional statements that run at every shell start.
    pub fn is_effective(&self) -> bool {
        !self.conditional && !self.in_function
    }
}

fn is_path_ref(text: &str, array: bool) -> bool {
    let t = text.trim_matches('"');
    if array {
        matches!(t, "$path" | "${path}" | "$path[@]" | "${path[@]}" | "$PATH" | "${PATH}")
    } else {
        matches!(t, "$PATH" | "${PATH}")
    }
}

fn contains_path_idiom(value: &str) -> bool {
    value.contains("${PATH:+") || value.contains("${PATH+") || value.contains("${PATH:-") || value.contains("${PATH-")
}

/// Extracts a PATH mutation from a statement, using `expand` to resolve variables.
pub fn extract_path_mutation(stmt: &Statement, expand: &dyn Fn(&str) -> Option<String>) -> Option<PathMutation> {
    match &stmt.kind {
        StatementKind::Assign(a) if a.name == "PATH" => {
            let value = a.value_raw.as_deref()?;
            let idiom = contains_path_idiom(value);
            let (wrap, words) = split_path_value(value);
            let mut components: Vec<PathComponent> = words
                .into_iter()
                .map(|w| {
                    let is_ref = is_path_ref(&w.text, false);
                    let expanded = if is_ref { None } else { expand(&w.text).map(|s| normalize_lexical(Path::new(&s))) };
                    PathComponent { raw: w.raw, text: w.text, expanded, exists: None, is_path_ref: is_ref }
                })
                .collect();
            if a.append {
                // PATH+=":/x" style; model as append of the components without the leading empty.
                components.retain(|c| !c.text.is_empty());
                return Some(PathMutation {
                    file: stmt.file.clone(),
                    line: stmt.line,
                    end_line: stmt.end_line,
                    op: PathOp::Append,
                    components,
                    conditional: stmt.conditional,
                    in_function: stmt.in_function,
                    exclusive_line: stmt.exclusive_line,
                    raw: stmt.raw.clone(),
                    logical_line_raw: stmt.logical_line_raw.clone(),
                    form: MutationForm::Scalar { wrap, exported: a.exported },
                    rewritable: false,
                });
            }
            let refs: Vec<usize> = components.iter().enumerate().filter(|(_, c)| c.is_path_ref).map(|(i, _)| i).collect();
            let op = match refs.as_slice() {
                [] if idiom => PathOp::Prepend,
                [] => PathOp::Set,
                [i] if *i == components.len() - 1 => PathOp::Prepend,
                [0] => PathOp::Append,
                _ => PathOp::Complex,
            };
            let rewritable = !idiom
                && matches!(op, PathOp::Prepend | PathOp::Append)
                && components.iter().all(|c| c.is_path_ref || c.expanded.is_some())
                && !stmt.raw.contains("$(")
                && !stmt.raw.contains('`');
            Some(PathMutation {
                file: stmt.file.clone(),
                line: stmt.line,
                end_line: stmt.end_line,
                op,
                components,
                conditional: stmt.conditional,
                in_function: stmt.in_function,
                exclusive_line: stmt.exclusive_line,
                raw: stmt.raw.clone(),
                logical_line_raw: stmt.logical_line_raw.clone(),
                form: MutationForm::Scalar { wrap, exported: a.exported },
                rewritable,
            })
        }
        StatementKind::ArrayAssign { name, op, elements_raw } if name == "path" || name == "PATH" => {
            let components: Vec<PathComponent> = elements_raw
                .iter()
                .map(|raw| {
                    let text = split_words(raw).into_iter().map(|w| w.text).collect::<Vec<_>>().join("");
                    let is_ref = is_path_ref(&text, true);
                    let expanded = if is_ref { None } else { expand(&text).map(|s| normalize_lexical(Path::new(&s))) };
                    PathComponent { raw: raw.clone(), text, expanded, exists: None, is_path_ref: is_ref }
                })
                .collect();
            let refs: Vec<usize> = components.iter().enumerate().filter(|(_, c)| c.is_path_ref).map(|(i, _)| i).collect();
            let path_op = match (op, refs.as_slice()) {
                (ArrayOp::Append, []) => PathOp::Append,
                (ArrayOp::Append, _) => PathOp::Complex,
                (ArrayOp::Set, []) => PathOp::Set,
                (ArrayOp::Set, [i]) if *i == components.len() - 1 => PathOp::Prepend,
                (ArrayOp::Set, [0]) => PathOp::Append,
                _ => PathOp::Complex,
            };
            let rewritable = matches!(path_op, PathOp::Prepend | PathOp::Append)
                && components.iter().all(|c| c.is_path_ref || c.expanded.is_some())
                && !stmt.raw.contains("$(");
            Some(PathMutation {
                file: stmt.file.clone(),
                line: stmt.line,
                end_line: stmt.end_line,
                op: path_op,
                components,
                conditional: stmt.conditional,
                in_function: stmt.in_function,
                exclusive_line: stmt.exclusive_line,
                raw: stmt.raw.clone(),
                logical_line_raw: stmt.logical_line_raw.clone(),
                form: MutationForm::ZshArray { op: *op },
                rewritable,
            })
        }
        _ => None,
    }
}

/// Simulates the PATH produced by effective (unconditional) mutations. Unresolved components are
/// skipped. Used by tests and for explanations; the live shell is the source of truth.
pub fn simulate(mutations: &[PathMutation], initial: &[String]) -> Vec<String> {
    let mut path: Vec<String> = initial.to_vec();
    for m in mutations.iter().filter(|m| m.is_effective()) {
        let dirs: Vec<String> = m.added_dirs().filter_map(|c| c.expanded.as_ref().map(|p| p.to_string_lossy().into_owned())).collect();
        match m.op {
            PathOp::Prepend => {
                let mut next = dirs;
                next.extend(path);
                path = next;
            }
            PathOp::Append => path.extend(dirs),
            PathOp::Set => path = dirs,
            PathOp::Complex => {}
        }
    }
    path
}

pub fn dedup_order(entries: &[String]) -> Vec<String> {
    let mut seen = std::collections::HashSet::new();
    entries.iter().filter(|e| seen.insert(normalize_key(e))).cloned().collect()
}

pub fn normalize_key(entry: &str) -> String {
    let trimmed = entry.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    crate::sys::fold_case(&normalize_lexical(Path::new(trimmed)).to_string_lossy())
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Removal {
    pub mutation_index: usize,
    pub component_index: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockedOccurrence {
    pub mutation_index: usize,
    pub component_index: usize,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemovalPlan {
    pub dir: String,
    /// Occurrence that keeps the directory in PATH (None when it comes from the system PATH or
    /// from an opaque source such as `eval "$(brew shellenv)"`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub keep: Option<Removal>,
    pub kept_by_initial_path: bool,
    pub removals: Vec<Removal>,
    pub blocked: Vec<BlockedOccurrence>,
}

/// Plans which occurrences of `dir` can be removed from startup files without changing the
/// de-duplicated PATH order. See the module documentation for the rule.
pub fn plan_duplicate_removals(mutations: &[PathMutation], initial: &[String], dir: &str) -> RemovalPlan {
    let key = normalize_key(dir);
    let in_initial = initial.iter().any(|e| normalize_key(e) == key);
    // Occurrences before the last unconditional Set never reach the final PATH.
    let cut = mutations.iter().enumerate().filter(|(_, m)| m.is_effective() && m.op == PathOp::Set).map(|(i, _)| i).next_back();
    let in_initial = in_initial && cut.is_none();

    let mut prepends: Vec<Removal> = Vec::new();
    let mut appends: Vec<Removal> = Vec::new();
    let mut blocked: Vec<BlockedOccurrence> = Vec::new();
    for (mi, m) in mutations.iter().enumerate() {
        if cut.is_some_and(|c| mi < c) {
            continue;
        }
        for (ci, c) in m.components.iter().enumerate() {
            let matches = c.expanded.as_ref().is_some_and(|p| p.to_string_lossy() == key);
            if !matches {
                continue;
            }
            let occurrence = Removal { mutation_index: mi, component_index: ci };
            if !m.is_effective() {
                blocked.push(BlockedOccurrence {
                    mutation_index: mi,
                    component_index: ci,
                    reason: "inside a conditional block or function".into(),
                });
                continue;
            }
            if !m.rewritable {
                blocked.push(BlockedOccurrence {
                    mutation_index: mi,
                    component_index: ci,
                    reason: "statement form not supported for automatic rewriting".into(),
                });
                continue;
            }
            match m.op {
                PathOp::Prepend => prepends.push(occurrence),
                PathOp::Append => appends.push(occurrence),
                PathOp::Set => {
                    // The Set defines the directory's position; nothing dominates it.
                    blocked.push(BlockedOccurrence {
                        mutation_index: mi,
                        component_index: ci,
                        reason: "PATH is reset by this statement".into(),
                    });
                }
                PathOp::Complex => {
                    blocked.push(BlockedOccurrence { mutation_index: mi, component_index: ci, reason: "complex PATH expression".into() })
                }
            }
        }
    }
    let mut removals = Vec::new();
    let mut keep = None;
    let mut kept_by_initial_path = false;
    if let Some(last) = prepends.pop() {
        keep = Some(last);
        removals.extend(prepends);
        removals.extend(appends);
    } else if in_initial {
        kept_by_initial_path = true;
        removals.extend(appends);
    } else if !appends.is_empty() {
        keep = Some(appends.remove(0));
        removals.extend(appends);
    }
    RemovalPlan { dir: key, keep, kept_by_initial_path, removals, blocked }
}

/// Text-level edit of one startup file.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEdit {
    pub path: PathBuf,
    pub original: String,
    pub updated: String,
    pub line_changes: Vec<LineChange>,
}

/// Computes the new statement text after removing components, or `None` when the statement no
/// longer adds anything and should be deleted.
pub fn rewrite_mutation(m: &PathMutation, remove: &[usize]) -> Option<String> {
    let remaining: Vec<&PathComponent> = m.components.iter().enumerate().filter(|(i, _)| !remove.contains(i)).map(|(_, c)| c).collect();
    if remaining.iter().all(|c| c.is_path_ref) {
        return None;
    }
    let words = split_words(&m.raw);
    match &m.form {
        MutationForm::Scalar { wrap, .. } => {
            let raws: Vec<String> = remaining.iter().map(|c| c.raw.clone()).collect();
            let new_value = join_path_value(*wrap, &raws);
            let word = words.iter().find(|w| w.raw.starts_with("PATH=") || w.raw.starts_with("PATH+="))?;
            let new_word = format!("PATH={new_value}");
            Some(m.raw.replacen(&word.raw, &new_word, 1))
        }
        MutationForm::ZshArray { op } => {
            let raws: Vec<String> = remaining.iter().map(|c| c.raw.clone()).collect();
            let name = if m.raw.contains("PATH") && !m.raw.contains("path") { "PATH" } else { "path" };
            let assign = match op {
                ArrayOp::Set => format!("{name}=({})", raws.join(" ")),
                ArrayOp::Append => format!("{name}+=({})", raws.join(" ")),
            };
            let word = words.iter().find(|w| w.raw.starts_with(&format!("{name}=")) || w.raw.starts_with(&format!("{name}+=")))?;
            Some(m.raw.replacen(&word.raw, &assign, 1))
        }
    }
}

/// Applies removals to file contents. `files` maps a path to its current content. Returns one
/// edit per touched file; statements that cannot be edited safely are reported in `skipped`.
pub fn apply_removals(files: &BTreeMap<PathBuf, String>, mutations: &[PathMutation], removals: &[Removal]) -> (Vec<FileEdit>, Vec<String>) {
    let mut by_mutation: BTreeMap<usize, Vec<usize>> = BTreeMap::new();
    for r in removals {
        by_mutation.entry(r.mutation_index).or_default().push(r.component_index);
    }
    // Group by file, process bottom-up so line numbers stay valid.
    let mut per_file: BTreeMap<PathBuf, Vec<(usize, Vec<usize>)>> = BTreeMap::new();
    for (mi, comps) in by_mutation {
        per_file.entry(mutations[mi].file.clone()).or_default().push((mi, comps));
    }
    let mut edits = Vec::new();
    let mut skipped = Vec::new();
    for (path, mut items) in per_file {
        let Some(original) = files.get(&path) else {
            skipped.push(format!("{}: content not available", path.display()));
            continue;
        };
        items.sort_by_key(|(mi, _)| std::cmp::Reverse(mutations[*mi].line));
        let had_trailing_newline = original.ends_with('\n');
        let mut lines: Vec<String> = original.split('\n').map(|s| s.to_string()).collect();
        if had_trailing_newline {
            lines.pop();
        }
        let mut line_changes = Vec::new();
        for (mi, comps) in items {
            let m = &mutations[mi];
            let start = (m.line as usize).saturating_sub(1);
            let end = (m.end_line as usize).saturating_sub(1);
            if end >= lines.len() || start > end {
                skipped.push(format!("{}:{}: line out of range (file changed?)", path.display(), m.line));
                continue;
            }
            match rewrite_mutation(m, &comps) {
                None => {
                    if !m.exclusive_line {
                        skipped.push(format!("{}:{}: statement shares its line with other commands", path.display(), m.line));
                        continue;
                    }
                    for (offset, removed) in lines.drain(start..=end).enumerate() {
                        line_changes.push(LineChange {
                            line: (start + offset + 1) as u32,
                            kind: LineChangeKind::Removed,
                            before: Some(removed),
                            after: None,
                        });
                    }
                }
                Some(new_segment) => {
                    if !m.logical_line_raw.contains(&m.raw) {
                        skipped.push(format!("{}:{}: could not locate statement text", path.display(), m.line));
                        continue;
                    }
                    let new_logical = m.logical_line_raw.replacen(&m.raw, &new_segment, 1);
                    let before: Vec<String> = lines.drain(start..=end).collect();
                    lines.insert(start, new_logical.clone());
                    line_changes.push(LineChange {
                        line: (start + 1) as u32,
                        kind: LineChangeKind::Changed,
                        before: Some(before.join("\n")),
                        after: Some(new_logical),
                    });
                }
            }
        }
        if line_changes.is_empty() {
            continue;
        }
        line_changes.sort_by_key(|c| c.line);
        let mut updated = lines.join("\n");
        if had_trailing_newline || updated.is_empty() {
            updated.push('\n');
        }
        edits.push(FileEdit { path, original: original.clone(), updated, line_changes });
    }
    (edits, skipped)
}

// These tests exercise POSIX shell behaviour (login shells, `:`-separated PATH, rc files).
#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use crate::shell::parser::parse_shell_file;

    fn mutations_from(content: &str) -> (Vec<PathMutation>, BTreeMap<PathBuf, String>) {
        let path = PathBuf::from("/home/me/.zshrc");
        let parsed = parse_shell_file(&path, content);
        let home = "/home/me".to_string();
        let expand = |t: &str| -> Option<String> {
            if t.contains("$(") {
                return None;
            }
            let s = t.replace("$HOME", &home).replace("${HOME}", &home);
            let s = if let Some(rest) = s.strip_prefix("~") { format!("{home}{rest}") } else { s };
            if s.contains('$') {
                None
            } else {
                Some(s)
            }
        };
        let muts = parsed.statements.iter().filter_map(|s| extract_path_mutation(s, &expand)).collect();
        let mut files = BTreeMap::new();
        files.insert(path, content.to_string());
        (muts, files)
    }

    #[test]
    fn classifies_ops() {
        let (m, _) = mutations_from("export PATH=\"/a:$PATH\"\nexport PATH=\"$PATH:/b\"\nexport PATH=/c:/d\nexport PATH=\"/e:$PATH:/f\"\npath=(/g $path)\npath+=(/h)\n");
        let ops: Vec<PathOp> = m.iter().map(|x| x.op).collect();
        assert_eq!(ops, vec![PathOp::Prepend, PathOp::Append, PathOp::Set, PathOp::Complex, PathOp::Prepend, PathOp::Append]);
        assert!(m[0].rewritable);
        assert!(!m[3].rewritable);
    }

    #[test]
    fn later_prepend_dominates_earlier_prepend() {
        let (m, files) = mutations_from(
            "export PATH=\"/opt/homebrew/bin:$PATH\"\nexport PATH=\"$HOME/.pyenv/shims:$PATH\"\nexport PATH=\"/opt/homebrew/bin:$PATH\"\n",
        );
        let initial = vec!["/usr/bin".to_string()];
        let plan = plan_duplicate_removals(&m, &initial, "/opt/homebrew/bin");
        assert_eq!(plan.removals, vec![Removal { mutation_index: 0, component_index: 0 }]);
        assert_eq!(plan.keep, Some(Removal { mutation_index: 2, component_index: 0 }));
        let before = dedup_order(&simulate(&m, &initial));
        let (edits, skipped) = apply_removals(&files, &m, &plan.removals);
        assert!(skipped.is_empty());
        assert_eq!(edits.len(), 1);
        assert_eq!(edits[0].updated, "export PATH=\"$HOME/.pyenv/shims:$PATH\"\nexport PATH=\"/opt/homebrew/bin:$PATH\"\n");
        let (m2, _) = mutations_from(&edits[0].updated);
        let after = dedup_order(&simulate(&m2, &initial));
        assert_eq!(before, after, "de-duplicated order is preserved");
        assert_eq!(edits[0].line_changes.len(), 1);
        assert_eq!(edits[0].line_changes[0].kind, LineChangeKind::Removed);
    }

    #[test]
    fn appends_are_dominated_by_initial_path() {
        let (m, files) = mutations_from("export PATH=\"$PATH:/usr/local/bin\"\n");
        let initial = vec!["/usr/local/bin".to_string(), "/usr/bin".to_string()];
        let plan = plan_duplicate_removals(&m, &initial, "/usr/local/bin");
        assert!(plan.kept_by_initial_path);
        assert_eq!(plan.removals.len(), 1);
        let (edits, _) = apply_removals(&files, &m, &plan.removals);
        assert_eq!(edits[0].updated, "\n");
    }

    #[test]
    fn prepend_is_not_removed_when_it_defines_precedence() {
        let (m, _) = mutations_from("export PATH=\"$PATH:/x\"\nexport PATH=\"/x:$PATH\"\n");
        let plan = plan_duplicate_removals(&m, &["/usr/bin".to_string()], "/x");
        assert_eq!(plan.keep, Some(Removal { mutation_index: 1, component_index: 0 }));
        assert_eq!(plan.removals, vec![Removal { mutation_index: 0, component_index: 1 }]);
    }

    #[test]
    fn conditional_occurrences_are_blocked() {
        let (m, _) = mutations_from("if [ -d /x ]; then\n  export PATH=\"/x:$PATH\"\nfi\nexport PATH=\"/x:$PATH\"\n");
        let plan = plan_duplicate_removals(&m, &[], "/x");
        assert!(plan.removals.is_empty());
        assert_eq!(plan.blocked.len(), 1);
    }

    #[test]
    fn rewrites_multi_component_lines() {
        let (m, files) =
            mutations_from("export PATH=\"$HOME/.local/bin:$HOME/.cargo/bin:$PATH\"\nexport PATH=\"$HOME/.cargo/bin:$PATH\"\n");
        let plan = plan_duplicate_removals(&m, &[], "/home/me/.cargo/bin");
        assert_eq!(plan.removals, vec![Removal { mutation_index: 0, component_index: 1 }]);
        let (edits, skipped) = apply_removals(&files, &m, &plan.removals);
        assert!(skipped.is_empty());
        assert_eq!(edits[0].updated, "export PATH=\"$HOME/.local/bin:$PATH\"\nexport PATH=\"$HOME/.cargo/bin:$PATH\"\n");
        assert_eq!(edits[0].line_changes[0].kind, LineChangeKind::Changed);
    }

    #[test]
    fn rewrites_zsh_arrays() {
        let (m, files) = mutations_from("path=(/a /b $path)\npath=(/a $path)\n");
        let plan = plan_duplicate_removals(&m, &[], "/a");
        let (edits, _) = apply_removals(&files, &m, &plan.removals);
        assert_eq!(edits[0].updated, "path=(/b $path)\npath=(/a $path)\n");
    }

    #[test]
    fn shared_line_deletion_is_skipped() {
        let (m, files) = mutations_from("export PATH=\"/a:$PATH\"; echo hi\nexport PATH=\"/a:$PATH\"\n");
        let plan = plan_duplicate_removals(&m, &[], "/a");
        let (edits, skipped) = apply_removals(&files, &m, &plan.removals);
        assert!(edits.is_empty());
        assert_eq!(skipped.len(), 1);
    }
}
