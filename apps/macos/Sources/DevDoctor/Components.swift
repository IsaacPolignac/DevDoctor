import AppKit
import SwiftUI

extension Color {
    static let devDoctorCanvas = Color(nsColor: NSColor(name: "DevDoctorCanvas") { appearance in
        let isDark = appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
        return isDark
            ? NSColor(srgbRed: 0.070, green: 0.070, blue: 0.078, alpha: 1)
            : NSColor(srgbRed: 0.965, green: 0.965, blue: 0.975, alpha: 1)
    })

    static let devDoctorSurface = Color(nsColor: NSColor(name: "DevDoctorSurface") { appearance in
        let isDark = appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
        return isDark
            ? NSColor(srgbRed: 0.135, green: 0.135, blue: 0.145, alpha: 1)
            : NSColor(srgbRed: 1, green: 1, blue: 1, alpha: 0.94)
    })

    static let devDoctorSurfaceHover = Color(nsColor: NSColor(name: "DevDoctorSurfaceHover") { appearance in
        let isDark = appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
        return isDark
            ? NSColor(srgbRed: 0.175, green: 0.175, blue: 0.190, alpha: 1)
            : NSColor(srgbRed: 1, green: 1, blue: 1, alpha: 1)
    })
}

struct DevDoctorAppIcon: View {
    var size: CGFloat

    private static let iconImage: NSImage? = {
        guard let url = Bundle.module.url(forResource: "AppIcon", withExtension: "png") else {
            return nil
        }
        return NSImage(contentsOf: url)
    }()

    var body: some View {
        Group {
            if let iconImage = Self.iconImage {
                Image(nsImage: iconImage)
                    .resizable()
                    .interpolation(.high)
                    .aspectRatio(contentMode: .fit)
            } else {
                Image(systemName: "cross.case.fill")
                    .resizable()
                    .scaledToFit()
                    .foregroundStyle(.blue)
                    .padding(size * 0.18)
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: size * 0.225, style: .continuous))
        .shadow(color: .black.opacity(0.10), radius: size * 0.045, y: 1)
        .accessibilityLabel(tr("DevDoctor"))
    }
}

struct MaterialPanel<Content: View>: View {
    @Environment(\.colorScheme) private var colorScheme
    var cornerRadius: CGFloat = 18
    var padding: CGFloat = 18
    @ViewBuilder let content: Content

    var body: some View {
        content
            .padding(padding)
            .background(Color.devDoctorSurface, in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .stroke(Color(nsColor: .separatorColor).opacity(0.72), lineWidth: 0.5)
                    .allowsHitTesting(false)
            }
            .shadow(
                color: .black.opacity(colorScheme == .dark ? 0.16 : 0.055),
                radius: colorScheme == .dark ? 2 : 6,
                y: colorScheme == .dark ? 1 : 2
            )
    }
}

struct PageScaffold<Content: View>: View {
    let title: String
    let subtitle: String
    @ViewBuilder let content: Content

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.largeTitle.weight(.semibold))
                    Text(subtitle)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                content
            }
            .padding(.horizontal, 28)
            .padding(.top, 24)
            .padding(.bottom, 32)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Color.devDoctorCanvas)
    }
}

struct InsetPanel<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        content
            .padding(18)
            .background {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Color(nsColor: .controlBackgroundColor))
                    .stroke(.separator.opacity(0.52), lineWidth: 0.5)
            }
    }
}

struct SectionHeading<Trailing: View>: View {
    let title: String
    let detail: String?
    @ViewBuilder let trailing: Trailing

    init(_ title: String, detail: String? = nil, @ViewBuilder trailing: () -> Trailing) {
        self.title = title
        self.detail = detail
        self.trailing = trailing()
    }

    var body: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.headline)
                if let detail {
                    Text(detail).font(.caption).foregroundStyle(.secondary)
                }
            }
            Spacer()
            trailing
        }
    }
}

extension SectionHeading where Trailing == EmptyView {
    init(_ title: String, detail: String? = nil) {
        self.init(title, detail: detail) { EmptyView() }
    }
}

struct StatusPill: View {
    let text: String
    let symbol: String
    let color: Color

