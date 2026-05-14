# SIP Docs

This directory houses the official project documentation for Solana Intent Pilot (SIP), consolidated from materials under `learn/`. It serves as the single entry point for subsequent design, implementation, and collaboration.

## Reading Order

When you need to get up to speed on the current implementation baseline and upcoming wrap-up work, start here:

1. [Next-Phase Plan](./roadmap/next-phase-plan.md)
2. [Project Overview](./overview/project-overview.md)
3. [System Architecture](./architecture/system-architecture.md)
4. [Runtime Sequence Diagram](./architecture/runtime-sequence.md)
5. [Workflow State Machine](./architecture/workflow-state-machine.md)
6. [Message Flow Design](./architecture/message-flow.md)
7. [Intent Protocol](./api/intent-schema.md)
8. [Runtime Contracts Summary](./api/runtime-contracts.md)
9. [Message Type Definitions](./api/message-types.md)
10. [Module Breakdown](./modules/module-breakdown.md)
11. [Repository Structure Conventions](./modules/repository-structure.md)
12. [Risk Engine Design](./security/risk-engine.md)
13. [MVP Risk Policy](./security/mvp-risk-policy.md)
14. [Trust Boundaries & Security Constraints](./security/trust-boundaries.md)
15. [UI/UX Design](./design/ui-ux-design.md)
16. [Frontend Component Architecture](./design/component-architecture.md)
17. [Development Setup](./setup/development-setup.md)
18. [Intent Sample Payloads](./api/sample-payloads.md)
19. [Risk Case Library](./security/risk-cases.md)
20. [Acceptance Criteria](./testing/acceptance-criteria.md)
21. [Test Matrix](./testing/test-matrix.md)
22. [UI State Mapping](./api/ui-state-mapping.md)
23. [Blocking Rules Table](./security/blocking-rules.md)
24. [QA Checklist](./testing/qa-checklist.md)
25. [Test Report Template](./testing/test-report-template.md)
26. [Demo Script](./roadmap/demo-script.md)
27. [Demo Checklist](./roadmap/demo-checklist.md)
28. [Implementation Roadmap](./roadmap/implementation-roadmap.md)

## Directory Structure

- `overview/`: Product positioning, target users, core value, and scope description
- `architecture/`: System layering, runtime chains, and key technical decisions
- `api/`: Internal protocols, data structures, and interface constraints
- `modules/`: Module responsibilities, boundaries, communication relationships, and directory conventions
- `security/`: Risk controls, validation logic, and security design
- `design/`: Visual system, page structure, interaction flows, and component specifications
- `setup/`: Development environment, dependency preparation, and local workflow
- `testing/`: Acceptance criteria, test strategies, and QA check items
- `roadmap/`: MVP delivery path, phase objectives, and demo highlights


If the product direction or technical approach changes in the future, prioritize updating this directory first, then back-port or archive the exploratory materials in `learn/`.
