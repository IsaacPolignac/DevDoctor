# Homebrew formula for the DevDoctor CLI. Publish it from a tap
# (`brew tap YOUR_GITHUB_USER/devdoctor https://github.com/YOUR_GITHUB_USER/devdoctor`, then
# `brew install devdoctor`). `scripts/update-formula.sh <version>` refreshes url and sha256 after
# each release.
class Devdoctor < Formula
  desc "Find what broke your development environment and fix it safely"
  homepage "https://github.com/YOUR_GITHUB_USER/devdoctor"
  url "https://github.com/YOUR_GITHUB_USER/devdoctor/archive/refs/tags/v0.2.0.tar.gz"
  sha256 "REPLACE_WITH_SOURCE_TARBALL_SHA256"
  license "MIT"
  head "https://github.com/YOUR_GITHUB_USER/devdoctor.git", branch: "main"

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
