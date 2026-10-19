const express = require("express");
const Announcement = require("../models/Announcement");
const { authenticate } = require("../middleware/auth");

const { requirePermission } = require("../middleware/rbac");
const { parseLimit } = require("../utils/pagination");

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/*
 * AUD-022: ownership is the server-assigned createdBy id, never the display name.
 * senderName is presentation only: a display name is not unique and any user can
 * change their own (PATCH /users/:id), so it can prove nothing. Administrators keep
 * their unrestricted access; everyone else may change only announcements they
 * created. An announcement with no createdBy (created before the field existed) has
 * no provable owner and is therefore administrator-only.
 */
const isAdmin = (user) => user.role === "ADMIN";

const isOwner = (user, announcement) =>
  Boolean(announcement.createdBy) && String(announcement.createdBy) === String(user._id);

/*
 * Who may READ an announcement - one rule, used by both the list and the detail so
 * they cannot drift apart. It is about the audience, not about who created the
 * announcement:
 *   - administrators see everything;
 *   - office bearers see ALL, LEADERSHIP, and SOCIETY announcements of their own
 *     society;
 *   - anything else (an announcement with no or an unknown audience, or another
 *     society's) is not visible to them.
 * It is a database filter, so incomplete legacy records are classified exactly as
 * the list classifies them. The only roles that exist are ADMIN and OFFICE_BEARER;
 * an unrecognized role matches nothing.
 *
 * A user with no society has no society to match, so the SOCIETY clause is left out
 * for them: they see ALL and LEADERSHIP only, never a SOCIETY announcement - in
 * particular not one whose societyId is null or missing. (A clause carrying
 * `societyId: undefined` would match exactly those records.)
 */
const visibilityFilter = (user) => {
  if (isAdmin(user)) return {};
  if (user.role !== "OFFICE_BEARER") return { _id: { $in: [] } };
  const userSocietyId = user.societyId?._id || user.societyId;
  const clauses = [{ targetAudience: "ALL" }, { targetAudience: "LEADERSHIP" }];
  if (userSocietyId) clauses.push({ targetAudience: "SOCIETY", societyId: userSocietyId });
  return { $or: clauses };
};

const notOwner = (res, verb, announcement) =>
  res.status(403).json({
    success: false,
    message: announcement.createdBy
      ? `You can only ${verb} your own announcements`
      : `This announcement has no recorded owner; only an administrator can ${verb} it`,
  });

/**
 * @route   GET /api/announcements
 * @desc    Get announcements filtered by user's access level
 * @access  All authenticated users (filtered)
 */
