import SwiftUI

struct ChangesView: View {
    @EnvironmentObject private var model: AppModel
    @State private var snapshots: [SnapshotSummary] = []
    @State private var runs: [RunRecord] = []
    @State private var diff: SnapshotDiff?
    @State private var from = ""
    @State private var to = ""
    @State private var isLoading = true
    @State private var isComparing = false
    @State private var creating: Bool? = nil
    @State private var error: String?

    private var hasBaseline: Bool { snapshots.contains { $0.kind == "baseline" } }

    var body: some View {
        PageScaffold(title: "What Changed", subtitle: AppSection.changes.blurb) {
            if isLoading {
                LoadingPanel(title: "Reading snapshots…")
            } else {
                if let error {
                    Callout(symbol: "exclamationmark.triangle", color: .orange, text: error)
                }

                InsetPanel {
                    VStack(alignment: .leading, spacing: 12) {
                        SectionHeading("Compare two snapshots", detail: "DevDoctor takes a snapshot after every check. It records metadata only: PATH, startup-file hashes, packages, runtimes, services, ports and variable names.") {
                            HStack(spacing: 8) {
                                Button {
                                    creating = false
                                } label: { Label("Take Snapshot", systemImage: "camera") }
                                    .buttonStyle(.glass)
                                if !hasBaseline {
                                    Button {
                                        creating = true
                                    } label: { Label("Create Baseline", systemImage: "flag") }
                                        .buttonStyle(.glassProminent)
                                }
                            }
                        }
                        HStack(spacing: 10) {
                            Picker("From", selection: $from) {
                                Text("the previous snapshot").tag("")
                                if hasBaseline { Text("the baseline").tag("baseline") }
                                Text("24 hours ago").tag("24h")
                                Text("7 days ago").tag("7d")
                                Divider()
                                ForEach(snapshots) { s in Text(label(s)).tag(s.id) }
                            }
                            .frame(maxWidth: 320)
                            Picker("To", selection: $to) {
                                Text("the latest snapshot").tag("")
                                ForEach(snapshots) { s in Text(label(s)).tag(s.id) }
                            }
                            .frame(maxWidth: 320)
                            .disabled(from == "24h" || from == "7d")
                            if isComparing { ProgressView().controlSize(.small) }
                            Spacer()
                        }
                    }
                }

                if let diff {
                    SectionCard("Between \(Formatters.shortDate(diff.fromAt)) and \(Formatters.shortDate(diff.toAt))") {
                        if diff.changes.isEmpty {
                            Label("No changes detected.", systemImage: "checkmark.circle").foregroundStyle(.secondary)
                        } else {
                            ForEach(Array(diff.headline.enumerated()), id: \.offset) { _, h in
                                Label(h, systemImage: "circle.fill").font(.callout.weight(.medium)).imageScale(.small)
                            }
                        }
                    }
                    ForEach(diff.categories) { category in
                        DisclosureGroup {
                            VStack(alignment: .leading, spacing: 6) {
                                ForEach(diff.changes.filter { $0.category == category.category }) { change in
                                    HStack(alignment: .top, spacing: 8) {
                                        StatusPill(text: change.kind, symbol: change.kind == "added" ? "plus" : (change.kind == "removed" ? "minus" : "arrow.triangle.2.circlepath"), color: change.kind == "added" ? .green : (change.kind == "removed" ? .red : .blue))
                                        Text(change.description).font(.callout).textSelection(.enabled).fixedSize(horizontal: false, vertical: true)
                                        Spacer()
                                    }
                                }
                            }
                            .padding(.top, 8)
                        } label: {
                            HStack {
                                Text(category.label).fontWeight(.medium)
                                Spacer()
                                Text([category.added > 0 ? "+\(category.added)" : "", category.removed > 0 ? "−\(category.removed)" : "", category.changed > 0 ? "~\(category.changed)" : ""].filter { !$0.isEmpty }.joined(separator: " "))
                                    .foregroundStyle(.secondary).monospacedDigit()
                            }
                        }
                        .padding(14)
                        .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(.separator.opacity(0.45), lineWidth: 0.5))
                    }
                } else if !isComparing {
                    InsetPanel {
                        Label("Not enough snapshots to compare yet. Run a check later, or take a snapshot now.", systemImage: "clock")
                            .foregroundStyle(.secondary)
                    }
                }

                VStack(alignment: .leading, spacing: 10) {
                    SectionHeading("Recorded installs", detail: "Wrap an installer in your terminal — `devdoctor run brew install something` — or use `devdoctor watch`, and DevDoctor records exactly what changed.")
                    if runs.isEmpty {
                        InsetPanel { Text("No recorded installs yet.").foregroundStyle(.secondary).frame(maxWidth: .infinity, alignment: .leading) }
                    } else {
                        ForEach(runs) { run in RunCard(run: run) }
                    }
                }

                SectionCard("Snapshots") {
                    if snapshots.isEmpty {
                        Text("None yet.").foregroundStyle(.secondary)
                    } else {
                        Table(snapshots) {
                            TableColumn("When") { s in Text(Formatters.shortDate(s.createdAt)) }
                                .width(min: 150, ideal: 180)
                            TableColumn("Kind") { s in
                                HStack(spacing: 6) {
                                    Text(s.kind.replacingOccurrences(of: "_", with: " "))
                                    if s.kind == "baseline" { StatusPill(text: "baseline", symbol: "flag", color: .blue) }
                                }
                            }
                            .width(min: 120, ideal: 160)
                            TableColumn("Label") { s in Text(s.label ?? "").foregroundStyle(.secondary).lineLimit(1) }
                            TableColumn("Items") { s in Text("\(s.itemCount)").monospacedDigit() }
                                .width(60)
                            TableColumn("Id") { s in Text(s.id).font(.system(.caption2, design: .monospaced)).foregroundStyle(.tertiary) }
                                .width(150)
                        }
                        .devDoctorTable(minHeight: CGFloat(min(360, 60 + snapshots.count * 28)))
                    }
                }
            }
        }
        .task(id: model.refreshToken) { await load() }
        .task(id: "\(from)|\(to)") { await compare() }
        .alert(creating == true ? "Create baseline snapshot" : "Take a snapshot", isPresented: Binding(get: { creating != nil }, set: { if !$0 { creating = nil } })) {
            Button("Cancel", role: .cancel) { creating = nil }
            Button("Create") {
                let baseline = creating == true
                creating = nil
                Task { await create(baseline: baseline) }
            }
        } message: {
            Text(creating == true
                 ? "The baseline is the reference for \"what changed since I set things up\". It records metadata only, no file contents and no secret values."
                 : "A snapshot records metadata only: PATH, hashes of your startup files, package names and versions, runtime versions, startup items, listening ports and environment variable names.")
        }
    }

    private func label(_ s: SnapshotSummary) -> String {
        "\(Formatters.shortDate(s.createdAt)) · \(s.kind.replacingOccurrences(of: "_", with: " "))\(s.label.map { " · \($0)" } ?? "")"
    }

    private func load() async {
        isLoading = snapshots.isEmpty && runs.isEmpty
        do {
            snapshots = try await EngineClient.shared.snapshots()
            runs = try await EngineClient.shared.runs()
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
        await compare()
    }

    private func compare() async {
        isComparing = true
        do {
            diff = try await EngineClient.shared.changes(since: from.isEmpty ? nil : from, to: to.isEmpty ? nil : to)
        } catch {
            diff = nil
            self.error = error.localizedDescription
        }
        isComparing = false
    }

    private func create(baseline: Bool) async {
        do {
            _ = try await EngineClient.shared.createSnapshot(baseline: baseline)
            await load()
        } catch {
            self.error = error.localizedDescription
        }
    }
}

