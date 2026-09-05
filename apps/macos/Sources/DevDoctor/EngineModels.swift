import Foundation
import SwiftUI

// Swift mirrors of the JSON printed by `devdoctor <command> --json`. Field names follow the
// Rust structs in crates/devdoctor-core and crates/devdoctor (snake_case in JSON, camelCase
// here). Fields the engine omits when empty are optional.

enum EngineError: LocalizedError {
    case missingEngine
    case commandFailed(String)
    case invalidOutput(String)

    var errorDescription: String? {
        switch self {
        case .missingEngine:
            tr("The DevDoctor engine (the `devdoctor` command line tool) could not be found. Rebuild the app with scripts/build-macos-app.sh or install the CLI.")
        case .commandFailed(let message):
            message
        case .invalidOutput(let message):
            tr("The diagnostic engine returned unreadable data. %@", "\(message)")
        }
    }
}

// MARK: - Scans and issues

struct ScanProgressEvent: Codable, Sendable {
    let event: String
    let total: Int?
    let mode: String?
    let index: Int?
    let id: String?
    let name: String?
    let issues: Int?
    let durationMs: Int?
    let failed: Bool?
}

enum IssueSeverity: String, Codable, Comparable, CaseIterable {
    case info, low, medium, high, critical

    private var rank: Int {
        switch self {
        case .info: 0
        case .low: 1
        case .medium: 2
        case .high: 3
        case .critical: 4
        }
    }

    static func < (lhs: IssueSeverity, rhs: IssueSeverity) -> Bool { lhs.rank < rhs.rank }

    var findingLevel: FindingSeverity {
        switch self {
        case .critical, .high, .medium: .attention
        case .low, .info: .recommendation
        }
    }

    var displayName: String {
        switch self {
        case .critical: tr("Fix now")
        case .high, .medium: tr("Needs attention")
        case .low: tr("Recommendation")
        case .info: tr("Good to know")
        }
    }
}

struct AffectedFile: Codable, Hashable {
    let path: String
    let line: Int?
    let excerpt: String?
}

struct EngineIssue: Codable, Hashable, Identifiable {
    let id: String
    let fingerprint: String?
    let detectorId: String
    let category: String
    let title: String
    let description: String
    let impact: String
    let technicalDescription: String?
    let severity: IssueSeverity
    let confidence: String
    let evidence: [String]
    let affectedFiles: [AffectedFile]
    let affectedCommands: [String]
    let currentState: String?
    let recommendedAction: String
    let fixerId: String?
    let fixerAvailable: Bool
    let reversible: Bool
    let batchSafe: Bool
    let createdAt: String?

    var confidenceLabel: String {
        switch confidence {
        case "confirmed": tr("Verified")
        case "likely": tr("Probable")
        default: tr("Possible")
        }
    }
}

struct IssueRecord: Codable, Identifiable {
    let issue: EngineIssue
    let firstSeenAt: String?
    let lastSeenAt: String?
    let resolvedAt: String?
    let ignored: Bool

    var id: String { issue.id }
}

struct IssueDetail: Codable {
    let record: IssueRecord
    let fixerName: String?
    let preview: FixPreview?
    let previewError: String?
    let transactions: [EngineTransaction]
}

struct DetectorRun: Codable, Identifiable {
    let id: String
    let name: String
    let category: String
    let durationMs: Int
    let status: String
    let issues: Int
    let error: String?
}

struct CategoryHealth: Codable, Identifiable, Hashable {
    let category: String
    let label: String
    let issues: Int
    let problems: Int
    let warnings: Int
    let maxSeverity: IssueSeverity?
    let penalty: Double
    let capped: Bool
    let checksRun: Int

    var id: String { category }
}

struct HealthScore: Codable {
    let score: Int
    let problems: Int
    let warnings: Int
    let notes: Int
    let checksPassed: Int
    let checksTotal: Int
    let categories: [CategoryHealth]
    let explanation: String
}

struct ScanReport: Codable, Identifiable {
    let id: String
    let mode: String
    let startedAt: String
    let finishedAt: String
    let durationMs: Int
    let issues: [EngineIssue]
    let ignored: [EngineIssue]
    let detectorRuns: [DetectorRun]
    let detectorsRun: Int
    let detectorsFailed: Int
    let health: HealthScore
    let warnings: [String]
}

