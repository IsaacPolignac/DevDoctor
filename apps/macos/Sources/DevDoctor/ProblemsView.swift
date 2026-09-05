import SwiftUI

struct ProblemsView: View {
    @EnvironmentObject private var model: AppModel
    @State private var level: LevelFilter = .all
    /// Sentinel for the area filter; displayed as "All areas".
    private static let allAreas = "*"
    @State private var area = ProblemsView.allAreas
    @State private var showingSafeFixes = false

    private var areas: [String] {
        [ProblemsView.allAreas] + Array(Set(model.findings.filter { $0.issue != nil }.map(\.area))).sorted()
    }

    private var rows: [FindingRow] {
        model.findings.filter { finding in
            let levelOK: Bool = switch level {
            case .all: finding.severity != .healthy
            case .attention: finding.severity == .attention
            case .recommendation: finding.severity == .recommendation
            case .healthy: finding.severity == .healthy
            }
            return levelOK && (area == ProblemsView.allAreas || finding.area == area)
        }
    }

    private var problemCount: Int { model.issueRecords.filter { !$0.ignored && $0.issue.severity >= .medium }.count }
    private var noteCount: Int { model.issueRecords.filter { !$0.ignored && $0.issue.severity < .medium }.count }

    var body: some View {
        VStack(spacing: 0) {
            PageScaffold(title: tr("Problems"), subtitle: AppSection.problems.blurb) {
                HStack(spacing: 10) {
                    StatusPill(text: tr("%@ need attention", "\(problemCount)"), symbol: "exclamationmark.triangle.fill", color: problemCount > 0 ? .orange : .green)
                    StatusPill(text: noteCount == 1 ? tr("1 recommendation") : tr("%@ recommendations", "\(noteCount)"), symbol: "info.circle.fill", color: .blue)
                    if model.issueRecords.contains(where: \.ignored) {
                        Toggle(tr("Show ignored"), isOn: $model.showIgnored).toggleStyle(.checkbox).font(.caption)
                    }
                    Spacer()
                    if model.safeFixCount > 0 {
                        Button {
                            showingSafeFixes = true
                        } label: {
                            Label(tr("Fix %@ safely…", "\(model.safeFixCount)"), systemImage: "wand.and.stars")
                        }
                        .buttonStyle(.glassProminent)
                        .help(tr("Apply every reversible, verified, low-risk fix in one go, after a preview"))
                    }
                }

                HStack(spacing: 10) {
                    Picker(tr("Level"), selection: $level) {
                        ForEach(LevelFilter.allCases) { item in Text(item.title(model)).tag(item) }
                    }
                    .labelsHidden()
                    .pickerStyle(.segmented)
                    .frame(maxWidth: 460)
                    Spacer(minLength: 8)
                    Picker(tr("Area"), selection: $area) {
                        ForEach(areas, id: \.self) { Text($0 == ProblemsView.allAreas ? tr("All areas") : $0).tag($0) }
                    }
                    .labelsHidden()
                    .frame(width: 150)
                }

                if rows.isEmpty {
                    DataUnavailableView(
                        title: level == .healthy ? tr("No Passed Checks Yet") : tr("Nothing Here"),
                        detail: model.report == nil ? tr("Run a scan to check runtimes, shell configuration, and local developer tools.") : tr("No result matches this filter."),
                        symbol: "checkmark.circle"
                    )
                } else {
                    FindingTable(findings: rows, selection: $model.selectedFindingID)
                        .frame(minHeight: 450)
                }
            }

            ScanStatusBar()
        }
        .inspector(isPresented: $model.isInspectorPresented) {
            IssueInspector()
                .inspectorColumnWidth(min: 280, ideal: 320, max: 380)
        }
        .sheet(isPresented: $showingSafeFixes) {
            SafeFixSheet()
        }
    }
}

private enum LevelFilter: String, CaseIterable, Identifiable {
    case all, attention, recommendation, healthy
    var id: String { rawValue }

    @MainActor
    func title(_ model: AppModel) -> String {
        let count: (FindingSeverity) -> Int = { level in model.findings.filter { $0.severity == level }.count }
        switch self {
        case .all: return tr("All")
        case .attention: return tr("Attention %@", "\(count(.attention))")
        case .recommendation: return tr("Advice %@", "\(count(.recommendation))")
        case .healthy: return tr("Healthy %@", "\(count(.healthy))")
        }
    }
}

