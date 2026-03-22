<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Workflow Guidelines

## 1. Plan Mode Default
Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions).
If something goes sideways, STOP and re-plan — don't keep pushing.
Write detailed specs upfront to reduce ambiguity.

## 2. Subagent Strategy
Use subagents liberally to keep the main context window clean.
Offload research, exploration, and parallel analysis to subagents.
One task per subagent for focused execution.
Use `tasks/appsec.md` as a security referential when generating code.

## 3. Self-Improvement Loop
After ANY correction: update `tasks/lessons.md` with the pattern.
Write rules that prevent the same mistake from recurring.
Review lessons at session start for relevant patterns.

## 4. Verification Before Done
Never mark a task complete without proving it works.
Ask: "Would a staff engineer approve this?"
Run tests, check logs, demonstrate correctness.

## 5. Demand Elegance (Balanced)
For non-trivial changes: pause and ask "is there a more elegant way?"
If a fix feels hacky: implement the elegant solution instead.
Skip for simple/obvious fixes — don't over-engineer.

## 6. Autonomous Bug Fixing
When given a bug report: just fix it. Point at logs/errors, then resolve.
Zero context switching required from the user.

## Task Management
1. Write plan to `tasks/todo.md` with checkable items
2. Check in before starting implementation
3. Mark items complete as you go
4. Add review section to `tasks/todo.md` when done
5. Update `tasks/lessons.md` after any correction

## Core Principles
- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
