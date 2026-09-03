# A healthy zshrc: one prepend per tool, guarded sources, nothing duplicated.
export PATH="$HOME/.local/bin:$PATH"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
alias ll='ls -la'
eval "$(/opt/homebrew/bin/brew shellenv)"
