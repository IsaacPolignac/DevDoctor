import AppKit
import SwiftUI

enum AppSection: String, CaseIterable, Identifiable {
    case overview = "Overview"
    case problems = "Problems"
    case shell = "Shell"
    case path = "PATH Explorer"
    case runtimes = "Runtimes"
    case packages = "Packages"
    case tools = "Developer Tools"
    case processes = "Processes"
    case ports = "Ports"
    case services = "Startup Items"
    case storage = "Developer Storage"
    case localAI = "Local AI"
    case git = "Git"
    case ssh = "SSH"
    case changes = "What Changed"
    case history = "History"
    case settings = "Settings"

    var id: String { rawValue }

    /// Localised name shown in the sidebar, titles and search.
    var title: String { tr(rawValue) }

    var symbol: String {
        switch self {
        case .overview: "square.grid.2x2"
        case .problems: "exclamationmark.triangle"
        case .shell: "terminal"
        case .path: "point.topleft.down.to.point.bottomright.curvepath"
        case .runtimes: "shippingbox"
        case .packages: "archivebox"
        case .tools: "wrench.and.screwdriver"
        case .processes: "waveform.path.ecg"
        case .ports: "cable.connector"
        case .services: "bolt.horizontal"
        case .storage: "internaldrive"
        case .localAI: "cpu"
        case .git: "arrow.triangle.branch"
        case .ssh: "key"
        case .changes: "arrow.left.arrow.right"
        case .history: "clock.arrow.trianglehead.counterclockwise.rotate.90"
        case .settings: "gearshape"
        }
    }

    /// One-line description shown under page titles.
    var blurb: String {
        switch self {
        case .overview: tr("Health of your development environment at a glance.")
        case .problems: tr("Review what was found before deciding whether to change anything.")
        case .shell: tr("The files your terminal runs at startup, what they change, and how long they take.")
        case .path: tr("See the exact lookup order and discover which executable wins.")
        case .runtimes: tr("Node.js, Python and Rust installations, and whether node/npm and python/pip agree.")
        case .packages: tr("Homebrew, npm, pip, uv, cargo and friends.")
        case .tools: tr("AI coding agents, editors, containers and Git tooling, with how each was installed.")
        case .processes: tr("Development processes grouped with their project, resources, and listening ports.")
        case .ports: tr("Understand which local service owns each listening port.")
        case .services: tr("Programs macOS starts for you at login.")
        case .storage: tr("Caches, build products, dependencies and models taking disk space.")
        case .localAI: tr("Ollama and other locally stored AI models. Nothing is sent anywhere.")
        case .git: tr("Your global Git identity and settings. Passwords and tokens are never read.")
        case .ssh: tr("Keys, permissions and configuration. Never their contents.")
        case .changes: tr("What was installed, removed or edited between two snapshots, and what each recorded install did.")
        case .history: tr("A local audit trail of scans, repairs, recorded runs and rollback points.")
        case .settings: tr("Choose how DevDoctor looks, scans, and presents technical detail.")
        }
    }
}

enum AppearanceMode: String, CaseIterable, Identifiable {
    case system = "System"
    case light = "Light"
    case dark = "Dark"

    var id: String { rawValue }
    var title: String { tr(rawValue) }

    var colorScheme: ColorScheme? {
        switch self {
        case .system: nil
        case .light: .light
        case .dark: .dark
        }
    }

    var symbol: String {
        switch self {
        case .system: "circle.lefthalf.filled"
        case .light: "sun.max"
        case .dark: "moon"
        }
    }
}

enum GlassMode: String, CaseIterable, Identifiable {
    case clear = "Clear"
    case tinted = "Tinted"

    var id: String { rawValue }
    var title: String { tr(rawValue) }
}

enum FindingSeverity: Int, Comparable, Hashable {
    case attention = 0
    case recommendation = 1
    case healthy = 2

    static func < (lhs: FindingSeverity, rhs: FindingSeverity) -> Bool {
        lhs.rawValue < rhs.rawValue
    }

    var title: String {
        switch self {
        case .attention: tr("Needs Attention")
        case .recommendation: tr("Recommendation")
        case .healthy: tr("Healthy")
        }
    }

    var symbol: String {
        switch self {
        case .attention: "exclamationmark.triangle.fill"
        case .recommendation: "info.circle.fill"
        case .healthy: "checkmark.circle.fill"
        }
    }

    var color: Color {
        switch self {
        case .attention: .orange
        case .recommendation: .blue
        case .healthy: .green
        }
    }
}

