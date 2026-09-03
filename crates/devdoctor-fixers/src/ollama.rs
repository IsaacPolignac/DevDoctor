//! Remove an Ollama model through Ollama's own CLI.

use devdoctor_core::command::CommandSpec;
use devdoctor_core::context::SystemContext;
use devdoctor_core::fixer::{FixPreview, Fixer, PlannedCommand, RiskLevel, ValidationReport};
use devdoctor_core::inventory::ollama;
use devdoctor_core::issue::Issue;
use devdoctor_core::transaction::TxBuilder;
use devdoctor_core::units::format_bytes;
use devdoctor_core::{Error, Result};

pub const ID: &str = "ai.ollama.remove_model";

pub struct RemoveOllamaModelFixer;

fn model_name(issue: &Issue) -> Result<String> {
    let name = issue.metadata.get("model").and_then(|m| m.as_str()).ok_or_else(|| Error::FixUnavailable("no model on issue".into()))?;
    // Model names: letters, digits, and a few separators. Anything else is refused.
    if name.is_empty()
        || name.len() > 200
        || !name.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_' | ':' | '/'))
        || name.starts_with('-')
    {
        return Err(Error::Invalid(format!("`{name}` is not a valid model name")));
    }
    Ok(name.to_string())
}

impl Fixer for RemoveOllamaModelFixer {
    fn id(&self) -> &'static str {
        ID
    }

    fn name(&self) -> &'static str {
        "Remove Ollama model"
    }

    fn supports(&self, issue: &Issue) -> bool {
        issue.detector_id == "ai.ollama.model" && issue.metadata.get("model").is_some()
    }

    fn reversible(&self, _issue: &Issue) -> bool {
        false
    }

    fn preview(&self, issue: &Issue, ctx: &SystemContext) -> Result<FixPreview> {
        let name = model_name(issue)?;
        let inv = ollama::inventory(ctx);
        let Some(model) = inv.models.iter().find(|m| m.name == name) else {
            return Err(Error::FixUnavailable(format!("model {name} is not installed (anymore)")));
        };
        let binary = inv.binary.clone().ok_or_else(|| Error::FixUnavailable("the ollama command line tool was not found".into()))?;
        let mut preview = FixPreview::new(
            ID,
            issue,
            format!("Remove Ollama model {name} ({})", format_bytes(model.size)),
            format!("Runs `ollama rm {name}`, which deletes the model's manifest and the blobs no other model shares."),
        );
        preview.operations.push(format!("{} rm {name}", binary.display()));
        preview.commands_executed.push(PlannedCommand {
            program: binary.to_string_lossy().into_owned(),
            args: vec!["rm".into(), name.clone()],
            description: "Remove the model with Ollama's own command".into(),
        });
        preview.estimated_disk_space_recovered = model.size;
        preview.risk = RiskLevel::Medium;
        preview.reversible = false;
        preview.notes.push(format!("The model can be downloaded again with `ollama pull {name}`."));
        if !inv.running {
            preview.notes.push("Ollama is not running; `ollama rm` starts a temporary server or edits the store directly.".into());
        }
        preview.validations.push("The model no longer appears in Ollama's local store.".into());
        Ok(preview)
    }

    fn apply(&self, issue: &Issue, ctx: &SystemContext, tx: &mut TxBuilder<'_>) -> Result<()> {
        let name = model_name(issue)?;
        let inv = ollama::inventory(ctx);
        let binary = inv.binary.clone().ok_or_else(|| Error::FixUnavailable("ollama not found".into()))?;
        let spec = CommandSpec::new(binary.to_string_lossy().into_owned())
            .args(["rm", name.as_str()])
            .env("PATH", ctx.effective_path().raw.clone())
            .timeout_ms(60_000);
        tx.run_command(&spec, &format!("ollama rm {name}"))?;
        Ok(())
    }

    fn validate(&self, issue: &Issue, ctx: &SystemContext, _tx: &TxBuilder<'_>) -> Result<ValidationReport> {
        let name = model_name(issue)?;
        let inv = ollama::inventory(ctx);
        let mut report = ValidationReport::ok();
        let present = inv.models.iter().any(|m| m.name == name);
        report.check("model removed", !present, name);
        Ok(report)
    }
}