    var body: some View {
        Label(text, systemImage: symbol)
            .font(.caption.weight(.medium))
            .foregroundStyle(color)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(color.opacity(0.1), in: Capsule())
            .overlay(Capsule().stroke(color.opacity(0.18), lineWidth: 0.5))
    }
}

struct LoadingPanel: View {
    let title: String

    var body: some View {
        HStack(spacing: 12) {
            ProgressView().controlSize(.small)
            Text(title).foregroundStyle(.secondary)
            Spacer()
        }
        .padding(18)
        .frame(maxWidth: .infinity)
        .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 14))
    }
}

struct DataUnavailableView: View {
    let title: String
    let detail: String
    let symbol: String

    var body: some View {
        ContentUnavailableView {
            Label(title, systemImage: symbol)
        } description: {
            Text(detail)
        }
        .frame(maxWidth: .infinity, minHeight: 260)
    }
}

struct MetricCell: View {
    let value: String
    let label: String
    let symbol: String
    var tint: Color = .secondary

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: symbol)
                .foregroundStyle(tint)
                .frame(width: 22)
            VStack(alignment: .leading, spacing: 1) {
                Text(value)
                    .font(.headline.monospacedDigit())
                Text(label)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 10)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 12)
    }
}

struct FindingTable: View {
    let findings: [FindingRow]
    @Binding var selection: String?

    var body: some View {
        Table(findings, selection: $selection) {
            TableColumn("") { finding in
                Image(systemName: finding.severity.symbol)
                    .foregroundStyle(finding.severity.color)
                    .symbolRenderingMode(.hierarchical)
                    .help(finding.severity.title)
            }
            .width(28)

            TableColumn(tr("Area")) { finding in
                Text(finding.area).fontWeight(.medium)
            }
            .width(min: 70, ideal: 100, max: 140)

            TableColumn(tr("Finding")) { finding in
                Text(finding.title).lineLimit(1)
            }
            .width(min: 180, ideal: 380)

            TableColumn(tr("Confidence")) { finding in
                if let issue = finding.issue {
                    Text(issue.confidenceLabel).foregroundStyle(.secondary)
                } else {
                    Text(tr("Passed")).foregroundStyle(.secondary)
                }
            }
            .width(90)

            TableColumn(tr("Fix")) { finding in
                if let issue = finding.issue, issue.fixerAvailable {
                    Image(systemName: issue.batchSafe ? "wand.and.stars" : "wrench.adjustable")
                        .foregroundStyle(.blue)
                        .help(issue.batchSafe ? tr("Safe fix available") : tr("Fix available after preview"))
                } else if finding.ignored {
                    Image(systemName: "eye.slash").foregroundStyle(.secondary).help(tr("Ignored"))
                }
            }
            .width(36)

            TableColumn(tr("Source")) { finding in
                Text(finding.source)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            .width(min: 90, ideal: 170, max: 240)
        }
        .tableStyle(.inset(alternatesRowBackgrounds: false))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(.separator.opacity(0.55), lineWidth: 0.5)
                .allowsHitTesting(false)
        }
    }
}

struct IssueInspector: View {
    @EnvironmentObject private var model: AppModel
    let glassMode: GlassMode

    init(glassMode: GlassMode = .clear) {
        self.glassMode = glassMode
    }

    var body: some View {
        ScrollView {
            if let finding = model.selectedFinding {
                InspectorFindingContent(finding: finding, glassMode: glassMode)
                    .padding(18)
            } else {
                DataUnavailableView(
                    title: tr("No Result Selected"),
                    detail: tr("Select a diagnostic result to review its evidence."),
                    symbol: "sidebar.right"
                )
            }
        }
        .background(Color(nsColor: .windowBackgroundColor))
    }
}

private struct InspectorFindingContent: View {
    @EnvironmentObject private var model: AppModel
    let finding: FindingRow
    let glassMode: GlassMode

    private var issue: EngineIssue? { finding.issue }

