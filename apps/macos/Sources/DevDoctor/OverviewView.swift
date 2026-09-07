import AppKit
import SwiftUI

struct OverviewView: View {
    @EnvironmentObject private var model: AppModel
    let glassMode: GlassMode

    private var attentionFindings: [FindingRow] {
        model.findings
            .filter { $0.severity != .healthy }
            .sorted { lhs, rhs in
                let lhsFixable = lhs.issue?.fixerAvailable == true
                let rhsFixable = rhs.issue?.fixerAvailable == true
                if lhsFixable != rhsFixable { return lhsFixable }
                if lhs.severity != rhs.severity { return lhs.severity < rhs.severity }
                return lhs.title < rhs.title
            }
    }

    var body: some View {
        ZStack {
            Color.devDoctorCanvas.ignoresSafeArea()

            VStack(spacing: 0) {
                ScrollView {
                    if model.report == nil {
                        WelcomePanel(glassMode: glassMode)
                            .padding(28)
                    } else {
                        VStack(alignment: .leading, spacing: 16) {
                            OverviewHeader()

                            EnvironmentHealthBar(
                                health: model.report?.health,
                                findings: attentionFindings,
                                glassMode: glassMode
                            )

                            EnvironmentRadarView(
                                categories: model.report?.health.categories ?? [],
                                findings: attentionFindings,
                                health: model.report?.health,
                                detectorRuns: model.report?.detectorRuns ?? [],
                                glassMode: glassMode
                            )
                            .frame(maxWidth: .infinity)

                            AttentionCardsSection(findings: attentionFindings, glassMode: glassMode)

                            if let categories = model.report?.health.categories, !categories.isEmpty {
                                SystemAreasSection(categories: categories, glassMode: glassMode)
                            }
                        }
                        .padding(.horizontal, 28)
                        .padding(.top, 24)
                        .padding(.bottom, 32)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .scrollContentBackground(.hidden)

                ScanStatusBar()
            }
        }
        .inspector(isPresented: Binding(
            get: { model.isInspectorPresented && model.selectedFinding != nil },
            set: { model.isInspectorPresented = $0 }
        )) {
            IssueInspector(glassMode: glassMode)
                .inspectorColumnWidth(min: 320, ideal: 350, max: 390)
        }
    }
}

private struct EnvironmentHealthBar: View {
    @EnvironmentObject private var model: AppModel
    let health: HealthScore?
    let findings: [FindingRow]
    let glassMode: GlassMode

    private var score: Int { health?.score ?? model.lastScan?.healthScore ?? 0 }
    private var issueCount: Int { findings.count }

    private var statusTitle: String {
        if model.isScanning { return tr("Checking your environment") }
        if health?.problems ?? 0 > 0 { return tr("Attention recommended") }
        if issueCount > 0 { return tr("A few items to review") }
        return tr("Your environment is ready")
    }

    private var statusDetail: String {
        if model.isScanning { return tr("Running local checks…") }
        guard let health else { return tr("Run a scan to build your health summary.") }
        if health.problems == 0 && health.warnings == 0 {
            return tr("All active checks passed.")
        }
        switch (health.problems, health.warnings) {
        case (1, 1): return tr("1 problem · 1 warning")
        case (1, _): return tr("1 problem · %@ warnings", "\(health.warnings)")
        case (_, 1): return tr("%@ problems · 1 warning", "\(health.problems)")
        default: return tr("%@ problems · %@ warnings", "\(health.problems)", "\(health.warnings)")
        }
    }

    private var statusColor: Color {
        if model.isScanning { return .blue }
        if health?.problems ?? 0 > 0 { return .orange }
        if issueCount > 0 { return .blue }
        return .green
    }

    var body: some View {
        MaterialPanel(cornerRadius: 20, padding: 14) {
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 16) {
                    healthGauge
                    statusCopy
                    Spacer(minLength: 4)
                    healthMetrics
                    scanControls
                }

                VStack(spacing: 12) {
                    HStack(spacing: 14) {
                        healthGauge
                        statusCopy
                        Spacer(minLength: 0)
                        scanControls
                    }
                    Divider()
                    healthMetrics
                        .frame(maxWidth: .infinity)
                }
            }
        }
    }