/// Batch "Fix safe issues": every preview is shown before anything runs.
struct SafeFixSheet: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var previews: [FixPreview] = []
    @State private var results: [BatchFixResult] = []
    @State private var isLoading = true
    @State private var isApplying = false
    @State private var error: String?

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Image(systemName: "wand.and.stars").font(.title2).foregroundStyle(.blue)
                VStack(alignment: .leading, spacing: 2) {
                    Text(tr("Fix safe issues")).font(.headline)
                    Text(tr("Only reversible, verified, low-risk fixes. Each file is backed up and every change is validated; anything that fails is rolled back automatically."))
                        .font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
            }
            .padding(20)
            Divider()
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if let error { Callout(symbol: "exclamationmark.triangle", color: .orange, text: error) }
                    if !results.isEmpty {
                        ForEach(results) { result in
                            HStack(alignment: .top, spacing: 10) {
                                Image(systemName: result.ok ? "checkmark.circle.fill" : "xmark.circle.fill").foregroundStyle(result.ok ? .green : .red)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(result.transaction?.title ?? previews.first { $0.issueId == result.issueId }?.title ?? result.issueId).font(.callout.weight(.medium))
                                    if let error = result.error { Text(error).font(.caption).foregroundStyle(.secondary) }
                                    if let tx = result.transaction, let validation = tx.validation {
                                        Text(validation.checks.map { "\($0.passed ? "✓" : "✗") \($0.name)" }.joined(separator: " · ")).font(.caption2).foregroundStyle(.secondary)
                                    }
                                }
                                Spacer()
                            }
                        }
                    } else if isLoading {
                        LoadingPanel(title: tr("Preparing previews…"))
                    } else if previews.isEmpty {
                        Text(tr("No safe fixes are available right now.")).foregroundStyle(.secondary)
                    } else {
                        ForEach(previews) { preview in
                            VStack(alignment: .leading, spacing: 8) {
                                Text(preview.title).font(.subheadline.weight(.semibold))
                                Text(preview.summary).font(.caption).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
                                ForEach(Array(preview.operations.enumerated()), id: \.offset) { _, op in
                                    Label(op, systemImage: "checkmark.circle").font(.caption)
                                }
                                ForEach(preview.filesModified) { file in
                                    DiffBlock(text: file.diff)
                                }
                            }
                            .padding(12)
                            .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 12))
                        }
                    }
                }
                .padding(20)
            }
            Divider()
            HStack {
                Button(results.isEmpty ? tr("Cancel") : tr("Done")) { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Spacer()
                if results.isEmpty {
                    if isApplying { ProgressView().controlSize(.small).padding(.trailing, 8) }
                    Button(previews.count == 1 ? tr("Apply 1 fix") : tr("Apply %@ fixes", "\(previews.count)")) {
                        Task { await apply() }
                    }
                    .buttonStyle(.glassProminent)
                    .keyboardShortcut(.defaultAction)
                    .disabled(previews.isEmpty || isLoading || isApplying)
                }
            }
            .padding(16)
        }
        .frame(minWidth: 660, idealWidth: 740, minHeight: 480, idealHeight: 640)
        .task { await load() }
    }

    private func load() async {
        isLoading = true
        do {
            previews = try await EngineClient.shared.safeFixPreviews()
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    private func apply() async {
        isApplying = true
        results = await model.applySafeFixes()
        isApplying = false
    }
}

struct SearchResultsView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        PageScaffold(
            title: tr("Search"),
            subtitle: tr("Results for “%@”", "\(model.searchQuery)")
        ) {
            if model.searchResults.isEmpty {
                DataUnavailableView(
                    title: tr("No Results"),
                    detail: tr("Try a tool name, problem, check, runtime, or section."),
                    symbol: "magnifyingglass"
                )
            } else {
                List(model.searchResults) { result in
                    Button {
                        model.open(result)
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: result.symbol)
                                .frame(width: 22)
                                .foregroundStyle(.secondary)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(result.title).foregroundStyle(.primary)
                                Text(result.subtitle).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                            }
                            Spacer()
                            Image(systemName: "chevron.right").foregroundStyle(.tertiary)
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .padding(.vertical, 5)
                }
                .listStyle(.inset)
                .frame(minHeight: 430)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(.separator.opacity(0.5), lineWidth: 0.5))
            }
        }
    }
}