    private var heroSymbol: String {
        let key = "\(finding.area) \(finding.title)".lowercased()
        if finding.severity == .healthy { return "checkmark.seal.fill" }
        if key.contains("link") || key.contains("missing") { return "link.circle.fill" }
        if key.contains("node") || key.contains("npm") { return "shippingbox.fill" }
        if key.contains("terminal") || key.contains("startup") { return "terminal.fill" }
        if key.contains("rust") || key.contains("path") { return "point.3.connected.trianglepath.dotted" }
        if key.contains("process") { return "waveform.path.ecg.rectangle.fill" }
        if key.contains("port") { return "network" }
        if key.contains("xcode") || key.contains("macos") { return "hammer.fill" }
        if key.contains("claude") || key.contains("ai") { return "brain.head.profile.fill" }
        return "wrench.and.screwdriver.fill"
    }

    private var categorySymbol: String {
        let area = finding.area.lowercased()
        if area.contains("runtime") || area.contains("node") || area.contains("python") || area.contains("rust") { return "cube.fill" }
        if area.contains("shell") || area.contains("path") || area.contains("terminal") || area.contains("alias") { return "terminal.fill" }
        if area.contains("process") { return "waveform.path.ecg" }
        if area.contains("port") || area.contains("startup") { return "network" }
        if area.contains("storage") || area.contains("disk") || area.contains("ollama") { return "internaldrive.fill" }
        if area.contains("git") { return "arrow.triangle.branch" }
        if area.contains("ssh") { return "key.fill" }
        return "wrench.and.screwdriver.fill"
    }

    private var glass: Glass {
        glassMode == .clear ? .regular : .regular.tint(finding.severity.color.opacity(0.20))
    }

    private var visibleEvidence: [String] {
        model.showTechnicalDetails ? finding.evidence : Array(finding.evidence.prefix(3))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 10) {
                Image(systemName: categorySymbol)
                    .font(.system(size: 16, weight: .semibold))
                    .symbolRenderingMode(.hierarchical)
                    .foregroundStyle(finding.severity.color)
                    .frame(width: 30, height: 30)
                    .background(finding.severity.color.opacity(0.10), in: RoundedRectangle(cornerRadius: 9, style: .continuous))

                VStack(alignment: .leading, spacing: 1) {
                    Text(finding.area)
                        .font(.subheadline.weight(.semibold))
                    Text(finding.source)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }

                Spacer()

                if let issue {
                    Text(issue.confidenceLabel)
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(.quaternary, in: Capsule())
                        .help(tr("Confidence: %@", "\(issue.confidence)"))
                }

                Label(finding.severity.title, systemImage: finding.severity.symbol)
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(finding.severity.color)
                    .labelStyle(.iconOnly)
                    .padding(7)
                    .background(finding.severity.color.opacity(0.10), in: Circle())
                    .help(issue?.severity.displayName ?? finding.severity.title)
            }

            VStack(spacing: 10) {
                Image(systemName: heroSymbol)
                    .font(.system(size: 45, weight: .semibold))
                    .symbolRenderingMode(.hierarchical)
                    .foregroundStyle(finding.severity.color)
                    .frame(width: 92, height: 92)
                    .glassEffect(glass, in: .circle)
                    .overlay(Circle().stroke(.white.opacity(0.42), lineWidth: 0.8))
                    .shadow(color: finding.severity.color.opacity(0.24), radius: 18, y: 5)

                Text(finding.title)
                    .font(.title3.weight(.semibold))
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)

                if finding.ignored {
                    StatusPill(text: tr("Ignored"), symbol: "eye.slash", color: .secondary)
                }

                if let state = issue?.currentState, !state.isEmpty {
                    Text(state)
                        .font(.system(.caption, design: .monospaced))
                        .foregroundStyle(finding.severity.color)
                        .lineLimit(3)
                        .multilineTextAlignment(.center)
                        .textSelection(.enabled)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(finding.severity.color.opacity(0.08), in: RoundedRectangle(cornerRadius: 7, style: .continuous))
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 4)

            VStack(spacing: 0) {
                InspectorDetailRow(symbol: "info.circle", title: issue == nil ? tr("Result") : tr("Cause"), text: finding.summary)

                if let issue {
                    Divider().padding(.leading, 36)
                    InspectorDetailRow(symbol: "exclamationmark.triangle", title: tr("Impact"), text: issue.impact.isEmpty ? tr("This result may affect the reliability of your development environment.") : issue.impact)
                    Divider().padding(.leading, 36)
                    InspectorDetailRow(symbol: "arrow.trianglehead.2.clockwise.rotate.90", title: tr("Proposed Change"), text: issue.recommendedAction)
                }
            }
            .background(Color.devDoctorSurface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(Color(nsColor: .separatorColor).opacity(0.70), lineWidth: 0.5)
            }

