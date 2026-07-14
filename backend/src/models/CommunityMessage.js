const mongoose = require("mongoose");

const communityMessageSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    societyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Society",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Transform output
communityMessageSchema.set("toJSON", {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model("CommunityMessage", communityMessageSchema);
