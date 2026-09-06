#!/bin/bash
##
# Copyright 2026 Webstack Builders, Inc.
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
set -e

echo "⏳ Setting up Python virtual environment..."

# 1. Create the virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
    echo "✅ Created .venv directory."
else
    echo "ℹ️  .venv already exists. Skipping creation."
fi

# 2. Determine the correct activation path (handles macOS/Linux)
# Note: For Windows Git Bash, this same path generally works.
ACTIVATE_SCRIPT=".venv/bin/activate"

if [ -f "$ACTIVATE_SCRIPT" ]; then
    # shellcheck disable=SC1091
    source "$ACTIVATE_SCRIPT"
else
    echo "❌ Error: Activation script not found at $ACTIVATE_SCRIPT"
    exit 1
fi

# 3. Upgrade package management tools
echo "🔄 Upgrading pip, setuptools, and wheel..."
pip install --upgrade pip setuptools wheel

# 4. Install dependencies (adjust the path if your requirements file is nested)
if [ -f "requirements.txt" ]; then
    echo "📦 Installing Python dependencies..."
    pip install -r requirements.txt
    echo "🚀 Python environment is ready!"
else
    echo "⚠️  Warning: requirements.txt not found at root. No packages installed."
fi