struct ScanSummary: Codable, Identifiable, Hashable {
    let id: String
    let mode: String
    let startedAt: String
    let finishedAt: String
    let durationMs: Int
    let detectorsRun: Int
    let detectorsFailed: Int
    let issueCount: Int
    let healthScore: Int?
}

struct DetectorMeta: Codable, Hashable, Identifiable {
    let id: String
    let name: String
    let category: String
    let description: String
    let modes: [String]
}

// MARK: - Fixes and transactions

struct HistoryEnvelope: Codable {
    var scans: [ScanSummary]
    var transactions: [EngineTransaction]
    var runs: [RunRecord]

    init(scans: [ScanSummary] = [], transactions: [EngineTransaction] = [], runs: [RunRecord] = []) {
        self.scans = scans
        self.transactions = transactions
        self.runs = runs
    }

    private enum CodingKeys: String, CodingKey { case scans, transactions, runs }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        scans = try container.decodeIfPresent([ScanSummary].self, forKey: .scans) ?? []
        transactions = try container.decodeIfPresent([EngineTransaction].self, forKey: .transactions) ?? []
        runs = try container.decodeIfPresent([RunRecord].self, forKey: .runs) ?? []
    }
}

struct TransactionOperation: Codable, Hashable {
    let kind: String
    let path: String?
    let target: String?
    let pid: Int?
    let name: String?
    let force: Bool?
    let description: String?
    let program: String?
    let args: [String]?
    let exitCode: Int?
    let bytes: Int64?
    let entries: Int64?
    let created: Bool?

    var isReversible: Bool { kind == "file_write" || kind == "file_delete" || kind == "symlink_delete" }

    var summary: String {
        switch kind {
        case "file_write": "\(created == true ? "Created" : "Edited") \(path ?? "")\(created == true ? "" : " (backup kept)")"
        case "file_delete": tr("Deleted file %@ (backup kept)", "\(path ?? "")")
        case "symlink_delete": tr("Removed broken link %@ → %@", "\(path ?? "")", "\(target ?? "")")
        case "dir_delete": tr("Deleted %@ (%@)", "\(path ?? "")", "\(Formatters.byteString(bytes))")
        case "process_stop": tr("Stopped %@ (pid %@)%@", "\(name ?? "process")", "\(pid ?? 0)", "\(force == true ? tr(" forcefully") : "")")
        case "command": tr("Ran %@ %@ (exit %@)", "\(program ?? "")", "\((args ?? []).joined(separator: " "))", "\(exitCode.map(String.init) ?? "?")")
        default: kind
        }
    }
}

struct BackupRecord: Codable, Hashable, Identifiable {
    let id: String
    let originalPath: String
    let storedPath: String
    let size: Int64
    let createdAt: String
}

struct ValidationCheck: Codable, Hashable {
    let name: String
    let passed: Bool
    let detail: String
}

struct ValidationReport: Codable, Hashable {
    let checks: [ValidationCheck]
}

struct EngineTransaction: Codable, Identifiable, Hashable {
    let id: String
    let issueId: String?
    let fixerId: String
    let title: String
    let status: String
    let createdAt: String
    let completedAt: String?
    let operations: [TransactionOperation]
    let backups: [BackupRecord]?
    let validation: ValidationReport?
    let error: String?
    let diskSpaceRecovered: Int64
    let notes: [String]

    var canRollback: Bool {
        status == "applied" && !operations.isEmpty && operations.allSatisfy(\.isReversible)
    }

    var statusLabel: String {
        switch status {
        case "applied": tr("Applied")
        case "rolled_back": tr("Rolled back")
        case "failed": tr("Failed")
        case "rollback_failed": tr("Rollback failed")
        default: status.capitalized
        }
    }
}

struct FileChange: Codable, Hashable, Identifiable {
    let path: String
    let before: String
    let after: String
    let diff: String

    var id: String { path }
}

struct DirDeletion: Codable, Hashable, Identifiable {
    let path: String
    let bytes: Int64
    let entries: Int64

    var id: String { path }
}

