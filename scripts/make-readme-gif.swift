import AppKit
import ImageIO
import UniformTypeIdentifiers

guard CommandLine.arguments.count >= 4 else {
    fputs("usage: make-readme-gif OUTPUT.gif FRAME.png FRAME.png [...]\n", stderr)
    exit(2)
}

let output = URL(fileURLWithPath: CommandLine.arguments[1])
let framePaths = CommandLine.arguments.dropFirst(2)
let outputSize = NSSize(width: 1400, height: 900)

func renderedFrame(at path: String) -> CGImage? {
    guard let source = NSImage(contentsOfFile: path),
          let bitmap = NSBitmapImageRep(
              bitmapDataPlanes: nil,
              pixelsWide: Int(outputSize.width),
              pixelsHigh: Int(outputSize.height),
              bitsPerSample: 8,
              samplesPerPixel: 4,
        hasAlpha: true,
              isPlanar: false,
              colorSpaceName: .deviceRGB,
              bytesPerRow: 0,
              bitsPerPixel: 0
          ) else { return nil }

    bitmap.size = outputSize
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
    NSColor.black.setFill()
    NSRect(origin: .zero, size: outputSize).fill()

    let sourceRatio = source.size.width / source.size.height
    let outputRatio = outputSize.width / outputSize.height
    let drawnSize: NSSize
    if sourceRatio > outputRatio {
        drawnSize = NSSize(width: outputSize.width, height: outputSize.width / sourceRatio)
    } else {
        drawnSize = NSSize(width: outputSize.height * sourceRatio, height: outputSize.height)
    }
    let rect = NSRect(
        x: (outputSize.width - drawnSize.width) / 2,
        y: (outputSize.height - drawnSize.height) / 2,
        width: drawnSize.width,
        height: drawnSize.height
    )
    source.draw(in: rect, from: .zero, operation: .copy, fraction: 1)
    NSGraphicsContext.restoreGraphicsState()
    return bitmap.cgImage
}

let frames = framePaths.compactMap(renderedFrame)
guard frames.count == framePaths.count,
      let destination = CGImageDestinationCreateWithURL(
          output as CFURL,
          UTType.gif.identifier as CFString,
          frames.count,
          nil
      ) else {
    fputs("Could not read every frame or create the GIF.\n", stderr)
    exit(1)
}

CGImageDestinationSetProperties(
    destination,
    [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFLoopCount: 0]] as CFDictionary
)
for frame in frames {
    CGImageDestinationAddImage(
        destination,
        frame,
        [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFDelayTime: 1.6]] as CFDictionary
    )
}

guard CGImageDestinationFinalize(destination) else {
    fputs("Could not finalize the GIF.\n", stderr)
    exit(1)
}

print("Wrote \(output.path) with \(frames.count) frames")
