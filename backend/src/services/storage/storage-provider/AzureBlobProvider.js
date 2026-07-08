const azureConfig = require('../../../config/azure');

// Azure SDK calls must remain isolated in this provider.
// Placeholder: implement provider methods with the chosen Azure SDK.
class AzureBlobProvider {
  constructor(config = azureConfig) {
    this.config = config;
  }

  async upload() {
    throw new Error('TODO: implement Azure blob upload');
  }

  async delete() {
    throw new Error('TODO: implement Azure blob delete');
  }

  async list() {
    throw new Error('TODO: implement Azure blob list');
  }
}

module.exports = AzureBlobProvider;