struct PlannedCommand: Codable, Hashable, Identifiable {
    let program: String
    let args: [String]
    let description: String

    var id: String { "\(program) \(args.joined(separator: " "))" }
}

struct ProcessRef: Codable, Hashable, Identifiable {
    let pid: Int
    let name: String
    let command: String

    var id: Int { pid }
}

struct FixPreview: Codable, Identifiable {
    let fixerId: String
    let issueId: String
    let title: String
    let summary: String
    let operations: [String]
    let filesModified: [FileChange]
    let filesDeleted: [String]
    let directoriesDeleted: [DirDeletion]
    let commandsExecuted: [PlannedCommand]
    let processesStopped: [ProcessRef]
    let servicesStopped: [String]
    let estimatedDiskSpaceRecovered: Int64
    let backupCreated: Bool
    let risk: String
    let reversible: Bool
    let requiresConfirmation: Bool
    let batchSafe: Bool
    let notes: [String]
    let validations: [String]

    var id: String { "\(fixerId):\(issueId)" }
}

struct BatchFixResult: Codable, Identifiable {
    let issueId: String
    let ok: Bool
    let transaction: EngineTransaction?
    let error: String?

    var id: String { issueId }
}

// MARK: - Shell and PATH

struct PathSource: Codable, Hashable {
    let kind: String
    let shell: String?
}

struct PathAttribution: Codable, Hashable, Identifiable {
    let file: String
    let line: Int
    let statement: String
    let op: String
    let conditional: Bool

    var id: String { "\(file):\(line):\(statement)" }
}

struct PathEntry: Codable, Hashable, Identifiable {
    let position: Int
    let raw: String
    let exists: Bool
    let isDir: Bool
    let isDuplicate: Bool
    let duplicateOf: Int?
    let executables: Int?
    let writable: Bool?
    let origin: String
    let originLabel: String
    let sources: [PathAttribution]
    let sourceHint: String?
    let suspicious: String?

    var id: Int { position }
}

struct PathReport: Codable {
    let source: PathSource?
    let raw: String
    let entries: [PathEntry]
    let duplicateCount: Int
    let missingCount: Int
    let warnings: [String]
    let captureDurationMs: Int
}

struct ParseWarning: Codable, Hashable {
    let line: Int
    let message: String
}

struct ShellConfigFile: Codable, Hashable, Identifiable {
    let path: String
    let role: String
    let exists: Bool
    let warnings: [ParseWarning]
    let sha256: String?
    let size: Int64
    let mtime: Int64?
    let statementCount: Int

    var id: String { path }

    var roleLabel: String {
        switch role {
        case "env": tr("always (env)")
        case "profile": tr("at login")
        case "rc": tr("every terminal")
        case "login": tr("after login")
        default: role
        }
    }
}

struct PathComponentInfo: Codable, Hashable {
    let raw: String
    let text: String
    let expanded: String?
    let exists: Bool?
    let isPathRef: Bool
}

struct PathMutation: Codable, Hashable, Identifiable {
    let file: String
    let line: Int
    let endLine: Int
    let op: String
    let components: [PathComponentInfo]
    let conditional: Bool
    let inFunction: Bool
    let exclusiveLine: Bool
    let raw: String
    let rewritable: Bool

    var id: String { "\(file):\(line):\(raw)" }

    var effectLabel: String {
        switch op {
        case "prepend": tr("adds in front")
        case "append": tr("adds at the end")
        case "set": tr("replaces PATH")
        default: op
        }
    }
}

struct SourceRef: Codable, Hashable, Identifiable {
    let file: String
    let line: Int
    let raw: String
    let targetRaw: String
    let expanded: String?
    let exists: Bool?
    let guarded: Bool
    let conditional: Bool
    let inFunction: Bool
    let exclusiveLine: Bool?

    var id: String { "\(file):\(line)" }
}

struct AliasDef: Codable, Hashable, Identifiable {
    let file: String
    let line: Int
    let name: String
    let valueRaw: String

    var id: String { "\(file):\(line):\(name)" }
}

struct EvalRef: Codable, Hashable, Identifiable {
    let file: String
    let line: Int
    let command: String
    let conditional: Bool

    var id: String { "\(file):\(line)" }
}

