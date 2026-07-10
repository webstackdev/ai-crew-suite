# Agentic Engineering Platform

## Backstage Native AI Capabilities

Backstage has an AI MCP Server as a Core Feature plugin, using `skills.sh` from Vercel to install community-published skills using `npx`. The `mcp-actions-backend` is an MCP Server implementation. It does not "launch" a separate server process in the way a standalone daemon would; rather, it turns your existing Backstage backend into an MCP-compliant server. Instead of communicating over local pipes (stdio), this plugin exposes MCP capabilities over HTTP/SSE (Server-Sent Events). This allows external agents (the "MCP Clients") to connect to your Backstage instance via a URL.

## Catalog

### Service Contextualizer (Knowledge)

- **The Task:** Answering contextual questions about any service in the Software Catalog (*"Who is the on-call?"*, *"Where are the logs?"*, *"Why did this service fail its last deployment?"*).
- **The Logic:** An agent "reads" a service's catalog metadata, recent deployments, and linked monitoring dashboards to synthesize answers in natural language.
- **Framework:** **RAG-based Agent** (either framework) backed by a vector store of catalog metadata and operational docs.

## Incident Response

### Incident Responder Assistant (Operations)

- **The Task:** Providing a "likely cause" summary when a service fails.
- **The Logic:** An agent monitors [Kubernetes](https://medium.com/@naeemulhaq/architecting-an-internal-developer-platform-idp-with-backstage-and-kubernetes-9ec6311d866d) status in Backstage and, upon failure, gathers logs, traces, and recent PRs to build a root-cause hypothesis.
- **Framework:** **LangGraph** for the stateful investigate → gather → summarize workflow.

### Post-Mortem Draft Generator (Reliability & Incident Management)

- **The Task:** Drafting post-incident timelines automatically.
- **The Logic:** After an incident is resolved in PagerDuty, a **CrewAI** agent gathers logs from Datadog, PR history from GitHub, and Slack chat logs to draft a "Timeline of Events" directly in Backstage TechDocs.
- **Framework:** **CrewAI** for the multi-source gather and collaborative drafting.

### On-Call Handover Assistant (Reliability & Incident Management)

- **The Task:** Briefing the incoming on-call engineer on the previous shift.
- **The Logic:** A **LangGraph** agent summarizes the most frequent alerts and service changes from the previous shift.
- **Framework:** **LangGraph** for the stateful aggregation and summarization flow.

## Pull Request Workflows

### Synthetic Test Generator (Code Quality)

- **The Task:** Automatically increasing test coverage for new PRs.
- **The Logic:** An agent reads a new PR and generates [unit tests or edge-case tests](https://www.sidetool.co/post/7-real-world-use-cases-for-ai-agents-in-modern-full-stack-teams/) targeting uncovered code paths.
- **Framework:** **LangGraph** for the read → generate → validate → submit cycle.

### PR Reviewer Agent (Code Quality & Security)

- **The Task:** Performing automated code review before a human sees the PR.
- **The Logic:** A **LangGraph** workflow runs security linting, style checks, and logic verification in sequence, producing a consolidated review comment.
- **Framework:** **LangGraph** for the multi-step lint → check → verify → comment pipeline.

### Automated Release Notes (Product & Delivery)

- **The Task:** Generating customer-facing release notes from merged PRs.
- **The Logic:** An agent aggregates all merged PRs since the last tag and generates [customer-facing release notes](https://aakashgupta.medium.com/21-ai-agent-use-cases-that-make-pms-10x-more-productive-most-pms-use-zero-47982523a75f).
- **Framework:** **LangGraph** for the gather → categorize → summarize → publish flow.

### Automated Security Remediation (Governance)

- **The Task:** Patching known vulnerabilities in Software Catalog components.
- **The Logic:** A **LangGraph** workflow detects a vulnerability, branches to check if a patch exists, and either opens a PR or initiates a "human-in-the-loop" approval state.
- **Framework:** **LangGraph** for the branching detect → check → patch/escalate decision graph.

### License & Legal Compliance Auditor (Governance)

- **The Task:** Ensuring new dependencies comply with corporate open-source policies.
- **The Logic:** A **CrewAI** crew consisting of a "Legal Analyst" and a "Software Engineer" agent reviews new dependencies and debates whether they align with policy.
- **Framework:** **CrewAI** for the adversarial review collaboration.

### Smart Dependency "Bridge Builder" (Migration)

- **The Task:** Handling major version migrations (e.g., migrating 50 services from Java 11 to Java 21).
- **The Logic:** Use **LangGraph** to manage the state of a massive migration. It picks a service, attempts an automated upgrade of the `pom.xml`, runs the CI/CD pipeline, analyzes the logs if it fails, and either fixes the code or creates a "Complexity Report" for a human to review.
- **Framework:** **LangGraph** because it requires a "Cyclic" loop (Try -> Fail -> Learn -> Try again).

## Scaffolder

### Smart Template Filler (Golden Path Provisioning)

- **The Task:** Replacing manual Scaffolder forms with natural-language service requests.
- **The Logic:** A dev describes their needs in plain English. The agent selects the correct Software Template and pre-fills the parameters.
- **Framework:** **LangGraph** for the multi-step parsing, template selection, and confirmation flow.

### IaC Generator (Golden Path Provisioning)

- **The Task:** Generating infrastructure code for new services based on their requirements.
- **The Logic:** A **CrewAI** agent specializes in [Terraform](https://dev.to/aws-builders/designing-an-internal-developer-platform-idp-on-aws-using-backstage-eks-terraform-3m88) or CloudFormation, producing the specific IaC needed for the service's compute, networking, and storage.
- **Framework:** **CrewAI** for role-based specialization (e.g., separate Terraform and CloudFormation experts).

### Policy Compliance Judge (Golden Path Provisioning)

- **The Task:** Intercepting Scaffolder requests to enforce corporate security policies.
- **The Logic:** A **LangGraph** node evaluates each request against policy rules, either approving it or entering a human-in-the-loop clarification state.
- **Framework:** **LangGraph** for the branching approve/reject/escalate decision graph.

### PRD to Scaffolder Pipeline (Product & Delivery)

- **The Task:** Turning a Product Requirement Document (PRD) into a ready-to-develop project scaffold.
- **The Logic:** An agent reads the PRD and creates the corresponding Jira epic, service boilerplate, and documentation structure in one go.
- **Framework:** **CrewAI** for the role-based breakdown (PM Agent, Engineer Agent, Doc Agent).

### Architecture Drift Detector (Governance)

- **The Task:** Flagging unapproved infrastructure changes ("shadow IT").
- **The Logic:** An agent compares the current infrastructure state (via the Kubernetes plugin) against the original Software Template definition and reports discrepancies.
- **Framework:** **LangGraph** for the continuous compare → detect → alert monitoring loop.

### The "Shadow IT" Detective (Governance)

- **The Task:** A **CrewAI** group that cross-references your Cloud Provider (AWS / Azure / GCP) resources against the **Backstage Software Catalog**.
- **The Logic:** One agent (the "Scout") lists all active S3 buckets or RDS instances; another (the "Archivist") checks if they are registered in Backstage. If not, a third agent (the "Communicator") pings the likely owner on Slack to ask them to register it via a Scaffolder template.
- **Framework:** **CrewAI** for the role-based coordination.

## TechDocs

### Documentation "Janitor" (Knowledge)

- **The Task:** Keeping TechDocs accurate and up to date.
- **The Logic:** A **CrewAI** crew (Writer, Researcher, Reviewer) identifies outdated READMEs or broken links in TechDocs and proposes PRs to fix them.
- **Framework:** **CrewAI** for the role-based writing/review collaboration.

## Other

### Automated "Tech Radar" Management (Strategic Planning)

- **The Task:** Maintaining the Backstage Tech Radar.
- **The Logic:** A **LangGraph** agent monitors all new PRs and `package.json` changes across the organization. If it sees a sudden spike in a new library (e.g., everyone is suddenly using *Vite* instead of *Webpack*), it automatically drafts a proposal to move that technology from "Assess" to "Adopt" on the company Tech Radar.
- **Framework:** **LangGraph** for the continuous state-tracking and long-running analysis.
- **Names:** Tech Debt Bounty Hunter, Agent Hunter, `code-quality-ai-bounties`

### The "Goldilocks" Alert Tuner (Operations)

- **The Task:** Reducing Alert Fatigue.
- **The Logic:** An agent monitors your PagerDuty or Opsgenie alerts. If an alert is triggered but consistently closed without any code changes or manual action (false positives), the agent opens a PR to your Terraform repository to tweak the threshold of that specific Prometheus alert.
- **Framework:** **LangGraph** to handle the "Observe -> Threshold Analysis -> PR" flow.
- Names: Alert Fatigue Optimizer, Agent Tuner, `pagerduty-ai-tuner`

### Codebase Tour Guide (Knowledge)

- **The Task:** Onboarding new developers to unfamiliar repositories.
- **The Logic:** A **LangGraph** agent uses RAG over the repo's source, docs, and PR history to answer questions and walk the developer through key areas of the codebase.
- **Framework:** **LangGraph** for stateful, conversational Q&A with retrieval.

### Cost Optimization Crew (Operations)

- **The Task:** Identifying underutilized cloud resources and recommending cost savings.
- **The Logic:** A **CrewAI** group (Analyst, FinOps Specialist) scans [cloud costs](https://mia-platform.eu/blog/why-ai-is-missing-link-in-developer-platforms/) and suggests specific resources to kill or resize.
- **Framework:** **CrewAI** for the role-based analysis and recommendation collaboration.

### Tech Debt Scout (Code Quality)

- **The Task:** Surfacing tech debt across the organization's repositories.
- **The Logic:** A crew periodically scans repositories for deprecated libraries or "TODO" comments, creating Jira tickets or Backstage Scorecard updates.
- **Framework:** **CrewAI** for the role-based scan (Scanner, Triager, Reporter).

### Predictive Scaling Advisor (Reliability & Incident Management)

- **The Task:** Recommending "Right-Sizing" actions for Kubernetes workloads.
- **The Logic:** An agent analyzes historical usage patterns in the Cost Insights plugin and suggests scaling adjustments.
- **Framework:** **LangGraph** for the long-running analysis and trend-detection cycle.

### Context-Aware Search (Developer Productivity)

- **The Task:** Answering complex cross-service questions that keyword search cannot handle.
- **The Logic:** Instead of simple keyword search, a [Knowledge Agent](https://www.harness.io/blog/the-ai-knowledge-agent-making-internal-developer-portals-smarter) uses RAG to answer questions like *"Which services will be affected if I deprecate the UserAuth v2 API?"*.
- **Framework:** **RAG-based Agent** (either framework) using a vector store of catalog and dependency data.

### RFC & Design Document Peer Reviewer (Developer Productivity)

- **The Task:** Providing initial feedback on new internal RFCs submitted via Backstage.
- **The Logic:** A **CrewAI** crew acts as a "Senior Architect" and "Security Lead" to review the RFC and produce structured feedback.
- **Framework:** **CrewAI** for the role-based multi-perspective review.

### Semantic Search for "Microservice Archeology"

- **The Task:** Finding "hidden" expertise.
- **The Logic:** Instead of searching for "User Service," a dev asks: *"Who knows the most about how our payment encryption worked back in 2022?"* An agent searches GitHub commit history, Jira tickets, and TechDocs to find the human who actually wrote the code, even if they aren't the current "Owner" listed in the catalog.
- **Framework:** **RAG-based Agent** (either framework) using a vector store of your internal docs.