            if !visibleEvidence.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Label(tr("Evidence"), systemImage: "doc.text.magnifyingglass")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                        Spacer()
                        if finding.evidence.count > visibleEvidence.count {
                            Button(tr("Show all %@", "\(finding.evidence.count)")) { model.showTechnicalDetails = true }
                                .buttonStyle(.plain)
                                .font(.caption2)
                                .foregroundStyle(.blue)
                        }
                    }
                    ForEach(visibleEvidence, id: \.self) { line in
                        Text(line)
                            .font(.system(.caption2, design: .monospaced))
                            .textSelection(.enabled)
                            .fixedSize(horizontal: false, vertical: true)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(9)
                            .background(Color(nsColor: .textBackgroundColor).opacity(0.72), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                    }
                }
            }

            if model.showTechnicalDetails, let issue {
                VStack(alignment: .leading, spacing: 6) {
                    Label(tr("Technical details"), systemImage: "chevron.left.forwardslash.chevron.right")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Text(tr("Detector %@ · issue %@ · severity %@ · confidence %@", "\(issue.detectorId)", "\(issue.id)", "\(issue.severity.rawValue)", "\(issue.confidence)"))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .textSelection(.enabled)
                    if let technical = issue.technicalDescription, !technical.isEmpty {
                        MonoBlock(text: technical)
                    }
                    if !issue.affectedCommands.isEmpty {
                        Text(tr("Affected commands: %@", "\(issue.affectedCommands.joined(separator: ", "))"))
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            if let issue {
                if issue.fixerAvailable {
                    Button {
                        Task { await model.previewRepair(issue: issue) }
                    } label: {
                        Label(issue.batchSafe ? tr("Preview Safe Fix") : tr("Preview Fix"), systemImage: "eye.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.glassProminent)
                    .buttonBorderShape(.capsule)
                    .controlSize(.large)
                    .keyboardShortcut(.defaultAction)
                } else {
                    Label(tr("Manual step: follow the proposed change above."), systemImage: "hand.point.right")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                Button {
                    Task { await model.setIgnored(issue, !finding.ignored) }
                } label: {
                    Label(finding.ignored ? tr("Stop Ignoring") : tr("Ignore This Finding"), systemImage: finding.ignored ? "eye" : "eye.slash")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.glass)
                .buttonBorderShape(.capsule)
                .controlSize(.regular)

                Label(
                    issue.reversible
                        ? tr("Backup and rollback included")
                        : (issue.fixerAvailable ? tr("Preview and confirmation required; not reversible") : tr("No change is made without confirmation")),
                    systemImage: issue.reversible ? "lock.rotation" : "lock.shield"
                )
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity)
            }
        }
    }
}

private struct InspectorDetailRow: View {
    let symbol: String
    let title: String
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: symbol)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.secondary)
                .frame(width: 25, height: 25)
                .background(.quaternary, in: RoundedRectangle(cornerRadius: 7, style: .continuous))

            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.caption.weight(.semibold))
                Text(text)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .textSelection(.enabled)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
    }
}

struct InspectorBlock<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 4)
    }
}

struct ScanStatusBar: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        VStack(spacing: 0) {
            Divider()
            HStack(spacing: 8) {
                if model.isScanning {
                    ProgressView().controlSize(.small)
                    Text(model.scanStatusText.isEmpty ? tr("Checking your developer environment…") : model.scanStatusText)
                        .lineLimit(1)
                } else if let scan = model.lastScan {
                    Image(systemName: "checkmark.circle").foregroundStyle(.green)
                    Text(tr("Last scan %@", "\(Formatters.shortDate(scan.finishedAt))"))
                } else {
                    Image(systemName: "lock.shield").foregroundStyle(.secondary)
                    Text(tr("Ready to scan locally"))
                }

                Spacer()

                if model.isScanning {
                    ProgressView(value: model.scanProgress).frame(width: 130)
                } else {
                    Text(tr("Engine runs entirely on this Mac"))
                }
            }
            .font(.caption)
            .foregroundStyle(.secondary)
            .padding(.horizontal, 14)
            .frame(height: 30)
            .background(.bar)
        }
    }
}