/// One `devdoctor run` / `devdoctor watch` record with its diffs.
struct RunCard: View {
    let run: RunRecord

    var body: some View {
        InsetPanel {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: "terminal.fill").foregroundStyle(.blue)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(run.label).font(.system(.subheadline, design: .monospaced).weight(.semibold)).lineLimit(2)
                        Text("\(Formatters.shortDate(run.startedAt)) · \(Formatters.duration(ms: run.durationMs))").font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    StatusPill(text: run.exitCode.map { "exit \($0)" } ?? "interrupted", symbol: run.exitCode == 0 ? "checkmark.circle" : "exclamationmark.circle", color: run.exitCode == 0 ? .green : .orange)
                }
                if run.headline.isEmpty {
                    Text("Nothing DevDoctor tracks changed.").font(.callout).foregroundStyle(.secondary)
                } else {
                    ForEach(Array(run.headline.enumerated()), id: \.offset) { _, h in
                        Label(h, systemImage: "circle.fill").font(.callout).imageScale(.small)
                    }
                }
                ForEach(run.fileDiffs) { f in
                    DisclosureGroup("\(Formatters.shortenHome(f.path)) · \(f.kind) (+\(f.linesAdded) / −\(f.linesRemoved))") {
                        DiffBlock(text: f.diff).padding(.top, 6)
                    }
                    .font(.callout)
                }
                if !run.diff.changes.isEmpty {
                    DisclosureGroup("\(run.diff.changes.count) tracked change\(run.diff.changes.count > 1 ? "s" : "")") {
                        VStack(alignment: .leading, spacing: 4) {
                            ForEach(run.diff.changes) { c in
                                HStack(spacing: 8) {
                                    StatusPill(text: c.kind, symbol: "circle", color: c.kind == "added" ? .green : (c.kind == "removed" ? .red : .blue))
                                    Text(c.description).font(.caption).textSelection(.enabled)
                                    Spacer()
                                }
                            }
                        }
                        .padding(.top, 6)
                    }
                    .font(.callout)
                }
                Text(run.id).font(.system(.caption2, design: .monospaced)).foregroundStyle(.tertiary)
            }
        }
    }
}
