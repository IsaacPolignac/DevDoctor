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
    @AppStorage(L10n.storageKey) private var languageChoice = AppLanguage.system.rawValue

    init() {
        L10n.activate(L10n.loadPreference())
    }

    private var language: AppLanguage { AppLanguage(rawValue: languageChoice) ?? .system }

    var body: some Scene {
        // Reading `languageChoice` here makes the scene (window title, menus) and, through
        // `.id`, every view rebuild when the language changes.
        let _ = L10n.activate(language)
        return Window(tr("Developer Environment"), id: "main") {
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
            .environment(\.locale, L10n.locale)
            .id(languageChoice)
            .preferredColorScheme((AppearanceMode(rawValue: appearanceMode) ?? .system).colorScheme)
            .frame(minWidth: 1160, minHeight: 680)
        }
        .defaultSize(width: 1320, height: 820)
        .windowResizability(.contentMinSize)
        .windowToolbarStyle(.unified(showsTitle: true))
        .restorationBehavior(.disabled)
        .commands {
            CommandMenu(tr("Diagnostics")) {
                Button(tr("Run Quick Check")) {
                    Task { await model.runScan() }
                }
                .keyboardShortcut("r", modifiers: [.command])
                .disabled(model.isScanning)

                Button(tr("Run Deep Check (includes brew doctor and storage)")) {
                    Task { await model.runScan(mode: .deep) }
                }
                .keyboardShortcut("r", modifiers: [.command, .shift])
                .disabled(model.isScanning)

                Button(tr("Measure Developer Storage")) {
                    Task { await model.runScan(mode: .storage) }
                }
                .disabled(model.isScanning)

                Divider()

                Button(tr("Take Snapshot")) {
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

                Button(model.isInspectorPresented && model.selectedFinding != nil ? tr("Hide Inspector") : tr("Show Inspector")) {
                    model.isInspectorPresented.toggle()
                }
                .keyboardShortcut("i", modifiers: [.command, .option])
                .disabled(model.selectedFinding == nil)
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
                .navigationSplitViewColumnWidth(min: 232, ideal: 248, max: 288)
        } detail: {
            Group {
                if !model.searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    SearchResultsView()
                } else {
                    selectedPage
                }
            }
            .navigationTitle(model.selection?.title ?? tr("Overview"))
            .searchable(text: $model.searchQuery, placement: .toolbar, prompt: tr("Search DevDoctor"))
            .toolbar {
                ToolbarItemGroup(placement: .primaryAction) {
                    Menu {
                        Button(tr("Quick Check")) { Task { await model.runScan() } }
                        Button(tr("Deep Check")) { Task { await model.runScan(mode: .deep) } }
                        Button(tr("Measure Developer Storage")) { Task { await model.runScan(mode: .storage) } }
                    } label: {
                        Label(tr("Run Scan"), systemImage: "arrow.clockwise")
                    } primaryAction: {
                        Task { await model.runScan() }
                    }
                    .help(tr("Run a quick check (⌘R); hold for deep and storage checks"))
                    .disabled(model.isScanning)

                    AppearanceMenu(appearance: $appearance, glassMode: $glassMode)

                    if model.selection == .overview || model.selection == .problems {
                        Button {
                            model.isInspectorPresented.toggle()
                        } label: {
                            Label(tr("Inspector"), systemImage: "sidebar.right")
                        }
                        .help(model.isInspectorPresented && model.selectedFinding != nil ? tr("Hide Inspector") : tr("Show Inspector"))
                        .disabled(model.selectedFinding == nil)
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
        .alert(tr("DevDoctor"), isPresented: Binding(
            get: { model.alertMessage != nil },
            set: { if !$0 { model.alertMessage = nil } }
        )) {
            Button(tr("OK")) { model.alertMessage = nil }
        } message: {
            Text(model.alertMessage ?? tr("An unknown error occurred."))
        }
    }

    @ViewBuilder
    private var selectedPage: some View {
        switch model.selection ?? .overview {
        case .overview:
            OverviewView(glassMode: glassMode)
        case .problems:
            ProblemsView(glassMode: glassMode)
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
            Label(tr("Appearance"), systemImage: appearance.symbol)
        }
        .help(tr("Appearance and Liquid Glass"))
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
                Text(tr("Appearance"))
                    .font(.headline)
                Text(tr("Choose how DevDoctor looks on this Mac."))
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
                Text(tr("Liquid Glass"))
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
                appearance == .system ? tr("Follows your Mac appearance") : tr("DevDoctor appearance override"),
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
                    Text(mode.title)
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
        .accessibilityLabel(mode.title)
        .accessibilityValue(isSelected ? tr("Selected") : tr("Not selected"))
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
                Text(mode.title)
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
        .accessibilityLabel(tr("%@ Liquid Glass", "\(mode.title)"))
        .accessibilityValue(isSelected ? tr("Selected") : tr("Not selected"))
    }
}
