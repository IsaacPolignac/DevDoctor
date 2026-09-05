import AppKit
import SwiftUI

@MainActor
final class DevDoctorAppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        presentMainWindow(attempt: 0)
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        presentMainWindow(attempt: 0)
        return true
    }

    private func presentMainWindow(attempt: Int) {
        guard let window = NSApp.windows.first(where: { candidate in
            !(candidate is NSPanel) && candidate.styleMask.contains(.titled) && candidate.contentView != nil
        }) else {
            if attempt < 20 {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                    self.presentMainWindow(attempt: attempt + 1)
                }
            }
            return
        }

        if window.frame.width < 1160 || window.frame.height < 680 {
            window.setContentSize(NSSize(width: 1320, height: 820))
            window.center()
        }
        window.makeKeyAndOrderFront(nil)
        window.orderFrontRegardless()
        NSApp.activate(ignoringOtherApps: true)
    }
}

@main
struct DevDoctorApp: App {
    @NSApplicationDelegateAdaptor(DevDoctorAppDelegate.self) private var appDelegate
    @StateObject private var model = AppModel()
    @AppStorage("appearanceMode") private var appearanceMode = AppearanceMode.system.rawValue
    @AppStorage("glassMode") private var glassMode = GlassMode.clear.rawValue

    var body: some Scene {
        Window("Developer Environment", id: "main") {
            RootView(
                appearance: Binding(
                    get: { AppearanceMode(rawValue: appearanceMode) ?? .system },
                    set: { appearanceMode = $0.rawValue }
                ),
                glassMode: Binding(
                    get: { GlassMode(rawValue: glassMode) ?? .clear },
                    set: { glassMode = $0.rawValue }
                )
            )
            .environmentObject(model)
            .preferredColorScheme((AppearanceMode(rawValue: appearanceMode) ?? .system).colorScheme)
            .frame(minWidth: 1160, minHeight: 680)
        }
        .defaultSize(width: 1320, height: 820)
        .windowResizability(.contentMinSize)
        .windowToolbarStyle(.unified(showsTitle: true))
        .restorationBehavior(.disabled)
        .commands {
            CommandMenu("Diagnostics") {
                Button("Run Quick Check") {
                    Task { await model.runScan() }
                }
                .keyboardShortcut("r", modifiers: [.command])
                .disabled(model.isScanning)

                Button("Run Deep Check (includes brew doctor and storage)") {
                    Task { await model.runScan(mode: .deep) }
                }
                .keyboardShortcut("r", modifiers: [.command, .shift])
                .disabled(model.isScanning)

                Button("Measure Developer Storage") {
                    Task { await model.runScan(mode: .storage) }
                }
                .disabled(model.isScanning)

                Divider()

                Button("Take Snapshot") {
                    Task {
                        do {
                            _ = try await EngineClient.shared.createSnapshot(baseline: false)
                            await model.refreshState()
                        } catch {
                            model.alertMessage = error.localizedDescription
                        }
                    }
                }
                .keyboardShortcut("s", modifiers: [.command, .shift])

                Divider()

                Button(model.isInspectorPresented ? "Hide Inspector" : "Show Inspector") {
                    model.isInspectorPresented.toggle()
                }
                .keyboardShortcut("i", modifiers: [.command, .option])
            }
        }
    }
}

struct RootView: View {
    @EnvironmentObject private var model: AppModel
    @Binding var appearance: AppearanceMode
    @Binding var glassMode: GlassMode

    var body: some View {
        NavigationSplitView {
            SidebarView(selection: $model.selection)
                .navigationSplitViewColumnWidth(min: 205, ideal: 220, max: 255)
        } detail: {
            Group {
                if !model.searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    SearchResultsView()
                } else {
                    selectedPage
                }
            }
            .navigationTitle(model.selection?.rawValue ?? "Overview")
            .searchable(text: $model.searchQuery, placement: .toolbar, prompt: "Search DevDoctor")
            .toolbar {
                ToolbarItemGroup(placement: .primaryAction) {
                    Menu {
                        Button("Quick Check") { Task { await model.runScan() } }
                        Button("Deep Check") { Task { await model.runScan(mode: .deep) } }
                        Button("Measure Developer Storage") { Task { await model.runScan(mode: .storage) } }
                    } label: {
                        Label("Run Scan", systemImage: "arrow.clockwise")
                    } primaryAction: {
                        Task { await model.runScan() }
                    }
                    .help("Run a quick check (⌘R); hold for deep and storage checks")
                    .disabled(model.isScanning)

                    AppearanceMenu(appearance: $appearance, glassMode: $glassMode)

                    if model.selection == .overview || model.selection == .problems {
                        Button {
                            model.isInspectorPresented.toggle()
                        } label: {
                            Label("Inspector", systemImage: "sidebar.right")
                        }
                        .help(model.isInspectorPresented ? "Hide Inspector" : "Show Inspector")
                    }
                }
            }
        }
        .navigationSplitViewStyle(.balanced)
        .task { await model.bootstrap() }
        .sheet(isPresented: $model.showingRepairPreview, onDismiss: { model.cancelPending() }) {
            RepairPreviewSheet()
        }
        .sheet(item: $model.completedTransaction) { transaction in
            TransactionResultSheet(transaction: transaction)
        }
        .alert("DevDoctor", isPresented: Binding(
            get: { model.alertMessage != nil },
            set: { if !$0 { model.alertMessage = nil } }
        )) {
            Button("OK") { model.alertMessage = nil }
        } message: {
            Text(model.alertMessage ?? "An unknown error occurred.")
        }
    }

    @ViewBuilder
    private var selectedPage: some View {
        switch model.selection ?? .overview {
        case .overview:
            OverviewView(glassMode: glassMode)
        case .problems:
            ProblemsView()
        case .shell:
            ShellView()
        case .path:
            PathExplorerView()
        case .runtimes:
            RuntimesView()
        case .packages:
            PackagesView()
        case .tools:
            ToolsView()
        case .processes:
            ProcessesView()
        case .ports:
            PortsView()
        case .services:
            ServicesView()
        case .storage:
            StorageView()
        case .localAI:
            LocalAIView()
        case .git:
            GitView()
        case .ssh:
            SshView()
        case .changes:
            ChangesView()
        case .history:
            HistoryView()
        case .settings:
            SettingsView(appearance: $appearance, glassMode: $glassMode)
        }
    }
}

