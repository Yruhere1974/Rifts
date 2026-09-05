# Ratcheting Protocol

This repository follows the **Ratcheting** operating model. Every contribution must respect the progress already made and ensure that the baseline of quality and functionality never slips backward.

## ⚙️ The Core Rules

1.  **Never Backtrack**: If a feature works, it must stay working. Regressions are the only true failure.
2.  **Explicit Handoffs**: Every session should end with a clear summary of what was "ratcheted" (locked into place) and what remains "in flight."
3.  **Atomic Gains**: Make small, verifiable improvements. It is better to lock in one perfect line of code than ten lines of "maybe."
4.  **GitFlow Ratchet**: Follow GitFlow practices. Active work belongs in `develop`. Stable states must be merged to `main` and **tagged** with a version (e.g., `vYYYY.MM.DD-description`). The tag is the physical "click" of the ratchet.
5.  **Documentation is the Lock**: If it isn't documented in the repo or memory, the ratchet hasn't clicked.

## 🤝 Expectations for Agents

When you initialize in this environment:
- **Read the History**: Look at the last 3 commits to understand the current "click" of the ratchet.
- **Respect the Structure**: This repo is part of a segregated strategy. Do not leak concerns from other domains (Infra, Logic, Content) into this one.
- **Communicate the Click**: When you finish a task, explicitly state: *"Ratcheted [X] into [Repository Name]."*

## 🧬 Segregation & Communication Context

This repo is one piece of the Ummard/Simon ecosystem. To maintain context and prevent drift:

1.  **Project-Specific Ground Truth**: All project-related notes, architectural decisions (ADRs), and agent-to-agent handoffs MUST reside in the project's own GitHub repository.
2.  **The Communication Point (MANAGER_NOTES.md)**: Use `MANAGER_NOTES.md` as the central handoff point. 
    - **Managers/Architects**: Write intent, constraints, and requirements here.
    - **Staff/Developers (Gemini CLI)**: Read this file to initialize context and implement logic.
    - **SecOps (Guardian/Challenger)**: Leave audit notes and adversarial challenges in this file (or specialized SecOps notes) within the repo.
3.  **Context Anchoring**: Upon entering a project context, agents must first read the repository's notes to "sync" their short-term memory with the long-term project intent.
4.  **No "Mental Notes"**: If it isn't in the repo, it doesn't exist for the next session.

## 🤖 BMAD-Infused Agile Workflows

We have integrated the **BMad Method (BMM)** to provide structured, expert-driven collaboration. The **Primary Agent** hosts the BMAD core and coordinates the workflow.

### 1. Analysis & Discovery (The Analyst)
Before architecture, we perform deep discovery.
- **Asset Discovery:** Proactive Inquiry. Explicitly request real-world samples or data before generating logic. For Greenfield projects, confirm no assets exist before proceeding.
- **Product Brief:** Define vision, users, and success metrics.
- **Research:** Perform technical and domain research to ground decisions in data. Dissect acquired assets to identify edge cases.

### 2. Solutioning (The Architect)
Complex shifts require an explicit architecture phase.
- **Stack Selection & Analysis:** MANDATORY. Formally review and select the technology stack (language, frameworks, infrastructure). Document Pros/Cons and justify the choice based on the target ecosystem (e.g., .NET for Microsoft-centric targets).
- **Architecture Decisions:** Documented as ADRs (Architecture Decision Records).
- **Readiness Check:** Validate that PRDs and architecture are sufficient for implementation.

### 3. Implementation (The Developer)
Development is guided by structured workflows.
- **Quick Flow:** For rapid fixes, use the `bmad-quick-flow` (Understand → Investigate → Generate → Review).
- **Story-Driven Dev:** Large features are broken into Epics and Stories, implemented with adversarial self-checks.

### 4. Quality & Governance (The Scrum Master & SecOps)
Progress is verified against both functional and security engineering principles.
- **Ratcheting is the Final Lock:** No matter the workflow, the "Click" (Git tag + Handoff) remains the mandatory exit criteria.
- **DevSecOps Guardian (Mentor):** Invoked during architecture to drive **Reduced Complexity (NIST SA-8(7))** and perform **Criticality Analysis (NIST RA-9)**. Prevents security over-engineering.
- **SecOps Challenger (Adversary):** Invoked during implementation to challenge **Spaghetti Design (NIST SA-8(3/4))** and validate **Acceptable Security (NIST SA-8(28))**. Ensures the design is testable and user-friendly.
- **Party Mode:** For high-stakes decisions, invoke multiple personas (Architect, Guardian, Challenger) to stress-test the solution.
- **Party Mode:** For high-stakes decisions, invoke multiple personas (Architect, Guardian, Challenger) to stress-test the solution.

**Always look for the next click.**
