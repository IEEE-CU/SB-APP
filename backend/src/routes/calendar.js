const express = require("express");
const CalendarEvent = require("../models/CalendarEvent");
const Message = require("../models/Message");
const Event = require("../models/Event");
const { authenticate, societyAccess } = require("../middleware/auth");
const { requirePermission } = require("../middleware/rbac");
const { parseLimit } = require("../utils/pagination");

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/calendar/unified
 * @desc    Aggregate CalendarEvent, Message (with calendarEvent populated), and Event collections for a given month range
 * @access  All authenticated users
 */
router.get("/unified", async (req, res, next) => {
  try {
    const { start, end, societyId } = req.query;

    if (!start || !end) {
      return res.status(400).json({
        success: false,
        message: "Start and end dates are required (format: YYYY-MM-DD)",
      });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    // Ensure endDate includes the full end day
    endDate.setHours(23, 59, 59, 999);

    const dateFilter = { $gte: startDate, $lte: endDate };

    // Build filters for each collection
    const calFilter = { date: dateFilter };
    const eventFilter = { date: dateFilter };
    const messageFilter = { "calendarEvent.date": dateFilter };

    if (societyId) {
      calFilter.societyId = societyId;
      eventFilter.societyId = societyId;
      messageFilter.societyId = societyId;
    }

    // Fetch in parallel
    const [calendarEvents, events, messages] = await Promise.all([
      CalendarEvent.find(calFilter).populate("societyId", "name shortName"),
      Event.find(eventFilter).populate("societyId", "name shortName"),
      Message.find(messageFilter)
        .populate("societyId", "name shortName")
        .populate("authorId", "name email"),
    ]);

    // Format and unify results
    const unified = [
      ...calendarEvents.map((item) => ({
        id: item._id || item.id,
        source: "CalendarEvent",
        title: item.title,
        date: item.date,
        time: item.time,
        venue: item.venue,
        description: item.description,
        status: item.status,
        society: item.societyId,
      })),
      ...events.map((item) => ({
        id: item._id || item.id,
        source: "Event",
        title: item.title,
        date: item.date,
        time: item.time,
        venue: item.venue,
        description: item.description,
        eventType: item.eventType,
        society: item.societyId,
      })),
      ...messages.map((item) => ({
        id: item._id || item.id,
        source: "Message",
        title: item.plainText || item.body,
        date: item.calendarEvent.date,
        time: item.calendarEvent.time,
        venue: "Chat Channel / Conversation",
        description: item.body,
        channelId: item.channelId,
        conversationId: item.conversationId,
        author: item.authorId,
        society: item.societyId,
      })),
    ];

    // Sort chronologically by date
    unified.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({
      success: true,
      count: unified.length,
      data: unified,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/calendar
 * @desc    Get all calendar events
 * @access  All authenticated users
 */
router.get("/", async (req, res, next) => {
  try {
    const { societyId, status, month, year, limit } = req.query;

    const filter = {};
    if (societyId) filter.societyId = societyId;
    if (status) filter.status = status;

    // Filter by month/year if provided
    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      filter.date = { $gte: startDate, $lte: endDate };
    } else if (year) {
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31, 23, 59, 59);
      filter.date = { $gte: startDate, $lte: endDate };
    }

    const events = await CalendarEvent.find(filter)
      .populate("societyId", "name shortName")
      .sort({ date: 1 })
      .limit(parseLimit(limit, 200));

    res.json({
      success: true,
      count: events.length,
      data: events,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/calendar/:id
 * @desc    Get calendar event by ID
 * @access  All authenticated users
 */
router.get("/:id", async (req, res, next) => {
  try {
    const event = await CalendarEvent.findById(req.params.id).populate(
      "societyId",
      "name shortName",
    );

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Calendar event not found",
      });
    }

    res.json({
      success: true,
      data: event,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/calendar
 * @desc    Create new calendar event
 * @access  Admin or Own Office Bearer
 */
router.post(
  "/",
  requirePermission("events", "create"),
  societyAccess,
  async (req, res, next) => {
    try {
      const { societyId, title, date, time, venue, description, status } =
        req.body;

      // For office bearers, use their society if not specified
      const targetSocietyId =
        societyId || req.user.societyId?._id || req.user.societyId;

      if (!targetSocietyId) {
        return res.status(400).json({
          success: false,
          message: "Society ID is required",
        });
      }

      const event = await CalendarEvent.create({
        societyId: targetSocietyId,
        title,
        date,
        time,
        venue,
        description,
        status: status || "PROPOSED",
      });

      const populated = await CalendarEvent.findById(event._id).populate(
        "societyId",
        "name shortName",
      );

      res.status(201).json({
        success: true,
        data: populated,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @route   PUT /api/calendar/:id
 * @desc    Update calendar event
 * @access  Admin or Own Office Bearer
 */
router.put(
  "/:id",
  requirePermission("events", "edit"),
  societyAccess,
  async (req, res, next) => {
    try {
      const event = await CalendarEvent.findById(req.params.id);

      if (!event) {
        return res.status(404).json({
          success: false,
          message: "Calendar event not found",
        });
      }

      // Check society access for office bearers
      if (req.user.role === "OFFICE_BEARER") {
        const userSocietyId =
          req.user.societyId?._id?.toString() || req.user.societyId?.toString();
        if (event.societyId.toString() !== userSocietyId) {
          return res.status(403).json({
            success: false,
            message: "Access restricted to your own society",
          });
        }
      }

      // Update fields
      const updateFields = [
        "title",
        "date",
        "time",
        "venue",
        "description",
        "status",
      ];

      updateFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          event[field] = req.body[field];
        }
      });

      await event.save();

      const populated = await CalendarEvent.findById(event._id).populate(
        "societyId",
        "name shortName",
      );

      res.json({
        success: true,
        data: populated,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @route   DELETE /api/calendar/:id
 * @desc    Delete calendar event
 * @access  Admin or Own Office Bearer
 */
router.delete(
  "/:id",
  requirePermission("events", "delete"),
  societyAccess,
  async (req, res, next) => {
    try {
      const event = await CalendarEvent.findById(req.params.id);

      if (!event) {
        return res.status(404).json({
          success: false,
          message: "Calendar event not found",
        });
      }

      // Check society access for office bearers
      if (req.user.role === "OFFICE_BEARER") {
        const userSocietyId =
          req.user.societyId?._id?.toString() || req.user.societyId?.toString();
        if (event.societyId.toString() !== userSocietyId) {
          return res.status(403).json({
            success: false,
            message: "Access restricted to your own society",
          });
        }
      }

      await CalendarEvent.findByIdAndDelete(req.params.id);

      res.json({
        success: true,
        message: "Calendar event deleted",
      });
    } catch (error) {
      next(error);
    }
  },
);

module.exports = router;
