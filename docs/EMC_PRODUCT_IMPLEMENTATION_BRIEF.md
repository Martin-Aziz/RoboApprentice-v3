# Aurevix EMC Product Implementation Brief

Date: 2026-05-27  
Context: EMC Precision design partner feedback after live demo  
Purpose: Convert EMC feedback into a clear product direction, feature list, and a copy-paste Codex implementation prompt with test expectations.

---

## Executive Product Direction

EMC's feedback is not asking for a nicer single pick-and-place demo. They are asking whether Aurevix can teach and export a complete industrial workcell routine.

The product should evolve from:

> Upload a demonstration video and generate robot motion.

To:

> Teach a complete robot workcell workflow, including robot motion, gripper control, machine triggers, wait conditions, inspection gates, and export-ready controller code.

This direction matters because real machine-tending and assembly cells are rarely one robot move. A realistic cell routine includes motion, gripper actuation, PLC I/O, confirmation signals, machine-cycle waits, and safety validation. Supporting those concepts directly makes Aurevix credible to machine-tool builders like EMC.

---

## Feature List And Product Rationale

### 1. Universal Gripper Configuration

Build a Workcell Setup experience where a user can configure the active end effector.

Supported types:
- Electric parallel gripper
- Pneumatic parallel gripper
- Pneumatic angular gripper
- Vacuum / suction gripper
- Magnetic gripper
- Custom / other

Each gripper should support:
- Model name
- Gripper type
- Control method
- Open signal
- Close signal
- Optional confirmation input
- Actuation delay
- Payload limit
- User override fields

Why this matters:
EMC's customers will not all use Robotiq-style electric grippers. Many production cells use cheaper, robust pneumatic grippers. If Aurevix only supports electric grippers, it is locked out of a large part of real industrial deployments.

Priority: P0

---

### 2. Pneumatic Gripper Support

Support binary air grippers explicitly.

Required modes:
- Double-acting pneumatic: one digital output for open, one for close
- Spring-return pneumatic: one signal controls the valve, return happens mechanically
- Optional digital input confirmation
- Configurable delay, default 350 ms, range 100-2000 ms

Generated URScript should use robot-controller digital outputs:

```urscript
def aurevix_gripper_open():
  set_digital_out(0, True)
  set_digital_out(1, False)
  sleep(0.35)
end

def aurevix_gripper_close():
  set_digital_out(0, False)
  set_digital_out(1, True)
  sleep(0.35)
end
```

Generated ROS 2 Python should use a digital output abstraction:

```python
def open_gripper(self):
    msg = DigitalOutput()
    msg.pin = self.cfg.gripper_open_pin
    msg.state = True
    self.gripper_pub.publish(msg)
    time.sleep(self.cfg.actuation_delay / 1000.0)
```

Why this matters:
The "cheaper gripper most companies use" almost certainly means pneumatic. This is a strong signal from EMC's engineering reality. It is also achievable without solving force control.

Priority: P0

---

### 3. Gripper Model Library

Add a searchable model library that auto-fills configuration.

Minimum models:
- Robotiq 2F-85
- Robotiq 2F-140
- OnRobot RG2
- OnRobot RG6
- Schunk EGK 40
- Schunk PGN-plus 80
- Schunk PGN-plus 100
- SMC MHZ2-16D
- SMC MHZ2-25D
- Festo DHWS-25-A
- Festo DHPS-20
- Schunk PGH 50
- Festo DHWA-20
- Schmalz SCG 30
- Piab B15
- Coval LEMCOM
- Magnetic gripper example
- Custom

Why this matters:
Users should not need to understand I/O mapping from scratch. Picking "Schunk PGN-plus 80" should immediately configure the demo in a way EMC engineers recognize.

Priority: P0/P1

---

### 4. Trigger And I/O Logic Builder

Add condition and signal steps to the teach workflow.

Required logic:
- Set digital output
- Wait for digital input
- Wait for machine cycle complete
- Inspection pass/fail branch
- Retry / abort / wait behavior
- Timeout handling

Example conditions:
- `IF signal_in(2) == HIGH -> proceed`
- `IF inspection_result == PASS -> proceed`
- `ELSE -> retry step 3`
- `ELSE -> abort`

Why this matters:
Machine-tool workflows depend on PLC-style handshakes. A robot must trigger a machine, wait for it, and then continue only when the machine is safe/complete.

Priority: P0

---

### 5. Multi-Step Workflow Builder

Aurevix should support task sequences, not only one motion policy.