    private var healthGauge: some View {
        Gauge(value: Double(score), in: 0...100) {
            Text(tr("Health"))
        } currentValueLabel: {
            Text("\(score)")
                .font(.subheadline.monospacedDigit().weight(.bold))
        }
        .gaugeStyle(.accessoryCircularCapacity)
        .tint(statusColor)
        .frame(width: 58, height: 58)
        .accessibilityLabel(tr("Environment health"))
        .accessibilityValue(tr("%@ percent", "\(score)"))
    }

    private var statusCopy: some View {
        VStack(alignment: .leading, spacing: 3) {
            Label(
                statusTitle,
                systemImage: model.isScanning
                    ? "waveform.path.ecg"
                    : ((health?.problems ?? 0) > 0 ? "exclamationmark.shield.fill" : "checkmark.shield.fill")
            )
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(statusColor)
            .lineLimit(1)

            Text(statusDetail)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
        .frame(minWidth: 180, idealWidth: 210, maxWidth: 210, alignment: .leading)
    }

    private var healthMetrics: some View {
        HStack(spacing: 14) {
            HealthMetric(value: health?.checksPassed ?? 0, label: tr("Passed"), color: .green)
            HealthMetric(value: health?.problems ?? 0, label: tr("Problems"), color: .orange)
            HealthMetric(value: health?.notes ?? 0, label: tr("Notes"), color: .blue)
        }
    }

    private var scanControls: some View {
        GlassEffectContainer(spacing: 10) {
            HStack(spacing: 8) {
                if issueCount > 0 {
                    Button(tr("Review")) {
                        model.selection = .problems
                    }
                    .buttonStyle(.glassProminent)
                    .buttonBorderShape(.capsule)
                    .controlSize(.small)
                }

                Button {
                    Task { await model.runScan() }
                } label: {
                    Image(systemName: model.isScanning ? "progress.indicator" : "arrow.clockwise")
                }
                .buttonStyle(.glass)
                .buttonBorderShape(.circle)
                .controlSize(.small)
                .disabled(model.isScanning)
                .help(model.isScanning ? tr("Scanning") : tr("Scan Again"))
            }
        }
    }
}

private struct HealthMetric: View {
    let value: Int
    let label: String
    let color: Color

    var body: some View {
        VStack(spacing: 1) {
            Text("\(value)")
                .font(.headline.monospacedDigit().weight(.semibold))
                .foregroundStyle(color)
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(minWidth: 42)
        .accessibilityElement(children: .combine)
    }
}

private struct OverviewHeader: View {
    @EnvironmentObject private var model: AppModel

    private var machineName: String {
        Host.current().localizedName ?? tr("This Mac")
    }

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            VStack(alignment: .leading, spacing: 3) {
                Text(tr("Developer Environment"))
                    .font(.largeTitle.weight(.semibold))
                    .tracking(-0.5)

                HStack(spacing: 6) {
                    Text(machineName)
                    Text("·")
                    if let scan = model.lastScan {
                        Text(tr("Updated %@", "\(Formatters.shortDate(scan.finishedAt))"))
                    } else {
                        Text(tr("Ready for a local scan"))
                    }
                }
                .font(.subheadline)
                .foregroundStyle(.secondary)
            }

            Spacer()

            Label(tr("On-device"), systemImage: "lock.shield.fill")
                .font(.caption.weight(.medium))
                .foregroundStyle(.secondary)
                .padding(.horizontal, 11)
                .padding(.vertical, 7)
                .background(.quaternary, in: Capsule())
                .help(tr("Diagnostic data stays on this Mac"))
        }
    }
}

private struct WelcomePanel: View {
    @EnvironmentObject private var model: AppModel
    let glassMode: GlassMode

    private var glass: Glass {
        glassMode == .clear ? .clear : .regular.tint(.blue.opacity(0.18))
    }

    var body: some View {
        MaterialPanel(cornerRadius: 24, padding: 34) {
            VStack(spacing: 24) {
                DevDoctorAppIcon(size: 86)

                VStack(spacing: 8) {
                    Text(tr("Know exactly what is happening on your Mac"))
                        .font(.title2.weight(.semibold))
                    Text(tr("Inspect runtimes, PATH, ports, processes, storage, and local AI. DevDoctor shows every change before it happens."))
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 590)
                }

                HStack(spacing: 26) {
                    WelcomeFact(symbol: "lock.shield", title: tr("Local"), detail: tr("Nothing uploaded"))
                    WelcomeFact(symbol: "eye", title: tr("Transparent"), detail: tr("Evidence included"))
                    WelcomeFact(symbol: "arrow.uturn.backward", title: tr("Reversible"), detail: tr("Rollback ready"))
                }

                Button {
                    Task { await model.runScan() }
                } label: {
                    HStack(spacing: 8) {
                        if model.isScanning {
                            ProgressView()
                                .controlSize(.small)
                        }
                        Text(model.isScanning ? tr("Scanning") : tr("Run First Scan"))
                    }
                }
                .buttonStyle(.glassProminent)
                .buttonBorderShape(.capsule)
                .controlSize(.large)
                .glassEffect(glass.interactive(), in: .capsule)
                .disabled(model.isScanning)
            }
            .frame(maxWidth: .infinity, minHeight: 420)
        }
    }
}

