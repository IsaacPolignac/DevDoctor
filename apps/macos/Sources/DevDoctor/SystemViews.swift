import SwiftUI

struct StorageView: View {
    @EnvironmentObject private var model: AppModel
    @State private var report: StorageReport?
    @State private var selectedID: String?
    @State private var isLoading = true
    @State private var scanningProjects = false
    @State private var error: String?

    private var selected: StorageCategory? { report?.categories.first { $0.id == selectedID } }

    var body: some View {
        PageScaffold(
            title: tr("Developer Storage"),
            subtitle: AppSection.storage.blurb
        ) {
            if isLoading {
                LoadingPanel(title: scanningProjects ? tr("Scanning project folders…") : tr("Measuring developer storage…"))
            } else if let error {
                DataUnavailableView(title: tr("Storage Scan Unavailable"), detail: error, symbol: "internaldrive")
            } else if let report {
                InsetPanel {
                    HStack(spacing: 20) {
                        ZStack {
                            Circle().fill(.blue.opacity(0.12))
                            Image(systemName: "internaldrive.fill")
                                .font(.system(size: 28))
                                .foregroundStyle(.blue)
                        }
                        .frame(width: 62, height: 62)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(Formatters.byteString(report.totalBytes))
                                .font(.title2.monospacedDigit().weight(.semibold))
                            Text(tr("Developer data measured across %@ categories", "\(report.categories.filter(\.exists).count)"))
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Button(report.projectsScanned ? tr("Scan Again") : tr("Include Projects…")) {
                            Task { await load(scanProjects: true) }
                        }
                        .buttonStyle(.glassProminent)
                    }
                }

                Table(report.categories.filter(\.exists), selection: $selectedID) {
                    TableColumn(tr("Category")) { category in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(category.label).fontWeight(.medium)
                            Text(category.description).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                        }
                    }
                    .width(min: 200, ideal: 310)
                    TableColumn(tr("Size")) { category in
                        Text(Formatters.byteString(category.bytes)).monospacedDigit()
                    }
                    .width(100)
                    TableColumn(tr("Files")) { category in
                        Text("\(category.files)").monospacedDigit()
                    }
                    .width(75)
                    TableColumn(tr("Type")) { category in
                        Text(category.recreatable ? tr("Re-creatable") : tr("Review carefully"))
                            .foregroundStyle(category.recreatable ? Color.secondary : Color.orange)
                    }
                    .width(120)
                    TableColumn(tr("Locations")) { category in
                        Text(category.paths.first ?? "—").font(.system(.caption, design: .monospaced)).lineLimit(1)
                    }
                    .width(min: 180, ideal: 300)
                }
                .frame(minHeight: 360)
                .tableStyle(.inset(alternatesRowBackgrounds: false))
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(.separator.opacity(0.5), lineWidth: 0.5))

                if let selected {
                    InsetPanel {
                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                Text(selected.label).font(.headline)
                                Spacer()
                                StatusPill(
                                    text: selected.recreatable ? tr("Re-creatable data") : tr("Contains user data"),
                                    symbol: selected.recreatable ? "arrow.clockwise" : "exclamationmark.shield",
                                    color: selected.recreatable ? .green : .orange
                                )
                            }
                            Text(selected.description).foregroundStyle(.secondary)
                            ForEach(selected.paths, id: \.self) { path in
                                Text(path).font(.system(.caption, design: .monospaced)).textSelection(.enabled)
                            }
                            Label(selected.recreatable ? tr("Caches can be cleared from the Problems page when they grow large; the tool re-downloads what it needs.") : tr("Contains data that cannot be recreated. Nothing is removed from this screen."), systemImage: "lock.shield")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }

                if report.projectsScanned {
                    ProjectArtifacts(report: report)
                }
            }
        }
        .task { await load(scanProjects: false) }
        .onChange(of: model.refreshToken) { _, _ in
            if report?.projectsScanned == true { Task { await load(scanProjects: true) } }
        }
    }

    private func load(scanProjects: Bool) async {
        isLoading = report == nil
        scanningProjects = scanProjects
        error = nil
        do {
            report = try await EngineClient.shared.storage(scanProjects: scanProjects)
            model.storageReport = report
            if selectedID == nil { selectedID = report?.categories.first(where: \.exists)?.id }
        } catch {
            self.error = error.localizedDescription
        }
        scanningProjects = false
        isLoading = false
    }
}

