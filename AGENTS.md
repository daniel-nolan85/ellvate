# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

<!-- SAOS_ARCHITECTURE_START -->
## SAOS Architecture Constitution

Use `$enforce-saos-architecture` while planning, implementing, refactoring, or reviewing TypeScript, React, Next.js, Expo, React Native, or Node.js code.

Decision pipeline:

1. Why: use `references/saos.md` as the stable architecture constitution.
2. First principles: use `references/engineering-principles.md` to identify what engineering problem is being optimized.
3. What: classify each change with `references/classification-guide.md`.
4. Uncertainty: use `references/architecture-decision-framework.md`, `references/architectural-priorities.md`, and `references/heuristics.md` when multiple homes seem valid.
5. How: select an existing `patterns/*.md` file before inventing structure.
6. Sequence: follow the relevant `playbooks/*.md` file for the task.
7. Recognition: use `anti-patterns/*.md` when something feels structurally wrong.
8. Precedent: use `precedents/*.md` for tradeoffs and transformations.
9. Validation: use `validation/saos-validation.md` and the repo's strongest available checker.

Constant rules:

- Keep app, page, route, layout, and screen files thin. Framework files orchestrate; modules implement.
- Put business capabilities in semantic modules and expose each meaningful module through `index.ts` or `index.tsx`.
- Import across semantic modules only through public APIs or parent namespace barrels. Do not deep-import implementation files from another module.
- Use namespace barrels for parent exports; avoid giant flattened exports.
- Keep constants grouped by domain; avoid root `constants.ts`, `helpers`, `misc`, `stuff`, `common`, and `shared2` dumping grounds.
- Preserve existing semantic ownership first; optimize file size and implementation convenience late.
- Services are integrations. Modules are business. Never reverse these responsibilities.
- Before finishing, run the repo's existing validation and any architecture checker. Do not weaken checkers, suppress real debt, or hide violations.
- If a phase violates these rules, stop and correct the current phase before continuing.

Decision checklist:

- Did I classify correctly?
- Does a pattern already exist?
- Am I creating a new module unnecessarily?
- Is the public API correct?
- Are imports semantic?
- Does validation still pass?
- Am I preserving behavior?
- Would another engineer understand this module by name alone?

Optional portable checks:

- Install or update this block with `python3 ~/.codex/skills/enforce-saos-architecture/scripts/install_agents_block.py --agents AGENTS.md`.
- Check that this block is current with `python3 ~/.codex/skills/enforce-saos-architecture/scripts/install_agents_block.py --agents AGENTS.md --check`.
- Run a lightweight generic structure check with `python3 ~/.codex/skills/enforce-saos-architecture/scripts/check_saos_structure.py . --fail-on-warning` when no repo-specific architecture gate exists.
<!-- SAOS_ARCHITECTURE_END -->
