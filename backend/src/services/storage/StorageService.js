const AzureBlobProvider = require('./AzureBlobProvider');

// Storage provider abstraction. Placeholder: add provider selection and mapping here.
class StorageService {
  constructor(provider = new AzureBlobProvider()) {
    this.provider = provider;
  }

  async upload(req, res, next) {
    throw new Error('TODO: implement storage upload service');
  }

  async remove(req, res, next) {
    throw new Error('TODO: implement storage remove service');
  }

  async list(req, res, next) {
    throw new Error('TODO: implement storage list service');
  }
}

module.exports = StorageService;