struct AppearanceMenu: View {
    @Binding var appearance: AppearanceMode
    @Binding var glassMode: GlassMode
    @State private var isPresented = false

    var body: some View {
        Button {
            isPresented.toggle()
        } label: {
            Label("Appearance", systemImage: appearance.symbol)
        }
        .help("Appearance and Liquid Glass")
        .popover(isPresented: $isPresented, arrowEdge: .top) {
            AppearancePopover(appearance: $appearance, glassMode: $glassMode)
        }
    }
}

private struct AppearancePopover: View {
    @Binding var appearance: AppearanceMode
    @Binding var glassMode: GlassMode

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 3) {
                Text("Appearance")
                    .font(.headline)
                Text("Choose how DevDoctor looks on this Mac.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            HStack(spacing: 10) {
                ForEach(AppearanceMode.allCases) { mode in
                    AppearanceChoice(mode: mode, isSelected: appearance == mode) {
                        appearance = mode
                    }
                }
            }

            Divider()

            VStack(alignment: .leading, spacing: 10) {
                Text("Liquid Glass")
                    .font(.subheadline.weight(.semibold))

                HStack(spacing: 12) {
                    ForEach(GlassMode.allCases) { mode in
                        GlassChoice(mode: mode, isSelected: glassMode == mode) {
                            glassMode = mode
                        }
                    }
                }
            }

            Label(
                appearance == .system ? "Follows your Mac appearance" : "DevDoctor appearance override",
                systemImage: appearance == .system ? "macbook" : "circle.lefthalf.filled"
            )
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .padding(18)
        .frame(width: 330)
    }
}

private struct AppearanceChoice: View {
    let mode: AppearanceMode
    let isSelected: Bool
    let action: () -> Void

    private var previewColor: Color {
        switch mode {
        case .system: return .blue
        case .light: return .white
        case .dark: return Color(nsColor: .darkGray)
        }
    }

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(previewColor)
                    Image(systemName: mode.symbol)
                        .font(.system(size: 20, weight: .medium))
                        .foregroundStyle(mode == .light ? .black.opacity(0.72) : .white)
                }
                .frame(height: 54)
                .overlay {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(isSelected ? Color.accentColor : Color(nsColor: .separatorColor), lineWidth: isSelected ? 2.5 : 0.5)
                }

                HStack(spacing: 4) {
                    Text(mode.rawValue)
                    if isSelected {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(.blue)
                    }
                }
                .font(.caption.weight(isSelected ? .semibold : .regular))
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(mode.rawValue)
        .accessibilityValue(isSelected ? "Selected" : "Not selected")
    }
}

private struct GlassChoice: View {
    let mode: GlassMode
    let isSelected: Bool
    let action: () -> Void

    private var glass: Glass {
        mode == .clear ? .clear : .regular.tint(.blue.opacity(0.22))
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 9) {
                Image(systemName: mode == .clear ? "drop" : "paintpalette")
                    .font(.system(size: 15, weight: .semibold))
                Text(mode.rawValue)
                    .font(.subheadline.weight(.medium))
                Spacer(minLength: 0)
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.blue)
                }
            }
            .padding(.horizontal, 12)
            .frame(height: 46)
            .frame(maxWidth: .infinity)
            .glassEffect(glass.interactive(), in: .rect(cornerRadius: 14))
            .overlay {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(isSelected ? Color.accentColor.opacity(0.85) : .clear, lineWidth: 1.5)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(mode.rawValue) Liquid Glass")
        .accessibilityValue(isSelected ? "Selected" : "Not selected")
    }
}
