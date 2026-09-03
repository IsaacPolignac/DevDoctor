//! Rust toolchain detectors.

use devdoctor_core::context::SystemContext;
use devdoctor_core::detector::{Detector, DetectorMeta, ScanMode};
use devdoctor_core::inventory::rust;
use devdoctor_core::issue::{Category, Confidence, Issue, IssueBuilder, Severity};
use devdoctor_core::Result;
use serde_json::json;

pub const CARGO_BIN_ID: &str = "rust.cargo_bin.not_in_path";

pub struct CargoBinPathDetector;

impl Detector for CargoBinPathDetector {
    fn meta(&self) -> DetectorMeta {
        DetectorMeta {
            id: CARGO_BIN_ID,
            name: "Cargo bin directory in PATH",
            category: Category::Runtimes,
            description: "rustup is installed but its bin directory is not in PATH, so cargo and rustc are not reachable.",
            modes: &[ScanMode::Quick],
        }
    }

    fn scan(&self, ctx: &SystemContext) -> Result<Vec<Issue>> {
        let inv = rust::inventory(ctx, false);
        if !inv.rustup_installed || inv.cargo_bin_in_path {
            return Ok(Vec::new());
        }
        let cargo_bin = inv.cargo_home.join("bin");
        let reachable_elsewhere = inv.cargo.is_some();
        let issue = IssueBuilder::new(CARGO_BIN_ID, Category::Runtimes, cargo_bin.display().to_string(), if reachable_elsewhere { "rustup's cargo is shadowed by another installation" } else { "Rust is installed but `cargo` and `rustc` are not in PATH" })
            .severity(if reachable_elsewhere { Severity::Low } else { Severity::Medium })
            .confidence(Confidence::Confirmed)
            .description(format!(
                "rustup keeps its toolchains under {} and its command shims under {}, but that directory is not part of the PATH of a fresh login shell.{}",
                ctx.display_path(&inv.rustup_home),
                ctx.display_path(&cargo_bin),
                match &inv.cargo {
                    Some(c) => format!(" `cargo` currently resolves to {} ({}) instead.", ctx.display_path(&c.path), c.origin_label),
                    None => " `cargo` and `rustc` are therefore not found.".to_string(),
                }
            ))
            .impact("`command not found: cargo`, or a different Rust toolchain than the one rustup manages (rustup override/toolchain selection has no effect).")
            .evidence(format!("{} exists", ctx.display_path(&inv.rustup_home.join("toolchains"))))
            .evidence(format!("{} is not in the login shell PATH", ctx.display_path(&cargo_bin)))
            .affected_command("cargo")
            .affected_command("rustc")
            .recommended_action(format!("Add `. \"$HOME/.cargo/env\"` to ~/.zshrc (this is the line the rustup installer adds), or `export PATH=\"{}:$PATH\"`.", ctx.display_path(&cargo_bin)))
            .metadata(json!({ "cargo_bin": cargo_bin, "rustup_home": inv.rustup_home, "toolchains": inv.toolchains.iter().map(|t| t.name.clone()).collect::<Vec<_>>() }))
            .build();
        Ok(vec![issue])
    }
}
