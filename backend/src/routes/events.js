const express = require("express");
const Event = require("../models/Event");
const { authenticate, societyAccess } = require("../middleware/auth");
const { requirePermission } = require("../middleware/rbac");
const { parseLimit } = require("../utils/pagination");

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/events
 * @desc    Get all events (read access for all)
 * @access  All authenticated users
 */
router.get("/", async (req, res, next) => {
  try {
    const { societyId, eventType, startDate, endDate, limit = 100 } = req.query;

    const filter = {};
    if (societyId) filter.societyId = societyId;
    if (eventType) filter.eventType = eventType;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const events = await Event.find(filter)
      .populate("societyId", "name shortName")
      .sort({ date: -1 })
      .limit(parseLimit(limit));

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
 * @route   GET /api/events/:id
 * @desc    Get event by ID
 * @access  All authenticated users
 */
router.get("/:id", async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id).populate(
      "societyId",
      "name shortName",
    );

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
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
 * @route   POST /api/events
 * @desc    Create new event
 * @access  Admin or Own Office Bearer
 */
router.post(
  "/",
  requirePermission("events", "create"),
  societyAccess,
  async (req, res, next) => {
    try {
      const {
        societyId,
        title,
        date,
        time,
        venue,
        eventType,
        participants,
        description,
        outcome,
        participantType,
        highlights,
        takeaways,
        followUpPlan,
        organizerName,
        organizerDesignation,
        collaboration,
        images,
        speakers,
      } = req.body;

      // For office bearers, use their society if not specified
      const targetSocietyId =
        societyId || req.user.societyId?._id || req.user.societyId;

      if (!targetSocietyId) {
        return res.status(400).json({
          success: false,
          message: "Society ID is required",
        });
      }

      const event = await Event.create({
        societyId: targetSocietyId,
        title,
        date,
        time,
        venue,
        eventType: eventType || req.body.type,
        participants,
        description,
        outcome,
        participantType,
        highlights,
        takeaways,
        followUpPlan,
        organizerName,
        organizerDesignation,
        collaboration,
        images: images || [],
        speakers: speakers || [],
      });

      const populated = await Event.findById(event._id).populate(
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
 * @route   PUT /api/events/:id
 * @desc    Update event
 * @access  Admin or Own Office Bearer
 */
router.put(
  "/:id",
  requirePermission("events", "edit"),
  societyAccess,
  async (req, res, next) => {
    try {
      const event = await Event.findById(req.params.id);

      if (!event) {
        return res.status(404).json({
          success: false,
          message: "Event not found",
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
        "eventType",
        "participants",
        "description",
        "outcome",
        "participantType",
        "highlights",
        "takeaways",
        "followUpPlan",
        "organizerName",
        "organizerDesignation",
        "collaboration",
        "images",
        "speakers",
      ];

      updateFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          event[field] = req.body[field];
        }
      });

      // Map 'type' to 'eventType' if present
      if (req.body.type) {
        event.eventType = req.body.type;
      }

      await event.save();

      const populated = await Event.findById(event._id).populate(
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

router.patch(
  "/:id",
  requirePermission("events", "edit"),
  societyAccess,
  async (req, res, next) => {
    try {
      const event = await Event.findById(req.params.id);

      if (!event) {
        return res.status(404).json({
          success: false,
          message: "Event not found",
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
        "eventType",
        "participants",
        "description",
        "outcome",
        "participantType",
        "highlights",
        "takeaways",
        "followUpPlan",
        "organizerName",
        "organizerDesignation",
        "collaboration",
        "images",
        "speakers",
      ];

      updateFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          event[field] = req.body[field];
        }
      });

      // Map 'type' to 'eventType' if present
      if (req.body.type) {
        event.eventType = req.body.type;
      }

      await event.save();

      const populated = await Event.findById(event._id).populate(
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
 * @route   DELETE /api/events/:id
 * @desc    Delete event
 * @access  Admin or Own Office Bearer
 */
router.delete(
  "/:id",
  requirePermission("events", "delete"),
  societyAccess,
  async (req, res, next) => {
    try {
      const event = await Event.findById(req.params.id);

      if (!event) {
        return res.status(404).json({
          success: false,
          message: "Event not found",
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

      await Event.findByIdAndDelete(req.params.id);

      res.json({
        success: true,
        message: "Event deleted",
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @route   POST /api/events/:id/speakers
 * @desc    Add speaker to event
 * @access  Admin or Own Office Bearer
 */
router.post(
  "/:id/speakers",
  requirePermission("events", "edit"),
  societyAccess,
  async (req, res, next) => {
    try {
      const event = await Event.findById(req.params.id);

      if (!event) {
        return res.status(404).json({
          success: false,
          message: "Event not found",
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

      event.speakers.push(req.body);
      await event.save();

      res.status(201).json({
        success: true,
        data: event.speakers,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @route   POST /api/events/:id/register
 * @desc    Register current user for an event
 * @access  All authenticated users
 */
router.post("/:id/register", async (req, res, next) => {
  try {
    const EventRegistration = require("../models/EventRegistration");
    const AuditLog = require("../models/AuditLog");

    const registration = await EventRegistration.create({
      event: req.params.id,
      user: req.user._id,
      status: "REGISTERED",
    });

    await AuditLog.create({
      userId: req.user._id,
      action: "EVENT_REGISTER",
      module: "events",
      details: { eventId: req.params.id, registrationId: registration._id },
    });

    res.status(201).json({
      success: true,
      data: registration,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "User already registered for this event" });
    }
    next(error);
  }
});

/**
 * @route   GET /api/events/:id/registrations
 * @desc    Get all registered attendees for an event
 * @access  All authenticated users
 */
router.get("/:id/registrations", async (req, res, next) => {
  try {
    const EventRegistration = require("../models/EventRegistration");
    const registrations = await EventRegistration.find({ event: req.params.id })
      .populate("user", "name email ieeeId")
      .sort({ registeredAt: -1 });

    res.json({
      success: true,
      count: registrations.length,
      data: registrations,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
