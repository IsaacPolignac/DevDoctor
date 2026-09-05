import AppKit
import SwiftUI
import UniformTypeIdentifiers

struct HistoryView: View {
    @EnvironmentObject private var model: AppModel
    @State private var mode: HistoryMode = .scans
    @State private var selectedScanID: String?
    @State private var selectedTransactionID: String?
    @State private var selectedRunID: String?
    @State private var pendingRollback: EngineTransaction?
    @State private var isLoading = true

    private var selectedScan: ScanSummary? { model.history.scans.first { $0.id == selectedScanID } }
    private var selectedTransaction: EngineTransaction? { model.history.transactions.first { $0.id == selectedTransactionID } }
    private var selectedRun: RunRecord? { model.history.runs.first { $0.id == selectedRunID } }

    var body: some View {
        PageScaffold(title: "History", subtitle: AppSection.history.blurb) {
            HStack {
                Picker("History", selection: $mode) {
                    ForEach(HistoryMode.allCases) { item in
                        Text(item.title(model)).tag(item)
                    }
                }
                .labelsHidden()
                .pickerStyle(.segmented)
                .fixedSize()
                Spacer()
                Button { Task { await load() } } label: {
                    Label("Refresh", systemImage: "arrow.clockwise")
                }
            }

            if isLoading {
                LoadingPanel(title: "Reading local history…")
            } else {
                switch mode {
                case .scans: scans
                case .repairs: transactions
                case .runs: runs
                }
            }
        }
        .task(id: model.refreshToken) { await load() }
        .alert("Undo this repair?", isPresented: Binding(
            get: { pendingRollback != nil },
            set: { if !$0 { pendingRollback = nil } }
        )) {
            Button("Cancel", role: .cancel) { pendingRollback = nil }
            Button("Restore files", role: .destructive) {
                guard let transaction = pendingRollback else { return }
                pendingRollback = nil
                Task { await model.rollback(transaction) }
            }
        } message: {
            Text("DevDoctor puts back the \(pendingRollback?.backups?.count ?? 0) file(s) it saved before “\(pendingRollback?.title ?? "this repair")”. If a file changed since, the restore is refused to protect your edits.")
        }
    }

