import AppKit
import ImageIO
import UniformTypeIdentifiers
import WebKit

final class CaptureRunner: NSObject, WKNavigationDelegate {
    private let webView: WKWebView
    private let outputDirectory: URL
    private let pages: [(label: String, button: String, dark: Bool)] = [
        ("overview", "Overview", false),
        ("problems", "Problems", false),
        ("runtimes-tools", "Runtimes & Tools", false),
        ("developer-storage", "Developer Storage", true),
    ]
    private var pageIndex = 0
    private var images: [CGImage] = []

    init(url: URL, outputDirectory: URL) {
        self.outputDirectory = outputDirectory
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        webView = WKWebView(frame: NSRect(x: 0, y: 0, width: 1440, height: 900), configuration: configuration)
        super.init()
        webView.navigationDelegate = self
        webView.load(URLRequest(url: url))
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { self.captureNext() }
    }

    private func captureNext() {
        guard pageIndex < pages.count else {
            writeDemoGIF()
            NSApplication.shared.terminate(nil)
            return
        }

        let page = pages[pageIndex]
        let script = """
        (() => {
          const wanted = \(jsString(page.button));
          const button = [...document.querySelectorAll('button')]
            .find((item) => item.textContent.trim().startsWith(wanted));
          if (button) button.click();
          document.documentElement.setAttribute('data-theme', \(jsString(page.dark ? "dark" : "light")));
          document.documentElement.classList.toggle('system-dark', \(page.dark ? "true" : "false"));
          return Boolean(button);
        })()
        """
        webView.evaluateJavaScript(script) { _, error in
            if let error { fputs("Navigation script failed: \(error)\n", stderr) }
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { self.takeSnapshot(named: page.label) }
        }
    }

    private func takeSnapshot(named name: String) {
        let configuration = WKSnapshotConfiguration()
        configuration.rect = webView.bounds
        configuration.snapshotWidth = 1200
        webView.takeSnapshot(with: configuration) { image, error in
            guard let image, let tiff = image.tiffRepresentation,
                  let bitmap = NSBitmapImageRep(data: tiff),
                  let png = bitmap.representation(using: .png, properties: [:]),
                  let cgImage = bitmap.cgImage else {
                fputs("Snapshot failed: \(error?.localizedDescription ?? "unknown error")\n", stderr)
                NSApplication.shared.terminate(nil)
                return
            }
            let destination = self.outputDirectory.appendingPathComponent("demo-\(name).png")
            do {
                try png.write(to: destination)
                self.images.append(cgImage)
                print("Wrote \(destination.path)")
                self.pageIndex += 1
                self.captureNext()
            } catch {
                fputs("Could not write \(destination.path): \(error)\n", stderr)
                NSApplication.shared.terminate(nil)
            }
        }
    }

    private func writeDemoGIF() {
        let destinationURL = outputDirectory.appendingPathComponent("devdoctor-demo.gif")
        guard let destination = CGImageDestinationCreateWithURL(
            destinationURL as CFURL,
            UTType.gif.identifier as CFString,
            images.count,
            nil
        ) else {
            fputs("Could not create GIF destination\n", stderr)
            return
        }

        let loop = [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFLoopCount: 0]] as CFDictionary
        CGImageDestinationSetProperties(destination, loop)
        for image in images {
            let frame = [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFDelayTime: 1.35]] as CFDictionary
            CGImageDestinationAddImage(destination, image, frame)
        }
        if CGImageDestinationFinalize(destination) {
            print("Wrote \(destinationURL.path)")
        } else {
            fputs("Could not finalize GIF\n", stderr)
        }
    }

    private func jsString(_ value: String) -> String {
        let data = try! JSONSerialization.data(withJSONObject: [value])
        let array = String(decoding: data, as: UTF8.self)
        return String(array.dropFirst().dropLast())
    }
}

guard CommandLine.arguments.count == 3,
      let sourceURL = URL(string: CommandLine.arguments[1]) else {
    fputs("usage: capture-readme URL OUTPUT_DIRECTORY\n", stderr)
    exit(2)
}

let outputDirectory = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
try FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)
let app = NSApplication.shared
app.setActivationPolicy(.prohibited)
let runner = CaptureRunner(url: sourceURL, outputDirectory: outputDirectory)
withExtendedLifetime(runner) { app.run() }
