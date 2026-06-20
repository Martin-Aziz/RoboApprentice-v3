# Aurevix Demo — Voiceover Script v6

Target delivery: calm, confident, technically credible.  
Estimated length: approximately 2 minutes 45 seconds to 3 minutes 15 seconds, depending on pacing.

---

Most industrial automation still begins with a specialist translating a human task into robot logic, one waypoint and one condition at a time.

Aurevix starts somewhere more natural: with a demonstration.

Here, an operator is teaching a multi-step assembly task. The source video shows the physical motion, while the workflow defines the intent around it: pick the component, rotate it, place it into the fixture, change tools, and trigger the next machine operation.

This is more than a sequence of movements. Real production work contains decisions.

The first operation waits for a digital signal before continuing. Placement is followed by an inspection gate, with a controlled retry if the result fails. The robot then docks its current tool, collects a vacuum cup, and waits for the machine handshake.

Each step can be renamed, reordered, or replaced with motion, gripper, inspection, tool-change, signal, or operator-confirmation logic. The operator describes the process in production terms. Aurevix turns that description into executable structure.

Now we run the workflow.

Aurevix analyses the demonstration, extracts the robot actions, and builds a policy waypoint by waypoint. The sequence progresses live while the 3D workcell replays the interpreted motion.

The operator can inspect the end-effector position, joint movement, gripper state, speed, duration, and the intent assigned to every step. Instead of treating generated automation as a black box, Aurevix makes the result visible and reviewable before it reaches the floor.

The same task can also be previewed against different robot models, including Universal Robots, ABB, KUKA, Techman, FANUC, and Yaskawa platforms.

In this example, Aurevix produces an eight-waypoint policy across five coordinated sequence steps, with the configured pneumatic gripper and workcell safety rules carried into the result.

From here, the skill can be deployed to a connected robot, evaluated through the ROI model, or exported for the engineering workflow.

The generated package includes robot-ready logic for URScript and ROS 2, along with additional controller targets, tool-change routines, digital I/O gates, bounded retry behaviour, and a readable PDF summary.

Once deployed, the skill becomes part of the operating system for the factory: versioned in the task library, visible across the robot fleet, and measurable through execution history, cycle time, success rate, and drift alerts.

When a process changes, the team does not have to begin again from an empty program.

They demonstrate the work, review the interpretation, and refine the skill.

Aurevix turns practical factory knowledge into automation that can be understood, tested, and reused.

Show it once. Run it on repeat.