    @ViewBuilder
    private var scans: some View {
        if model.history.scans.isEmpty {
            DataUnavailableView(title: "No Scan History", detail: "Completed scans appear here.", symbol: "clock")
        } else {
            Table(model.history.scans, selection: $selectedScanID) {
                TableColumn("Date") { scan in Text(Formatters.shortDate(scan.finishedAt)) }
                    .width(min: 150, ideal: 190)
                TableColumn("Type") { scan in Text(ScanMode(rawValue: scan.mode)?.label ?? scan.mode) }
                    .width(120)
                TableColumn("Health") { scan in Text(scan.healthScore.map { "\($0) / 100" } ?? "—").monospacedDigit() }
                    .width(90)
                TableColumn("Findings") { scan in Text("\(scan.issueCount)").monospacedDigit() }
                    .width(75)
                TableColumn("Checks") { scan in Text("\(scan.detectorsRun)\(scan.detectorsFailed > 0 ? " (\(scan.detectorsFailed) failed)" : "")").monospacedDigit() }
                    .width(110)
                TableColumn("Duration") { scan in Text(Formatters.duration(ms: scan.durationMs)).monospacedDigit().foregroundStyle(.secondary) }
                    .width(90)
            }
            .devDoctorTable(minHeight: 390)

            if let selectedScan {
                InsetPanel {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("\((ScanMode(rawValue: selectedScan.mode)?.label ?? selectedScan.mode).capitalized) completed").font(.headline)
                            Text("\(Formatters.shortDate(selectedScan.finishedAt)) · \(selectedScan.detectorsRun) checks in \(Formatters.duration(ms: selectedScan.durationMs))").foregroundStyle(.secondary)
                        }
                        Spacer()
                        StatusPill(
                            text: selectedScan.issueCount == 0 ? "No findings" : "\(selectedScan.issueCount) findings",
                            symbol: selectedScan.issueCount == 0 ? "checkmark.circle.fill" : "exclamationmark.triangle.fill",
                            color: selectedScan.issueCount == 0 ? .green : .orange
                        )
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var transactions: some View {
        if model.history.transactions.isEmpty {
            DataUnavailableView(title: "No Repairs Yet", detail: "Repairs and rollback records appear here.", symbol: "arrow.uturn.backward.circle")
        } else {
            Table(model.history.transactions, selection: $selectedTransactionID) {
                TableColumn("Date") { transaction in Text(Formatters.shortDate(transaction.createdAt)) }
                    .width(min: 150, ideal: 190)
                TableColumn("Action") { transaction in Text(transaction.title).fontWeight(.medium).lineLimit(1) }
                    .width(min: 240, ideal: 360)
                TableColumn("Status") { transaction in
                    Text(transaction.statusLabel)
                        .foregroundStyle(transaction.status == "applied" ? .green : (transaction.status == "rolled_back" ? .blue : .orange))
                }
                .width(110)
                TableColumn("Recovered") { transaction in
                    Text(transaction.diskSpaceRecovered > 0 ? Formatters.byteString(transaction.diskSpaceRecovered) : "—").monospacedDigit()
                }
                .width(100)
            }
            .devDoctorTable(minHeight: 360)

            if let tx = selectedTransaction {
                InsetPanel {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(tx.title).font(.headline)
                                Text("\(tx.operations.count) recorded operation\(tx.operations.count == 1 ? "" : "s") · \(tx.id)")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                    .textSelection(.enabled)
                            }
                            Spacer()
                            if tx.canRollback {
                                Button("Undo…", role: .destructive) { pendingRollback = tx }
                            }
                        }
                        ForEach(Array(tx.operations.enumerated()), id: \.offset) { _, op in
                            Label(Formatters.shortenHome(op.summary), systemImage: op.isReversible ? "doc.badge.clock" : "bolt").font(.callout)
                        }
                        if let validation = tx.validation, !validation.checks.isEmpty {
                            Divider()
                            ForEach(Array(validation.checks.enumerated()), id: \.offset) { _, check in
                                HStack(alignment: .top, spacing: 8) {
                                    Image(systemName: check.passed ? "checkmark.circle.fill" : "xmark.circle.fill").foregroundStyle(check.passed ? .green : .red)
                                    Text("\(check.name) — \(Formatters.shortenHome(check.detail))").font(.caption).foregroundStyle(.secondary)
                                }
                            }
                        }
                        ForEach(Array(tx.notes.enumerated()), id: \.offset) { _, note in
                            Label(note, systemImage: "info.circle").font(.caption).foregroundStyle(.secondary)
                        }
                        if let error = tx.error {
                            Label(error, systemImage: "exclamationmark.triangle").font(.caption).foregroundStyle(.orange)
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var runs: some View {
        if model.history.runs.isEmpty {
            DataUnavailableView(title: "No Recorded Runs", detail: "Wrap an installer with `devdoctor run <command>` or use `devdoctor watch` in the terminal; every recorded run appears here and in What Changed.", symbol: "terminal")
        } else {
            Table(model.history.runs, selection: $selectedRunID) {
                TableColumn("Date") { run in Text(Formatters.shortDate(run.startedAt)) }
                    .width(min: 150, ideal: 190)
                TableColumn("Command") { run in Text(run.label).font(.system(.body, design: .monospaced)).lineLimit(1) }
                    .width(min: 240, ideal: 360)
                TableColumn("Exit") { run in Text(run.exitCode.map(String.init) ?? "signal").monospacedDigit().foregroundStyle(run.exitCode == 0 ? .green : .orange) }
                    .width(60)
                TableColumn("What changed") { run in Text(run.headline.isEmpty ? "nothing tracked" : run.headline.joined(separator: "; ")).foregroundStyle(.secondary).lineLimit(1) }
            }
            .devDoctorTable(minHeight: 300)

            if let run = selectedRun {
                RunCard(run: run)
            }
        }
    }

    private func load() async {
        isLoading = model.history.scans.isEmpty && model.history.transactions.isEmpty
        do {
            model.history = try await EngineClient.shared.history()
            if selectedScanID == nil { selectedScanID = model.history.scans.first?.id }
            if selectedTransactionID == nil { selectedTransactionID = model.history.transactions.first?.id }
            if selectedRunID == nil { selectedRunID = model.history.runs.first?.id }
        } catch {
            model.alertMessage = error.localizedDescription
        }
        isLoading = false
    }
}

private enum HistoryMode: String, CaseIterable, Identifiable {
    case scans, repairs, runs
    var id: String { rawValue }

    @MainActor
    func title(_ model: AppModel) -> String {
        switch self {
        case .scans: "Scans · \(model.history.scans.count)"
        case .repairs: "Repairs & Rollbacks · \(model.history.transactions.count)"
        case .runs: "Recorded Runs · \(model.history.runs.count)"
        }
    }
}

struct SettingsView: View {
    @EnvironmentObject private var model: AppModel
    @Binding var appearance: AppearanceMode
    @Binding var glassMode: GlassMode
    @State private var schedule: SnapshotSchedule?
    @State private var scheduleHour = 12
    @State private var markdown: String?
    @State private var reportStatus: String?

    var body: some View {
        PageScaffold(title: "Settings", subtitle: AppSection.settings.blurb) {
            Form {
                Section("Appearance") {
                    LabeledContent("Theme") {
                        Picker("Theme", selection: $appearance) {
                            ForEach(AppearanceMode.allCases) { mode in
                                Label(mode.rawValue, systemImage: mode.symbol).tag(mode)
                            }
                        }
                        .labelsHidden()
                        .pickerStyle(.segmented)
                        .frame(width: 310)
                    }

                    LabeledContent("Liquid Glass") {
                        Picker("Liquid Glass", selection: $glassMode) {
                            ForEach(GlassMode.allCases) { mode in
                                Text(mode.rawValue).tag(mode)
                            }
                        }
                        .labelsHidden()
                        .pickerStyle(.segmented)
                        .frame(width: 210)
                    }

                    Text("System follows the Mac automatically. Liquid Glass is reserved for navigation and primary controls so technical content stays easy to read.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Section("Diagnostics") {
                    Toggle("Run a quick check when DevDoctor opens (if the last one is older than an hour)", isOn: Binding(
                        get: { model.autoScanOnLaunch },
                        set: { model.autoScanOnLaunch = $0 }
                    ))
                    Toggle("Show technical details: detector ids, all evidence, raw diagnostics", isOn: Binding(
                        get: { model.showTechnicalDetails },
                        set: { model.showTechnicalDetails = $0 }
                    ))
                    Toggle("Show ignored findings in the Problems list", isOn: Binding(
                        get: { model.showIgnored },
                        set: { model.showIgnored = $0 }
                    ))
                }

                Section {
                    if let schedule {
                        Toggle(isOn: Binding(
                            get: { schedule.installed },
                            set: { on in
                                Task {
                                    if on { await model.previewSchedule(hour: scheduleHour) } else { await model.previewUnschedule() }
                                }
                            }
                        )) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Take a snapshot every day")
                                if schedule.installed {
                                    Text("At \(String(format: "%02d:%02d", schedule.hour ?? 0, schedule.minute ?? 0)) · \(schedule.loaded ? "active" : "not loaded yet")\(schedule.lastRun.map { " · last run \(Formatters.shortDate($0))" } ?? "")")
                                        .font(.caption).foregroundStyle(.secondary)
                                } else {
                                    Text("\"What changed since yesterday\" needs a snapshot from yesterday. A user launch agent runs the DevDoctor command line tool for about a second; no password, metadata only.")
                                        .font(.caption).foregroundStyle(.secondary)
                                }
                            }
                        }
                        if !schedule.installed {
                            LabeledContent("Time of day") {
                                Picker("Time of day", selection: $scheduleHour) {
                                    ForEach(0..<24, id: \.self) { h in Text(String(format: "%02d:00", h)).tag(h) }
                                }
                                .labelsHidden()
                                .frame(width: 110)
                            }
                            if schedule.availableProgram == nil {
                                Label("The `devdoctor` command line tool was not found in PATH. Install it (`cargo install --path crates/devdoctor-cli`) so launchd has a stable command to run.", systemImage: "exclamationmark.triangle")
                                    .font(.caption).foregroundStyle(.orange)
                            }
                        }
                        ForEach(Array(schedule.notes.enumerated()), id: \.offset) { _, note in
                            Label(note, systemImage: "info.circle").font(.caption).foregroundStyle(.secondary)
                        }
                    } else {
                        LabeledContent("Daily snapshot") { ProgressView().controlSize(.small) }
                    }
                } header: {
                    Text("Daily snapshot")
                }

                Section("Reports") {
                    Text("Create a report to share when asking for help. Home paths are shortened, your username and e-mail addresses are replaced, and anything that looks like a secret is removed.")
                        .font(.caption).foregroundStyle(.secondary)
                    HStack {
                        Button {
                            Task { await copyMarkdown() }
                        } label: { Label("Copy Markdown for a bug report", systemImage: "doc.on.clipboard") }
                        Button {
                            Task { await saveJSON() }
                        } label: { Label("Save full JSON report…", systemImage: "square.and.arrow.down") }
                        if let reportStatus {
                            Text(reportStatus).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    if let markdown {
                        ScrollView {
                            Text(markdown)
                                .font(.system(.caption, design: .monospaced))
                                .textSelection(.enabled)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .frame(height: 220)
                        .padding(8)
                        .background(Color(nsColor: .textBackgroundColor), in: RoundedRectangle(cornerRadius: 8))
                    }
                }

                Section("Privacy & Safety") {
                    SettingsFact(symbol: "lock.shield.fill", title: "Local by default", detail: "Scans, snapshots and history stay on this Mac. No account, no network.")
                    SettingsFact(symbol: "eye.fill", title: "Preview first", detail: "File changes and commands are shown before confirmation.")
                    SettingsFact(symbol: "arrow.uturn.backward.circle.fill", title: "Recorded repairs", detail: "Files are backed up; eligible repairs can be undone from History.")
                }

                Section("Data") {
                    LabeledContent("Local database") {
                        Text(Formatters.shortenHome(EngineClient.shared.dataDirectory.path))
                            .font(.system(.caption, design: .monospaced))
                            .textSelection(.enabled)
                    }
                    Button("Show in Finder") {
                        NSWorkspace.shared.activateFileViewerSelecting([EngineClient.shared.dataDirectory])
                    }
                }

                Section("Engine") {
                    LabeledContent("Status") {
                        StatusPill(
                            text: model.engineAvailable ? "Ready" : "Unavailable",
                            symbol: model.engineAvailable ? "checkmark.circle.fill" : "xmark.circle.fill",
                            color: model.engineAvailable ? .green : .red
                        )
                    }
                    LabeledContent("Version") { Text(model.engineVersion.isEmpty ? "—" : model.engineVersion) }
                    LabeledContent("Command line tool") {
                        Text(EngineClient.shared.engineURL.map { Formatters.shortenHome($0.path) } ?? "not found")
                            .font(.system(.caption, design: .monospaced))
                            .textSelection(.enabled)
                    }
                    LabeledContent("Interface") { Text("Native SwiftUI for macOS 26 · same Rust engine as the CLI") }
                }

                Section("Checks DevDoctor runs (\(model.detectors.count))") {
                    ForEach(model.detectors) { detector in
                        VStack(alignment: .leading, spacing: 2) {
                            HStack {
                                Text(detector.name).font(.callout.weight(.medium))
                                Spacer()
                                Text(detector.modes.isEmpty ? "deep check only" : detector.modes.map { ScanMode(rawValue: $0)?.label ?? $0 }.joined(separator: ", "))
                                    .font(.caption2).foregroundStyle(.secondary)
                            }
                            Text(detector.description).font(.caption).foregroundStyle(.secondary)
                            if model.showTechnicalDetails {
                                Text(detector.id).font(.system(.caption2, design: .monospaced)).foregroundStyle(.tertiary)
                            }
                        }
                        .padding(.vertical, 2)
                    }
                }
            }
            .formStyle(.grouped)
            .frame(maxWidth: 860)
        }
        .task(id: model.refreshToken) { await loadSchedule() }
    }

    private func loadSchedule() async {
        schedule = try? await EngineClient.shared.snapshotSchedule()
        if let hour = schedule?.hour { scheduleHour = hour }
    }

    private func copyMarkdown() async {
        do {
            let text = try await EngineClient.shared.markdownReport()
            markdown = text
            NSPasteboard.general.clearContents()
            NSPasteboard.general.setString(text, forType: .string)
            reportStatus = "Copied to the clipboard."
        } catch {
            model.alertMessage = error.localizedDescription
        }
    }

    private func saveJSON() async {
        do {
            let data = try await EngineClient.shared.reportData()
            let panel = NSSavePanel()
            panel.nameFieldStringValue = "devdoctor-report.json"
            panel.allowedContentTypes = [.json]
            if panel.runModal() == .OK, let url = panel.url {
                try data.write(to: url)
                reportStatus = "Saved \(url.lastPathComponent)."
            }
        } catch {
            model.alertMessage = error.localizedDescription
        }
    }
}

private struct SettingsFact: View {
    let symbol: String
    let title: String
    let detail: String

    var body: some View {
        LabeledContent {
            Text(detail).foregroundStyle(.secondary)
        } label: {
            Label(title, systemImage: symbol)
        }
    }
}
