<!-- Please provide a clear, concise summary of what these changes achieve and the problem they solve. -->

### 🛠️ Scope of Changes

- **Type of Change**: [ ] New AI Feature/Tool | [ ] RAG/Plugin Refactor | [ ] Bug Fix | [ ] Maintenance
- **Target Workspaces**: *e.g., packages/plugin-rag-ai-core, packages/tool-crew-analyst*

### 🤖 AI Engine & Context Verification

- [ ] **Stream Evaluation**: Verified that SSE stream token parsers (`eventsource-parser` v3) function correctly without stalling.
- [ ] **LLM/RAG Fallbacks**: Confirmed proper error boundary responses are gracefully handled if the upstream vector database or model timeouts.

### 🍴 Forked Plugin Alignment (Roadie Vendor Sync)

- [ ] This PR modifies code inside a forked `RoadieHQ` experimental plugin workspace.
- [ ] Changes are backward-compatible with our active Backstage frontend routing shell.
- [ ] Code avoids direct `winston` logging imports and utilizes `coreServices.logger` exclusively.

---

### ✅ Development Quality Checklist

- [ ] **Automated Testing**: Added unit/integration tests (`turbo test`) and verified that end-to-end setups account for async streaming.
- [ ] **Type Safety**: Ran local typechecks (`yarn tsc`) to ensure cross-workspace dependency types align.
- [ ] **Versioning**: Added a changeset targeting the correct vendor workspace scope (`yarn changeset`).
- [ ] **Visual Validation**: Attached screenshots or terminal logs demonstrating successful stream generation or UI updates.
- [ ] **Documentation**: Updated the internal Backstage catalog annotations or local README files to reflect configuration updates.
