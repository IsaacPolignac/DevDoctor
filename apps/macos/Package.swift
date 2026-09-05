// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "DevDoctor",
    defaultLocalization: "en",
    platforms: [
        .macOS("26.0")
    ],
    products: [
        .executable(name: "DevDoctor", targets: ["DevDoctor"])
    ],
    targets: [
        .executableTarget(
            name: "DevDoctor",
            path: "Sources/DevDoctor",
            resources: [
                .process("Resources")
            ]
        )
    ]
)
