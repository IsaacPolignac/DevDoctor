import Foundation
import SwiftUI

/// Interface language. `system` follows the Mac's preferred languages; the others force one.
/// Diagnostic text produced by the engine (issue titles, explanations, evidence) stays in
/// English in this version; everything the app itself displays goes through `tr`.
enum AppLanguage: String, CaseIterable, Identifiable {
    case system
    case en
    case fr
    case es
    case zh = "zh-Hans"

    var id: String { rawValue }

    /// Name shown in the language picker, always in the language it designates.
    var title: String {
        switch self {
        case .system: tr("System")
        case .en: "English"
        case .fr: "Français"
        case .es: "Español"
        case .zh: "中文"
        }
    }

    /// The localisation to use: the forced one, or the best match among the Mac's preferences.
    var resolvedCode: String {
        switch self {
        case .system:
            Bundle.preferredLocalizations(from: L10n.supported, forPreferences: Locale.preferredLanguages).first ?? "en"
        default:
            rawValue
        }
    }
}

enum L10n {
    static let storageKey = "appLanguage"
    static let supported = ["en", "fr", "es", "zh-Hans"]

    /// The active language code (`en` or `fr`). Set by the app at launch and on every change.
    nonisolated(unsafe) private(set) static var code = "en"
    nonisolated(unsafe) private static var bundle: Bundle?

    static func activate(_ language: AppLanguage) {
        let resolved = language.resolvedCode
        code = resolved
        // SwiftPM lower-cases localisation folders (`zh-hans.lproj`) and bundle lookups are
        // case-sensitive, so try both spellings.
        bundle = resolved == "en"
            ? nil
            : [resolved, resolved.lowercased()]
                .compactMap { Bundle.module.url(forResource: $0, withExtension: "lproj") }
                .first
                .flatMap(Bundle.init(url:))
    }

    static var locale: Locale { Locale(identifier: code) }

    /// The stored preference, applied before the first view is built.
    static func loadPreference() -> AppLanguage {
        AppLanguage(rawValue: UserDefaults.standard.string(forKey: storageKey) ?? "") ?? .system
    }

    static func string(_ key: String) -> String {
        guard let bundle else { return key }
        return bundle.localizedString(forKey: key, value: key, table: nil)
    }
}

/// Translates an interface string. The English text is the key; a missing translation falls
/// back to it. Placeholders use `String(format:)` syntax (`%@`, `%lld`, positional `%1$@`).
func tr(_ key: String, _ args: CVarArg...) -> String {
    let template = L10n.string(key)
    return args.isEmpty ? template : String(format: template, locale: L10n.locale, arguments: args)
}

/// Renders trusted inline Markdown from DevDoctor copy and engine output. This keeps command
/// names visually distinct without exposing Markdown punctuation such as backticks in the UI.
func richText(_ markdown: String) -> Text {
    let options = AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)
    let attributed = (try? AttributedString(markdown: markdown, options: options)) ?? AttributedString(markdown)
    return Text(attributed)
}