private struct WelcomeFact: View {
    let symbol: String
    let title: String
    let detail: String

    var body: some View {
        HStack(spacing: 9) {
            Image(systemName: symbol)
                .foregroundStyle(.blue)
            VStack(alignment: .leading, spacing: 1) {
                Text(title).font(.subheadline.weight(.medium))
                Text(detail).font(.caption).foregroundStyle(.secondary)
            }
        }
    }
}

private struct RadarArea: Identifiable {
    let id: String
    let title: String
    let symbol: String
    let issues: Int
    let problems: Int
    let checks: Int
    let destination: AppSection

    var color: Color {
        if checks == 0 && issues == 0 { return .secondary }
        if problems > 0 { return .red }
        if issues > 0 { return .orange }
        return .green
    }

    var status: String {
        if checks == 0 && issues == 0 { return tr("Not scanned") }
        if problems > 0 {
            return problems == 1 ? tr("1 conflict") : tr("%@ conflicts", "\(problems)")
        }
        if issues > 0 {
            return issues == 1 ? tr("1 finding") : tr("%@ findings", "\(issues)")
        }
        return tr("All good")
    }
}

private struct EnvironmentRadarView: View {
    @EnvironmentObject private var model: AppModel
    let categories: [CategoryHealth]
    let findings: [FindingRow]
    let health: HealthScore?
    let detectorRuns: [DetectorRun]
    let glassMode: GlassMode

    private var availableFixes: Int {
        findings.filter { $0.issue?.fixerAvailable == true }.count
    }

    private var areas: [RadarArea] {
        let categoryMap = Dictionary(uniqueKeysWithValues: categories.map { ($0.category, $0) })
        let pathFindings = findings.filter { finding in
            let corpus = ([finding.title, finding.summary] + finding.changes).joined(separator: " ").lowercased()
            return corpus.contains("path") || corpus.contains(".zshrc") || corpus.contains(".zprofile")
        }
        let shellPathFindings = pathFindings.filter { $0.area.lowercased().contains("shell") }.count
        let shell = categoryMap["shell"]
        let packageManagers = categoryMap["package_managers"]
        let services = categoryMap["services"]
        let runtimes = categoryMap["runtimes"]
        let disk = categoryMap["disk"]

        return [
            RadarArea(
                id: "shell",
                title: tr("Shell"),
                symbol: "terminal.fill",
                issues: max(0, (shell?.issues ?? 0) - shellPathFindings),
                problems: max(0, (shell?.problems ?? 0) - shellPathFindings),
                checks: shell?.checksRun ?? 0,
                destination: .shell
            ),
            RadarArea(
                id: "packages",
                title: tr("Packages"),
                symbol: "shippingbox.fill",
                issues: packageManagers?.issues ?? 0,
                problems: packageManagers?.problems ?? 0,
                checks: packageManagers?.checksRun ?? 0,
                destination: .packages
            ),
            RadarArea(
                id: "path",
                title: tr("PATH"),
                symbol: "point.topleft.down.to.point.bottomright.curvepath",
                issues: pathFindings.count,
                problems: pathFindings.filter { $0.severity == .attention }.count,
                checks: detectorRuns.filter { $0.id.contains("path") }.count,
                destination: .path
            ),
            RadarArea(
                id: "services",
                title: tr("Services"),
                symbol: "bolt.horizontal.fill",
                issues: services?.issues ?? 0,
                problems: services?.problems ?? 0,
                checks: services?.checksRun ?? 0,
                destination: .services
            ),
            RadarArea(
                id: "runtimes",
                title: tr("Runtimes"),
                symbol: "cube.fill",
                issues: runtimes?.issues ?? 0,
                problems: runtimes?.problems ?? 0,
                checks: runtimes?.checksRun ?? 0,
                destination: .runtimes
            ),
            RadarArea(
                id: "storage",
                title: tr("Storage"),
                symbol: "internaldrive.fill",
                issues: disk?.issues ?? 0,
                problems: disk?.problems ?? 0,
                checks: disk?.checksRun ?? 0,
                destination: .storage
            )
        ]
    }