struct FindingRow: Identifiable, Hashable {
    let id: String
    let severity: FindingSeverity
    let area: String
    let title: String
    let source: String
    let summary: String
    let evidence: [String]
    let changes: [String]
    let issue: EngineIssue?
    let ignored: Bool

    init(record: IssueRecord) {
        let issue = record.issue
        id = issue.id
        severity = issue.severity.findingLevel
        area = FindingRow.area(for: issue.detectorId, category: issue.category)
        title = issue.title
        source = Formatters.detectorName(issue.detectorId)
        summary = issue.description
        evidence = issue.evidence + issue.affectedFiles.map { file in
            file.line.map { "\(Formatters.shortenHome(file.path)):\($0)" } ?? Formatters.shortenHome(file.path)
        }
        changes = [issue.recommendedAction]
        self.issue = issue
        ignored = record.ignored
    }

    init(healthy run: DetectorRun) {
        id = "healthy:\(run.id)"
        severity = .healthy
        area = FindingRow.area(for: run.id, category: run.category)
        title = FindingRow.healthyTitle(for: run.id) ?? tr("%@: nothing found", "\(run.name)")
        source = run.name
        summary = tr("The \"%@\" check ran in %@ ms and found nothing to report.", "\(run.name)", "\(run.durationMs)")
        evidence = []
        changes = []
        issue = nil
        ignored = false
    }

    /// Short area name derived from the detector id, as in the CLI's plain-language layer.
    static func area(for detectorId: String, category: String) -> String {
        let parts = detectorId.split(separator: ".").map(String.init)
        let head = parts.first ?? ""
        let second = parts.count > 1 ? parts[1] : ""
        switch (head, second) {
        case ("shell", "path"): return tr("PATH")
        case ("shell", "alias"): return tr("Aliases")
        case ("shell", "startup"): return tr("Terminal")
        case ("shell", _): return tr("Shell")
        case ("python", _): return tr("Python")
        case ("node", _): return tr("Node.js")
        case ("rust", _): return tr("Rust")
        case ("homebrew", _): return tr("Homebrew")
        case ("process", _): return tr("Processes")
        case ("port", _): return tr("Ports")
        case ("disk", "ollama"): return tr("Ollama")
        case ("disk", _): return tr("Storage")
        case ("service", _): return tr("Startup")
        case ("ssh", _): return tr("SSH")
        case ("git", _): return tr("Git")
        case ("env", _): return tr("Environment")
        case ("macos", _): return tr("macOS")
        case ("ai", _): return tr("AI tools")
        default: return Formatters.category(category)
        }
    }

    static func healthyTitle(for detectorId: String) -> String? {
        let titles: [String: String] = [
            "shell.zsh.syntax": tr("Startup files parse correctly"),
            "shell.path.duplicate": tr("PATH has no duplicate entries"),
            "shell.path.missing_directory": tr("Every PATH entry exists"),
            "shell.path.suspicious_entry": tr("No empty, relative or world-writable PATH entry"),
            "shell.path.dangling_symlinks": tr("No broken command links in PATH"),
            "shell.source.missing_file": tr("Every sourced file exists"),
            "shell.source.recursive": tr("Startup files do not source each other in a loop"),
            "shell.source.duplicate": tr("No file is sourced twice at startup"),
            "shell.startup.errors": tr("Nothing prints an error when a terminal opens"),
            "shell.startup.slow": tr("New terminals start quickly"),
            "shell.alias.shadow": tr("No alias replaces a developer command"),
            "env.var.missing_path": tr("Tool variables point to existing folders"),
            "python.interpreter.multiple": tr("python and python3 agree"),
            "python.pip.mismatch": tr("pip installs into the Python you run"),
            "node.multiple_installations": tr("One Node.js installation method"),
            "node.npm.mismatch": tr("npm belongs to the active Node.js"),
            "node.npm.global_prefix_not_writable": tr("npm can install global packages without sudo"),
            "node.npm.stranded_globals": tr("Global npm packages follow the active Node.js version"),
            "ai.claude_code.duplicate_install": tr("Claude Code is installed once"),
            "rust.cargo_bin.not_in_path": tr("Rust tools are reachable"),
            "macos.xcode_clt": tr("Xcode Command Line Tools are installed"),
            "homebrew.health": tr("Homebrew installation is healthy"),
            "homebrew.doctor": tr("brew doctor reports no warnings"),
            "process.dev.stale": tr("No abandoned development process"),
            "port.dev.occupied": tr("No stale development server holds a port"),
            "disk.homebrew.cache": tr("Homebrew cache is small"),
            "disk.npm.cache": tr("npm cache is small"),
            "disk.pip.cache": tr("pip cache is small"),
            "disk.uv.cache": tr("uv cache is small"),
            "disk.ollama.models": tr("Ollama models take little space"),
            "disk.venv.broken": tr("Virtual environments are usable"),
            "disk.node_modules.stale": tr("No large node_modules in inactive projects"),
            "service.brew.running": tr("No Homebrew service starts at login"),
            "service.launchagent.broken": tr("Startup items point to existing programs"),
            "ssh.permissions": tr("SSH files have safe permissions"),
            "ssh.config": tr("SSH configuration is consistent"),
            "git.identity": tr("Git identity is configured"),
        ]
        return titles[detectorId]
    }
}