struct ShellReport: Codable {
    let shell: String
    let shellPath: String
    let files: [ShellConfigFile]
    let mutations: [PathMutation]
    let sources: [SourceRef]
    let aliases: [AliasDef]
    let evals: [EvalRef]
    let pathSource: PathSource?
    let captureWarnings: [String]
    let captureDurationMs: Int
    let shellFunctions: Int
    let shellAliases: Int
}

struct StartupHotspot: Codable, Hashable, Identifiable {
    let file: String
    let line: Int
    let statement: String
    let inclusiveMs: Int
    let sharePercent: Int
    let hint: String?

    var id: String { "\(file):\(line)" }
}

struct StartupSource: Codable, Hashable, Identifiable {
    let name: String
    let display: String
    let kind: String
    let selfMs: Int
    let lines: Int

    var id: String { name }
}

struct StartupProfile: Codable {
    let shell: String
    let measuredAt: String
    let samplesMs: [Int]
    let medianMs: Int
    let minMs: Int
    let maxMs: Int
    let rating: String
    let traced: Bool
    let traceTotalMs: Int?
    let traceLines: Int
    let hotspots: [StartupHotspot]
    let sources: [StartupSource]
    let stderrLines: [String]
    let notes: [String]

    var ratingLabel: String {
        switch rating {
        case "fast": "instant"
        case "ok": "fine"
        case "slow": "slow"
        default: tr("very slow")
        }
    }

    var ratingColor: Color {
        switch rating {
        case "fast": .green
        case "ok": .blue
        case "slow": .orange
        default: .red
        }
    }
}

struct CommandExecutable: Codable, Hashable {
    let path: String
    let realPath: String?
    let isSymlink: Bool
    let pathPosition: Int
    let directory: String
    let origin: String
    let originLabel: String
    let version: String?
    let shebang: String?
}

struct PrecedenceEntry: Codable, Hashable, Identifiable {
    let position: Int
    let originLabel: String
    let path: String

    var id: Int { position }
}

struct CommandResolution: Codable {
    let command: String
    let alias: String?
    let shellFunction: Bool
    let active: CommandExecutable?
    let others: [CommandExecutable]
    let precedence: [PrecedenceEntry]?
    let notes: [String]
    let conflict: String?
}

// MARK: - Runtimes, packages, tools

struct NodeInstallation: Codable, Hashable, Identifiable {
    let source: String
    let label: String
    let binary: String
    let prefix: String
    let version: String?
    let active: Bool

    var id: String { binary }
}

struct NpmMismatch: Codable, Hashable {
    let nodePrefix: String
    let npmPrefix: String
    let nodeVersion: String?
    let npmVersion: String?
    let npmOwnerNodeVersion: String?
}

struct NodeInventory: Codable {
    let installations: [NodeInstallation]
    let activeNode: CommandExecutable?
    let activeNpm: CommandExecutable?
    let activeNodePrefix: String?
    let activeNpmPrefix: String?
    let npmMismatch: NpmMismatch?
    let managers: [String]
    let notes: [String]
}

struct PythonInstallation: Codable, Hashable, Identifiable {
    let source: String
    let label: String
    let binary: String
    let version: String?
    let active: Bool

    var id: String { binary }
}

struct PipMismatch: Codable, Hashable, Identifiable {
    let pipCommand: String
    let pipPath: String
    let pipInterpreter: String
    let pythonCommand: String
    let pythonPath: String
    let pythonRealPath: String?
    let pythonVersion: String?
    let pipPythonVersion: String?

    var id: String { pipCommand }
}

struct PythonInventory: Codable {
    let installations: [PythonInstallation]
    let python: CommandExecutable?
    let python3: CommandExecutable?
    let pip: CommandExecutable?
    let pip3: CommandExecutable?
    let pythonAlias: String?
    let pipMismatches: [PipMismatch]
    let pythonPython3Mismatch: String?
    let brokenLinks: [String]
    let notes: [String]
}

struct RustToolchain: Codable, Hashable, Identifiable {
    let name: String
    let path: String

    var id: String { name }
}

struct RustCrate: Codable, Hashable, Identifiable {
    let name: String
    let version: String
    let source: String

    var id: String { name }
}