struct RepairPreviewSheet: View {
    @EnvironmentObject private var model: AppModel

    private var confirmLabel: String {
        switch model.pendingAction {
        case .clean: tr("Delete")
        case .schedule: tr("Schedule")
        case .unschedule: tr("Stop")
        default: tr("Apply Repair")
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Image(systemName: "wrench.and.screwdriver.fill")
                    .font(.title2)
                    .foregroundStyle(.blue)
                VStack(alignment: .leading, spacing: 2) {
                    Text(tr("Preview Repair")).font(.headline)
                    Text(tr("Review every operation before it is applied."))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if let preview = model.fixPreview {
                    StatusPill(
                        text: preview.risk.capitalized + " risk",
                        symbol: preview.risk == "low" ? "shield.checkered" : "exclamationmark.shield",
                        color: preview.risk == "low" ? .green : (preview.risk == "medium" ? .orange : .red)
                    )
                    StatusPill(
                        text: preview.reversible ? tr("Reversible") : tr("Not reversible"),
                        symbol: preview.reversible ? "arrow.uturn.backward.circle" : "exclamationmark.shield",
                        color: preview.reversible ? .green : .orange
                    )
                }
            }
            .padding(20)

            Divider()

            if let preview = model.fixPreview {
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        VStack(alignment: .leading, spacing: 5) {
                            Text(preview.title).font(.title3.weight(.semibold))
                            Text(preview.summary).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
                        }

                        GroupBox(tr("Operations")) {
                            VStack(alignment: .leading, spacing: 9) {
                                ForEach(Array(preview.operations.enumerated()), id: \.offset) { _, operation in
                                    Label(operation, systemImage: "checkmark.circle")
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                }
                                ForEach(preview.directoriesDeleted) { dir in
                                    Label(tr("%@ — %@, %@ entries", "\(Formatters.shortenHome(dir.path))", "\(Formatters.byteString(dir.bytes))", "\(dir.entries)"), systemImage: "trash")
                                        .font(.system(.caption, design: .monospaced))
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                }
                                ForEach(preview.filesDeleted, id: \.self) { path in
                                    Label(Formatters.shortenHome(path), systemImage: "trash")
                                        .font(.system(.caption, design: .monospaced))
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                }
                                ForEach(preview.commandsExecuted) { command in
                                    Label("\(command.program) \(command.args.joined(separator: " ")) — \(command.description)", systemImage: "terminal")
                                        .font(.system(.caption, design: .monospaced))
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                }
                                ForEach(preview.processesStopped) { process in
                                    Label("pid \(process.pid) \(process.name)", systemImage: "stop.circle")
                                        .font(.system(.caption, design: .monospaced))
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                }
                            }
                            .padding(4)
                        }

                        ForEach(preview.filesModified) { file in
                            VStack(alignment: .leading, spacing: 8) {
                                Label(Formatters.shortenHome(file.path), systemImage: "doc.text")
                                    .font(.caption.weight(.medium))
                                DiffBlock(text: file.diff.isEmpty ? tr("The file contents will be updated.") : file.diff)
                            }
                        }

                        if preview.estimatedDiskSpaceRecovered > 0 {
                            Label(tr("Frees about %@.", "\(Formatters.byteString(preview.estimatedDiskSpaceRecovered))"), systemImage: "internaldrive")
                                .font(.caption)
                        }

                        ForEach(Array(preview.notes.enumerated()), id: \.offset) { _, note in
                            Label(note, systemImage: "info.circle")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }

                        if !preview.validations.isEmpty {
                            VStack(alignment: .leading, spacing: 6) {
                                Text(tr("Verified after applying (automatic rollback on failure)"))
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(.secondary)
                                ForEach(Array(preview.validations.enumerated()), id: \.offset) { _, check in
                                    Label(check, systemImage: "checkmark.shield")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                            }
                        }

                        Label(preview.backupCreated ? tr("Modified files are backed up before the change.") : tr("DevDoctor records the transaction before changing anything."), systemImage: "lock.shield")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding(20)
                }
            } else if let error = model.previewError {
                VStack(spacing: 12) {
                    Image(systemName: "exclamationmark.triangle.fill").font(.title).foregroundStyle(.orange)
                    Text(tr("No fix is available right now")).font(.headline)
                    Text(error).foregroundStyle(.secondary).multilineTextAlignment(.center).frame(maxWidth: 520)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding(20)
            } else {
                LoadingPanel(title: tr("Preparing the repair preview…")).padding(20)
                Spacer()
            }

            Divider()

            HStack {
                Button(tr("Cancel"), role: .cancel) { model.cancelPending() }
                    .keyboardShortcut(.cancelAction)
                Spacer()
                if model.isApplying {
                    ProgressView().controlSize(.small).padding(.trailing, 8)
                }
                Button(confirmLabel) {
                    Task { await model.applyPending() }
                }
                .buttonStyle(.glassProminent)
                .keyboardShortcut(.defaultAction)
                .disabled(model.fixPreview == nil || model.isApplying)
            }
            .padding(16)
        }
        .frame(minWidth: 640, idealWidth: 720, minHeight: 480, idealHeight: 640)
    }
}

/// Shown after a transaction completed: what was done, what was verified, and how to undo it.
struct TransactionResultSheet: View {
    @EnvironmentObject private var model: AppModel
    let transaction: EngineTransaction
    @State private var confirmingUndo = false

