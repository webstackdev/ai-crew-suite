import os
import json
import re
import urllib.request
import sys


def fetch_url(url, headers=None):
    """Utility to fetch raw data from external endpoints safely."""
    try:
        req = urllib.request.Request(url, headers=headers or {})
        with urllib.request.urlopen(req) as response:
            return response.read().decode("utf-8")
    except Exception as e:
        print(f"Error fetching URL {url}: {e}")
        return None


def ask_github_llm(token, prompt):
    """Queries GitHub Copilot's engine by exchanging tokens and sending a completion payload."""
    try:
        token_url = "https://api.github.com/copilot_internal/v2/token"
        token_req = urllib.request.Request(
            token_url,
            headers={
                "Authorization": f"Bearer {token}",
                "User-Agent": "Python-GHA-Sync-Audit",
            },
        )
        with urllib.request.urlopen(token_req) as token_resp:
            token_data = json.loads(token_resp.read().decode("utf-8"))
            copilot_token = token_data.get("token")

        if not copilot_token:
            print("❌ Failed to resolve an operational Copilot session proxy token.")
            return "Could not authorize GitHub Copilot proxy exchange."

        completions_url = "https://api.githubcopilot.com/chat/completions"
        payload = {
            "model": "gpt-4o-mini",
            "messages": [
                {
                    "role": "system",
                    "content": "You are a senior frontend engineer comparing JavaScript/TypeScript configuration changes.",
                },
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.1,
        }

        comp_req = urllib.request.Request(
            completions_url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {copilot_token}",
                "Content-Type": "application/json",
                "User-Agent": "Python-GHA-Sync-Audit",
            },
            method="POST",
        )

        with urllib.request.urlopen(comp_req) as comp_resp:
            res_data = json.loads(comp_resp.read().decode("utf-8"))
            return res_data["choices"][0]["message"]["content"]

    except Exception as e:
        print(f"⚠️ Native GitHub Copilot LLM proxy call failed: {e}")
        return "Could not generate AI analysis due to token validation or runtime timeout errors."


def main():
    github_token = os.getenv("GITHUB_TOKEN")
    if not github_token:
        print("❌ GITHUB_TOKEN is missing from execution environment.")
        sys.exit(1)

    # 1. Parse configuration to target the matching @backstage/cli version
    backstage_cli_version = None
    if os.path.exists("package.json"):
        with open("package.json", "r") as f:
            pkg = json.load(f)
            deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
            backstage_cli_version = deps.get("@backstage/cli")

    if (
        not backstage_cli_version
        or "*" in backstage_cli_version
        or "workspace" in backstage_cli_version
    ):
        if os.path.exists("yarn.lock"):
            with open("yarn.lock", "r") as f:
                lockfile_content = f.read()
                match = re.search(
                    r'"?@backstage/cli@.*[\s\S]*?version "([^"]+)"', lockfile_content
                )
                if match:
                    backstage_cli_version = match.group(1)

    if not backstage_cli_version:
        print("❌ Could not resolve the @backstage/cli version inside this workspace.")
        sys.exit(0)

    clean_version = re.sub(r"[^\d\.]", "", backstage_cli_version)
    print(
        f"🔍 Syncing alignment against upstream @backstage/cli version: {clean_version}"
    )

    # 2. Fetch the corresponding file version from upstream Spotify Backstage
    specific_tag_url = f"https://githubusercontent.com{clean_version}/packages/cli/config/eslint-factory.js"
    minor_version = ".".join(clean_version.split(".")[:2])
    fallback_branch_url = f"https://githubusercontent.com{minor_version}/packages/cli/config/eslint-factory.js"

    upstream_source = fetch_url(specific_tag_url)
    if not upstream_source or "404: Not Found" in upstream_source:
        upstream_source = fetch_url(fallback_branch_url)

    if not upstream_source or "404: Not Found" in upstream_source:
        print("⚠️ Failed to locate upstream eslint-factory.js for this version step.")
        sys.exit(0)

    # 3. Read your custom file
    local_config_path = "packages/config-eslint/src/index.ts"
    local_source = ""
    if os.path.exists(local_config_path):
        with open(local_config_path, "r") as f:
            local_source = f.read()

    # 4. Prompt the native AI to run a configuration gap assessment
    ai_prompt = f"""
    Our repository decouples Spotify Backstage configs into a separate ESM package. 
    Compare our local configuration against the upstream core '@backstage/cli' version ({clean_version}) content provided below.

    Task:
    Identify any new core eslint plugins, configurations, or critical custom rules introduced in the Upstream file that our Local file completely lacks. Summarize them in a short markdown bulleted list.

    --- UPSTREAM FILE CONTENT ---
    {upstream_source}

    --- OUR LOCAL FILE CONTENT ---
    {local_source}
    """

    print("🤖 Querying native GitHub Copilot LLM engine for diff analysis...")
    ai_analysis = ask_github_llm(github_token, ai_prompt)

    # 5. Build the GitHub PR markdown notification
    body = f"""### ⚠️ Upstream ESLint Config Alignment Check
The core upstream **@backstage/cli ({clean_version})** base configurations have been mapped against your local configuration to isolate structural changes.

#### 🤖 Copilot Gap Assessment Report:
{ai_analysis}

_Please review `{local_config_path}` if critical rules require structural adjustments to maintain upstream parity._"""

    # 6. Post the comment safely to the target GitHub Pull Request
    event_path = os.getenv("GITHUB_EVENT_PATH")
    if event_path:
        with open(event_path, "r") as f:
            event_data = json.load(f)

        pull_request = event_data.get("pull_request")
        if pull_request:
            comments_url = pull_request.get("comments_url")

            req = urllib.request.Request(
                comments_url,
                data=json.dumps({"body": body}).encode("utf-8"),
                headers={
                    "Authorization": f"token {github_token}",
                    "Content-Type": "application/json",
                    "User-Agent": "Python-GHA-Drift-Checker",
                },
                method="POST",
            )
            try:
                with urllib.request.urlopen(req) as resp:
                    if resp.status in (200, 201):
                        print(
                            "🎉 Alignment status comment posted to the Pull Request successfully."
                        )
            except Exception as e:
                print(f"❌ Failed to submit comment back to PR API endpoint: {e}")


if __name__ == "__main__":
    main()