    var body: some View {
        GeometryReader { proxy in
            let width = proxy.size.width
            let center = CGPoint(x: width / 2, y: 180)
            let diameter = min(310, width * 0.50)
            let nodeRadius = diameter * 0.49

            ZStack {
                RadarRings(diameter: diameter)
                    .position(center)

                ForEach(Array(areas.enumerated()), id: \.element.id) { index, area in
                    let node = nodePosition(index: index, center: center, radius: nodeRadius)
                    let label = labelPosition(index: index, width: width)
                    let isLeft = index == 0 || index == 2 || index == 4
                    let displayColor = model.isScanning ? Color.blue : area.color

                    RadarConnector(
                        from: node,
                        to: label,
                        labelWidth: 132,
                        isLeft: isLeft,
                        color: displayColor
                    )

                    RadarStatusNode(area: area, isScanning: model.isScanning, glassMode: glassMode)
                        .position(node)

                    RadarAreaLabel(area: area, isLeft: isLeft, isScanning: model.isScanning) {
                        model.selection = area.destination
                    }
                    .frame(width: 132)
                    .position(label)
                }

                RadarCenter(
                    health: health,
                    issueCount: findings.count,
                    availableFixes: availableFixes,
                    isScanning: model.isScanning,
                    glassMode: glassMode
                )
                .position(center)
            }
            .accessibilityElement(children: .contain)
        }
        .frame(height: 360)
    }

    private func nodePosition(index: Int, center: CGPoint, radius: CGFloat) -> CGPoint {
        let angle: Double
        switch index {
        case 0: angle = .pi * 1.22
        case 1: angle = .pi * 1.78
        case 2: angle = .pi
        case 3: angle = 0
        case 4: angle = .pi * 0.76
        default: angle = .pi * 0.24
        }
        return CGPoint(
            x: center.x + cos(angle) * radius,
            y: center.y + sin(angle) * radius
        )
    }

    private func labelPosition(index: Int, width: CGFloat) -> CGPoint {
        let leftX: CGFloat = 70
        let rightX = width - 70
        switch index {
        case 0: return CGPoint(x: leftX, y: 56)
        case 1: return CGPoint(x: rightX, y: 56)
        case 2: return CGPoint(x: leftX, y: 180)
        case 3: return CGPoint(x: rightX, y: 180)
        case 4: return CGPoint(x: leftX, y: 305)
        default: return CGPoint(x: rightX, y: 305)
        }
    }
}

private struct RadarRings: View {
    @Environment(\.colorScheme) private var colorScheme
    let diameter: CGFloat

    var body: some View {
        ZStack {
            Circle()
                .fill(
                    AngularGradient(
                        colors: [
                            .blue.opacity(0.16),
                            .cyan.opacity(0.12),
                            .mint.opacity(0.18),
                            .purple.opacity(0.15),
                            .blue.opacity(0.16)
                        ],
                        center: .center
                    )
                )
                .blur(radius: 22)

            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            Color.white.opacity(colorScheme == .dark ? 0.06 : 0.42),
                            Color.cyan.opacity(colorScheme == .dark ? 0.06 : 0.10),
                            Color.blue.opacity(colorScheme == .dark ? 0.04 : 0.06),
                            .clear
                        ],
                        center: .center,
                        startRadius: 12,
                        endRadius: diameter / 2
                    )
                )

            ForEach(1...5, id: \.self) { ring in
                Circle()
                    .fill(Color.white.opacity(colorScheme == .dark ? 0.012 : 0.055))
                    .overlay {
                        Circle()
                            .stroke(
                                Color.white.opacity(colorScheme == .dark ? 0.22 : 0.78),
                                lineWidth: 1
                            )
                    }
                    .overlay {
                        Circle()
                            .stroke(Color.accentColor.opacity(0.055), lineWidth: 4)
                            .blur(radius: 5)
                    }
                    .frame(
                        width: diameter * CGFloat(ring) / 5,
                        height: diameter * CGFloat(ring) / 5
                    )
            }
        }
        .frame(width: diameter, height: diameter)
        .shadow(color: .blue.opacity(colorScheme == .dark ? 0.08 : 0.06), radius: 28)
    }
}

