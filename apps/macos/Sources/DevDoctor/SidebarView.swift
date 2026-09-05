import SwiftUI

struct SidebarView: View {
    @EnvironmentObject private var model: AppModel
    @Binding var selection: AppSection?

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                DevDoctorAppIcon(size: 30)
                VStack(alignment: .leading, spacing: 0) {
                    Text("DevDoctor")
                        .font(.subheadline.weight(.semibold))
                    Text("Developer diagnostics")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 12)
            .padding(.top, 4)
            .padding(.bottom, 4)

            List(selection: $selection) {
                Section("Diagnose") {
                    SidebarRow(section: .overview)
                    SidebarRow(section: .problems, badge: model.openIssueCount == 0 ? nil : model.openIssueCount)
                }

                Section("Inspect") {
                    SidebarRow(section: .shell)
                    SidebarRow(section: .path)
                    SidebarRow(section: .runtimes)
                    SidebarRow(section: .packages)
                    SidebarRow(section: .tools)
                }

                Section("Activity") {
                    SidebarRow(section: .processes)
                    SidebarRow(section: .ports)
                    SidebarRow(section: .services)
                }

                Section("System") {
                    SidebarRow(section: .storage)
                    SidebarRow(section: .localAI)
                    SidebarRow(section: .git)
                    SidebarRow(section: .ssh)
                }

                Section("History") {
                    SidebarRow(section: .changes)
                    SidebarRow(section: .history)
                    SidebarRow(section: .settings)
                }
            }
            .listStyle(.sidebar)
            .environment(\.defaultMinListRowHeight, 26)

            Divider()
            HStack(spacing: 8) {
                Image(systemName: "lock.shield")
                    .foregroundStyle(.secondary)
                Text("Local by default · nothing leaves this Mac")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
        }
    }
}

private struct SidebarRow: View {
    let section: AppSection
    var badge: Int? = nil

    var body: some View {
        Label {
            HStack {
                Text(section.rawValue)
                Spacer()
                if let badge {
                    Text("\(badge)")
                        .font(.caption2.monospacedDigit().weight(.semibold))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 2)
                        .background(.quaternary, in: Capsule())
                }
            }
        } icon: {
            Image(systemName: section.symbol)
                .symbolRenderingMode(.hierarchical)
        }
        .tag(section)
    }
}
