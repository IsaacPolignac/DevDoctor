import SwiftUI

struct ProcessesView: View {
    @EnvironmentObject private var model: AppModel
    @State private var processes: [DevProcess] = []
    @State private var selectedPID: Int?
    @State private var pendingStop: DevProcess?
    @State private var isLoading = true
    @State private var error: String?

    private var selected: DevProcess? { processes.first { $0.pid == selectedPID } }

    var body: some View {
        PageScaffold(
            title: "Processes",
            subtitle: AppSection.processes.blurb
        ) {
            if isLoading {
                LoadingPanel(title: "Reading active processes…")
            } else if let error {
                DataUnavailableView(title: "Processes Unavailable", detail: error, symbol: "waveform.path.ecg")
            } else {
                HStack {
                    StatusPill(text: "\(processes.count) development", symbol: "waveform.path.ecg", color: .blue)
                    if processes.contains(where: \.stale) {
                        StatusPill(text: "\(processes.filter(\.stale).count) stale", symbol: "clock.badge.exclamationmark", color: .orange)
                    }
                    Spacer()
                    Button { Task { await load() } } label: {
                        Label("Refresh", systemImage: "arrow.clockwise")
                    }
                }

                Table(processes, selection: $selectedPID) {
                    TableColumn("Process") { process in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(process.label).fontWeight(.medium).lineLimit(1)
                            Text(process.kindLabel).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    .width(min: 150, ideal: 210)
                    TableColumn("PID") { process in
                        Text("\(process.pid)").font(.system(.body, design: .monospaced))
                    }
                    .width(70)
                    TableColumn("Project") { process in
                        Text(process.projectPath ?? process.cwd ?? "—").lineLimit(1).foregroundStyle(.secondary)
                    }
                    .width(min: 180, ideal: 300)
                    TableColumn("CPU") { process in
                        Text(process.cpuPercent.map { String(format: "%.1f%%", $0) } ?? "—").monospacedDigit()
                    }
                    .width(65)
                    TableColumn("Memory") { process in
                        Text(process.memoryBytes.map(Formatters.byteString) ?? "—").monospacedDigit()
                    }
                    .width(85)
                    TableColumn("Ports") { process in
                        Text(process.ports.isEmpty ? "—" : process.ports.map(String.init).joined(separator: ", "))
                            .monospacedDigit()
                    }
                    .width(85)
                }
                .frame(minHeight: 380)
                .tableStyle(.inset(alternatesRowBackgrounds: false))
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(.separator.opacity(0.5), lineWidth: 0.5))

                if let selected {
                    InsetPanel {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(selected.label).font(.headline)
                                    Text("PID \(selected.pid) · \(selected.kindLabel)")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                if selected.stale {
                                    StatusPill(text: "Possibly stale", symbol: "clock.badge.exclamationmark", color: .orange)
                                }
                                Button("Stop Process…", role: .destructive) { pendingStop = selected }
                                    .disabled(!selected.stoppable)
                            }
                            Text(selected.command)
                                .font(.system(.caption, design: .monospaced))
                                .textSelection(.enabled)
                                .padding(10)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(Color(nsColor: .textBackgroundColor), in: RoundedRectangle(cornerRadius: 8))
                            if let reason = selected.notStoppableReason {
                                Label(reason, systemImage: "lock").font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
        }
        .task(id: model.refreshToken) { await load() }
        .alert("Stop \(pendingStop?.label ?? "process")?", isPresented: Binding(
            get: { pendingStop != nil },
            set: { if !$0 { pendingStop = nil } }
        )) {
            Button("Cancel", role: .cancel) { pendingStop = nil }
            Button("Stop Process", role: .destructive) {
                guard let process = pendingStop else { return }
                pendingStop = nil
                Task { await stop(process) }
            }
        } message: {
            Text("DevDoctor will send a normal termination request to PID \(pendingStop?.pid ?? 0). Unsaved work in that process may be lost.")
        }
    }

    private func load() async {
        isLoading = processes.isEmpty
        error = nil
        do {
            processes = try await EngineClient.shared.processes()
            if selectedPID == nil || !processes.contains(where: { $0.pid == selectedPID }) { selectedPID = processes.first?.pid }
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    private func stop(_ process: DevProcess) async {
        if await model.stopProcess(pid: process.pid) {
            await load()
        }
    }
}

struct PortsView: View {
    @EnvironmentObject private var model: AppModel
    @State private var ports: [PortEntry] = []
    @State private var selectedID: String?
    @State private var pendingStop: DevProcess?
    @State private var isLoading = true
    @State private var error: String?

    private var selected: PortEntry? { ports.first { $0.id == selectedID } }

    var body: some View {
        PageScaffold(
            title: "Ports",
            subtitle: AppSection.ports.blurb
        ) {
            if isLoading {
                LoadingPanel(title: "Inspecting listening ports…")
            } else if let error {
                DataUnavailableView(title: "Ports Unavailable", detail: error, symbol: "cable.connector")
            } else {
                HStack {
                    StatusPill(text: "\(ports.count) listeners", symbol: "antenna.radiowaves.left.and.right", color: .blue)
                    StatusPill(text: "\(ports.filter { $0.localOnly == true }.count) local only", symbol: "lock", color: .green)
                    Spacer()
                    Button { Task { await load() } } label: {
                        Label("Refresh", systemImage: "arrow.clockwise")
                    }
                }

                Table(ports, selection: $selectedID) {
                    TableColumn("Port") { entry in
                        Text("\(entry.port)").font(.system(.body, design: .monospaced)).fontWeight(.medium)
                    }
                    .width(70)
                    TableColumn("Process") { entry in
                        Text(entry.devProcess?.label ?? entry.processName ?? "Unknown")
                    }
                    .width(min: 150, ideal: 220)
                    TableColumn("PID") { entry in
                        Text(entry.pid.map(String.init) ?? "—").monospacedDigit()
                    }
                    .width(75)
                    TableColumn("Address") { entry in
                        Text(entry.address).font(.system(.body, design: .monospaced))
                    }
                    .width(min: 130, ideal: 170)
                    TableColumn("Exposure") { entry in
                        Label(entry.localOnly == true ? "This Mac" : "Network", systemImage: entry.localOnly == true ? "lock" : "network")
                            .foregroundStyle(entry.localOnly == true ? Color.secondary : Color.orange)
                    }
                    .width(110)
                    TableColumn("Project") { entry in
                        Text(entry.devProcess?.projectPath ?? "—").lineLimit(1).foregroundStyle(.secondary)
                    }
                    .width(min: 170, ideal: 280)
                }
                .frame(minHeight: 400)
                .tableStyle(.inset(alternatesRowBackgrounds: false))
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(.separator.opacity(0.5), lineWidth: 0.5))

                if let selected {
                    InsetPanel {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text("Port \(selected.port)").font(.headline)
                                Spacer()
                                StatusPill(
                                    text: selected.localOnly == true ? "Local only" : "Visible on network",
                                    symbol: selected.localOnly == true ? "lock.fill" : "network",
                                    color: selected.localOnly == true ? .green : .orange
                                )
                            }
                            if let process = selected.devProcess {
                                Text(process.command)
                                    .font(.system(.caption, design: .monospaced))
                                    .textSelection(.enabled)
                                if process.stoppable {
                                    Button("Stop \(process.label)…", role: .destructive) { pendingStop = process }
                                }
                            }
                        }
                    }
                }
            }
        }
        .task(id: model.refreshToken) { await load() }
        .alert("Stop \(pendingStop?.label ?? "process")?", isPresented: Binding(
            get: { pendingStop != nil },
            set: { if !$0 { pendingStop = nil } }
        )) {
            Button("Cancel", role: .cancel) { pendingStop = nil }
            Button("Stop Process", role: .destructive) {
                guard let process = pendingStop else { return }
                pendingStop = nil
                Task {
                    if await model.stopProcess(pid: process.pid) { await load() }
                }
            }
        } message: {
            Text("DevDoctor sends a normal termination request to PID \(pendingStop?.pid ?? 0). Unsaved work in that process may be lost.")
        }
    }

    private func load() async {
        isLoading = ports.isEmpty
        error = nil
        do {
            ports = try await EngineClient.shared.ports()
            if selectedID == nil || !ports.contains(where: { $0.id == selectedID }) { selectedID = ports.first?.id }
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}