struct RustInventory: Codable {
    let rustupInstalled: Bool
    let rustupHome: String
    let cargoHome: String
    let cargoBinInPath: Bool
    let cargo: CommandExecutable?
    let rustc: CommandExecutable?
    let toolchains: [RustToolchain]
    let defaultToolchain: String?
    let installedCrates: [RustCrate]
    let notes: [String]
}

struct RuntimesReport: Codable {
    let node: NodeInventory
    let python: PythonInventory
    let rust: RustInventory
}

struct PackageManager: Codable, Hashable, Identifiable {
    let id: String
    let name: String
    let installed: Bool
    let version: String?
    let binary: String?
    let location: String?
    let packageCount: Int?
    let cachePath: String?
    let cacheSize: Int64?
    let notes: [String]
}

struct BrewFormula: Codable, Hashable, Identifiable {
    let name: String
    let versions: [String]
    let linked: Bool

    var id: String { name }
}

struct BrewCask: Codable, Hashable, Identifiable {
    let name: String
    let versions: [String]

    var id: String { name }
}

struct BrokenLink: Codable, Hashable, Identifiable {
    let link: String
    let target: String

    var id: String { link }
}

struct DirSize: Codable, Hashable {
    let allocated: Int64
    let files: Int64
}

struct HomebrewInventory: Codable {
    let installed: Bool
    let prefix: String?
    let expectedPrefix: String
    let otherPrefix: String?
    let brewBinary: String?
    let inPath: Bool
    let version: String?
    let formulae: [BrewFormula]
    let casks: [BrewCask]
    let brokenLinks: [BrokenLink]
    let cacheDir: String
    let cacheSize: DirSize?
    let versionedDuplicates: [[String]]
}

struct PackagesReport: Codable {
    let managers: [PackageManager]
    let homebrew: HomebrewInventory
}

struct DevTool: Codable, Hashable, Identifiable {
    let id: String
    let name: String
    let installed: Bool
    let version: String?
    let binary: String?
    let installMethod: String?
    let appBundle: String?
    let configPaths: [String]
    let dataPaths: [String]
    let diskUsage: Int64?
    let notes: [String]
}

// MARK: - Processes, ports, services

struct DevProcess: Codable, Hashable, Identifiable {
    let pid: Int
    let parentPid: Int?
    let name: String
    let kind: String
    let kindLabel: String
    let label: String
    let command: String
    let cwd: String?
    let projectPath: String?
    let cpuPercent: Double?
    let memoryBytes: Int64?
    let runTimeSecs: Int?
    let ports: [Int]
    let orphaned: Bool
    let cwdMissing: Bool
    let stale: Bool
    let staleReason: String?
    let ownedByUser: Bool
    let stoppable: Bool
    let notStoppableReason: String?

    var id: Int { pid }
}

struct PortEntry: Codable, Hashable, Identifiable {
    let port: Int
    let pid: Int?
    let processName: String?
    let address: String
    let localOnly: Bool?
    let devProcess: DevProcess?
    let commonDevPort: Bool

    var id: String { "\(port):\(pid ?? 0):\(address)" }
}

struct ServiceInfo: Codable, Hashable, Identifiable {
    let label: String
    let kind: String
    let origin: String
    let plistPath: String
    let program: String?
    let programArguments: [String]
    let runAtLoad: Bool
    let keepAlive: Bool
    let loaded: Bool?
    let runningPid: Int?
    let lastExitStatus: Int?
    let targetExists: Bool?
    let workingDirectory: String?

    var id: String { plistPath }

    var originLabel: String {
        switch origin {
        case "homebrew_services": tr("brew services")
        case "developer": tr("developer tool")
        case "third_party": tr("other app")
        case "apple": tr("Apple")
        default: origin
        }
    }

    var stateLabel: String {
        if let runningPid { return tr("running · pid %@", "\(runningPid)") }
        switch loaded {
        case .some(true): return "loaded"
        case .some(false): return tr("not loaded")
        case .none: return "—"
        }
    }
}

// MARK: - Git and SSH

