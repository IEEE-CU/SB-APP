const AzureBlobProvider = require("./AzureBlobProvider");
const StorageService = require("../StorageService");

const storageService = new StorageService();

module.exports = storageService;
module.exports.storageService = storageService;
module.exports.AzureBlobProvider = AzureBlobProvider;
module.exports.StorageService = StorageService;
