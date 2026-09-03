//! Development ports in use.

use devdoctor_core::context::SystemContext;
use devdoctor_core::detector::{Detector, DetectorMeta, ScanMode};
use devdoctor_core::inventory::processes::{dev_processes, DevProcessKind};
use devdoctor_core::issue::{Category, Confidence, Issue, IssueBuilder, Severity};
use devdoctor_core::Result;
use serde_json::json;

pub const ID: &str = "port.dev.occupied";

pub fn is_common_dev_port(port: u16) -> bool {
    matches!(port, 3000..=3010 | 3333 | 4000..=4010 | 4200 | 4321 | 5000..=5010 | 5173..=5180 | 6006 | 7000 | 8000..=8010 | 8080..=8090 | 8443 | 8888 | 9000..=9010 | 9229 | 19000..=19006 | 24678)
}

pub struct DevPortOccupiedDetector;

impl Detector for DevPortOccupiedDetector {
    fn meta(&self) -> DetectorMeta {
        DetectorMeta {
            id: ID,
            name: "Occupied development ports",
            category: Category::Ports,
            description: "Common development ports (3000, 5173, 8000, ...) currently held by dev servers.",
            modes: &[ScanMode::Quick],
        }
    }

    fn scan(&self, ctx: &SystemContext) -> Result<Vec<Issue>> {
        let ports = ctx.platform.listening_ports()?;
        let processes = ctx.platform.processes()?;
        let devs = dev_processes(ctx, &processes, &ports);
        let mut issues = Vec::new();
        let mut seen = std::collections::HashSet::new();
        for port in &ports {
            if port.port < 1024 || !seen.insert(port.port) {
                continue;
            }
            let Some(pid) = port.pid else { continue };
            let Some(p) = devs.iter().find(|d| d.pid == pid) else { continue };
            if !matches!(
                p.kind,
                DevProcessKind::Node | DevProcessKind::Python | DevProcessKind::Ruby | DevProcessKind::Other | DevProcessKind::Browser
            ) {
                continue;
            }
            if !is_common_dev_port(port.port) {
                continue;
            }
            let stale = p.stale;
            let project = p.project_path.as_ref().map(|pp| ctx.display_path(pp));
            let exposed = port.local_only == Some(false);
            let mut b = IssueBuilder::new(
                ID,
                Category::Ports,
                port.port.to_string(),
                format!(
                    "Port {} is used by {} ({}){}",
                    port.port,
                    p.name,
                    p.label,
                    project.as_ref().map(|pr| format!(" from {pr}")).unwrap_or_default()
                ),
            )
            .severity(if stale { Severity::Low } else { Severity::Info })
            .confidence(if stale { Confidence::Likely } else { Confidence::Confirmed })
            .description(format!(
                "{} (pid {}) is listening on {}:{}{}.",
                p.name,
                p.pid,
                port.address,
                port.port,
                if stale { " and looks stale: its terminal is gone or its project directory no longer exists" } else { "" }
            ))
            .impact(if stale {
                "The next project that wants this port fails with EADDRINUSE and you get a mysterious 'port already in use' error."
                    .to_string()
            } else {
                format!("Informational: another server wanting port {} will fail with EADDRINUSE.", port.port)
            })
            .evidence(format!("lsof: {}:{} LISTEN pid {}", port.address, port.port, p.pid))
            .evidence(format!("command: {}", p.command))
            .current_state(format!("{}:{} → pid {}", port.address, port.port, p.pid))
            .recommended_action(if stale && p.stoppable {
                "Stop the stale process to free the port.".to_string()
            } else {
                "Nothing to do unless you need the port; stop the server from its own terminal.".to_string()
            });
            if exposed {
                b = b.evidence("bound to all interfaces: reachable from other machines on your network".to_string());
            }
            if stale && p.stoppable {
                b = b.fixer("process.stop_user_dev_process");
            }
            issues.push(b.metadata(json!({ "port": port.port, "pid": p.pid, "name": p.name, "command": p.command, "cwd": p.cwd, "project_path": p.project_path, "ports": p.ports, "stoppable": p.stoppable, "stale": stale, "run_time_secs": p.run_time_secs })).build());
        }
        Ok(issues)
    }
}