struct GitReport: Codable {
    let git: CommandExecutable?
    let gh: CommandExecutable?
    let ghConfigPresent: Bool
    let configFiles: [String]
    let userName: String?
    let userEmail: String?
    let defaultBranch: String?
    let credentialHelpers: [String]
    let gpgSign: Bool?
    let gpgFormat: String?
    let signingKey: String?
    let excludesFile: String?
    let excludesFileExists: Bool
    let aliasCount: Int
    let includeIfs: [String]
    let findings: [String]
}

struct SshKey: Codable, Hashable, Identifiable {
    let path: String
    let name: String
    let mode: Int
    let modeOk: Bool
    let hasPublicKey: Bool
    let keyType: String?
    let comment: String?

    var id: String { path }
}

struct SshHost: Codable, Hashable, Identifiable {
    let patterns: [String]
    let line: Int
    let hostname: String?
    let user: String?
    let identityFiles: [String]
    let missingIdentityFiles: [String]

    var id: String { "\(line):\(patterns.joined(separator: " "))" }
}

struct SshReport: Codable {
    let sshDir: String
    let sshDirExists: Bool
    let sshDirMode: Int?
    let keys: [SshKey]
    let configPath: String
    let configExists: Bool
    let configMode: Int?
    let hosts: [SshHost]
    let duplicateHosts: [String]
    let knownHostsEntries: Int
    let agentStatus: String
    let agentIdentities: Int
    let findings: [String]
}

// MARK: - Storage and local AI

struct StorageCategory: Codable, Hashable, Identifiable {
    let id: String
    let label: String
    let kind: String
    let paths: [String]
    let exists: Bool
    let bytes: Int64
    let files: Int
    let recreatable: Bool
    let description: String
    let scanMs: Int
}

struct StorageItem: Codable, Hashable, Identifiable {
    let path: String
    let projectPath: String?
    let projectName: String?
    let bytes: Int64
    let files: Int?
    let broken: Bool?
    let tool: String?
    let packageManager: String?
    let recreateCommand: String?
    let pythonVersion: String?
    let lastActivitySecsAgo: Int?

    var id: String { path }
}

struct StorageReport: Codable {
    let generatedAt: String
    let durationMs: Int
    let categories: [StorageCategory]
    let totalBytes: Int64
    let nodeModules: [StorageItem]
    let nodeModulesBytes: Int64
    let venvs: [StorageItem]
    let venvsBytes: Int64
    let buildDirs: [StorageItem]
    let buildBytes: Int64
    let rootsScanned: [String]
    let projectsScanned: Bool
}

struct LocalAIModel: Codable, Hashable, Identifiable {
    let name: String
    let path: String
    let bytes: Int64
    let lastUsedSecsAgo: Int?
    let kind: String

    var id: String { path }
}

struct LocalAISource: Codable, Hashable, Identifiable {
    let id: String
    let label: String
    let root: String
    let present: Bool
    let bytes: Int64
    let models: [LocalAIModel]
    let description: String
}

struct OllamaModel: Codable, Hashable, Identifiable {
    let name: String
    let manifestPath: String
    let size: Int64
    let modifiedSecsAgo: Int?
    let family: String?
    let parameterSize: String?
    let quantization: String?

    var id: String { manifestPath }
}

struct OllamaInventory: Codable {
    let installed: Bool
    let binary: String?
    let appBundlePresent: Bool
    let modelsDir: String
    let models: [OllamaModel]
    let totalBytes: Int64
    let blobBytes: Int64
    let orphanBlobBytes: Int64
    let orphanBlobs: Int
    let running: Bool
}

struct LocalAIReport: Codable {
    let ollama: OllamaInventory
    let sources: [LocalAISource]
    let totalBytes: Int64
    let durationMs: Int
}

// MARK: - Snapshots, changes, tracked runs

struct SnapshotCounts: Codable, Hashable {
    let counts: [String: Int]
    let pathEntries: Int?
    let storageBytes: Int64?
}

struct SnapshotSummary: Codable, Hashable, Identifiable {
    let id: String
    let kind: String
    let label: String?
    let createdAt: String
    let summary: SnapshotCounts

    var itemCount: Int { summary.counts.values.reduce(0, +) }
}

struct SnapshotChange: Codable, Hashable, Identifiable {
    let category: String
    let key: String
    let kind: String
    let description: String

    var id: String { "\(category):\(key)" }
}

