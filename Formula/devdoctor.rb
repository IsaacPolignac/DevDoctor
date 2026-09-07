# Homebrew formula for the DevDoctor CLI. Publish it from a tap
# (`brew tap IsaacPolignac/devdoctor https://github.com/IsaacPolignac/DevDoctor`, then
# `brew install devdoctor`). `scripts/update-formula.sh <version>` refreshes url and sha256 after
# each release.
class Devdoctor < Formula
  desc "Find what broke your development environment and fix it safely"
  homepage "https://github.com/IsaacPolignac/DevDoctor"
  url "https://github.com/IsaacPolignac/DevDoctor/archive/refs/tags/v0.2.1.tar.gz"
  sha256 "aa34c467fcb7d39235b905c1cc7a3949c90b87e5b88d79f1173290b70503878f"
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
