import AppKit
import SwiftUI

struct ServicesView: View {
    @EnvironmentObject private var model: AppModel
    @State private var services: [ServiceInfo] = []
    @State private var selectedID: String?
    @State private var isLoading = true
    @State private var error: String?

    private var rows: [ServiceInfo] { services.filter { $0.origin != "apple" } }
    private var selected: ServiceInfo? { rows.first { $0.id == selectedID } }

    var body: some View {
        PageScaffold(title: "Startup Items", subtitle: AppSection.services.blurb + " Apple's own are hidden.") {
            if isLoading {
                LoadingPanel(title: "Reading launch agents…")
            } else if let error {
                DataUnavailableView(title: "Startup Items Unavailable", detail: error, symbol: "bolt.horizontal")
            } else if rows.isEmpty {
                DataUnavailableView(title: "No Third-Party Startup Items", detail: "Only Apple's launch agents are installed for this user.", symbol: "bolt.horizontal")
            } else {
                HStack {
                    StatusPill(text: "\(rows.count) items", symbol: "bolt.horizontal", color: .blue)
                    StatusPill(text: "\(rows.filter { $0.runningPid != nil }.count) running", symbol: "play.circle", color: .green)
                    if rows.contains(where: { $0.targetExists == false }) {
                        StatusPill(text: "\(rows.filter { $0.targetExists == false }.count) broken", symbol: "xmark.circle", color: .red)
                    }
                    Spacer()
                }
                Table(rows, selection: $selectedID) {
                    TableColumn("Item") { s in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(s.label).fontWeight(.medium).lineLimit(1)
                            Text(Formatters.shortenHome(s.plistPath)).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                        }
                    }
                    .width(min: 220, ideal: 320)
                    TableColumn("From") { s in Text(s.originLabel).foregroundStyle(.secondary) }
                        .width(110)
                    TableColumn("At login") { s in Text(s.runAtLoad ? "yes" : "no").foregroundStyle(s.runAtLoad ? .primary : .secondary) }
                        .width(70)
                    TableColumn("Now") { s in Text(s.stateLabel).foregroundStyle(s.runningPid != nil ? .green : .secondary) }
                        .width(120)
                    TableColumn("Starts") { s in
                        if s.targetExists == false {
                            StatusPill(text: "missing: \(s.program.map(Formatters.shortenHome) ?? "?")", symbol: "xmark.circle", color: .red)
                        } else {
                            Text(s.program.map(Formatters.shortenHome) ?? "").font(.system(.caption, design: .monospaced)).lineLimit(1)
                        }
                    }
                }
                .devDoctorTable(minHeight: 360)

                if let selected {
                    InsetPanel {
                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                Text(selected.label).font(.headline)
                                Spacer()
                                Button {
                                    NSWorkspace.shared.activateFileViewerSelecting([URL(fileURLWithPath: selected.plistPath)])
                                } label: { Label("Show in Finder", systemImage: "folder") }
                            }
                            KeyValueList(rows: [
                                ("Program", selected.program.map(Formatters.shortenHome) ?? "—"),
                                ("Arguments", selected.programArguments.isEmpty ? "—" : selected.programArguments.joined(separator: " ")),
                                ("Keep alive", selected.keepAlive ? "yes" : "no"),
                                ("Last exit status", selected.lastExitStatus.map(String.init) ?? "—"),
                                ("Working directory", selected.workingDirectory.map(Formatters.shortenHome) ?? "—"),
                            ])
                            Label("Turning items off is not automated yet; issues list the exact command.", systemImage: "info.circle")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .task(id: model.refreshToken) { await load() }
    }

    private func load() async {
        isLoading = services.isEmpty
        do {
            services = try await EngineClient.shared.services()
            if selectedID == nil { selectedID = rows.first?.id }
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

struct GitView: View {
    @EnvironmentObject private var model: AppModel
    @State private var report: GitReport?
    @State private var isLoading = true
    @State private var error: String?

    var body: some View {
        PageScaffold(title: "Git", subtitle: AppSection.git.blurb) {
            if isLoading {
                LoadingPanel(title: "Reading Git configuration…")
            } else if let error {
                DataUnavailableView(title: "Git Unavailable", detail: error, symbol: "arrow.triangle.branch")
            } else if let g = report {
                HStack(alignment: .top, spacing: 16) {
                    SectionCard("Global configuration") {
                        KeyValueList(rows: [
                            ("git", g.git.map { "\(Formatters.shortenHome($0.path)) · \($0.version ?? "")" } ?? "not found"),
                            ("GitHub CLI", g.gh.map { "\(Formatters.shortenHome($0.path)) · \($0.version ?? "")\(g.ghConfigPresent ? " · signed in" : "")" } ?? "not found"),
                            ("Config files", g.configFiles.isEmpty ? "none" : g.configFiles.map(Formatters.shortenHome).joined(separator: "\n")),
                            ("Name", g.userName ?? "not set"),
                            ("Email", g.userEmail ?? "not set"),
                            ("Default branch", g.defaultBranch ?? "(not set — Git uses master)"),
                            ("Credential helper", g.credentialHelpers.isEmpty ? "(none in global config)" : g.credentialHelpers.joined(separator: ", ")),
                            ("Commit signing", g.gpgSign == true ? "on (\(g.gpgFormat ?? "gpg"))\(g.signingKey.map { " · key \($0)" } ?? "")" : "off"),
                            ("Global ignore file", g.excludesFile.map { "\(Formatters.shortenHome($0))\(g.excludesFileExists ? "" : " (missing)")" } ?? "—"),
                            ("Aliases", "\(g.aliasCount)"),
                            ("Conditional includes", g.includeIfs.isEmpty ? "—" : g.includeIfs.joined(separator: "; ")),
                        ])
                    }
                    .frame(maxWidth: .infinity)
                    SectionCard("Findings") {
                        if g.findings.isEmpty {
                            Label("Nothing unusual.", systemImage: "checkmark.circle").foregroundStyle(.secondary)
                        } else {
                            ForEach(Array(g.findings.enumerated()), id: \.offset) { _, f in
                                Label(f, systemImage: "info.circle").font(.callout)
                            }
                        }
                    }
                    .frame(width: 340)
                }
            }
        }
        .task(id: model.refreshToken) { await load() }
    }

    private func load() async {
        isLoading = report == nil
        do {
            report = try await EngineClient.shared.git()
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

struct SshView: View {
    @EnvironmentObject private var model: AppModel
    @State private var report: SshReport?
    @State private var isLoading = true
    @State private var error: String?

    var body: some View {
        PageScaffold(title: "SSH", subtitle: AppSection.ssh.blurb) {
            if isLoading {
                LoadingPanel(title: "Reading SSH metadata…")
            } else if let error {
                DataUnavailableView(title: "SSH Unavailable", detail: error, symbol: "key")
            } else if let s = report {
                HStack(alignment: .top, spacing: 16) {
                    SectionCard("Status") {
                        KeyValueList(rows: [
                            ("~/.ssh folder", s.sshDirExists ? "present (permissions \(s.sshDirMode.map { String($0, radix: 8) } ?? "?"))" : "missing"),
                            ("Agent", "\(s.agentStatus.replacingOccurrences(of: "_", with: " ")) · \(s.agentIdentities) key\(s.agentIdentities == 1 ? "" : "s") loaded"),
                            ("Config", s.configExists ? "\(s.hosts.count) host entries" : "no ~/.ssh/config"),
                            ("Known hosts", "\(s.knownHostsEntries) entries"),
                        ])
                    }
                    .frame(maxWidth: .infinity)
                    SectionCard("Findings") {
                        if s.findings.isEmpty {
                            Label("Nothing unusual.", systemImage: "checkmark.circle").foregroundStyle(.secondary)
                        } else {
                            ForEach(Array(s.findings.enumerated()), id: \.offset) { _, f in
                                Label(f, systemImage: "info.circle").font(.callout)
                            }
                        }
                    }
                    .frame(width: 340)
                }

                SectionCard("Keys", detail: "Private key contents are never read.") {
                    if s.keys.isEmpty {
                        Text("No private keys found in ~/.ssh.").foregroundStyle(.secondary)
                    } else {
                        Table(s.keys) {
                            TableColumn("Key") { k in Text(k.name).font(.system(.body, design: .monospaced)) }
                                .width(min: 120, ideal: 180)
                            TableColumn("Type") { k in Text(k.keyType ?? "") }
                                .width(100)
                            TableColumn("Comment") { k in Text(k.comment ?? "").foregroundStyle(.secondary).lineLimit(1) }
                            TableColumn("Permissions") { k in
                                StatusPill(text: "\(String(k.mode, radix: 8)) \(k.modeOk ? "ok" : "too open")", symbol: k.modeOk ? "lock" : "lock.open", color: k.modeOk ? .green : .red)
                            }
                            .width(130)
                            TableColumn("Public key") { k in Text(k.hasPublicKey ? "yes" : "no").foregroundStyle(.secondary) }
                                .width(80)
                        }
                        .devDoctorTable(minHeight: CGFloat(min(280, 60 + s.keys.count * 32)))
                    }
                }

                SectionCard("Hosts") {
                    if s.hosts.isEmpty {
                        Text("No host entries.").foregroundStyle(.secondary)
                    } else {
                        Table(s.hosts) {
                            TableColumn("Host") { h in Text(h.patterns.joined(separator: " ")).fontWeight(.medium) }
                                .width(min: 120, ideal: 180)
                            TableColumn("Connects to") { h in Text(h.hostname ?? "") }
                                .width(min: 120, ideal: 180)
                            TableColumn("User") { h in Text(h.user ?? "") }
                                .width(90)
                            TableColumn("Key") { h in
                                VStack(alignment: .leading, spacing: 2) {
                                    ForEach(h.identityFiles, id: \.self) { f in
                                        if h.missingIdentityFiles.contains(f) {
                                            StatusPill(text: "\(Formatters.shortenHome(f)) missing", symbol: "xmark.circle", color: .red)
                                        } else {
                                            Text(Formatters.shortenHome(f)).font(.system(.caption, design: .monospaced))
                                        }
                                    }
                                }
                            }
                            TableColumn("Line") { h in Text("\(h.line)").monospacedDigit().foregroundStyle(.secondary) }
                                .width(50)
                        }
                        .devDoctorTable(minHeight: CGFloat(min(320, 60 + s.hosts.count * 32)))
                    }
                }
            }
        }
        .task(id: model.refreshToken) { await load() }
    }

    private func load() async {
        isLoading = report == nil
        do {
            report = try await EngineClient.shared.ssh()
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}
