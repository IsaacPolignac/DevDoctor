//! DevDoctor detectors. Each module implements one or more [`Detector`]s; `all_detectors`
//! is the single registry used by both the CLI and the desktop app.

use devdoctor_core::detector::Detector;
use devdoctor_core::engine::ScanEngine;
use std::sync::Arc;

pub mod disk;
pub mod git;
pub mod homebrew;
pub mod node;
pub mod port;
pub mod process;
pub mod python;
pub mod rust;
pub mod service;
pub mod shell_env;
pub mod shell_path;
pub mod shell_source;
pub mod shell_syntax;
pub mod ssh;
pub mod util;

pub fn all_detectors() -> Vec<Arc<dyn Detector>> {
    vec![
        Arc::new(shell_syntax::ShellSyntaxDetector),
        Arc::new(shell_path::PathDuplicateDetector),
        Arc::new(shell_path::PathMissingDirectoryDetector),
        Arc::new(shell_path::PathSuspiciousEntryDetector),
        Arc::new(shell_source::SourceMissingFileDetector),
        Arc::new(shell_source::SourceRecursiveDetector),
        Arc::new(shell_source::SourceDuplicateDetector),
        Arc::new(shell_env::AliasShadowDetector),
        Arc::new(shell_env::EnvVarMissingPathDetector),
        Arc::new(python::PythonMultipleInterpretersDetector),
        Arc::new(python::PipMismatchDetector),
        Arc::new(node::NodeMultipleInstallationsDetector),
        Arc::new(node::NpmMismatchDetector),
        Arc::new(rust::CargoBinPathDetector),
        Arc::new(homebrew::HomebrewHealthDetector),
        Arc::new(homebrew::HomebrewDoctorDetector),
        Arc::new(process::StaleDevProcessDetector),
        Arc::new(port::DevPortOccupiedDetector),
        Arc::new(disk::HomebrewCacheDetector),
        Arc::new(disk::NpmCacheDetector),
        Arc::new(disk::PipCacheDetector),
        Arc::new(disk::OllamaModelsDetector),
        Arc::new(disk::UvCacheDetector),
        Arc::new(disk::BrokenVenvDetector),
        Arc::new(disk::StaleNodeModulesDetector),
        Arc::new(ssh::SshPermissionsDetector),
        Arc::new(ssh::SshConfigDetector),
        Arc::new(git::GitIdentityDetector),
        Arc::new(service::BrewServiceDetector),
        Arc::new(service::BrokenLaunchAgentDetector),
    ]
}

pub fn register_all(engine: &mut ScanEngine) {
    for d in all_detectors() {
        engine.register(d);
    }
}
