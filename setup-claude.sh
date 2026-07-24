#!/usr/bin/env bash
# Installs this repo's Claude skills so Claude Code / Cowork auto-discovers them.
set -e
cd "$(dirname "$0")"
mkdir -p .claude/skills
cp -R claude-skills/. .claude/skills/
echo "✅ Claude skills installed to .claude/skills — start Claude in this folder and they load automatically."
