const express = require("express");
const Task = require("../models/Task");
const Society = require("../models/Society");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

// Id of a society reference that may be a bare id or a populated document.
// A populated document without an _id (for example a deleted society) has no id.
const societyIdOf = (ref) => {
  if (!ref) return undefined;
  const id = ref._id !== undefined ? ref._id : ref;
  return id ? id.toString() : undefined;
};

// AUD (task mass assignment): the only fields a caller may change on their own
// task. userId (ownership) and societyId (scope) are deliberately absent: tasks
// are personal (every read is filtered by userId) and no workflow reassigns or
// moves them. Anything else in the body - including _id, timestamps and
// Mongoose internals - is ignored.
const UPDATABLE_FIELDS = [
  "title",
  "description",
  "status",
  "priority",
  "dueDate",
  "categoryName",
  "categoryColor",
  "blockedBy",
  "completed",
];

/**
 * @route   GET /api/tasks
 * @desc    Get personal tasks for current user
 */
router.get("/", async (req, res, next) => {
  try {
    const { societyId, categoryName, status } = req.query;
    const filter = { userId: req.user._id };

    if (societyId) filter.societyId = societyId;
    if (categoryName) filter.categoryName = categoryName;
    if (status) filter.status = status;

    const tasks = await Task.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: tasks.length, data: tasks });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/tasks
 * @desc    Create a new task
 */
router.post("/", async (req, res, next) => {
  try {
    const { title, description, status, priority, dueDate, categoryName, categoryColor, societyId, blockedBy } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: "Task title is required" });
    }

    // Society policy for new tasks (Task.societyId is a required Society reference):
    //   - a society named in the body must be well formed (400) and exist (404);
    //   - administrators may use any existing society;
    //   - everyone else may use only their own stored society (403 otherwise),
    //     and a caller with no society cannot create tasks (403);
    //   - with no society in the body, the caller's own society is used; an
    //     administrator with none must name one (400). No default is ever invented.
    // The caller's society comes from the user record loaded by authenticate,
    // never from the request.
    const isAdmin = req.user.role === "ADMIN";
    const ownSocietyId = societyIdOf(req.user.societyId);
    const noSociety = () =>
      res.status(403).json({
        success: false,
        message: "You must belong to a society to create tasks",
      });

    let targetSocietyId;
    if (societyId) {
      if (typeof societyId !== "string" || !OBJECT_ID_PATTERN.test(societyId)) {
        return res.status(400).json({ success: false, message: "Invalid ID format." });
      }
      if (!(await Society.exists({ _id: societyId }))) {
        return res.status(404).json({ success: false, message: "Society not found." });
      }
      if (!isAdmin) {
        if (!ownSocietyId) return noSociety();
        if (societyId.toLowerCase() !== ownSocietyId.toLowerCase()) {
          return res.status(403).json({
            success: false,
            message: "Access restricted to your own society",
          });
        }
      }
      targetSocietyId = societyId;
    } else if (ownSocietyId) {
      targetSocietyId = ownSocietyId;
    } else if (isAdmin) {
      return res.status(400).json({ success: false, message: "Society ID is required" });
    } else {
      return noSociety();
    }

    const task = await Task.create({
      userId: req.user._id,
      societyId: targetSocietyId,
      title,
      description: description || "",
      status: status || "NOT_STARTED",
      priority: priority || "MEDIUM",
      dueDate: dueDate || null,
      categoryName: categoryName || "General",
      categoryColor: categoryColor || "#3b82f6",
      blockedBy: blockedBy || [],
    });

    res.status(201).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/tasks/:id
 * @desc    Update task status or fields
 */
router.put("/:id", async (req, res, next) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.user._id });
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    const body = req.body && typeof req.body === "object" ? req.body : {};
    for (const field of UPDATABLE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        task[field] = body[field];
      }
    }
    if (body.status === "COMPLETED") {
      task.completed = true;
    }
    await task.save();

    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /api/tasks/:id
 * @desc    Delete a task
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }
    res.json({ success: true, message: "Task deleted" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
