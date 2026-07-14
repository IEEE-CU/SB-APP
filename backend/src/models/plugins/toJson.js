/**
 * Mongoose plugin to convert _id to id and clean up __v and private fields.
 */
const toJson = (schema) => {
  let transform;
  if (schema.options.toJSON && schema.options.toJSON.transform) {
    transform = schema.options.toJSON.transform;
  }

  schema.options.toJSON = schema.options.toJSON || {};
  schema.options.toJSON.transform = function (doc, ret, options) {
    // Convert _id to id
    if (ret._id) {
      ret.id = ret._id.toString();
      delete ret._id;
    }

    // Remove version key
    delete ret.__v;

    // Remove password hash if present
    delete ret.passwordHash;
    delete ret.password;

    // Call custom transform if it exists
    if (transform) {
      return transform(doc, ret, options);
    }
    return ret;
  };
};

module.exports = toJson;