struct SearchResult: Identifiable, Hashable {
    let id: String
    let title: String
    let subtitle: String
    let symbol: String
    let section: AppSection
    let findingID: String?
}

enum ScanMode: String {
    case quick, deep, storage

    var label: String {
        switch self {
        case .quick: tr("quick check")
        case .deep: tr("deep check")
        case .storage: tr("disk space check")
        }
    }
}

/// A change the user is about to confirm: the preview sheet shows `fixPreview`, and
/// `applyPending` performs the matching engine command.
enum PendingAction: Equatable {
    case fix(issueID: String)
    case clean(CleanTarget)
    case schedule(hour: Int)
    case unschedule

    static func == (lhs: PendingAction, rhs: PendingAction) -> Bool {
        switch (lhs, rhs) {
        case (.fix(let a), .fix(let b)): a == b
        case (.clean(let a), .clean(let b)): a.arguments == b.arguments
        case (.schedule(let a), .schedule(let b)): a == b
        case (.unschedule, .unschedule): true
        default: false
        }
    }
}

@MainActor
final class AppModel: ObservableObject {
    @Published var selection: AppSection? = AppModel.initialSection
    @Published var selectedFindingID: String?

    /// `DevDoctor --section shell` opens on a given page (QA and deep links).
    private static var initialSection: AppSection {
        let arguments = CommandLine.arguments
        guard let index = arguments.firstIndex(of: "--section"), index + 1 < arguments.count else { return .overview }
        let wanted = arguments[index + 1].lowercased()
        return AppSection.allCases.first { $0.rawValue.lowercased() == wanted || String(describing: $0).lowercased() == wanted } ?? .overview
    }
    @Published var isInspectorPresented = true
    @Published var isScanning = false
    @Published var scanProgress = 0.0
    @Published var scanStatusText = ""
    @Published var scanMode: ScanMode = .quick
    @Published var report: ScanReport?
    @Published var issueRecords: [IssueRecord] = []
    @Published var history = HistoryEnvelope()
    @Published var detectors: [DetectorMeta] = []
    @Published var storageReport: StorageReport?
    @Published var pendingAction: PendingAction?
    @Published var fixPreview: FixPreview?
    @Published var previewError: String?
    @Published var showingRepairPreview = false
    @Published var isApplying = false
    @Published var completedTransaction: EngineTransaction?
    @Published var alertMessage: String?
    @Published var searchQuery = ""
    @Published var engineAvailable = false
    @Published var engineVersion = ""
    @Published var bootstrapped = false
    /// Bumped after every state-changing engine call so pages can reload.
    @Published var refreshToken = 0

    @AppStorage("autoScanOnLaunch") var autoScanOnLaunch = true
    @AppStorage("showTechnicalDetails") var showTechnicalDetails = false
    @AppStorage("showIgnoredFindings") var showIgnored = false

    var openIssueCount: Int { issueRecords.filter { !$0.ignored }.count }

    var findings: [FindingRow] {
        let problems = issueRecords
            .filter { showIgnored || !$0.ignored }
            .map(FindingRow.init(record:))
            .sorted { lhs, rhs in
                if lhs.severity != rhs.severity { return lhs.severity < rhs.severity }
                let ls = lhs.issue?.severity ?? .info, rs = rhs.issue?.severity ?? .info
                if ls != rs { return ls > rs }
                return lhs.title < rhs.title
            }
        let reported = Set(issueRecords.map(\.issue.detectorId))
        let healthy = (report?.detectorRuns ?? [])
            .filter { $0.status == "ok" && !reported.contains($0.id) }
            .map(FindingRow.init(healthy:))
        return problems + healthy
    }