private struct ProjectArtifacts: View {
    @EnvironmentObject private var model: AppModel
    let report: StorageReport

    private var items: [(String, [StorageItem], Int64, Bool)] {
        [
            (tr("Node Modules"), report.nodeModules, report.nodeModulesBytes, true),
            (tr("Virtual Environments"), report.venvs, report.venvsBytes, true),
            (tr("Build Directories"), report.buildDirs, report.buildBytes, false)
        ]
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeading(tr("Project Artifacts"), detail: tr("Large generated folders found in your project roots. Dependencies can be deleted after a preview and recreated by the project's package manager."))
            ForEach(items, id: \.0) { title, artifacts, bytes, deletable in
                DisclosureGroup {
                    VStack(spacing: 0) {
                        ForEach(artifacts.prefix(40)) { artifact in
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    HStack(spacing: 6) {
                                        Text(artifact.projectName ?? Formatters.shortenHome(artifact.projectPath ?? artifact.path)).font(.subheadline)
                                        if artifact.broken == true { StatusPill(text: tr("broken"), symbol: "exclamationmark.triangle", color: .orange) }
                                        if let pm = artifact.packageManager { Text(pm).font(.caption2).foregroundStyle(.secondary) }
                                        if let py = artifact.pythonVersion { Text(tr("Python %@", "\(py)")).font(.caption2).foregroundStyle(.secondary) }
                                        if let ago = artifact.lastActivitySecsAgo { Text(tr("last activity %@", "\(Formatters.ago(seconds: ago))")).font(.caption2).foregroundStyle(.secondary) }
                                    }
                                    Text(Formatters.shortenHome(artifact.path)).font(.system(.caption, design: .monospaced)).foregroundStyle(.secondary).lineLimit(1)
                                }
                                Spacer()
                                Text(Formatters.byteString(artifact.bytes)).monospacedDigit()
                                if deletable {
                                    Button(tr("Delete…")) {
                                        Task {
                                            await model.previewClean(title == tr("Node Modules") ? .nodeModules(path: artifact.path) : .venv(path: artifact.path))
                                        }
                                    }
                                    .buttonStyle(.glass)
                                    .controlSize(.small)
                                }
                            }
                            .padding(.vertical, 7)
                            if artifact.id != artifacts.prefix(40).last?.id { Divider() }
                        }
                    }
                    .padding(.top, 8)
                } label: {
                    HStack {
                        Text(title).fontWeight(.medium)
                        Spacer()
                        Text("\(artifacts.count) · \(Formatters.byteString(bytes))")
                            .foregroundStyle(.secondary)
                            .monospacedDigit()
                    }
                }
                .padding(14)
                .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(.separator.opacity(0.45), lineWidth: 0.5))
            }
        }
    }
}

struct LocalAIView: View {
    @EnvironmentObject private var model: AppModel
    @State private var report: LocalAIReport?
    @State private var isLoading = true
    @State private var error: String?