private struct RadarConnector: View {
    let from: CGPoint
    let to: CGPoint
    let labelWidth: CGFloat
    let isLeft: Bool
    let color: Color

    var body: some View {
        Path { path in
            let labelEdge = CGPoint(
                x: to.x + (isLeft ? labelWidth / 2 - 8 : -labelWidth / 2 + 8),
                y: to.y
            )
            let elbow = CGPoint(
                x: from.x + (isLeft ? -18 : 18),
                y: labelEdge.y
            )
            path.move(to: from)
            path.addCurve(
                to: elbow,
                control1: CGPoint(x: from.x + (isLeft ? -9 : 9), y: from.y),
                control2: CGPoint(x: elbow.x, y: labelEdge.y)
            )
            path.addLine(to: labelEdge)
        }
        .stroke(color.opacity(0.62), style: StrokeStyle(lineWidth: 1.2, lineCap: .round, lineJoin: .round))
    }
}

private struct RadarStatusNode: View {
    let area: RadarArea
    let isScanning: Bool
    let glassMode: GlassMode

    private var tint: Color { isScanning ? .blue : area.color }

    private var symbol: String {
        if isScanning { return "ellipsis" }
        if area.checks == 0 && area.issues == 0 { return "minus" }
        return area.issues > 0 ? "exclamationmark" : "checkmark"
    }

    private var glass: Glass {
        glassMode == .clear ? .clear : .regular.tint(tint.opacity(0.24))
    }

    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: 11, weight: .bold))
            .foregroundStyle(.white)
            .frame(width: 27, height: 27)
            .background(tint.gradient, in: Circle())
            .glassEffect(glass, in: .circle)
            .overlay(Circle().stroke(.white.opacity(0.72), lineWidth: 1))
            .shadow(color: tint.opacity(0.30), radius: 8, y: 2)
            .accessibilityHidden(true)
    }
}

private struct RadarAreaLabel: View {
    let area: RadarArea
    let isLeft: Bool
    let isScanning: Bool
    let action: () -> Void

    private var tint: Color { isScanning ? .blue : area.color }
    private var status: String { isScanning ? tr("Scanning") : area.status }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if !isLeft { labelText }

                Image(systemName: area.symbol)
                    .font(.system(size: 13, weight: .semibold))
                    .symbolRenderingMode(.hierarchical)
                    .foregroundStyle(tint)
                    .frame(width: 28, height: 28)
                    .background(tint.opacity(0.10), in: RoundedRectangle(cornerRadius: 8, style: .continuous))

                if isLeft { labelText }
            }
            .frame(maxWidth: .infinity, alignment: isLeft ? .leading : .trailing)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .help(tr("Open %@", "\(area.title)"))
        .accessibilityLabel("\(area.title), \(status)")
    }

    private var labelText: some View {
        VStack(alignment: isLeft ? .leading : .trailing, spacing: 1) {
            Text(area.title)
                .font(.subheadline.weight(.semibold))
            Text(status)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .lineLimit(1)
    }
}

