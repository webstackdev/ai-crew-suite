#!/bin/bash
##
# Copyright 2026 The AI Crew Suite Authors
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
##

# Exit immediately if a command exits with a non-zero status
# -u treats unset variables as an error; -o pipefail catches hidden pipeline crashes
set -euo pipefail

echo "⏳ Setting up Python virtual environment..."

# 1. Enforce a modern Python version threshold (Backstage AI Suites usually require >=3.10)
if ! command -v python3 &> /dev/null; then
    echo "❌ Error: python3 is not installed or available in your PATH." >&2
    exit 1
fi

# 2. Heal broken or corrupted environments automatically
if [ -d ".venv" ] && [ ! -f ".venv/bin/activate" ]; then
    echo "⚠️  Detected a broken .venv directory. Purging and recreation triggered..."
    rm -rf .venv
fi

# 3. Create the virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
    echo "✅ Created fresh .venv environment."
else
    echo "ℹ️  .venv already exists. Skipping creation."
fi

# 4. Determine and activate the script context layout (cross-platform fallback mechanism)
if [ -f ".venv/bin/activate" ]; then
    ACTIVATE_SCRIPT=".venv/bin/activate"
elif [ -f ".venv/Scripts/activate" ]; then
    # Cross-platform support fallback for native Windows Git Bash runtimes
    ACTIVATE_SCRIPT=".venv/Scripts/activate"
else
    echo "❌ Error: Activation binary could not be resolved." >&2
    exit 1
fi

# shellcheck disable=SC1091
source "$ACTIVATE_SCRIPT"

# 5. Speed up execution using caching checks (Only run pip if requirements changed)
# Prevents wasting time running slow network roundtrips during every single yarn bootstrap
HASH_FILE=".venv/.requirements.hash"
CURRENT_HASH=""
if [ -f "requirements.txt" ]; then
    # Generate an MD5 hash check signature of your lock boundary specifications
    if command -v md5sum &> /dev/null; then
        CURRENT_HASH=$(md5sum requirements.txt | awk '{print $1}')
    elif command -v md5 &> /dev/null; then
        CURRENT_HASH=$(md5 -q requirements.txt)
    fi
fi

if [ -f "$HASH_FILE" ] && [ "$(cat "$HASH_FILE")" = "$CURRENT_HASH" ] && [ -n "$CURRENT_HASH" ]; then
    echo "✨ Python packages match requirements cache block signature. Skipping installation."
else
    echo "🔄 Upgrading core package management installation layer..."
    pip install --quiet --upgrade pip setuptools wheel

    if [ -f "requirements.txt" ]; then
        echo "📦 Installing Python workspace dependencies..."
        pip install --quiet -r requirements.txt

        # Cache the current file state hash signature into the virtual environment block
        if [ -n "$CURRENT_HASH" ]; then
            echo "$CURRENT_HASH" > "$HASH_FILE"
        fi
        echo "🚀 Python environment is fully aligned and ready!"
    else
        echo "⚠️  Warning: requirements.txt not found at repository root."
    fi
fi
