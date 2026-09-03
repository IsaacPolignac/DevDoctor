//! DevDoctor core: the diagnostic engine shared by the desktop application and the CLI.
//!
//! The crate is organised around a few concepts:
//!
//! * [`context::SystemContext`] – everything a detector may inspect (home directory, shell,
//!   environment, platform adapter, command runner). It is the single entry point to the
//!   machine so tests can substitute fakes.
//! * [`detector::Detector`] – produces [`issue::Issue`]s. Detectors never mutate anything.
//! * [`fixer::Fixer`] – previews and applies a fix for an issue. Fixers only mutate the
//!   machine through a [`transaction::TxBuilder`], which records every operation, creates
//!   backups and enables rollback.
//! * [`engine::ScanEngine`] – runs detectors in isolation, measures them and computes the
//!   health score.
//! * [`snapshot`] – lightweight environment snapshots and their diffs ("What changed").
//! * [`db::Database`] – local SQLite persistence.
//!
//! Platform-specific code lives behind the [`platform::Platform`] trait so Linux/Windows
//! adapters can be added later without touching the engine.

pub mod backup;
pub mod command;
pub mod context;
pub mod db;
pub mod detector;
pub mod engine;
pub mod error;
pub mod fixer;
pub mod fs_util;
pub mod health;
pub mod ids;
pub mod inventory;
pub mod issue;
pub mod logging;
pub mod path_env;
pub mod paths;
pub mod platform;
pub mod redact;
pub mod resolve;
pub mod shell;
pub mod snapshot;
pub mod transaction;
pub mod units;

pub use error::{Error, Result};