private struct RadarCenter: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let health: HealthScore?
    let issueCount: Int
    let availableFixes: Int
    let isScanning: Bool
    let glassMode: GlassMode

    private var hasProblems: Bool { (health?.problems ?? 0) > 0 }

    private var stateColor: Color {
        if isScanning { return .blue }
        if health == nil { return .secondary }
        if hasProblems { return .red }
        if issueCount > 0 { return .orange }
        return .green
    }

    private var stateSymbol: String {
        if isScanning { return "waveform.path.ecg" }
        if health == nil { return "minus.circle.fill" }
        if hasProblems { return "exclamationmark.shield.fill" }
        if issueCount > 0 { return "info.circle.fill" }
        return "checkmark.seal.fill"
    }

    private var glass: Glass {
        glassMode == .clear ? .clear : .regular.tint(stateColor.opacity(0.18))
    }

    private var title: String {
        if isScanning { return tr("Scanning") }
        if health == nil { return tr("Not scanned") }
        if hasProblems { return tr("Needs Attention") }
        if issueCount > 0 { return tr("Review") }
        return tr("All checks")
    }

    private var value: String {
        if isScanning { return tr("your Mac") }
        if health == nil { return tr("your Mac") }
        if availableFixes > 0 { return availableFixes == 1 ? tr("1 fix") : tr("%@ fixes", "\(availableFixes)") }
        if issueCount > 0 { return issueCount == 1 ? tr("1 finding") : tr("%@ findings", "\(issueCount)") }
        return tr("passed")
    }

    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: stateSymbol)
                .font(.system(size: 27, weight: .semibold))
                .symbolRenderingMode(.hierarchical)
                .foregroundStyle(stateColor)
                .symbolEffect(.pulse, isActive: isScanning && !reduceMotion)
                .contentTransition(.symbolEffect(.replace))

            VStack(spacing: 0) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                Text(value)
                    .font(.title2.monospacedDigit().weight(.semibold))
                    .contentTransition(.numericText())
            }

            if let health {
                Text(tr("%@ of %@ checks passed", "\(health.checksPassed)", "\(health.checksTotal)"))
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
        }
        .frame(width: 152, height: 152)
        .glassEffect(glass, in: .circle)
        .overlay(Circle().stroke(.white.opacity(0.48), lineWidth: 0.8))
        .shadow(color: .black.opacity(0.08), radius: 16, y: 7)
        .accessibilityElement(children: .combine)
        .animation(reduceMotion ? nil : .easeInOut(duration: 0.24), value: isScanning)
        .animation(reduceMotion ? nil : .easeInOut(duration: 0.24), value: value)
    }
}

private struct AttentionCardsSection: View {
    @EnvironmentObject private var model: AppModel
    let findings: [FindingRow]
    let glassMode: GlassMode

    var body: some View {
        MaterialPanel(cornerRadius: 20, padding: 14) {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 8) {
                    Text(model.isScanning ? tr("Checking your environment") : (findings.isEmpty ? tr("Environment Ready") : tr("Needs Attention")))
                        .font(.headline)

                    if !model.isScanning {
                        Text("\(findings.count)")
                            .font(.caption.monospacedDigit().weight(.semibold))
                            .foregroundStyle(.secondary)
                            .padding(.horizontal, 7)
                            .padding(.vertical, 3)
                            .background(.quaternary, in: Capsule())
                    }

                    Spacer()

                    if findings.count > 3 {
                        Button(tr("View All")) {
                            model.selection = .problems
                        }
                        .buttonStyle(.glass)
                        .buttonBorderShape(.capsule)
                        .controlSize(.small)
                    }
                }

                if model.isScanning {
                    HStack(spacing: 12) {
                        ProgressView()
                            .controlSize(.small)
                            .tint(.blue)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(tr("Checking your environment")).font(.subheadline.weight(.semibold))
                            Text(tr("Running local checks…"))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                    }
                    .frame(minHeight: 86)
                } else if findings.isEmpty {
                    HStack(spacing: 12) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.title2)
                            .foregroundStyle(.green)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(tr("No active findings")).font(.subheadline.weight(.semibold))
                            Text(tr("Your development environment passed every active check."))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                    }
                    .frame(minHeight: 86)
                } else {
                    HStack(spacing: 10) {
                        ForEach(Array(findings.prefix(3))) { finding in
                            AttentionFindingCard(
                                finding: finding,
                                isSelected: model.selectedFindingID == finding.id,
                                glassMode: glassMode
                            ) {
                                model.selectedFindingID = finding.id
                                model.isInspectorPresented = true
                            }
                        }
                    }
                }
            }
        }
    }
}

private struct AttentionFindingCard: View {
    @Environment(\.colorScheme) private var colorScheme
    let finding: FindingRow
    let isSelected: Bool
    let glassMode: GlassMode
    let action: () -> Void
    @State private var isHovering = false

    private var symbol: String {
        let key = "\(finding.area) \(finding.title)".lowercased()
        if key.contains("rust") { return "gearshape.2.fill" }
        if key.contains("terminal") || key.contains("startup") { return "terminal.fill" }
        if key.contains("xcode") || key.contains("macos") { return "hammer.fill" }
        if key.contains("claude") || key.contains("ai tools") { return "brain.head.profile.fill" }
        if key.contains("node") || key.contains("npm") { return "shippingbox.fill" }
        if key.contains("path") || key.contains("shell") { return "terminal.fill" }
        if key.contains("port") || key.contains("service") { return "network" }
        if key.contains("process") { return "waveform.path.ecg" }
        if key.contains("python") { return "chevron.left.forwardslash.chevron.right" }
        return "wrench.and.screwdriver.fill"
    }