router.get("/", async (req, res, next) => {
  try {
    const { limit = 50 } = req.query;

    const announcements = await Announcement.find(visibilityFilter(req.user))
      .populate("societyId", "name shortName")
      .sort({ date: -1 })
      .limit(parseLimit(limit, 50));

    res.json({
      success: true,
      count: announcements.length,
      data: announcements,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/announcements/:id
 * @desc    Get announcement by ID, if the caller may see it (same rule as the list)
 * @access  All authenticated users (filtered)
 */
router.get("/:id", async (req, res, next) => {
  try {
    // An announcement the caller may not see is indistinguishable from one that
    // does not exist (404), so knowing an id reveals nothing.
    const announcement = await Announcement.findOne({
      $and: [{ _id: req.params.id }, visibilityFilter(req.user)],
    }).populate("societyId", "name shortName");

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found",
      });
    }

    res.json({
      success: true,
      data: announcement,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/announcements
 * @desc    Create new announcement
 * @access  Admin or Office Bearer
 */
router.post(
  "/",
  requirePermission("announcements", "create"),
  async (req, res, next) => {
    try {
      const { title, date, senderName, targetAudience, societyId } = req.body;
      const message = req.body.message || req.body.content;

      // Validate target audience
      if (!["ALL", "LEADERSHIP", "SOCIETY"].includes(targetAudience)) {
        return res.status(400).json({
          success: false,
          message: "Invalid target audience",
        });
      }

      // For SOCIETY-specific announcements, require societyId
      if (targetAudience === "SOCIETY" && !societyId) {
        return res.status(400).json({
          success: false,
          message: "Society ID is required for society-specific announcements",
        });
      }

      // Office bearers can only send to their own society or leadership
      if (req.user.role === "OFFICE_BEARER") {
        if (targetAudience === "ALL") {
          return res.status(403).json({
            success: false,
            message: "Only admins can send announcements to all members",
          });
        }
        if (targetAudience === "SOCIETY") {
          const userSocietyId =
            req.user.societyId?._id?.toString() ||
            req.user.societyId?.toString();
          if (societyId !== userSocietyId) {
            return res.status(403).json({
              success: false,
              message: "You can only send announcements to your own society",
            });
          }
        }
      }

      // createdBy is always the authenticated caller. A custom sender name (for an
      // institutional post such as "Dean of Engineering") is for administrators
      // only; everyone else's announcements carry their own name.
      const announcement = await Announcement.create({
        title,
        message,
        date: date || Date.now(),
        senderName: isAdmin(req.user) && senderName ? senderName : req.user.name,
        createdBy: req.user._id,
        targetAudience,
        societyId: targetAudience === "SOCIETY" ? societyId : null,
      });

      const populated = await Announcement.findById(announcement._id).populate(
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
 * @route   DELETE /api/announcements/:id
 * @desc    Delete announcement
 * @access  announcements:delete AND (administrator, or the creator)
 */
router.delete(
  "/:id",
  requirePermission("announcements", "delete"),
  async (req, res, next) => {
    try {
      const announcement = await Announcement.findById(req.params.id);

      if (!announcement) {
        return res.status(404).json({
          success: false,
          message: "Announcement not found",
        });
      }

      // Only an administrator or the creator can delete an announcement
      if (!isAdmin(req.user) && !isOwner(req.user, announcement)) {
        return notOwner(res, "delete", announcement);
      }

      await Announcement.findByIdAndDelete(req.params.id);

      res.json({
        success: true,
        message: "Announcement deleted",
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @route   PATCH /api/announcements/:id
 * @desc    Update announcement
 * @access  announcements:edit AND (administrator, or the creator)
 */
router.patch(
  "/:id",
  requirePermission("announcements", "edit"),
  async (req, res, next) => {
    try {
      const { title, date, senderName, targetAudience, societyId } = req.body;
      const message = req.body.message || req.body.content;

      const announcement = await Announcement.findById(req.params.id);

      if (!announcement) {
        return res.status(404).json({
          success: false,
          message: "Announcement not found",
        });
      }

      // Only an administrator or the creator can update an announcement
      if (!isAdmin(req.user) && !isOwner(req.user, announcement)) {
        return notOwner(res, "update", announcement);
      }

      // Update fields if provided
      if (title !== undefined) announcement.title = title;
      if (message !== undefined) announcement.message = message;
      if (date !== undefined) announcement.date = date;
      // The display name can be set by administrators only; it never changes ownership.
      if (senderName !== undefined && isAdmin(req.user)) {
        announcement.senderName = senderName;
      }
      if (targetAudience !== undefined) {
        if (!["ALL", "LEADERSHIP", "SOCIETY"].includes(targetAudience)) {
          return res.status(400).json({
            success: false,
            message: "Invalid target audience",
          });
        }
        announcement.targetAudience = targetAudience;
      }
      if (societyId !== undefined) {
        announcement.societyId =
          targetAudience === "SOCIETY" ? societyId : null;
      }

      // A non-administrator is held to the rules that apply when creating: no
      // announcement to everyone, and a society announcement only for their own
      // society. They are checked on the resulting values, so an edit cannot
      // retarget an announcement the creator could not have posted.
      if (!isAdmin(req.user)) {
        if (announcement.targetAudience === "ALL") {
          return res.status(403).json({
            success: false,
            message: "Only admins can send announcements to all members",
          });
        }
        if (announcement.targetAudience === "SOCIETY") {
          const userSocietyId =
            req.user.societyId?._id?.toString() ||
            req.user.societyId?.toString();
          const targetSocietyId =
            announcement.societyId?._id?.toString() ||
            announcement.societyId?.toString();
          if (!userSocietyId || targetSocietyId !== userSocietyId) {
            return res.status(403).json({
              success: false,
              message: "You can only send announcements to your own society",
            });
          }
        }
      }

      await announcement.save();

      const populated = await Announcement.findById(announcement._id).populate(
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

module.exports = router;
