const mongoose = require("mongoose");
const { isSafeWebUrl } = require("../utils/urlSafety");

const SOCIETY_CODES = [
  "GENERAL",
  "WIE",
  "AES",
  "APS",
  "CS",
  "CIS",
  "GRSS",
  "SIGHT",
  "MTTS",
  "PELS",
  "PES",
  "RAS",
  "VTS",
];

const opportunitySchema = new mongoose.Schema(
  {
    society: {
      type: String,
      enum: SOCIETY_CODES,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    // AUD-030: both are shown to users as links, so only plain http(s) URLs are accepted.
    link: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: isSafeWebUrl,
        message: "link must be an http(s) URL without credentials",
      },
    },
    sourceUrl: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: isSafeWebUrl,
        message: "sourceUrl must be an http(s) URL without credentials",
      },
    },
    scrapedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

// A given link only needs to appear once per society
opportunitySchema.index({ society: 1, link: 1 }, { unique: true });

opportunitySchema.set("toJSON", {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

opportunitySchema.statics.SOCIETY_CODES = SOCIETY_CODES;

module.exports = mongoose.model("Opportunity", opportunitySchema);