Step types:
- Motion
- Gripper actuate
- Wait for signal
- Trigger output
- Tool change
- Inspection
- User confirmation

User actions:
- Add step
- Rename step
- Select step type
- Reorder steps
- Add condition gates between steps
- Run sequence end to end
- Persist sequence on refresh

Why this matters:
The EMC engineer's first objection was "What happens with multi-step tasks?" This is a fundamental pilot requirement. A sequence builder lets the demo answer that question visually before anyone reads generated code.

Priority: P0

---

### 6. Controller-Aware Code Export

Export code should reflect the complete sequence, not just a flat pick-place routine.

Required behavior:
- URScript: `main()` function calls each sequence step as sub-functions
- URScript: gripper helpers use the configured gripper type
- URScript: condition gates emit `get_digital_in()` / `set_digital_out()`
- ROS 2 Python: sequence is represented as state functions/state machine
- ROS 2 Python: pneumatic gripper uses a `DigitalOutput` message or clearly named adapter
- Generated filenames reflect the workflow, e.g. `assemble_bracket_sequence.urscript`

Later controller targets:
- ABB RAPID
- FANUC TP / Karel
- KUKA KRL
- Yaskawa INFORM
- Doosan DRL

Why this matters:
Engineers judge credibility by generated code. If the UI says "pneumatic" but export still uses `set_tool_digital_out()` or a generic comment, trust collapses.

Priority: P0/P1

---

### 7. Gripper State Timeline And Viewport Badge

Show gripper state visibly during replay.

Recommended UI:
- Header badge: Electric / Pneumatic / Vacuum / Magnetic / Custom
- Timeline: Open -> Descend -> Close -> Lift -> Wait DI -> Place -> Open
- Visual gripper open/closed state where feasible
- I/O state chips: `DO0 OPEN`, `DO1 CLOSE`, `DI5 VERIFY`

Why this matters:
Non-robotics buyers understand visual state better than code. Engineers also need quick confirmation that Aurevix understands actuation timing.

Priority: P1

---

### 8. Tool Changer Support

Support one robot switching between multiple end effectors.

Scope:
- Tool changer toggle in Workcell Setup
- Up to 6 end-effectors
- Slot number
- Model/type per slot
- I/O mapping per slot
- Dock/undock sequence
- Verify attachment signal

Important product distinction:
Do not imply full multi-arm coordination unless EMC confirms it. One robot with a tool changer is much more common and much easier to pilot than multiple synchronized robots.

Why this matters:
This answers "two grippers, three grippers" without overcommitting to multi-arm planning.

Priority: P2

---

### 9. Machine Integration Profiles

Add templates for common cell types:
- CNC machine tending
- Press loading
- Assembly fixture
- Inspection station
- Conveyor pick/place
- Packaging cell

Each template should preconfigure common step types and I/O gates.

Why this matters:
EMC is a machine-tool builder. Templates let Aurevix speak their implementation language.

Priority: P2

---

### 10. Demo Video Generator

Add a co-brandable demo video generator.

Must support:
- "Generate Demo Video" button after workflow completion
- Aurevix logo upload
- Partner logo upload
- Title overlay
- Footer/contact text
- 720p/1080p
- MP4 at minimum
- Optional GIF later
- 60-90 second workflow recording
- Picture-in-picture source video overlay
- Step labels during replay
- ROI summary card at the end

Why this matters:
EMC asking for a video means they are thinking about selling Aurevix to their customers. The video is a sales enablement asset, not a vanity feature.

Priority: P1

---

### 11. Safe Demo Mode

Add a Settings toggle:

> Safe Demo Mode

When enabled:
- Uses cached deterministic workflow results
- Streams steps visually as if live
- Does not depend on live ML
- Keeps export deterministic
- Default ON for demo workspaces

Why this matters:
The live demo must never visually fail. This is the product equivalent of a fallback recording, while still keeping the UI interactive.

Priority: P0/P1

---

## Copy-Paste Codex Implementation Prompt

Use this prompt in a fresh Codex implementation thread.