    var selectedFinding: FindingRow? { findings.first { $0.id == selectedFindingID } }
    var selectedIssue: EngineIssue? { selectedFinding?.issue }
    var lastScan: ScanSummary? { history.scans.first }
    var needsOnboarding: Bool { !isScanning && report == nil && history.scans.isEmpty }
    var safeFixCount: Int { issueRecords.filter { !$0.ignored && $0.issue.batchSafe && $0.issue.fixerAvailable }.count }

    private var preferredFindingID: String? {
        findings.first(where: { $0.issue?.fixerAvailable == true })?.id ?? findings.first?.id
    }

    var searchResults: [SearchResult] {
        let query = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return [] }
        let sections = AppSection.allCases.compactMap { section -> SearchResult? in
            guard section.title.localizedCaseInsensitiveContains(query) || section.rawValue.localizedCaseInsensitiveContains(query) || section.blurb.localizedCaseInsensitiveContains(query) else { return nil }
            return SearchResult(id: "section:\(section.id)", title: section.title, subtitle: tr("Open section"), symbol: section.symbol, section: section, findingID: nil)
        }
        let issues = findings.compactMap { finding -> SearchResult? in
            let corpus = [finding.title, finding.area, finding.summary, finding.source].joined(separator: " ")
            guard corpus.localizedCaseInsensitiveContains(query) else { return nil }
            return SearchResult(id: "finding:\(finding.id)", title: finding.title, subtitle: finding.area, symbol: finding.severity.symbol, section: finding.issue == nil ? .overview : .problems, findingID: finding.id)
        }
        let checks = detectors.compactMap { detector -> SearchResult? in
            guard detector.name.localizedCaseInsensitiveContains(query) || detector.id.localizedCaseInsensitiveContains(query) else { return nil }
            return SearchResult(id: "detector:\(detector.id)", title: detector.name, subtitle: tr("Check · %@", "\(detector.description)"), symbol: "checklist", section: .settings, findingID: nil)
        }
        return sections + issues + checks
    }

    // MARK: Lifecycle

    func bootstrap() async {
        guard !bootstrapped else { return }
        engineAvailable = await EngineClient.shared.isAvailable
        bootstrapped = true
        guard engineAvailable else {
            alertMessage = EngineError.missingEngine.localizedDescription
            return
        }
        engineVersion = (try? await EngineClient.shared.version()) ?? ""
        detectors = (try? await EngineClient.shared.detectors()) ?? []
        await refreshState()
        if report == nil, let last = try? await EngineClient.shared.lastReport() {
            report = last
        }
        let stale: Bool = {
            guard let last = lastScan, let date = Formatters.date(last.startedAt) else { return true }
            return Date().timeIntervalSince(date) > 3600
        }()
        if history.scans.isEmpty || (autoScanOnLaunch && stale) {
            await runScan(audible: false)
        } else if selectedFindingID == nil {
            selectedFindingID = preferredFindingID
        }
    }

    func refreshState() async {
        do {
            issueRecords = try await EngineClient.shared.issues(includeIgnored: true)
            history = try await EngineClient.shared.history()
            if selectedFindingID == nil || !findings.contains(where: { $0.id == selectedFindingID }) {
                selectedFindingID = preferredFindingID
            }
            refreshToken += 1
        } catch {
            alertMessage = error.localizedDescription
        }
    }

    // MARK: Scans

    func runScan(mode: ScanMode = .quick, audible: Bool = true) async {
        guard !isScanning else { return }
        isScanning = true
        scanMode = mode
        scanProgress = 0.02
        scanStatusText = tr("Starting %@…", "\(mode.label)")
        do {
            let result = try await EngineClient.shared.scan(deep: mode == .deep, storage: mode == .storage) { [weak self] event in
                Task { @MainActor in self?.handle(event) }
            }
            report = result
            scanProgress = 1
            await refreshState()
            selectedFindingID = preferredFindingID
            if audible { InterfaceFeedback.scanCompleted() }
        } catch {
            alertMessage = error.localizedDescription
        }
        isScanning = false
        scanStatusText = ""
    }

    private func handle(_ event: ScanProgressEvent) {
        switch event.event {
        case "detector_started":
            if let index = event.index, let total = event.total, total > 0 {
                scanProgress = max(scanProgress, Double(index) / Double(total))
                scanStatusText = tr("Checking %@… (%@/%@)", "\(event.name ?? "")", "\(index + 1)", "\(total)")
            }
        case "detector_finished":
            if let index = event.index, let total = event.total, total > 0 {
                scanProgress = max(scanProgress, Double(index + 1) / Double(total))
            }
        case "finished":
            scanProgress = 1
            scanStatusText = tr("Saving results…")
        default:
            break
        }
    }

    // MARK: Previews and confirmations

    func previewRepair() async {
        guard let issue = selectedIssue else { return }
        await previewRepair(issue: issue)
    }

    func previewRepair(issue: EngineIssue) async {
        guard issue.fixerAvailable else { return }
        await present(.fix(issueID: issue.id)) { try await EngineClient.shared.previewFix(issueID: issue.id) }
    }

    func previewClean(_ target: CleanTarget) async {
        await present(.clean(target)) { try await EngineClient.shared.previewClean(target) }
    }

    func previewSchedule(hour: Int) async {
        await present(.schedule(hour: hour)) { try await EngineClient.shared.previewSchedule(hour: hour) }
    }

    func previewUnschedule() async {
        pendingAction = .unschedule
        previewError = nil
        fixPreview = FixPreview(
            fixerId: "schedule.snapshot_agent.remove", issueId: "snapshot_agent", title: tr("Stop taking daily snapshots"),
            summary: tr("Unloads the DevDoctor launch agent and removes its file. Snapshots already taken are kept."),
            operations: [tr("launchctl bootout gui/<uid>/dev.devdoctor.snapshot"), "Delete ~/Library/LaunchAgents/dev.devdoctor.snapshot.plist"],
            filesModified: [], filesDeleted: ["~/Library/LaunchAgents/dev.devdoctor.snapshot.plist"], directoriesDeleted: [], commandsExecuted: [],
            processesStopped: [], servicesStopped: [], estimatedDiskSpaceRecovered: 0, backupCreated: true, risk: "low", reversible: false,
            requiresConfirmation: true, batchSafe: false, notes: [], validations: [tr("launchd no longer lists the agent and the file is gone.")]
        )
        showingRepairPreview = true
    }

    private func present(_ action: PendingAction, preview: () async throws -> FixPreview) async {
        pendingAction = action
        fixPreview = nil
        previewError = nil
        showingRepairPreview = true
        do {
            fixPreview = try await preview()
        } catch {
            previewError = error.localizedDescription
        }
    }

    func cancelPending() {
        showingRepairPreview = false
        pendingAction = nil
        fixPreview = nil
        previewError = nil
    }

    func applyPending() async {
        guard let action = pendingAction, !isApplying else { return }
        isApplying = true
        defer { isApplying = false }
        do {
            let transaction: EngineTransaction
            switch action {
            case .fix(let issueID): transaction = try await EngineClient.shared.applyFix(issueID: issueID)
            case .clean(let target): transaction = try await EngineClient.shared.applyClean(target)
            case .schedule(let hour): transaction = try await EngineClient.shared.schedule(hour: hour)
            case .unschedule: transaction = try await EngineClient.shared.unschedule()
            }
            cancelPending()
            completedTransaction = transaction
            await refreshState()
            if case .fix = action { await runScan() }
        } catch {
            alertMessage = error.localizedDescription
        }
    }

    // Kept for the inspector button, which acts on the selected finding.
    func applyRepair() async { await applyPending() }

    func rollback(_ transaction: EngineTransaction, force: Bool = false) async {
        do {
            completedTransaction = try await EngineClient.shared.rollback(transactionID: transaction.id, force: force)
            await refreshState()
            await runScan()
        } catch {
            alertMessage = error.localizedDescription
        }
    }

    func setIgnored(_ issue: EngineIssue, _ ignored: Bool) async {
        do {
            if ignored {
                try await EngineClient.shared.ignore(issueID: issue.id)
            } else {
                try await EngineClient.shared.unignore(issueID: issue.id)
            }
            await refreshState()
            await runScan()
        } catch {
            alertMessage = error.localizedDescription
        }
    }

    func stopProcess(pid: Int) async -> Bool {
        do {
            completedTransaction = try await EngineClient.shared.stopProcess(pid: pid)
            await refreshState()
            return true
        } catch {
            alertMessage = error.localizedDescription
            return false
        }
    }

    func applySafeFixes() async -> [BatchFixResult] {
        do {
            let results = try await EngineClient.shared.applySafeFixes()
            await refreshState()
            await runScan()
            return results
        } catch {
            alertMessage = error.localizedDescription
            return []
        }
    }

    func open(_ result: SearchResult) {
        selection = result.section
        if let findingID = result.findingID {
            selectedFindingID = findingID
            isInspectorPresented = true
        }
        searchQuery = ""
    }
}