    var body: some View {
        PageScaffold(
            title: tr("Local AI"),
            subtitle: AppSection.localAI.blurb
        ) {
            if isLoading {
                LoadingPanel(title: tr("Inspecting local model stores…"))
            } else if let error {
                DataUnavailableView(title: tr("Local AI Unavailable"), detail: error, symbol: "cpu")
            } else if let report {
                HStack(spacing: 0) {
                    MetricCell(value: Formatters.byteString(report.totalBytes), label: tr("Total model data"), symbol: "internaldrive", tint: .blue)
                    Divider().frame(height: 36)
                    MetricCell(value: "\(report.sources.filter(\.present).count)", label: tr("Model stores"), symbol: "square.stack.3d.up", tint: .purple)
                    Divider().frame(height: 36)
                    MetricCell(value: "\(report.ollama.models.count)", label: tr("Ollama models"), symbol: "shippingbox", tint: .orange)
                    Divider().frame(height: 36)
                    MetricCell(value: report.ollama.running ? tr("Running") : tr("Stopped"), label: tr("Ollama service"), symbol: "bolt.horizontal", tint: report.ollama.running ? .green : .secondary)
                }
                .padding(.vertical, 18)
                .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 16))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(.separator.opacity(0.5), lineWidth: 0.5))

                if report.ollama.installed, !report.ollama.models.isEmpty {
                    SectionCard(tr("Ollama models"), detail: tr("%@ models · %@ in %@", "\(report.ollama.models.count)", "\(Formatters.byteString(report.ollama.totalBytes))", "\(Formatters.shortenHome(report.ollama.modelsDir))")) {
                        ForEach(report.ollama.models) { m in
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(m.name).font(.subheadline)
                                    Text([m.family, m.parameterSize, m.quantization].compactMap { $0 }.joined(separator: " · ") + (m.modifiedSecsAgo.map { tr(" · modified %@", "\(Formatters.ago(seconds: $0))") } ?? ""))
                                        .font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                                Text(Formatters.byteString(m.size)).monospacedDigit()
                                Button(tr("Remove…")) {
                                    Task { await model.previewClean(.ollamaModel(name: m.name)) }
                                }
                                .buttonStyle(.glass)
                                .controlSize(.small)
                            }
                            .padding(.vertical, 4)
                            if m.id != report.ollama.models.last?.id { Divider() }
                        }
                    }
                }

                VStack(alignment: .leading, spacing: 12) {
                    SectionHeading(tr("Model Stores"), detail: tr("Locations recognized by the diagnostic engine"))
                    ForEach(report.sources) { source in
                        DisclosureGroup {
                            VStack(alignment: .leading, spacing: 10) {
                                Text(source.description).font(.caption).foregroundStyle(.secondary)
                                Text(source.root).font(.system(.caption, design: .monospaced)).textSelection(.enabled)
                                ForEach(source.models) { model in
                                    HStack {
                                        Image(systemName: "cube.transparent")
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(model.name)
                                            Text(model.path).font(.system(.caption2, design: .monospaced)).foregroundStyle(.secondary).lineLimit(1)
                                        }
                                        Spacer()
                                        Text(Formatters.byteString(model.bytes)).monospacedDigit()
                                    }
                                }
                            }
                            .padding(.top, 10)
                        } label: {
                            HStack(spacing: 10) {
                                Image(systemName: source.present ? "checkmark.circle.fill" : "minus.circle")
                                    .foregroundStyle(source.present ? .green : .secondary)
                                Text(source.label).fontWeight(.medium)
                                Spacer()
                                Text(source.present ? Formatters.byteString(source.bytes) : "Not found")
                                    .foregroundStyle(.secondary)
                                    .monospacedDigit()
                            }
                        }
                        .padding(14)
                        .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(.separator.opacity(0.45), lineWidth: 0.5))
                    }
                }

                if report.ollama.orphanBlobs > 0 {
                    InsetPanel {
                        HStack {
                            Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(.orange)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(tr("Unused Ollama blobs")).font(.headline)
                                Text(tr("%@ blobs use %@. Review them before any cleanup.", "\(report.ollama.orphanBlobs)", "\(Formatters.byteString(report.ollama.orphanBlobBytes))"))
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                        }
                    }
                }
            }
        }
        .task(id: model.refreshToken) { await load() }
    }

    private func load() async {
        isLoading = report == nil
        do {
            report = try await EngineClient.shared.localAI()
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}