```text
You are Codex working in the Aurevix repo at /Users/martin/Documents/Active Projects /RoboApprentice-v3.

Read AGENTS.md first and follow the repo conventions:
- Active app: apps/web, Next.js App Router, TypeScript strict
- Use Tailwind CSS v4 and existing CSS vars from apps/web/src/app/globals.css
- Use rgb(var(--signal-cyan)) and other CSS variables; do not hardcode hex colors in React components
- Primary UI surface: apps/web/src/app/app/teach/page.tsx
- 3D viewport: apps/web/src/components/robot-viewport.tsx
- Workcell setup: apps/web/src/app/app/workcell/page.tsx
- Shared data/types: apps/web/src/lib
- Use apply_patch for edits
- Preserve existing worktree changes; do not revert unrelated changes

Goal:
Implement EMC Precision design-partner feedback so Aurevix demonstrates a complete industrial workcell workflow, not only single pick-and-place motion.

Implement in this priority order:

1. Universal gripper configuration in Workcell Setup
   - Add gripper type selector with:
     - Electric (Parallel)
     - Pneumatic (Parallel)
     - Pneumatic (Angular)
     - Vacuum / Suction
     - Magnetic
     - Custom / Other
   - Add searchable/select dropdown for gripper models.
   - Include at least these models:
     Robotiq 2F-85, Robotiq 2F-140, OnRobot RG2, OnRobot RG6, Schunk EGK 40,
     Schunk PGN-plus 80, Schunk PGN-plus 100, SMC MHZ2-16D, SMC MHZ2-25D,
     Festo DHWS-25-A, Festo DHPS-20, Schunk PGH 50, Festo DHWA-20,
     Schmalz SCG 30, Piab B15, Coval LEMCOM, magnetic example, Custom.
   - Selecting a model auto-fills:
     - gripper type
     - open DO port
     - close DO port
     - optional verify DI port
     - spring-return boolean
     - actuation delay
     - max payload
   - Persist workcell config in localStorage.
   - Default demo config should be Schunk PGN-plus 80 pneumatic parallel, DO0 open, DO1 close, 350ms delay.

2. Pneumatic gripper support in code export
   - When pneumatic gripper is selected, generated URScript must use set_digital_out(), not set_tool_digital_out().
   - Generate helpers:
     def aurevix_gripper_open()
     def aurevix_gripper_close()
   - Double acting:
     open: set_digital_out(openPort, True), set_digital_out(closePort, False)
     close: set_digital_out(openPort, False), set_digital_out(closePort, True)
   - Spring-return:
     use only the configured open/control port.
   - Sleep for actuationDelayMs / 1000.
   - ROS 2 Python export should include DigitalOutput usage or a clearly named DigitalOutput adapter method.
   - Generated code must include no TODO, placeholder, or undefined strings.

3. Multi-step workflow builder on Teach a Robot
   - Add a "Task Sequence" panel under the video input.
   - User can add, rename, delete, and reorder sequence steps.
   - Each step has a type:
     MOTION, WAIT_FOR_SIGNAL, GRIPPER_ACTUATE, TOOL_CHANGE, INSPECTION, USER_CONFIRM.
   - Add condition gate cards between steps:
     signal_high, inspection_pass, retry_or_abort.
   - Gate fields:
     signal/DI port number
     else action: wait, retry, abort
   - Persist sequence to localStorage.
   - Default sequence:
     Pick bracket -> Orient bracket -> Place in fixture -> Trigger machine.

4. Sequence progress tracker
   - Above the 3D viewport, show a horizontal progress tracker.
   - Each step shows:
     number, label, step type badge, status pending/analysing/complete/error.
   - Active step has blue glow.
   - Complete step has green check.
   - Counter should show global motion progress across the full sequence.

5. Multi-step code export
   - URScript:
     - Emit a def main(): function.
     - Emit each sequence step as a sub-function.
     - main() calls each sub-function in order.
     - Emit condition gate logic with get_digital_in(), sleep, popup/halt where relevant.
     - Filename should be assemble_bracket_sequence.urscript.
   - ROS 2 Python:
     - Emit a state-machine-like class.
     - Include one state method per sequence step.
     - Include gate methods for condition gates.
     - Filename should be assemble_bracket_sequence_ros2.py.

6. 3D viewport gripper badge
   - Robot viewport header shows active gripper type.
   - Electric badge: blue
   - Pneumatic badge: grey
   - Vacuum badge: amber
   - Magnetic badge: green
   - Badge should update from saved workcell config in the Teach page.

7. Safe Demo Mode
   - Add a Settings toggle stored in localStorage: aurevix_safe_demo_mode.
   - Default ON.
   - When ON, Teach workflow uses deterministic cached sequence policy and never calls live ML.
   - UI should still stream/progress visually.
   - Display a small "Safe demo mode" indicator in the top/app UI or Teach page.

8. Testing and verification
   Run these checks and fix failures:
   - pnpm --filter @forge-mind/web-v3 typecheck
   - Browser test via Playwright or Node script:
     1. Open /app/workcell
     2. Select Schunk PGN-plus 80
     3. Verify fields show pneumatic, DO0 open, DO1 close, 350ms delay
     4. Open /app/teach
     5. Verify Task Sequence panel appears
     6. Rename at least one sequence step
     7. Change one type to WAIT_FOR_SIGNAL
     8. Run workflow
     9. Verify result panel appears
     10. Open Export code modal
     11. Verify URScript contains def main(), set_digital_out(), get_digital_in(), and per-step sub-functions
     12. Verify ROS 2 Python contains DigitalOutput and state methods
     13. Save screenshots into docs/emc-implementation-verification/
   - Save generated URScript and ROS 2 Python to /tmp and run python3 -m py_compile on the ROS 2 Python file if imports do not prevent syntax checking. If imports prevent direct compile, strip external import lines only for syntax validation and note that in final report.

Acceptance criteria:
- Workcell Setup supports all 6 gripper types.
- Pneumatic model selection auto-fills I/O and delay.
- Teach page supports visible multi-step sequence editing.
- Sequence progress updates while workflow runs.
- Condition gate UI exists and persists on refresh.
- URScript export chains sequence steps in main().
- URScript export uses set_digital_out() for pneumatic gripper.
- ROS 2 Python export uses state-machine-style methods and DigitalOutput.
- Viewport shows gripper type badge.
- TypeScript passes.
- Browser verification passes with no console/page errors.
- Final response includes changed files, test results, screenshot paths, and any limitations.

Important product constraint:
Do not claim full multi-arm coordination. Scope "two or three grippers" as one robot with a tool changer or configurable end effectors unless the user explicitly asks for synchronized multi-robot planning.
```