    private var conciseTitle: String {
        let title = finding.title.lowercased()
        if title.contains("npm") && title.contains("node") { return tr("Node & npm") }
        if title.contains("rust") { return tr("Rust PATH") }
        if title.contains("node.js") && title.contains("different tools") { return tr("Node.js Installs") }
        if title.contains("python") && title.contains("install") { return tr("Python Installs") }
        if title.contains("stale") { return tr("Stale Process") }
        if title.contains("path entry") { return tr("PATH Entry") }
        if title.contains("takes") && title.contains("to start") { return tr("Slow Terminal") }
        if title.contains("not installed") && title.contains("runs") { return tr("Missing Tool at Startup") }
        if title.contains("broken command link") { return tr("Broken Links in PATH") }
        if title.contains("command line tools") { return tr("Xcode Tools") }
        if title.contains("claude code") { return tr("Claude Code") }
        if title.contains("npm install -g") { return tr("npm Permissions") }
        if title.contains("left behind in node") { return tr("Stranded npm Globals") }
        return finding.title
    }

    private var tint: Color { finding.severity.color }

    private var glass: Glass {
        glassMode == .clear ? .clear : .regular.tint(tint.opacity(0.20))
    }

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 9) {
                HStack(alignment: .top) {
                    Image(systemName: symbol)
                        .font(.system(size: 19, weight: .semibold))
                        .symbolRenderingMode(.hierarchical)
                        .foregroundStyle(tint)
                        .frame(width: 39, height: 39)
                        .glassEffect(glass, in: .rect(cornerRadius: 11))

                    Spacer()

                    Image(systemName: finding.issue?.fixerAvailable == true ? "wrench.adjustable.fill" : finding.severity.symbol)
                        .font(.system(size: 13, weight: .semibold))
                        .symbolRenderingMode(.hierarchical)
                        .foregroundStyle(finding.issue?.fixerAvailable == true ? .blue : finding.severity.color)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(conciseTitle)
                        .font(.subheadline.weight(.semibold))
                        .lineLimit(1)
                    richText(finding.summary)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
            }
            .frame(maxWidth: .infinity, minHeight: 92, alignment: .leading)
            .padding(12)
            .background(
                isHovering ? Color.devDoctorSurfaceHover : Color(nsColor: .controlBackgroundColor).opacity(colorScheme == .dark ? 0.62 : 0.78),
                in: RoundedRectangle(cornerRadius: 15, style: .continuous)
            )
            .overlay {
                RoundedRectangle(cornerRadius: 15, style: .continuous)
                    .stroke(
                        isSelected ? Color.accentColor : Color(nsColor: .separatorColor).opacity(0.65),
                        lineWidth: isSelected ? 1.8 : 0.5
                    )
            }
            .shadow(color: isSelected ? Color.accentColor.opacity(0.12) : .clear, radius: 8, y: 2)
            .contentShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
        }
        .buttonStyle(.plain)
        .onHover { hovering in
            withAnimation(.easeOut(duration: 0.15)) { isHovering = hovering }
        }
        .accessibilityLabel("\(conciseTitle), \(finding.severity.title)")
    }
}

private struct SystemAreasSection: View {
    let categories: [CategoryHealth]
    let glassMode: GlassMode

    private let columns = [
        GridItem(.adaptive(minimum: 228, maximum: 300), spacing: 10)
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(tr("System Areas"))
                    .font(.headline)
                Text(tr("Every part of your development environment, at a glance"))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            LazyVGrid(columns: columns, alignment: .leading, spacing: 10) {
                ForEach(categories) { category in
                    SystemAreaTile(category: category, glassMode: glassMode)
                }
            }
        }
    }
}

