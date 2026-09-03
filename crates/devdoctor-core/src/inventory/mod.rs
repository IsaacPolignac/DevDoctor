//! Read-only inventories of the developer environment (package managers, runtimes, tools,
//! storage, local AI). Detectors turn these facts into issues; snapshots record them.

pub mod git;
pub mod homebrew;
pub mod localai;
pub mod node;
pub mod ollama;
pub mod processes;
pub mod python;
pub mod rust;
pub mod ssh;
pub mod storage;
pub mod tools;
