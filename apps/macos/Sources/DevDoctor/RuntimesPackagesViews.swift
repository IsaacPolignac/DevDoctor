import SwiftUI

struct RuntimesView: View {
    @EnvironmentObject private var model: AppModel
    @State private var report: RuntimesReport?
    @State private var isLoading = true
    @State private var error: String?

    var body: some View {
        PageScaffold(title: tr("Runtimes"), subtitle: AppSection.runtimes.blurb) {
            if isLoading {
                LoadingPanel(title: tr("Inventorying Node.js, Python and Rust…"))
            } else if let error {
                DataUnavailableView(title: tr("Runtimes Unavailable"), detail: error, symbol: "shippingbox")
            } else if let report {
                nodeSection(report.node)
                pythonSection(report.python)
                rustSection(report.rust)
            }
        }
        .task(id: model.refreshToken) { await load() }
    }

    private func exe(_ x: CommandExecutable?) -> String {
        guard let x else { return tr("not found") }
        return "\(Formatters.shortenHome(x.path)) · \(x.originLabel)\(x.version.map { " · \($0)" } ?? "")"
    }

    @ViewBuilder
    private func nodeSection(_ node: NodeInventory) -> some View {
        SectionCard(tr("Node.js"), detail: node.managers.isEmpty ? tr("No version manager detected.") : tr("Version managers present: %@", "\(node.managers.joined(separator: ", "))")) {
            KeyValueList(rows: [("node", exe(node.activeNode)), ("npm", exe(node.activeNpm))])
            if let mismatch = node.npmMismatch {
                Callout(symbol: "exclamationmark.triangle.fill", color: .orange, title: tr("npm belongs to a different Node than node"),
                        text: tr("node lives in %@ but npm comes from %@%@. Global installs land in the other Node.", "\(Formatters.shortenHome(mismatch.nodePrefix))", "\(Formatters.shortenHome(mismatch.npmPrefix))", "\(mismatch.npmOwnerNodeVersion.map { " (Node \($0))" } ?? "")"))
            }
            if node.installations.isEmpty {
                Text(tr("No Node.js installation found.")).foregroundStyle(.secondary)
            } else {
                Table(node.installations) {
                    TableColumn("") { i in
                        if i.active { Image(systemName: "checkmark.circle.fill").foregroundStyle(.green).help(tr("Active in a fresh login shell")) }
                    }
                    .width(24)
                    TableColumn(tr("Installed by")) { i in Text(i.label).fontWeight(i.active ? .semibold : .regular) }
                        .width(min: 120, ideal: 160)
                    TableColumn(tr("Version")) { i in Text(i.version ?? "—").font(.system(.body, design: .monospaced)) }
                        .width(100)
                    TableColumn(tr("Location")) { i in Text(Formatters.shortenHome(i.binary)).font(.system(.caption, design: .monospaced)).lineLimit(1) }
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
        SectionCard(tr("Python")) {
            KeyValueList(rows: [("python3", exe(python.python3)), ("python", python.pythonAlias.map { tr("alias → %@", "\($0)") } ?? exe(python.python)), ("pip3", exe(python.pip3)), ("pip", exe(python.pip))])
            if let mismatch = python.pythonPython3Mismatch {
                Callout(symbol: "exclamationmark.triangle.fill", color: .orange, title: tr("python and python3 differ"), text: mismatch)
            }
            ForEach(python.pipMismatches) { m in
                Callout(symbol: "exclamationmark.triangle.fill", color: .orange, title: tr("%@ installs into another Python", "\(m.pipCommand)"),
                        text: tr("%@ (%@) installs packages for %@, but %@ runs %@. Packages seem to install but stay invisible.", "\(m.pipCommand)", "\(Formatters.shortenHome(m.pipPath))", "\(Formatters.shortenHome(m.pipInterpreter))", "\(m.pythonCommand)", "\(Formatters.shortenHome(m.pythonPath))"))
            }
            if python.installations.isEmpty {
                Text(tr("No Python installation found.")).foregroundStyle(.secondary)
            } else {
                Table(python.installations) {
                    TableColumn("") { i in
                        if i.active { Image(systemName: "checkmark.circle.fill").foregroundStyle(.green).help(tr("Active in a fresh login shell")) }
                    }
                    .width(24)
                    TableColumn(tr("Installed by")) { i in Text(i.label).fontWeight(i.active ? .semibold : .regular) }
                        .width(min: 120, ideal: 170)
                    TableColumn(tr("Version")) { i in Text(i.version ?? "—").font(.system(.body, design: .monospaced)) }
                        .width(100)
                    TableColumn(tr("Location")) { i in Text(Formatters.shortenHome(i.binary)).font(.system(.caption, design: .monospaced)).lineLimit(1) }
                }
                .devDoctorTable(minHeight: CGFloat(min(260, 60 + python.installations.count * 30)))
            }
            if !python.brokenLinks.isEmpty {
                Callout(symbol: "link.badge.plus", color: .orange, title: tr("Broken Python links"), text: python.brokenLinks.joined(separator: ", "))
            }
            ForEach(Array(python.notes.enumerated()), id: \.offset) { _, note in
                Label(note, systemImage: "info.circle").font(.caption).foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private func rustSection(_ rust: RustInventory) -> some View {
        SectionCard(tr("Rust")) {
            KeyValueList(rows: [
                ("rustup", rust.rustupInstalled ? tr("installed in %@", "\(Formatters.shortenHome(rust.rustupHome))") : tr("not installed")),
                ("cargo", exe(rust.cargo)),
                (tr("~/.cargo/bin in PATH"), rust.cargoBinInPath ? "yes" : "no"),
                (tr("Default toolchain"), rust.defaultToolchain ?? "—"),
                (tr("Toolchains"), rust.toolchains.isEmpty ? "—" : rust.toolchains.map(\.name).joined(separator: ", ")),
                (tr("Installed binaries"), rust.installedCrates.isEmpty ? "—" : rust.installedCrates.map { "\($0.name) \($0.version)" }.joined(separator: ", ")),
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
        PageScaffold(title: tr("Packages"), subtitle: AppSection.packages.blurb) {
            if isLoading {
                LoadingPanel(title: tr("Reading package managers…"))
            } else if let error {
                DataUnavailableView(title: tr("Packages Unavailable"), detail: error, symbol: "archivebox")
            } else if let report {
                SectionCard(tr("Package managers")) {
                    Table(report.managers) {
                        TableColumn("") { m in
                            Image(systemName: m.installed ? "checkmark.circle.fill" : "minus.circle").foregroundStyle(m.installed ? .green : .secondary)
                        }
                        .width(24)
                        TableColumn(tr("Manager")) { m in Text(m.name).fontWeight(.medium) }
                            .width(min: 100, ideal: 130)
                        TableColumn(tr("Version")) { m in Text(m.version ?? "—").font(.system(.body, design: .monospaced)) }
                            .width(min: 90, ideal: 120)
                        TableColumn(tr("Packages")) { m in Text(m.packageCount.map(String.init) ?? "—").monospacedDigit() }
                            .width(80)
                        TableColumn(tr("Location")) { m in Text(m.location.map(Formatters.shortenHome) ?? "—").font(.system(.caption, design: .monospaced)).lineLimit(1) }
                            .width(min: 160, ideal: 260)
                        TableColumn(tr("Cache")) { m in Text(m.cachePath.map(Formatters.shortenHome) ?? "—").font(.system(.caption, design: .monospaced)).lineLimit(1) }
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
        SectionCard(tr("Homebrew"), detail: brew.installed ? "\(brew.version ?? "Homebrew") at \(brew.prefix ?? "?")" : tr("Not installed")) {
            if brew.installed {
                HStack(spacing: 0) {
                    MetricCell(value: "\(brew.formulae.count)", label: tr("formulae"), symbol: "shippingbox", tint: .orange)
                    Divider().frame(height: 36)
                    MetricCell(value: "\(brew.casks.count)", label: tr("casks"), symbol: "app.badge", tint: .blue)
                    Divider().frame(height: 36)
                    MetricCell(value: "\(brew.brokenLinks.count)", label: tr("broken links"), symbol: "link", tint: brew.brokenLinks.isEmpty ? .green : .orange)
                    Divider().frame(height: 36)
                    MetricCell(value: brew.inPath ? "yes" : "no", label: tr("brew in PATH"), symbol: "point.topleft.down.to.point.bottomright.curvepath", tint: brew.inPath ? .green : .red)
                }
                .padding(.vertical, 10)
                .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 12))

                if let other = brew.otherPrefix {
                    Callout(symbol: "exclamationmark.triangle.fill", color: .orange, title: tr("Two Homebrew installations"), text: tr("A second Homebrew lives in %@. See the Problems page for the recommended cleanup.", "\(other)"))
                }
                if !brew.versionedDuplicates.isEmpty {
                    Callout(symbol: "square.stack.3d.up", color: .blue, title: tr("Several versions installed"), text: brew.versionedDuplicates.map { $0.joined(separator: " + ") }.joined(separator: " · "))
                }

                TextField(tr("Filter formulae and casks"), text: $filter)
                    .textFieldStyle(.roundedBorder)
                    .frame(maxWidth: 320)

                let formulae = brew.formulae.filter { filter.isEmpty || $0.name.localizedCaseInsensitiveContains(filter) }
                let casks = brew.casks.filter { filter.isEmpty || $0.name.localizedCaseInsensitiveContains(filter) }
                DisclosureGroup(tr("Formulae (%@)", "\(formulae.count)")) {
                    Table(formulae) {
                        TableColumn(tr("Formula")) { f in Text(f.name) }
                        TableColumn(tr("Versions")) { f in Text(f.versions.joined(separator: ", ")).font(.system(.caption, design: .monospaced)) }
                        TableColumn(tr("Linked")) { f in Text(f.linked ? "yes" : "no").foregroundStyle(f.linked ? .primary : .secondary) }
                            .width(60)
                    }
                    .devDoctorTable(minHeight: CGFloat(min(360, 60 + formulae.count * 28)))
                }
                DisclosureGroup(tr("Casks (%@)", "\(casks.count)")) {
                    Table(casks) {
                        TableColumn(tr("Cask")) { c in Text(c.name) }
                        TableColumn(tr("Versions")) { c in Text(c.versions.joined(separator: ", ")).font(.system(.caption, design: .monospaced)) }
                    }
                    .devDoctorTable(minHeight: CGFloat(min(300, 60 + casks.count * 28)))
                }
                if !brew.brokenLinks.isEmpty {
                    DisclosureGroup(tr("Broken links (%@)", "\(brew.brokenLinks.count)")) {
                        ForEach(brew.brokenLinks) { l in
                            Text("\(l.link) → \(l.target)").font(.system(.caption, design: .monospaced)).textSelection(.enabled)
                        }
                    }
                }
            } else {
                Text(tr("Homebrew was not found under %@.", "\(brew.expectedPrefix)")).foregroundStyle(.secondary)
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
