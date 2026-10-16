# fagplan — terminal shortcuts for the studieplan repo.
#
#   fagplan                     start the page (python3 serve.py)
#   fagplan update "message"    git add . / git commit -m "message" / git push
#   fagplan "message"           same as update
#   fagplan help                show this help
#
# Installed by one line in ~/.zshrc:
#   source "$HOME/Github/studieplan/fagplan.sh"
# Because ~/.zshrc loads this file from the repo, changes to it apply
# to every new terminal — nothing to reinstall.

# The folder this file is in (works in both zsh and bash)
if [ -n "$ZSH_VERSION" ]; then
  FAGPLAN_DIR="${${(%):-%x}:A:h}"
else
  FAGPLAN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

_fagplan_help() {
  echo "fagplan                     start the page (python3 serve.py)"
  echo "fagplan update \"message\"    git add, commit with the message, and push"
  echo "fagplan \"message\"           same as update"
  echo "fagplan help                show this help"
}

# git add . / git commit -m "message" / git push, run in the repo folder
_fagplan_save() {
  local message="$1"
  if [ -z "$message" ]; then
    echo "Write a commit message, e.g.:  fagplan update \"Øving 9 levert\""
    return 1
  fi

  (
    cd "$FAGPLAN_DIR" || exit 1
    git add . || exit 1

    if git diff --cached --quiet; then
      echo "Nothing new to commit."
    else
      git commit -m "$message" || exit 1
    fi

    # Push; the first time, also link the branch to origin
    if git rev-parse --abbrev-ref --symbolic-full-name "@{u}" >/dev/null 2>&1; then
      git push
    else
      git push --set-upstream origin HEAD
    fi
  )
}

fagplan() {
  case "$1" in
    "")
      # Run in a subshell so your terminal stays in the folder you were in
      (cd "$FAGPLAN_DIR" && python3 serve.py)
      ;;
    help | -h | --help)
      _fagplan_help
      ;;
    update)
      shift
      _fagplan_save "$*"
      ;;
    *)
      _fagplan_save "$*"
      ;;
  esac
}