---

## Test Plan For The Implemented Features

### Manual Browser Test

1. Start app:

```bash
pnpm --filter @forge-mind/web-v3 dev
```

2. Open `/app/workcell`.

Expected:
- Gripper type selector is visible.
- Gripper model selector is visible.
- Selecting `Schunk PGN-plus 80` sets:
  - type: Pneumatic parallel
  - open DO: 0
  - close DO: 1
  - actuation delay: 350 ms
  - spring-return: off

3. Open `/app/teach`.

Expected:
- Task Sequence panel appears under video.
- Default sequence has at least four steps.
- User can rename and reorder steps.
- Step type dropdown changes badge/type.
- Condition gate appears between steps.

4. Click Run Workflow.

Expected:
- Sequence progress appears above 3D viewport.
- Active step glows blue.
- Completed steps turn green.
- Result panel appears.

5. Open Export Code.

Expected URScript:
- Contains `def main():`
- Contains one sub-function per sequence step.
- Contains `set_digital_out()` for pneumatic gripper.
- Contains `get_digital_in()` for gates.
- Does not contain `undefined`, `placeholder`, or `TODO`.

Expected ROS 2 Python:
- Contains state methods.
- Contains `DigitalOutput`.
- Does not contain `undefined`, `placeholder`, or `TODO`.

---

### Automated Checks

```bash
pnpm --filter @forge-mind/web-v3 typecheck
pnpm --filter @forge-mind/web-v3 test:unit
```

Note: if existing unrelated unit tests fail, report exact failures separately and do not hide them.

Recommended browser automation:

```bash
node scripts/verify-emc-workflow.mjs
```

If that script does not exist yet, create one or run an inline Playwright script that exercises Workcell Setup, Teach workflow, and exports.

---

## Definition Of Done

This iteration is done when an EMC engineer can see the following in one uninterrupted demo:

1. Configure a Schunk pneumatic gripper.
2. See DO0/DO1 and delay settings.
3. Build or inspect a multi-step workflow.
4. Run the sequence and see progress across multiple steps.
5. Open export and see real pneumatic I/O code.
6. See gate logic for machine/inspection signals.
7. Download code files with sensible names.
8. Refresh the browser and see the sequence/config persisted.

---

## Product Messaging After Implementation

Use this language in demos:

> Aurevix now teaches complete workcell workflows, not just robot motion. It captures the sequence of operations, gripper actuation, machine signals, wait conditions, and safety gates, then exports controller-ready code for the selected robot and gripper configuration.

Avoid saying:

> We support all multi-gripper and multi-arm setups.

Say instead:

> The pilot scope supports one robot with configurable end effectors, including electric and pneumatic grippers. Tool changer workflows are the next extension. Multi-arm coordination can be scoped separately if EMC confirms that requirement.

