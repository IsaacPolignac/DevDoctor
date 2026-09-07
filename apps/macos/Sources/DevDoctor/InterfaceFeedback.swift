import AppKit

@MainActor
enum InterfaceFeedback {
    private static var activeSound: NSSound?

    static func scanCompleted() {
        guard UserDefaults.standard.bool(forKey: "soundEffectsEnabled"), NSApp.isActive else { return }
        activeSound?.stop()
        guard let sound = NSSound(named: NSSound.Name("Tink"))?.copy() as? NSSound else { return }
        sound.volume = 0.22
        activeSound = sound
        sound.play()
    }
}