struct CategoryChanges: Codable, Hashable, Identifiable {
    let category: String
    let label: String
    let added: Int
    let removed: Int
    let changed: Int

    var id: String { category }
}

struct SnapshotDiff: Codable, Hashable {
    let fromId: String
    let toId: String
    let fromAt: String
    let toAt: String
    let changes: [SnapshotChange]
    let categories: [CategoryChanges]
    let headline: [String]
}

struct TrackedFileDiff: Codable, Hashable, Identifiable {
    let path: String
    let kind: String
    let diff: String
    let linesAdded: Int
    let linesRemoved: Int

    var id: String { path }
}

struct DirectoryChanges: Codable, Hashable, Identifiable {
    let dir: String
    let added: [String]
    let removed: [String]

    var id: String { dir }
}

struct VersionChange: Codable, Hashable, Identifiable {
    let command: String
    let before: String?
    let after: String?
    let path: String?

    var id: String { command }
}

struct RunRecord: Codable, Hashable, Identifiable {
    let id: String
    let command: [String]
    let label: String
    let cwd: String?
    let startedAt: String
    let finishedAt: String
    let durationMs: Int
    let exitCode: Int?
    let beforeSnapshotId: String
    let afterSnapshotId: String
    let diff: SnapshotDiff
    let fileDiffs: [TrackedFileDiff]
    let directoryChanges: [DirectoryChanges]
    let versionChanges: [VersionChange]
    let headline: [String]

    var changedAnything: Bool {
        !diff.changes.isEmpty || !fileDiffs.isEmpty || directoryChanges.contains { !$0.added.isEmpty || !$0.removed.isEmpty } || !versionChanges.isEmpty
    }
}

struct SnapshotSchedule: Codable {
    let installed: Bool
    let loaded: Bool
    let plistPath: String
    let program: String?
    let programExists: Bool
    let hour: Int?
    let minute: Int?
    let lastRun: String?
    let logPath: String
    let availableProgram: String?
    let notes: [String]
}

// MARK: - Formatting

enum Formatters {
    static func byteString(_ value: Int64?) -> String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        formatter.allowedUnits = [.useKB, .useMB, .useGB, .useTB]
        formatter.includesUnit = true
        formatter.isAdaptive = true
        return formatter.string(fromByteCount: value ?? 0)
    }

    static func date(_ value: String?) -> Date? {
        guard let value else { return nil }
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return fractional.date(from: value) ?? ISO8601DateFormatter().date(from: value)
    }

    static func shortDate(_ value: String?) -> String {
        guard let value else { return tr("Never") }
        guard let date = date(value) else { return value }
        return date.formatted(Date.FormatStyle(date: .abbreviated, time: .shortened).locale(L10n.locale))
    }

    static func duration(ms: Int) -> String {
        if ms < 1000 { return "\(ms) ms" }
        if ms < 60_000 { return String(format: "%.1f s", Double(ms) / 1000) }
        let seconds = ms / 1000
        return tr("%@ min %@ s", "\(seconds / 60)", "\(seconds % 60)")
    }

    static func ago(seconds: Int?) -> String {
        guard let seconds else { return "" }
        if seconds < 60 { return tr("just now") }
        if seconds < 3600 { return tr("%@ min ago", "\(seconds / 60)") }
        if seconds < 86_400 { return tr("%@ h ago", "\(seconds / 3600)") }
        if seconds < 30 * 86_400 { return tr("%@ days ago", "\(seconds / 86_400)") }
        if seconds < 365 * 86_400 { return tr("%@ months ago", "\(seconds / (30 * 86_400))") }
        return tr("%@ years ago", "\(seconds / (365 * 86_400))")
    }

    static func category(_ value: String) -> String {
        switch value {
        case "package_managers": tr("Packages")
        case "ai_tools": tr("AI Tools")
        case "ssh": tr("SSH")
        default: value.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }

    static func detectorName(_ id: String) -> String {
        id.split(separator: ".").map { $0.replacingOccurrences(of: "_", with: " ") }.joined(separator: " · ")
    }

    static func shortenHome(_ path: String) -> String {
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        return path.hasPrefix(home) ? "~" + path.dropFirst(home.count) : path
    }
}
