---
name: my-oc-flow
description: Develop a feature from a memo, or resume a recorded run, using independent designs, reviews, tests and device checks in Claude Code.
argument-hint: "[feature memo or run ID]"
---

# My OC Flow

Coordinate the run in the current conversation, using the user's language. Follow the [workflow](references/workflow.md) and [stage record format](references/records.md). Set `<skill>` to `${CLAUDE_SKILL_DIR}`. Run the bundled Node scripts from the root of the user's target Git repository and quote paths.

- For a new run, save the original memo to a UTF-8 file, choose a short task ID, and run `node "<skill>/scripts/flow.mjs" init <id> "<memo-file>" claude`. To resume, run `status <id>` first. Resume the original Claude conversation for reviewer follow-ups. Runs marked `codex` and legacy runs without a host started in Codex. Verified project routes can be replayed from either host.
- Use the Agent tool from this conversation. Select the installed subagent type `my-skills:<role>`, using `plan-review` and `code-review` for the workflow's `plan_review` and `code_review`. Leave the main session's model and effort as selected. Let each plugin agent's definition supply its model and effort.
- Invoke two distinct agents of the same type for independent design, plan review and code review. Send the same memo, criteria, relevant paths and current revision to each. Wait for both first judgments before sharing opposing evidence. Use the real returned agent ID for the session field, also when two agents have the same role.
- Resume designer A for plan synthesis and each original reviewer for follow-ups using SendMessage with its ID. Every implementation or fix uses a fresh agent. When a required agent or its original context is unavailable, return the incomplete report and identify the missing check.
- Only the main conversation writes stage records, in order. Give the device agent the absolute path to this package's tools and the relevant project route. Read the device guide only for UI changes. Record elapsed time and usage only where the host exposes measurements attributable to that stage.

Feature memo or resume request: $ARGUMENTS