    private var color: Color {
        switch transaction.status {
        case "applied": .green
        case "rolled_back": .blue
        default: .orange
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Image(systemName: transaction.status == "applied" ? "checkmark.seal.fill" : (transaction.status == "rolled_back" ? "arrow.uturn.backward.circle.fill" : "exclamationmark.triangle.fill"))
                    .font(.title2)
                    .foregroundStyle(color)
                VStack(alignment: .leading, spacing: 2) {
                    Text(transaction.status == "applied" ? tr("Repair applied") : transaction.statusLabel).font(.headline)
                    Text(transaction.title).font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                StatusPill(text: transaction.statusLabel, symbol: "circle.fill", color: color)
            }
            .padding(20)

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if !transaction.operations.isEmpty {
                        GroupBox(tr("What changed")) {
                            VStack(alignment: .leading, spacing: 8) {
                                ForEach(Array(transaction.operations.enumerated()), id: \.offset) { _, operation in
                                    Label(Formatters.shortenHome(operation.summary), systemImage: operation.isReversible ? "doc.badge.clock" : "bolt")
                                        .font(.caption)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                }
                            }
                            .padding(4)
                        }
                    }
                    if let validation = transaction.validation, !validation.checks.isEmpty {
                        GroupBox(tr("Verified")) {
                            VStack(alignment: .leading, spacing: 8) {
                                ForEach(Array(validation.checks.enumerated()), id: \.offset) { _, check in
                                    HStack(alignment: .top, spacing: 8) {
                                        Image(systemName: check.passed ? "checkmark.circle.fill" : "xmark.circle.fill")
                                            .foregroundStyle(check.passed ? .green : .red)
                                        VStack(alignment: .leading, spacing: 1) {
                                            Text(check.name).font(.caption.weight(.medium))
                                            Text(Formatters.shortenHome(check.detail)).font(.caption2).foregroundStyle(.secondary)
                                        }
                                        Spacer()
                                    }
                                }
                            }
                            .padding(4)
                        }
                    }
                    if transaction.diskSpaceRecovered > 0 {
                        Label(tr("Freed %@.", "\(Formatters.byteString(transaction.diskSpaceRecovered))"), systemImage: "internaldrive").font(.caption)
                    }
                    ForEach(Array(transaction.notes.enumerated()), id: \.offset) { _, note in
                        Label(note, systemImage: "info.circle").font(.caption).foregroundStyle(.secondary)
                    }
                    if let error = transaction.error {
                        Label(error, systemImage: "exclamationmark.triangle").font(.caption).foregroundStyle(.orange)
                    }
                    Text(tr("Transaction %@ · %@", "\(transaction.id)", "\(Formatters.shortDate(transaction.createdAt))"))
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                        .textSelection(.enabled)
                }
                .padding(20)
            }

