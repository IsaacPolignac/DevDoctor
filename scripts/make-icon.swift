// Renders the DevDoctor app icon (a pulse line on a blue squircle) as a 1024x1024 PNG.
// Usage: swift scripts/make-icon.swift <output.png>
import AppKit
import CoreGraphics

let out = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "icon.png"
let size = 1024
guard let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0),
      let gctx = NSGraphicsContext(bitmapImageRep: rep) else { fatalError("no context") }
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = gctx
let ctx = gctx.cgContext
ctx.clear(CGRect(x: 0, y: 0, width: size, height: size))

// macOS icon grid: the squircle occupies ~824pt of the 1024 canvas.
let inset: CGFloat = 100
let rect = CGRect(x: inset, y: inset, width: CGFloat(size) - 2 * inset, height: CGFloat(size) - 2 * inset)
let radius: CGFloat = rect.width * 0.2237
let squircle = CGPath(roundedRect: rect, cornerWidth: radius, cornerHeight: radius, transform: nil)

// Drop shadow
ctx.saveGState()
ctx.setShadow(offset: CGSize(width: 0, height: -10), blur: 26, color: CGColor(gray: 0, alpha: 0.25))
ctx.setFillColor(CGColor(red: 0.05, green: 0.45, blue: 0.98, alpha: 1))
ctx.addPath(squircle)
ctx.fillPath()
ctx.restoreGState()

// Gradient body
ctx.saveGState()
ctx.addPath(squircle)
ctx.clip()
let space = CGColorSpaceCreateDeviceRGB()
let body = CGGradient(colorsSpace: space, colors: [
    CGColor(red: 0.40, green: 0.70, blue: 1.00, alpha: 1),
    CGColor(red: 0.13, green: 0.50, blue: 0.98, alpha: 1),
    CGColor(red: 0.03, green: 0.36, blue: 0.90, alpha: 1),
] as CFArray, locations: [0, 0.55, 1])!
ctx.drawLinearGradient(body, start: CGPoint(x: rect.midX, y: rect.maxY), end: CGPoint(x: rect.midX, y: rect.minY), options: [])
// Soft top highlight
let glow = CGGradient(colorsSpace: space, colors: [CGColor(gray: 1, alpha: 0.35), CGColor(gray: 1, alpha: 0)] as CFArray, locations: [0, 1])!
ctx.drawRadialGradient(glow, startCenter: CGPoint(x: rect.midX, y: rect.maxY + rect.height * 0.1), startRadius: 0, endCenter: CGPoint(x: rect.midX, y: rect.maxY + rect.height * 0.1), endRadius: rect.width * 0.75, options: [])
// Subtle inner edge
ctx.setStrokeColor(CGColor(gray: 1, alpha: 0.22))
ctx.setLineWidth(6)
ctx.addPath(CGPath(roundedRect: rect.insetBy(dx: 3, dy: 3), cornerWidth: radius - 3, cornerHeight: radius - 3, transform: nil))
ctx.strokePath()
ctx.restoreGState()

// Pulse line (24-unit design grid mapped into the central 60% of the tile)
let glyph = rect.insetBy(dx: rect.width * 0.19, dy: rect.height * 0.19)
func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
    CGPoint(x: glyph.minX + x / 24 * glyph.width, y: glyph.maxY - y / 24 * glyph.height)
}
let pulse: [(CGFloat, CGFloat)] = [(2, 12.5), (6.5, 12.5), (8.6, 6.5), (12.2, 18.5), (15, 9.5), (16.6, 12.5), (22, 12.5)]
ctx.saveGState()
ctx.setShadow(offset: CGSize(width: 0, height: -6), blur: 14, color: CGColor(gray: 0, alpha: 0.22))
ctx.setStrokeColor(CGColor.white)
ctx.setLineWidth(glyph.width * 0.085)
ctx.setLineCap(.round)
ctx.setLineJoin(.round)
ctx.move(to: pt(pulse[0].0, pulse[0].1))
for p in pulse.dropFirst() { ctx.addLine(to: pt(p.0, p.1)) }
ctx.strokePath()
ctx.restoreGState()

NSGraphicsContext.restoreGraphicsState()
guard let png = rep.representation(using: .png, properties: [:]) else { fatalError("png") }
try! png.write(to: URL(fileURLWithPath: out))
print("wrote \(out)")