private struct SystemAreaTile: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.colorScheme) private var colorScheme
    let category: CategoryHealth
    let glassMode: GlassMode
    @State private var isHovering = false

    private var style: SystemAreaStyle { SystemAreaStyle(category: category) }
    private var localizedCategoryLabel: String { tr(category.label) }

    private var statusColor: Color {
        if category.problems > 0 { return .red }
        if category.warnings > 0 { return .orange }
        if category.issues > 0 { return .blue }
        if category.checksRun == 0 { return .secondary }
        return .green
    }

    private var statusText: String {
        if category.problems > 0 {
            return category.problems == 1 ? tr("1 problem") : tr("%@ problems", "\(category.problems)")
        }
        if category.issues > 0 {
            return category.issues == 1 ? tr("1 finding") : tr("%@ findings", "\(category.issues)")
        }
        if category.checksRun == 0 { return tr("Not scanned") }
        return category.checksRun == 1 ? tr("1 check passed") : tr("%@ checks passed", "\(category.checksRun)")
    }

    private var glass: Glass {
        glassMode == .clear ? .clear : .regular.tint(style.tint.opacity(0.20))
    }

    var body: some View {
        Button {
            model.selection = style.destination
        } label: {
            HStack(spacing: 11) {
                Image(systemName: style.symbol)
                    .font(.system(size: 16, weight: .semibold))
                    .symbolRenderingMode(.hierarchical)
                    .foregroundStyle(style.tint)
                    .frame(width: 38, height: 38)
                    .glassEffect(glass, in: .rect(cornerRadius: 11))

                VStack(alignment: .leading, spacing: 2) {
                    Text(localizedCategoryLabel)
                        .font(.subheadline.weight(.semibold))
                        .lineLimit(1)
                    Text(statusText)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }

                Spacer(minLength: 4)

                Image(
                    systemName: category.issues > 0
                        ? (category.problems > 0 ? "exclamationmark.circle.fill" : "info.circle.fill")
                        : (category.checksRun == 0 ? "minus.circle" : "checkmark.circle.fill")
                )
                .font(.system(size: 13, weight: .semibold))
                .symbolRenderingMode(.hierarchical)
                .foregroundStyle(statusColor)
            }
            .frame(maxWidth: .infinity, minHeight: 50, alignment: .leading)
            .padding(11)
            .background(
                isHovering ? Color.devDoctorSurfaceHover : Color.devDoctorSurface,
                in: RoundedRectangle(cornerRadius: 15, style: .continuous)
            )
            .overlay {
                RoundedRectangle(cornerRadius: 15, style: .continuous)
                    .stroke(
                        isHovering ? style.tint.opacity(0.48) : Color(nsColor: .separatorColor).opacity(0.68),
                        lineWidth: isHovering ? 1 : 0.5
                    )
            }
            .shadow(
                color: .black.opacity(colorScheme == .dark ? 0.13 : 0.045),
                radius: isHovering ? 7 : 3,
                y: 2
            )
            .contentShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
        }
        .buttonStyle(.plain)
        .onHover { hovering in
            withAnimation(.easeOut(duration: 0.15)) { isHovering = hovering }
        }
        .help(tr("Open %@", "\(localizedCategoryLabel)"))
        .accessibilityLabel("\(localizedCategoryLabel), \(statusText)")
    }
}

private struct SystemAreaStyle {
    let symbol: String
    let tint: Color
    let destination: AppSection

    init(category: CategoryHealth) {
        let key = "\(category.category) \(category.label)".lowercased()
        if key.contains("shell") {
            symbol = "terminal.fill"
            tint = .blue
            destination = .shell
        } else if key.contains("runtime") {
            symbol = "cube.fill"
            tint = .orange
            destination = .runtimes
        } else if key.contains("package") {
            symbol = "archivebox.fill"
            tint = .indigo
            destination = .packages
        } else if key.contains("process") {
            symbol = "waveform.path.ecg.rectangle.fill"
            tint = .mint
            destination = .processes
        } else if key.contains("port") {
            symbol = "globe"
            tint = .cyan
            destination = .ports
        } else if key.contains("ai") {
            symbol = "brain.head.profile.fill"
            tint = .purple
            destination = .localAI
        } else if key.contains("disk") || key.contains("storage") {
            symbol = "internaldrive.fill"
            tint = .blue
            destination = .storage
        } else if key.contains("git") {
            symbol = "arrow.triangle.branch"
            tint = .orange
            destination = .git
        } else if key.contains("ssh") {
            symbol = "lock.shield.fill"
            tint = .green
            destination = .ssh
        } else if key.contains("container") {
            symbol = "shippingbox.circle.fill"
            tint = .purple
            destination = .processes
        } else if key.contains("environment") {
            symbol = "slider.horizontal.3"
            tint = .cyan
            destination = .shell
        } else if key.contains("service") {
            symbol = "bolt.horizontal.circle.fill"
            tint = .teal
            destination = .services
        } else {
            symbol = "wrench.and.screwdriver.fill"
            tint = .blue
            destination = .problems
        }
    }
}
