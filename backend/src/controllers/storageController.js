const storageService = require('../services/storage/storage-provider');

// Thin controller shell. Placeholder: delegate request handling to the storage service.
const storageController = {
  async upload(req, res, next) {
    return storageService.upload(req, res, next);
  },

  async remove(req, res, next) {
    return storageService.remove(req, res, next);
  },

  async list(req, res, next) {
    return storageService.list(req, res, next);
  }
};

module.exports = storageController;
