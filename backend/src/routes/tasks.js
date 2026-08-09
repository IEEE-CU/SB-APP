const express = require("express");
const Task = require("../models/Task");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

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
    const targetSocietyId = societyId || req.user.societyId?._id || req.user.societyId;

    if (!title) {
      return res.status(400).json({ success: false, message: "Task title is required" });
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

    Object.assign(task, req.body);
    if (req.body.status === "COMPLETED") {
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
