import SwiftUI

struct RuntimesView: View {
    @EnvironmentObject private var model: AppModel
    @State private var report: RuntimesReport?
    @State private var isLoading = true
    @State private var error: String?

    var body: some View {
        PageScaffold(title: "Runtimes", subtitle: AppSection.runtimes.blurb) {
            if isLoading {
                LoadingPanel(title: "Inventorying Node.js, Python and Rust…")
            } else if let error {
                DataUnavailableView(title: "Runtimes Unavailable", detail: error, symbol: "shippingbox")
            } else if let report {
                nodeSection(report.node)
                pythonSection(report.python)
                rustSection(report.rust)
            }
        }
        .task(id: model.refreshToken) { await load() }
    }

    private func exe(_ x: CommandExecutable?) -> String {
        guard let x else { return "not found" }
        return "\(Formatters.shortenHome(x.path)) · \(x.originLabel)\(x.version.map { " · \($0)" } ?? "")"
    }

    @ViewBuilder
    private func nodeSection(_ node: NodeInventory) -> some View {
        SectionCard("Node.js", detail: node.managers.isEmpty ? "No version manager detected." : "Version managers present: \(node.managers.joined(separator: ", "))") {
            KeyValueList(rows: [("node", exe(node.activeNode)), ("npm", exe(node.activeNpm))])
            if let mismatch = node.npmMismatch {
                Callout(symbol: "exclamationmark.triangle.fill", color: .orange, title: "npm belongs to a different Node than node",
                        text: "node lives in \(Formatters.shortenHome(mismatch.nodePrefix)) but npm comes from \(Formatters.shortenHome(mismatch.npmPrefix))\(mismatch.npmOwnerNodeVersion.map { " (Node \($0))" } ?? ""). Global installs land in the other Node.")
            }
            if node.installations.isEmpty {
                Text("No Node.js installation found.").foregroundStyle(.secondary)
            } else {
                Table(node.installations) {
                    TableColumn("") { i in
                        if i.active { Image(systemName: "checkmark.circle.fill").foregroundStyle(.green).help("Active in a fresh login shell") }
                    }
                    .width(24)
                    TableColumn("Installed by") { i in Text(i.label).fontWeight(i.active ? .semibold : .regular) }
                        .width(min: 120, ideal: 160)
                    TableColumn("Version") { i in Text(i.version ?? "—").font(.system(.body, design: .monospaced)) }
                        .width(100)
                    TableColumn("Location") { i in Text(Formatters.shortenHome(i.binary)).font(.system(.caption, design: .monospaced)).lineLimit(1) }
                }
                .devDoctorTable(minHeight: CGFloat(min(260, 60 + node.installations.count * 30)))
            }
            ForEach(Array(node.notes.enumerated()), id: \.offset) { _, note in
                Label(note, systemImage: "info.circle").font(.caption).foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private func pythonSection(_ python: PythonInventory) -> some View {
        SectionCard("Python") {
            KeyValueList(rows: [("python3", exe(python.python3)), ("python", python.pythonAlias.map { "alias → \($0)" } ?? exe(python.python)), ("pip3", exe(python.pip3)), ("pip", exe(python.pip))])
            if let mismatch = python.pythonPython3Mismatch {
                Callout(symbol: "exclamationmark.triangle.fill", color: .orange, title: "python and python3 differ", text: mismatch)
            }
            ForEach(python.pipMismatches) { m in
                Callout(symbol: "exclamationmark.triangle.fill", color: .orange, title: "\(m.pipCommand) installs into another Python",
                        text: "\(m.pipCommand) (\(Formatters.shortenHome(m.pipPath))) installs packages for \(Formatters.shortenHome(m.pipInterpreter)), but \(m.pythonCommand) runs \(Formatters.shortenHome(m.pythonPath)). Packages seem to install but stay invisible.")
            }
            if python.installations.isEmpty {
                Text("No Python installation found.").foregroundStyle(.secondary)
            } else {
                Table(python.installations) {
                    TableColumn("") { i in
                        if i.active { Image(systemName: "checkmark.circle.fill").foregroundStyle(.green).help("Active in a fresh login shell") }
                    }
                    .width(24)
                    TableColumn("Installed by") { i in Text(i.label).fontWeight(i.active ? .semibold : .regular) }
                        .width(min: 120, ideal: 170)
                    TableColumn("Version") { i in Text(i.version ?? "—").font(.system(.body, design: .monospaced)) }
                        .width(100)
                    TableColumn("Location") { i in Text(Formatters.shortenHome(i.binary)).font(.system(.caption, design: .monospaced)).lineLimit(1) }
                }
                .devDoctorTable(minHeight: CGFloat(min(260, 60 + python.installations.count * 30)))
            }
            if !python.brokenLinks.isEmpty {
                Callout(symbol: "link.badge.plus", color: .orange, title: "Broken Python links", text: python.brokenLinks.joined(separator: ", "))
            }
            ForEach(Array(python.notes.enumerated()), id: \.offset) { _, note in
                Label(note, systemImage: "info.circle").font(.caption).foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private func rustSection(_ rust: RustInventory) -> some View {
        SectionCard("Rust") {
            KeyValueList(rows: [
                ("rustup", rust.rustupInstalled ? "installed in \(Formatters.shortenHome(rust.rustupHome))" : "not installed"),
                ("cargo", exe(rust.cargo)),
                ("~/.cargo/bin in PATH", rust.cargoBinInPath ? "yes" : "no"),
                ("Default toolchain", rust.defaultToolchain ?? "—"),
                ("Toolchains", rust.toolchains.isEmpty ? "—" : rust.toolchains.map(\.name).joined(separator: ", ")),
                ("Installed binaries", rust.installedCrates.isEmpty ? "—" : rust.installedCrates.map { "\($0.name) \($0.version)" }.joined(separator: ", ")),
            ])
            ForEach(Array(rust.notes.enumerated()), id: \.offset) { _, note in
                Label(note, systemImage: "info.circle").font(.caption).foregroundStyle(.secondary)
            }
        }
    }

    private func load() async {
        isLoading = report == nil
        do {
            report = try await EngineClient.shared.runtimes()
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

struct PackagesView: View {
    @EnvironmentObject private var model: AppModel
    @State private var report: PackagesReport?
    @State private var isLoading = true
    @State private var error: String?
    @State private var filter = ""

    var body: some View {
        PageScaffold(title: "Packages", subtitle: AppSection.packages.blurb) {
            if isLoading {
                LoadingPanel(title: "Reading package managers…")
            } else if let error {
                DataUnavailableView(title: "Packages Unavailable", detail: error, symbol: "archivebox")
            } else if let report {
                SectionCard("Package managers") {
                    Table(report.managers) {
                        TableColumn("") { m in
                            Image(systemName: m.installed ? "checkmark.circle.fill" : "minus.circle").foregroundStyle(m.installed ? .green : .secondary)
                        }
                        .width(24)
                        TableColumn("Manager") { m in Text(m.name).fontWeight(.medium) }
                            .width(min: 100, ideal: 130)
                        TableColumn("Version") { m in Text(m.version ?? "—").font(.system(.body, design: .monospaced)) }
                            .width(min: 90, ideal: 120)
                        TableColumn("Packages") { m in Text(m.packageCount.map(String.init) ?? "—").monospacedDigit() }
                            .width(80)
                        TableColumn("Location") { m in Text(m.location.map(Formatters.shortenHome) ?? "—").font(.system(.caption, design: .monospaced)).lineLimit(1) }
                            .width(min: 160, ideal: 260)
                        TableColumn("Cache") { m in Text(m.cachePath.map(Formatters.shortenHome) ?? "—").font(.system(.caption, design: .monospaced)).lineLimit(1) }
                    }
                    .devDoctorTable(minHeight: CGFloat(min(420, 60 + report.managers.count * 30)))
                }

                homebrew(report.homebrew)
            }
        }
        .task(id: model.refreshToken) { await load() }
    }

    @ViewBuilder
    private func homebrew(_ brew: HomebrewInventory) -> some View {
        SectionCard("Homebrew", detail: brew.installed ? "\(brew.version ?? "Homebrew") at \(brew.prefix ?? "?")" : "Not installed") {
            if brew.installed {
                HStack(spacing: 0) {
                    MetricCell(value: "\(brew.formulae.count)", label: "formulae", symbol: "shippingbox", tint: .orange)
                    Divider().frame(height: 36)
                    MetricCell(value: "\(brew.casks.count)", label: "casks", symbol: "app.badge", tint: .blue)
                    Divider().frame(height: 36)
                    MetricCell(value: "\(brew.brokenLinks.count)", label: "broken links", symbol: "link", tint: brew.brokenLinks.isEmpty ? .green : .orange)
                    Divider().frame(height: 36)
                    MetricCell(value: brew.inPath ? "yes" : "no", label: "brew in PATH", symbol: "point.topleft.down.to.point.bottomright.curvepath", tint: brew.inPath ? .green : .red)
                }
                .padding(.vertical, 10)
                .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 12))

                if let other = brew.otherPrefix {
                    Callout(symbol: "exclamationmark.triangle.fill", color: .orange, title: "Two Homebrew installations", text: "A second Homebrew lives in \(other). See the Problems page for the recommended cleanup.")
                }
                if !brew.versionedDuplicates.isEmpty {
                    Callout(symbol: "square.stack.3d.up", color: .blue, title: "Several versions installed", text: brew.versionedDuplicates.map { $0.joined(separator: " + ") }.joined(separator: " · "))
                }

                TextField("Filter formulae and casks", text: $filter)
                    .textFieldStyle(.roundedBorder)
                    .frame(maxWidth: 320)

                let formulae = brew.formulae.filter { filter.isEmpty || $0.name.localizedCaseInsensitiveContains(filter) }
                let casks = brew.casks.filter { filter.isEmpty || $0.name.localizedCaseInsensitiveContains(filter) }
                DisclosureGroup("Formulae (\(formulae.count))") {
                    Table(formulae) {
                        TableColumn("Formula") { f in Text(f.name) }
                        TableColumn("Versions") { f in Text(f.versions.joined(separator: ", ")).font(.system(.caption, design: .monospaced)) }
                        TableColumn("Linked") { f in Text(f.linked ? "yes" : "no").foregroundStyle(f.linked ? .primary : .secondary) }
                            .width(60)
                    }
                    .devDoctorTable(minHeight: CGFloat(min(360, 60 + formulae.count * 28)))
                }
                DisclosureGroup("Casks (\(casks.count))") {
                    Table(casks) {
                        TableColumn("Cask") { c in Text(c.name) }
                        TableColumn("Versions") { c in Text(c.versions.joined(separator: ", ")).font(.system(.caption, design: .monospaced)) }
                    }
                    .devDoctorTable(minHeight: CGFloat(min(300, 60 + casks.count * 28)))
                }
                if !brew.brokenLinks.isEmpty {
                    DisclosureGroup("Broken links (\(brew.brokenLinks.count))") {
                        ForEach(brew.brokenLinks) { l in
                            Text("\(l.link) → \(l.target)").font(.system(.caption, design: .monospaced)).textSelection(.enabled)
                        }
                    }
                }
            } else {
                Text("Homebrew was not found under \(brew.expectedPrefix).").foregroundStyle(.secondary)
            }
        }
    }

    private func load() async {
        isLoading = report == nil
        do {
            report = try await EngineClient.shared.packages()
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}
