const express = require("express");
const Opportunity = require("../models/Opportunity");
const sources = require("../config/opportunitySources");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

router.use(authenticate);

/**
 * @route   GET /api/opportunities/societies
 * @desc    List the societies available for filtering, with their source page
 * @access  All authenticated users
 */
router.get("/societies", (req, res) => {
  res.json({
    success: true,
    data: sources.map(({ society, label, url }) => ({ society, label, url })),
  });
});

/**
 * @route   GET /api/opportunities?society=WIE
 * @desc    Get scraped awards/grants/scholarships for a society
 * @access  All authenticated users
 */
router.get("/", async (req, res, next) => {
  try {
    const { society } = req.query;
    const validCodes = Opportunity.SOCIETY_CODES;

    if (!society || !validCodes.includes(society)) {
      return res.status(400).json({
        success: false,
        message: `Please provide a valid society (${validCodes.join(", ")})`,
      });
    }

    const opportunities = await Opportunity.find({ society }).sort({
      scrapedAt: -1,
    });

    const source = sources.find((s) => s.society === society);

    res.json({
      success: true,
      count: opportunities.length,
      data: opportunities,
      fallbackUrl: source ? source.url : null,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