            Divider()

            HStack {
                if transaction.canRollback {
                    Button(tr("Undo…")) { confirmingUndo = true }
                }
                Spacer()
                Button(tr("Done")) { model.completedTransaction = nil }
                    .buttonStyle(.glassProminent)
                    .keyboardShortcut(.defaultAction)
            }
            .padding(16)
        }
        .frame(minWidth: 560, idealWidth: 620, minHeight: 360, idealHeight: 460)
        .alert(tr("Undo this repair?"), isPresented: $confirmingUndo) {
            Button(tr("Cancel"), role: .cancel) {}
            Button(tr("Restore files"), role: .destructive) {
                Task { await model.rollback(transaction) }
            }
        } message: {
            Text(tr("DevDoctor puts back the %@ file(s) it saved before this repair.", "\(transaction.backups?.count ?? 0)"))
        }
    }
}

// MARK: - Shared helpers

extension View {
    /// Table chrome used on every page: inset style, rounded corners, hairline border.
    func devDoctorTable(minHeight: CGFloat = 320) -> some View {
        self.frame(minHeight: minHeight)
            .tableStyle(.inset(alternatesRowBackgrounds: false))
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(.separator.opacity(0.5), lineWidth: 0.5))
    }
}

struct MonoBlock: View {
    let text: String

    var body: some View {
        ScrollView(.horizontal) {
            Text(text)
                .font(.system(.caption, design: .monospaced))
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(12)
        .background(Color(nsColor: .textBackgroundColor), in: RoundedRectangle(cornerRadius: 8))
    }
}

/// A unified diff with added and removed lines tinted.
struct DiffBlock: View {
    let text: String

    private var lines: [(Int, String)] { Array(text.split(separator: "\n", omittingEmptySubsequences: false).prefix(400).map(String.init).enumerated()) }

    private func color(for line: String) -> Color? {
        if line.hasPrefix("+++") || line.hasPrefix("---") || line.hasPrefix("@@") { return nil }
        if line.hasPrefix("+") { return .green }
        if line.hasPrefix("-") { return .red }
        return nil
    }

    var body: some View {
        ScrollView(.horizontal) {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(lines, id: \.0) { _, line in
                    Text(line.isEmpty ? " " : line)
                        .font(.system(.caption, design: .monospaced))
                        .foregroundStyle(line.hasPrefix("@@") || line.hasPrefix("+++") || line.hasPrefix("---") ? Color.secondary : Color.primary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 6)
                        .background(color(for: line)?.opacity(0.14) ?? .clear)
                }
            }
            .textSelection(.enabled)
        }
        .padding(8)
        .background(Color(nsColor: .textBackgroundColor), in: RoundedRectangle(cornerRadius: 8))
    }
}

struct Callout: View {
    let symbol: String
    let color: Color
    let title: String?
    let text: String

    init(symbol: String, color: Color, title: String? = nil, text: String) {
        self.symbol = symbol
        self.color = color
        self.title = title
        self.text = text
    }

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: symbol).foregroundStyle(color)
            VStack(alignment: .leading, spacing: 2) {
                if let title { Text(title).font(.subheadline.weight(.semibold)) }
                Text(text).font(.caption).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .background(color.opacity(0.08), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

struct KeyValueList: View {
    let rows: [(String, String)]

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(rows.enumerated()), id: \.offset) { index, row in
                HStack(alignment: .top) {
                    Text(row.0).foregroundStyle(.secondary).frame(width: 150, alignment: .leading)
                    Text(row.1).textSelection(.enabled).frame(maxWidth: .infinity, alignment: .leading)
                }
                .font(.callout)
                .padding(.vertical, 6)
                if index < rows.count - 1 { Divider() }
            }
        }
    }
}

struct SectionCard<Content: View>: View {
    let title: String
    let detail: String?
    @ViewBuilder let content: Content

    init(_ title: String, detail: String? = nil, @ViewBuilder content: () -> Content) {
        self.title = title
        self.detail = detail
        self.content = content()
    }

    var body: some View {
        InsetPanel {
            VStack(alignment: .leading, spacing: 12) {
                SectionHeading(title, detail: detail)
                content
            }
        }
    }
}
