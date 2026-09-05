import SwiftUI

struct ShellView: View {
    @EnvironmentObject private var model: AppModel
    @State private var report: ShellReport?
    @State private var isLoading = true
    @State private var error: String?

    var body: some View {
        PageScaffold(title: "Shell", subtitle: AppSection.shell.blurb) {
            StartupTimeCard()

            if isLoading {
                LoadingPanel(title: "Reading shell startup files…")
            } else if let error {
                DataUnavailableView(title: "Shell Unavailable", detail: error, symbol: "terminal")
            } else if let report {
                HStack(spacing: 10) {
                    StatusPill(text: report.shell, symbol: "terminal", color: .blue)
                    StatusPill(text: "\(report.files.filter(\.exists).count) startup files", symbol: "doc.text", color: .secondary)
                    StatusPill(text: "\(report.shellAliases) aliases · \(report.shellFunctions) functions", symbol: "text.alignleft", color: .secondary)
                    StatusPill(text: "captured in \(Formatters.duration(ms: report.captureDurationMs))", symbol: "clock", color: .secondary)
                    Spacer()
                }
                ForEach(Array(report.captureWarnings.enumerated()), id: \.offset) { _, warning in
                    Callout(symbol: "exclamationmark.triangle", color: .orange, text: warning)
                }

                SectionCard("Startup files, in the order they run", detail: "Each new terminal runs these files; installers add lines to them, which is how setups get messy.") {
                    Table(report.files) {
                        TableColumn("File") { file in
                            Text(Formatters.shortenHome(file.path)).font(.system(.body, design: .monospaced))
                        }
                        .width(min: 140, ideal: 200)
                        TableColumn("Role") { file in Text(file.roleLabel).foregroundStyle(.secondary) }
                            .width(120)
                        TableColumn("Contents") { file in
                            Text(file.exists ? "\(file.statementCount) statements · \(file.size) bytes" : "not present")
                                .foregroundStyle(file.exists ? .primary : .secondary)
                        }
                        .width(min: 160, ideal: 220)
                        TableColumn("") { file in
                            if !file.warnings.isEmpty {
                                StatusPill(text: "\(file.warnings.count) parser warning\(file.warnings.count > 1 ? "s" : "")", symbol: "exclamationmark.triangle", color: .orange)
                            }
                        }
                    }
                    .devDoctorTable(minHeight: CGFloat(60 + report.files.count * 30))
                }

                SectionCard("Lines that change PATH", detail: "Where each folder in your PATH comes from.") {
                    if report.mutations.isEmpty {
                        Text("No PATH statements found in startup files.").foregroundStyle(.secondary)
                    } else {
                        Table(report.mutations) {
                            TableColumn("Where") { m in Text("\(Formatters.shortenHome(m.file)):\(m.line)").font(.system(.caption, design: .monospaced)) }
                                .width(min: 120, ideal: 150)
                            TableColumn("Effect") { m in
                                Text(m.effectLabel + (m.conditional ? " (only sometimes)" : "") + (m.inFunction ? " (inside a function)" : ""))
                                    .foregroundStyle(.secondary)
                            }
                            .width(min: 120, ideal: 160)
                            TableColumn("Folders") { m in
                                VStack(alignment: .leading, spacing: 2) {
                                    ForEach(m.components.filter { !$0.isPathRef }, id: \.raw) { c in
                                        HStack(spacing: 6) {
                                            Text(Formatters.shortenHome(c.expanded ?? c.raw)).font(.system(.caption, design: .monospaced))
                                            if c.exists == false { StatusPill(text: "missing", symbol: "questionmark.folder", color: .orange) }
                                        }
                                    }
                                }
                            }
                            .width(min: 200, ideal: 300)
                            TableColumn("Statement") { m in Text(m.raw).font(.system(.caption, design: .monospaced)).lineLimit(1) }
                        }
                        .devDoctorTable(minHeight: CGFloat(min(400, 60 + report.mutations.count * 34)))
                    }
                }

                SectionCard("Other files loaded at startup") {
                    if report.sources.isEmpty {
                        Text("No files are loaded from the startup files.").foregroundStyle(.secondary)
                    } else {
                        Table(report.sources) {
                            TableColumn("Where") { s in Text("\(Formatters.shortenHome(s.file)):\(s.line)").font(.system(.caption, design: .monospaced)) }
                                .width(min: 120, ideal: 150)
                            TableColumn("Loads") { s in Text(Formatters.shortenHome(s.expanded ?? s.targetRaw)).font(.system(.caption, design: .monospaced)).lineLimit(1) }
                                .width(min: 220, ideal: 340)
                            TableColumn("Status") { s in
                                if s.exists == false {
                                    StatusPill(text: "missing", symbol: "xmark.circle", color: .orange)
                                } else if s.exists == true {
                                    StatusPill(text: "exists", symbol: "checkmark.circle", color: .green)
                                } else {
                                    Text("unknown").foregroundStyle(.secondary)
                                }
                            }
                            .width(110)
                            TableColumn("") { s in
                                Text([s.guarded ? "only if present" : "", s.conditional ? "conditional" : "", s.inFunction ? "in function" : ""].filter { !$0.isEmpty }.joined(separator: ", "))
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .devDoctorTable(minHeight: CGFloat(min(320, 60 + report.sources.count * 30)))
                    }
                }

                SectionCard("Tools that set themselves up (eval)") {
                    if report.evals.isEmpty {
                        Text("No eval statements.").foregroundStyle(.secondary)
                    } else {
                        ForEach(report.evals) { e in
                            HStack(alignment: .top) {
                                Text("\(Formatters.shortenHome(e.file)):\(e.line)").font(.system(.caption, design: .monospaced)).foregroundStyle(.secondary).frame(width: 150, alignment: .leading)
                                Text(e.command).font(.system(.caption, design: .monospaced)).textSelection(.enabled)
                                if e.conditional { StatusPill(text: "conditional", symbol: "questionmark.circle", color: .secondary) }
                                Spacer()
                            }
                        }
                    }
                }

                SectionCard("Aliases defined in your files") {
                    if report.aliases.isEmpty {
                        Text("No aliases defined in startup files.").foregroundStyle(.secondary)
                    } else {
                        Table(report.aliases) {
                            TableColumn("Where") { a in Text("\(Formatters.shortenHome(a.file)):\(a.line)").font(.system(.caption, design: .monospaced)) }
                                .width(min: 120, ideal: 150)
                            TableColumn("Alias") { a in Text(a.name).fontWeight(.medium) }
                                .width(min: 90, ideal: 130)
                            TableColumn("Runs") { a in Text(a.valueRaw).font(.system(.caption, design: .monospaced)).lineLimit(1) }
                        }
                        .devDoctorTable(minHeight: CGFloat(min(280, 60 + report.aliases.count * 30)))
                    }
                }
            }
        }
        .task(id: model.refreshToken) { await load() }
    }

    private func load() async {
        isLoading = report == nil
        do {
            report = try await EngineClient.shared.shell()
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

/// Measures how long a new terminal takes to start and which startup lines are slow.
struct StartupTimeCard: View {
    @State private var profile: StartupProfile?
    @State private var isMeasuring = false
    @State private var error: String?

    var body: some View {
        InsetPanel {
            VStack(alignment: .leading, spacing: 14) {
                SectionHeading("Startup time", detail: "How long a new terminal takes to become usable, and which lines are responsible.") {
                    Button {
                        Task { await measure() }
                    } label: {
                        Label(isMeasuring ? "Measuring…" : (profile == nil ? "Measure" : "Measure again"), systemImage: isMeasuring ? "hourglass" : "gauge.with.needle")
                    }
                    .buttonStyle(.glassProminent)
                    .disabled(isMeasuring)
                }

                if let error {
                    Callout(symbol: "exclamationmark.triangle", color: .orange, text: error)
                }

                if let profile {
                    HStack(spacing: 0) {
                        MetricCell(value: "\(profile.medianMs) ms", label: "typical start · \(profile.ratingLabel)", symbol: "timer", tint: profile.ratingColor)
                        Divider().frame(height: 36)
                        MetricCell(value: "\(profile.minMs)–\(profile.maxMs) ms", label: "\(profile.samplesMs.count) complete starts", symbol: "arrow.left.and.right", tint: .secondary)
                        Divider().frame(height: 36)
                        MetricCell(value: profile.traced ? "\(profile.traceLines)" : "—", label: profile.traced ? "lines traced" : "trace unavailable", symbol: "list.number", tint: .secondary)
                    }
                    .padding(.vertical, 10)
                    .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 12))

                    Text("Under 150 ms feels instant; above 500 ms every new tab waits; above 1.5 s it hurts.")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    ForEach(Array(profile.notes.enumerated()), id: \.offset) { _, note in
                        Callout(symbol: "info.circle", color: .blue, text: note)
                    }

                    if profile.traced {
                        Text("Slowest lines of your startup files").font(.subheadline.weight(.semibold))
                        if profile.hotspots.isEmpty {
                            Text("No lines of your own startup files were traced.").foregroundStyle(.secondary).font(.caption)
                        } else {
                            Table(profile.hotspots) {
                                TableColumn("Time") { h in Text("\(h.inclusiveMs) ms").monospacedDigit() }
                                    .width(70)
                                TableColumn("Share") { h in Text("\(h.sharePercent)%").monospacedDigit().foregroundStyle(.secondary) }
                                    .width(60)
                                TableColumn("Where") { h in Text("\(Formatters.shortenHome(h.file)):\(h.line)").font(.system(.caption, design: .monospaced)) }
                                    .width(min: 120, ideal: 150)
                                TableColumn("Statement") { h in
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(h.statement).font(.system(.caption, design: .monospaced)).lineLimit(1)
                                        if let hint = h.hint {
                                            Text(hint).font(.caption2).foregroundStyle(.secondary).lineLimit(2)
                                        }
                                    }
                                }
                            }
                            .devDoctorTable(minHeight: CGFloat(min(360, 60 + profile.hotspots.count * 40)))
                        }

                        Text("Time spent per file or function").font(.subheadline.weight(.semibold))
                        Table(profile.sources) {
                            TableColumn("Own time") { s in Text("\(s.selfMs) ms").monospacedDigit() }
                                .width(80)
                            TableColumn("Kind") { s in Text(s.kind).foregroundStyle(.secondary) }
                                .width(80)
                            TableColumn("Lines run") { s in Text("\(s.lines)").monospacedDigit() }
                                .width(80)
                            TableColumn("Source") { s in Text(Formatters.shortenHome(s.display)).font(.system(.caption, design: .monospaced)) }
                        }
                        .devDoctorTable(minHeight: CGFloat(min(320, 60 + profile.sources.count * 30)))
                    }

                    if !profile.stderrLines.isEmpty {
                        Text("Printed when a terminal opens").font(.subheadline.weight(.semibold))
                        MonoBlock(text: profile.stderrLines.joined(separator: "\n"))
                    }
                } else if !isMeasuring {
                    Text("DevDoctor starts your login shell three times and, for zsh, traces one start line by line. Nothing is changed.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } else {
                    LoadingPanel(title: "Starting your login shell three times and tracing one start…")
                }
            }
        }
    }

    private func measure() async {
        isMeasuring = true
        error = nil
        do {
            profile = try await EngineClient.shared.startup(samples: 3, trace: true)
        } catch {
            self.error = error.localizedDescription
        }
        isMeasuring = false
    }
}
