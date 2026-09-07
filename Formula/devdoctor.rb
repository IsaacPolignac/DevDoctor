# Homebrew formula for the DevDoctor CLI. Publish it from a tap
# (`brew tap IsaacPolignac/devdoctor https://github.com/IsaacPolignac/DevDoctor`, then
# `brew install devdoctor`). `scripts/update-formula.sh <version>` refreshes url and sha256 after
# each release.
class Devdoctor < Formula
  desc "Find what broke your development environment and fix it safely"
  homepage "https://github.com/IsaacPolignac/DevDoctor"
  url "https://github.com/IsaacPolignac/DevDoctor/archive/refs/tags/v0.2.0.tar.gz"
  sha256 "0f581eb98d8e1d5ee3a78b39ae2da7e2032c5bb5463c3c4876a92753a5621e22"
  license "MIT"
  head "https://github.com/IsaacPolignac/DevDoctor.git", branch: "main"

  depends_on "rust" => :build
  depends_on :macos

  def install
    system "cargo", "install", *std_cargo_args(path: "crates/devdoctor-cli")
    generate_completions_from_executable(bin/"devdoctor", "completions")
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/devdoctor --version")
    ENV["DEVDOCTOR_HOME"] = testpath/"data"
    assert_match "detector", shell_output("#{bin}/devdoctor detectors")
  end
end
