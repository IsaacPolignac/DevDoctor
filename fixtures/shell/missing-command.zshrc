# References a tool directory that no longer exists and sources a script that is gone.
export PATH="$HOME/.nonexistent-tool/bin:$PATH"
source "$HOME/.config/removed-tool/init.sh"
[ -f "$HOME/.optional.zsh" ] && source "$HOME/.optional.zsh"
