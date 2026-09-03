//! Shell configuration understanding: a tolerant parser for zsh/bash rc files, a model of how
//! they build `PATH`, and the rewriting primitives used by the safe PATH fixers.

pub mod analysis;
pub mod parser;
pub mod path_model;

pub use analysis::*;
pub use parser::*;
pub use path_model::*;
