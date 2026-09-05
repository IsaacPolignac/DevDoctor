import Foundation

/// Talks to the DevDoctor engine: the `devdoctor` command line binary, run with `--json`.
///
/// The CLI is the API. It shares one Rust core with the terminal experience, so everything the
/// app shows is exactly what `devdoctor <command> --json` prints, and the app writes to the
/// same local database as the CLI (`~/Library/Application Support/DevDoctor`, or
/// `DEVDOCTOR_HOME` when set).
actor EngineClient {
    static let shared = EngineClient()

    /// Where the engine keeps its database, backups and logs.
    nonisolated var dataDirectory: URL {
        if let custom = ProcessInfo.processInfo.environment["DEVDOCTOR_HOME"], !custom.isEmpty {
            return URL(fileURLWithPath: custom, isDirectory: true)
        }
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        return base.appendingPathComponent("DevDoctor", isDirectory: true)
    }

    /// The engine binary. In the app bundle it sits next to the app executable
    /// (`Contents/MacOS/devdoctor-engine`); during development the repository's `target/` build is
    /// used; `DEVDOCTOR_ENGINE` overrides everything.
    nonisolated var engineURL: URL? { Self.locateEngine() }

    nonisolated static func locateEngine() -> URL? {
        let fm = FileManager.default
        if let custom = ProcessInfo.processInfo.environment["DEVDOCTOR_ENGINE"], fm.isExecutableFile(atPath: custom) {
            return URL(fileURLWithPath: custom)
        }
        // The bundled engine is `Contents/MacOS/devdoctor-engine` (not `devdoctor`: APFS is
        // case-insensitive and that name would collide with the app executable).
        if let executable = Bundle.main.executableURL {
            let sibling = executable.deletingLastPathComponent().appendingPathComponent("devdoctor-engine")
            if fm.isExecutableFile(atPath: sibling.path) { return sibling }
        }
        if let bundled = Bundle.main.url(forResource: "devdoctor-engine", withExtension: nil), fm.isExecutableFile(atPath: bundled.path) {
            return bundled
        }
        // Development: walk up from apps/macos/.build/<config>/DevDoctor to the repository root.
        var dir = URL(fileURLWithPath: CommandLine.arguments[0]).standardizedFileURL.deletingLastPathComponent()
        for _ in 0..<8 {
            for relative in ["target/release/devdoctor", "target/debug/devdoctor"] {
                let candidate = dir.appendingPathComponent(relative)
                if fm.isExecutableFile(atPath: candidate.path) { return candidate }
            }
            dir = dir.deletingLastPathComponent()
        }
        let home = fm.homeDirectoryForCurrentUser
        for candidate in [home.appendingPathComponent(".cargo/bin/devdoctor"), home.appendingPathComponent(".local/bin/devdoctor"),
                          URL(fileURLWithPath: "/opt/homebrew/bin/devdoctor"), URL(fileURLWithPath: "/usr/local/bin/devdoctor")] {
            if fm.isExecutableFile(atPath: candidate.path) { return candidate }
        }
        return nil
    }

    var isAvailable: Bool { engineURL != nil }

    func version() async throws -> String {
        let output = try await execute(["--version"], json: false)
        return String(data: output.stdout, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "unknown"
    }

    // MARK: Scans and issues

    func scan(deep: Bool = false, storage: Bool = false, onProgress: (@Sendable (ScanProgressEvent) -> Void)? = nil) async throws -> ScanReport {
        var arguments = ["scan"]
        if deep { arguments.append("--deep") }
        if storage { arguments.append("--storage") }
        if onProgress != nil { arguments.append("--progress") }
        var lineHandler: (@Sendable (String) -> Void)? = nil
        if let onProgress {
            lineHandler = { (line: String) in
                guard let data = line.data(using: .utf8),
                      let event = try? JSONDecoder.engine.decode(ScanProgressEvent.self, from: data) else { return }
                onProgress(event)
            }
        }
        return try await decode(arguments, accepting: [0, 2], onStderrLine: lineHandler)
    }

    func issues(includeIgnored: Bool = false) async throws -> [IssueRecord] {
        try await decode(["issues"] + (includeIgnored ? ["--all"] : []))
    }

    func issueDetail(_ id: String) async throws -> IssueDetail { try await decode(["issue", id]) }
    func previewFix(issueID: String) async throws -> FixPreview { try await decode(["fix", issueID, "--dry-run"]) }
    func applyFix(issueID: String) async throws -> EngineTransaction { try await decode(["fix", issueID, "--yes"]) }
    func safeFixPreviews() async throws -> [FixPreview] { try await decode(["fix-safe", "--dry-run"]) }
    func applySafeFixes() async throws -> [BatchFixResult] { try await decode(["fix-safe", "--yes"]) }
    func ignore(issueID: String, reason: String? = nil) async throws {
        _ = try await execute(["ignore", issueID] + (reason.map { ["--reason", $0] } ?? []))
    }
    func unignore(issueID: String) async throws { _ = try await execute(["unignore", issueID]) }
    func rollback(transactionID: String, force: Bool = false) async throws -> EngineTransaction {
        try await decode(["rollback", transactionID] + (force ? ["--force"] : []) + ["--yes"])
    }
    func detectors() async throws -> [DetectorMeta] { try await decode(["detectors"]) }
    func lastReport() async throws -> ScanReport? { try await decode(["last-report"]) }

    // MARK: Explorers

    func path() async throws -> PathReport { try await decode(["path"]) }
    func shell() async throws -> ShellReport { try await decode(["shell"]) }
    func startup(samples: Int = 3, trace: Bool = true) async throws -> StartupProfile {
        try await decode(["startup", "--samples", String(samples)] + (trace ? [] : ["--no-trace"]))
    }
    func resolve(_ command: String) async throws -> CommandResolution { try await decode(["resolve", command]) }
    func runtimes() async throws -> RuntimesReport { try await decode(["runtimes"]) }
    func packages() async throws -> PackagesReport { try await decode(["packages"]) }
    func tools() async throws -> [DevTool] { try await decode(["tools"]) }
    func processes() async throws -> [DevProcess] { try await decode(["processes"]) }
    func ports() async throws -> [PortEntry] { try await decode(["ports"]) }
    func stopProcess(pid: Int) async throws -> EngineTransaction { try await decode(["stop", String(pid), "--yes"]) }
    func services() async throws -> [ServiceInfo] { try await decode(["services"]) }
    func git() async throws -> GitReport { try await decode(["git"]) }
    func ssh() async throws -> SshReport { try await decode(["ssh"]) }
    func localAI() async throws -> LocalAIReport { try await decode(["ai"]) }
    func storage(scanProjects: Bool) async throws -> StorageReport {
        try await decode(["storage"] + (scanProjects ? [] : ["--no-projects"]))
    }

    // MARK: Cleaning (always previewed first)

    func previewClean(_ target: CleanTarget) async throws -> FixPreview { try await decode(target.arguments + ["--dry-run"]) }
    func applyClean(_ target: CleanTarget) async throws -> EngineTransaction { try await decode(target.arguments + ["--yes"]) }

    // MARK: History, snapshots, tracking

    func history() async throws -> HistoryEnvelope { try await decode(["history"]) }
    func runs() async throws -> [RunRecord] { try await decode(["runs"]) }
    func snapshots() async throws -> [SnapshotSummary] { try await decode(["snapshot", "list"]) }
    func createSnapshot(baseline: Bool, label: String? = nil) async throws -> SnapshotSummary {
        try await decode(["snapshot", "create"] + (baseline ? ["--baseline"] : []) + (label.map { ["--label", $0] } ?? []))
    }
    func changes(since: String? = nil, to: String? = nil) async throws -> SnapshotDiff? {
        try await decode(["changes"] + (since.map { ["--since", $0] } ?? []) + (to.map { ["--to", $0] } ?? []))
    }
    func snapshotSchedule() async throws -> SnapshotSchedule { try await decode(["snapshot", "status"]) }
    func previewSchedule(hour: Int, minute: Int = 0) async throws -> FixPreview {
        try await decode(["snapshot", "schedule", "--hour", String(hour), "--minute", String(minute), "--dry-run"])
    }
    func schedule(hour: Int, minute: Int = 0) async throws -> EngineTransaction {
        try await decode(["snapshot", "schedule", "--hour", String(hour), "--minute", String(minute), "--yes"])
    }
    func unschedule() async throws -> EngineTransaction { try await decode(["snapshot", "unschedule", "--yes"]) }

    // MARK: Reports

    func reportData() async throws -> Data { try await execute(["report"]).stdout }
    func markdownReport() async throws -> String {
        let output = try await execute(["report", "--markdown"], json: false)
        return String(data: output.stdout, encoding: .utf8) ?? ""
    }

    // MARK: Plumbing

    private func decode<T: Decodable>(
        _ arguments: [String],
        accepting accepted: Set<Int32> = [0],
        onStderrLine: (@Sendable (String) -> Void)? = nil
    ) async throws -> T {
        let output = try await execute(arguments, accepting: accepted, onStderrLine: onStderrLine)
        do {
            return try JSONDecoder.engine.decode(T.self, from: output.stdout)
        } catch {
            let preview = String(data: output.stdout.prefix(400), encoding: .utf8) ?? ""
            throw EngineError.invalidOutput("\(error.localizedDescription)\n\(preview)")
        }
    }

    private func execute(
        _ arguments: [String],
        json: Bool = true,
        accepting accepted: Set<Int32> = [0],
        onStderrLine: (@Sendable (String) -> Void)? = nil
    ) async throws -> (stdout: Data, stderr: Data) {
        guard let engineURL else { throw EngineError.missingEngine }
        let dataDirectory = dataDirectory
        return try await Task.detached(priority: .userInitiated) {
            try FileManager.default.createDirectory(at: dataDirectory, withIntermediateDirectories: true)

            let process = Process()
            process.executableURL = engineURL
            process.arguments = (json ? ["--json"] : []) + arguments
            process.currentDirectoryURL = FileManager.default.homeDirectoryForCurrentUser

            var environment = ProcessInfo.processInfo.environment
            let home = FileManager.default.homeDirectoryForCurrentUser
            let preferred = [
                home.appendingPathComponent(".cargo/bin").path, home.appendingPathComponent(".local/bin").path,
                "/opt/homebrew/bin", "/opt/homebrew/sbin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin",
            ]
            environment["PATH"] = preferred.joined(separator: ":")
            environment["HOME"] = home.path
            environment["SHELL"] = environment["SHELL"] ?? "/bin/zsh"
            process.environment = environment

            let stdoutPipe = Pipe()
            let stderrPipe = Pipe()
            process.standardOutput = stdoutPipe
            process.standardError = stderrPipe

            // stderr is drained as it arrives (progress events); stdout is read to the end.
            let stderrCollector = LineCollector(onLine: onStderrLine)
            stderrPipe.fileHandleForReading.readabilityHandler = { handle in
                let chunk = handle.availableData
                if chunk.isEmpty {
                    handle.readabilityHandler = nil
                    stderrCollector.finish()
                } else {
                    stderrCollector.append(chunk)
                }
            }

            try process.run()
            let stdout = stdoutPipe.fileHandleForReading.readDataToEndOfFile()
            process.waitUntilExit()
            stderrPipe.fileHandleForReading.readabilityHandler = nil
            stderrCollector.append(stderrPipe.fileHandleForReading.availableData)
            stderrCollector.finish()
            let stderr = stderrCollector.data

            guard accepted.contains(process.terminationStatus) else {
                let message = String(data: stderr, encoding: .utf8)?
                    .split(separator: "\n")
                    .map(String.init)
                    .last { !$0.trimmingCharacters(in: .whitespaces).isEmpty && !$0.hasPrefix("{") }?
                    .replacingOccurrences(of: "error: ", with: "")
                throw EngineError.commandFailed(message ?? "The engine stopped with status \(process.terminationStatus).")
            }
            return (stdout, stderr)
        }.value
    }
}

/// What can be removed from the Storage and Local AI pages, always through a preview.
enum CleanTarget: Sendable {
    case nodeModules(path: String)
    case venv(path: String)
    case ollamaModel(name: String)

    var arguments: [String] {
        switch self {
        case .nodeModules(let path): ["clean", "node-modules", path]
        case .venv(let path): ["clean", "venv", path]
        case .ollamaModel(let name): ["clean", "ollama-model", name]
        }
    }
}

/// Accumulates a byte stream and emits complete lines to a callback.
private final class LineCollector: @unchecked Sendable {
    private let lock = NSLock()
    private var buffer = Data()
    private(set) var data = Data()
    private let onLine: (@Sendable (String) -> Void)?

    init(onLine: (@Sendable (String) -> Void)?) { self.onLine = onLine }

    func append(_ chunk: Data) {
        lock.lock()
        data.append(chunk)
        buffer.append(chunk)
        var lines: [String] = []
        while let newline = buffer.firstIndex(of: 0x0A) {
            let lineData = buffer.subdata(in: buffer.startIndex..<newline)
            buffer.removeSubrange(buffer.startIndex...newline)
            if let line = String(data: lineData, encoding: .utf8) { lines.append(line) }
        }
        lock.unlock()
        lines.forEach { onLine?($0) }
    }

    func finish() {
        lock.lock()
        let rest = buffer
        buffer.removeAll()
        lock.unlock()
        if !rest.isEmpty, let line = String(data: rest, encoding: .utf8) { onLine?(line) }
    }
}

extension JSONDecoder {
    /// Decoder for the engine's snake_case JSON.
    static let engine: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return decoder
    }()
}
