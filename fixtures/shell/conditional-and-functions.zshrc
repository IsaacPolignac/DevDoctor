if [ -d "$HOME/.cargo/bin" ]; then
  export PATH="$HOME/.cargo/bin:$PATH"
fi
use_old_node() {
  export PATH="$HOME/.nvm/versions/node/v16.0.0/bin:$PATH"
}
export PATH="$HOME/.cargo/bin:$PATH"
path=(/usr/local/go/bin $path)
typeset -U path
