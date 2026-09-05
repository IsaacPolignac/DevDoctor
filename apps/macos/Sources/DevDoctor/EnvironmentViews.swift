import SwiftUI

struct PathExplorerView: View {
    @EnvironmentObject private var model: AppModel
    @State private var report: PathReport?
    @State private var selectedEntry: Int?
    @State private var command = "node"
    @State private var resolution: CommandResolution?
    @State private var isLoading = true
    @State private var isResolving = false
    @State private var error: String?

    private var selected: PathEntry? {
        report?.entries.first { $0.position == selectedEntry }
    }

    var body: some View {
        PageScaffold(
            title: "PATH Explorer",
            subtitle: AppSection.path.blurb
        ) {
            InsetPanel {
                VStack(alignment: .leading, spacing: 14) {
                    SectionHeading("Resolve a Command", detail: "Uses the same PATH captured by the diagnostic engine")
                    HStack {
                        TextField("Command, for example node", text: $command)
                            .textFieldStyle(.roundedBorder)
                            .onSubmit { Task { await resolve() } }
                        Button("Resolve") { Task { await resolve() } }
                            .buttonStyle(.glassProminent)
                            .disabled(command.trimmingCharacters(in: .whitespaces).isEmpty || isResolving)
                    }

                    if isResolving {
                        ProgressView().controlSize(.small)
                    } else if let resolution {
                        Divider()
                        HStack(alignment: .top, spacing: 12) {
                            Image(systemName: resolution.conflict == nil ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                                .foregroundStyle(resolution.conflict == nil ? .green : .orange)
                            VStack(alignment: .leading, spacing: 5) {
                                Text(resolution.active?.path ?? "Command not found")
                                    .font(.system(.body, design: .monospaced))
                                    .textSelection(.enabled)
                                if let version = resolution.active?.version {
                                    Text(version).font(.caption).foregroundStyle(.secondary)
                                }
                                if let conflict = resolution.conflict {
                                    Text(conflict).font(.caption).foregroundStyle(.orange)
                                }
                                ForEach(resolution.others, id: \.path) { other in
                                    Text("also: \(Formatters.shortenHome(other.path)) · \(other.originLabel)\(other.version.map { " · \($0)" } ?? "") (PATH position \(other.pathPosition))")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                ForEach(resolution.notes, id: \.self) { note in
                                    Text(note).font(.caption).foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }
            }

            if isLoading {
                LoadingPanel(title: "Reading shell configuration and PATH…")
            } else if let error {
                DataUnavailableView(title: "PATH Unavailable", detail: error, symbol: "exclamationmark.triangle")
            } else if let report {
                HStack {
                    StatusPill(text: "\(report.entries.count) entries", symbol: "list.number", color: .blue)
                    if report.duplicateCount > 0 {
                        StatusPill(text: "\(report.duplicateCount) duplicates", symbol: "doc.on.doc", color: .orange)
                    }
                    if report.missingCount > 0 {
                        StatusPill(text: "\(report.missingCount) missing", symbol: "questionmark.folder", color: .orange)
                    }
                    Spacer()
                }

                Table(report.entries, selection: $selectedEntry) {
                    TableColumn("#") { entry in
                        Text("\(entry.position)").monospacedDigit().foregroundStyle(.secondary)
                    }
                    .width(34)
                    TableColumn("Status") { entry in
                        Image(systemName: entry.exists ? (entry.isDuplicate ? "doc.on.doc" : "checkmark.circle") : "xmark.circle")
                            .foregroundStyle(entry.exists ? (entry.isDuplicate ? .orange : .green) : .red)
                    }
                    .width(50)
                    TableColumn("Directory") { entry in
                        Text(entry.raw).font(.system(.body, design: .monospaced)).lineLimit(1)
                    }
                    .width(min: 260, ideal: 430)
                    TableColumn("Origin") { entry in
                        Text(entry.originLabel).foregroundStyle(.secondary)
                    }
                    .width(min: 130, ideal: 180)
                    TableColumn("Executables") { entry in
                        Text(entry.executables.map(String.init) ?? "—").monospacedDigit()
                    }
                    .width(90)
                }
                .frame(minHeight: 370)
                .tableStyle(.inset(alternatesRowBackgrounds: false))
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(.separator.opacity(0.5), lineWidth: 0.5))

                if let selected {
                    InsetPanel {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Source").font(.headline)
                            if selected.sources.isEmpty {
                                Text(selected.sourceHint ?? selected.originLabel).foregroundStyle(.secondary)
                            } else {
                                ForEach(selected.sources) { source in
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text("\(source.file):\(source.line)")
                                            .font(.system(.caption, design: .monospaced))
                                            .foregroundStyle(.secondary)
                                        Text(source.statement)
                                            .font(.system(.caption, design: .monospaced))
                                            .textSelection(.enabled)
                                    }
                                }
                            }
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
            report = try await EngineClient.shared.path()
            if selectedEntry == nil { selectedEntry = report?.entries.first?.position }
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    private func resolve() async {
        isResolving = true
        do {
            resolution = try await EngineClient.shared.resolve(command.trimmingCharacters(in: .whitespacesAndNewlines))
        } catch {
            self.error = error.localizedDescription
        }
        isResolving = false
    }
}

struct ToolsView: View {
    @EnvironmentObject private var model: AppModel
    @State private var tools: [DevTool] = []
    @State private var selectedID: String?
    @State private var isLoading = true
    @State private var error: String?

    private var selected: DevTool? { tools.first { $0.id == selectedID } }

    var body: some View {
        PageScaffold(
            title: "Developer Tools",
            subtitle: AppSection.tools.blurb
        ) {
            if isLoading {
                LoadingPanel(title: "Inventorying developer tools…")
            } else if let error {
                DataUnavailableView(title: "Inventory Unavailable", detail: error, symbol: "shippingbox")
            } else {
                HStack {
                    StatusPill(text: "\(tools.filter(\.installed).count) installed", symbol: "checkmark.seal.fill", color: .green)
                    StatusPill(text: "\(tools.filter { !$0.installed }.count) not found", symbol: "minus.circle", color: .secondary)
                    Spacer()
                }

                Table(tools, selection: $selectedID) {
                    TableColumn("") { tool in
                        Image(systemName: tool.installed ? "checkmark.circle.fill" : "minus.circle")
                            .foregroundStyle(tool.installed ? .green : .secondary)
                    }
                    .width(28)
                    TableColumn("Tool") { tool in
                        Text(tool.name).fontWeight(.medium)
                    }
                    .width(min: 130, ideal: 180)
                    TableColumn("Version") { tool in
                        Text(tool.version ?? "—").font(.system(.body, design: .monospaced)).lineLimit(1)
                    }
                    .width(min: 150, ideal: 240)
                    TableColumn("Installation") { tool in
                        Text(tool.installMethod ?? "Not detected").foregroundStyle(.secondary)
                    }
                    .width(min: 130, ideal: 180)
                    TableColumn("Disk") { tool in
                        Text(tool.diskUsage.map(Formatters.byteString) ?? "—").monospacedDigit()
                    }
                    .width(90)
                }
                .frame(minHeight: 400)
                .tableStyle(.inset(alternatesRowBackgrounds: false))
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(.separator.opacity(0.5), lineWidth: 0.5))

                if let selected {
                    InsetPanel {
                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                Text(selected.name).font(.headline)
                                Spacer()
                                if selected.installed {
                                    StatusPill(text: "Installed", symbol: "checkmark", color: .green)
                                }
                            }
                            if let binary = selected.binary {
                                LabeledContent("Executable") {
                                    Text(Formatters.shortenHome(binary)).font(.system(.caption, design: .monospaced)).textSelection(.enabled)
                                }
                            }
                            if let app = selected.appBundle {
                                LabeledContent("Application") {
                                    Text(app).font(.system(.caption, design: .monospaced)).textSelection(.enabled)
                                }
                            }
                            if let method = selected.installMethod {
                                LabeledContent("Installed by") { Text(method) }
                            }
                            ForEach(selected.configPaths, id: \.self) { path in
                                LabeledContent("Configuration") {
                                    Text(path).font(.system(.caption, design: .monospaced)).textSelection(.enabled)
                                }
                            }
                            ForEach(selected.notes, id: \.self) { note in
                                Label(note, systemImage: "info.circle").font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
        }
        .task(id: model.refreshToken) { await load() }
    }

    private func load() async {
        isLoading = tools.isEmpty
        do {
            tools = try await EngineClient.shared.tools()
            if selectedID == nil { selectedID = tools.first(where: \.installed)?.id }
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}
