# Storage Module Requirements

## Functional Requirements

| ID | Requirement |
|---|---|
| FR-1 | Accept a single uploaded file. |
| FR-2 | Upload using multipart/form-data. |
| FR-3 | Store files in Azure Blob Storage. |
| FR-4 | Generate unique blob names. |
| FR-5 | Preserve the original filename in the returned metadata. |
| FR-6 | Return upload metadata after success. |
| FR-7 | Return HTTP 201 for a successful upload. |
| FR-8 | Download files by blob name. |
| FR-9 | Stream downloads directly to the client. |
| FR-10 | Set `Content-Type`, `Content-Length`, and `Content-Disposition` on downloads. |
| FR-11 | Delete files by blob name. |
| FR-12 | Return delete confirmation metadata. |
| FR-13 | List stored files. |
| FR-14 | Return metadata only when listing files. |
| FR-15 | Return the total file count in list responses. |
| FR-16 | Support provider abstraction. |
| FR-17 | Keep `StorageService` cloud independent. |
| FR-18 | Use an Azure-specific provider for SDK operations. |
| FR-19 | Use in-memory Multer uploads. |
| FR-20 | Enforce a 10 MB upload limit. |
| FR-21 | Support standalone testing for upload, download, delete, and list flows. |

## Non Functional Requirements

### Performance
- Upload handling should avoid writing temporary files to disk.
- Downloads should stream directly rather than buffering entire files in memory.
- List responses should return metadata only and not fetch file contents.

### Reliability
- Missing file and missing blob name cases should fail fast with clear 400 responses.
- Azure failures should surface with contextual errors.
- The standalone test server should allow direct verification without altering production routes.

### Availability
- The storage module should remain available through the main backend application.
- The standalone test server is for local validation only.

### Scalability
- The provider abstraction should allow future storage backends without changing service consumers.
- The module should support future pagination for large blob inventories.

### Maintainability
- HTTP handling, business logic, and cloud SDK calls are separated into distinct layers.
- The storage service should remain cloud-provider agnostic.

### Security
- The middleware should avoid disk storage.
- Authentication and authorization are deferred to future work.
- File validation, virus scanning, and signed URL generation are future enhancements.

### Extensibility
- The service is structured so future storage providers can be added.
- Additional blob processing features such as image optimization can be added later.

### Portability
- The module uses standard Node.js and Express patterns and can be executed in a local development environment.

## Dependencies
- `express`
- `multer`
- `dotenv`
- `@azure/storage-blob`
- `path`
- `crypto`

## Environment Variables

| Variable | Description |
|---|---|
| `AZURE_STORAGE_CONNECTION_STRING` | Required connection string used to create the Azure `BlobServiceClient`. |
| `AZURE_STORAGE_CONTAINER_NAME` | Required Azure container name used for storage operations. |
| `AZURE_STORAGE_ACCOUNT_NAME` | Azure storage account name placeholder used by the shared Azure config. |
| `MAX_FILE_SIZE` | Shared configuration value present in `backend/src/config/azure.js`. The upload middleware still enforces a fixed 10 MB limit. |
| `ALLOWED_FILE_TYPES` | Shared configuration value present in `backend/src/config/azure.js`. |
| `GEMINI_API_KEY` | Non-storage environment variable present in the shared backend `.env`. |
| `GEMINI_MODEL` | Non-storage environment variable present in the shared backend `.env`. |
| `GEMINI_BASE_URL` | Non-storage environment variable present in the shared backend `.env`. |
| `EMAIL_PROVIDER` | Non-storage environment variable present in the shared backend `.env`. |
| `EMAIL_HOST` | Non-storage environment variable present in the shared backend `.env`. |
| `EMAIL_PORT` | Non-storage environment variable present in the shared backend `.env`. |
| `EMAIL_USER` | Non-storage environment variable present in the shared backend `.env`. |
| `EMAIL_PASSWORD` | Non-storage environment variable present in the shared backend `.env`. |
| `EMAIL_FROM` | Non-storage environment variable present in the shared backend `.env`. |
| `EMAIL_REPLY_TO` | Non-storage environment variable present in the shared backend `.env`. |
| `EMAIL_SECURE` | Non-storage environment variable present in the shared backend `.env`. |
| `PDF_TEMP_PATH` | Non-storage environment variable present in the shared backend `.env`. |
| `PDF_OUTPUT_DIR` | Non-storage environment variable present in the shared backend `.env`. |
| `PDF_DEFAULT_PAGE_SIZE` | Non-storage environment variable present in the shared backend `.env`. |
| `BACKUP_PATH` | Non-storage environment variable present in the shared backend `.env`. |
| `BACKUP_RETENTION_DAYS` | Non-storage environment variable present in the shared backend `.env`. |
| `BACKUP_ENABLED` | Non-storage environment variable present in the shared backend `.env`. |
| `LOG_LEVEL` | Non-storage environment variable present in the shared backend `.env`. |
| `LOG_DIR` | Non-storage environment variable present in the shared backend `.env`. |
| `LOG_FORMAT` | Non-storage environment variable present in the shared backend `.env`. |

## API Contract

### Base Path
The main backend mounts the storage router under `/api/v1/storage`.

The standalone storage test server mounts the same router under `/api/storage` for local validation only.

### Upload

#### Request
- Method: `POST`
- Path: `/api/v1/storage/upload`
- Content-Type: `multipart/form-data`
- Field name: `file`

#### Response
- HTTP `201` on success.
- HTTP `400` when no file is provided.
- HTTP `500` for unexpected failures.

#### Response Body
```json
{
  "success": true,
  "message": "File uploaded successfully.",
  "data": {
    "originalName": "storage-service-validation.txt",
    "storedName": "stored-1710000000000-acde1234-acde-1234abcd5678.txt",
    "path": "stored-1710000000000-acde1234-acde-1234abcd5678.txt",
    "url": "https://exampleaccount.blob.core.windows.net/uploads/stored-1710000000000-acde1234-acde-1234abcd5678.txt",
    "contentType": "text/plain",
    "size": 30,
    "uploadedAt": "2026-07-08T15:37:13.114Z"
  }
}
```

### Download

#### Request
- Method: `GET`
- Path: `/api/v1/storage/download/:blobName`
- No request body.

#### Response
- HTTP `200` on success.
- HTTP `400` when `blobName` is missing.
- HTTP `500` for unexpected failures.
- Response body is a stream, not JSON.

#### Response Headers
- `Content-Type`
- `Content-Length`
- `Content-Disposition`

### Delete

#### Request
- Method: `DELETE`
- Path: `/api/v1/storage/:blobName`
- No request body.

#### Response
- HTTP `200` on success.
- HTTP `400` when `blobName` is missing.
- HTTP `500` for unexpected failures.

### List Files

#### Request
- Method: `GET`
- Path: `/api/v1/storage/files`
- No request body.

#### Response
- HTTP `200` on success.
- HTTP `500` for unexpected failures.
- Response body contains metadata only and includes `count`.

## Assumptions
- Upload requests arrive as multipart/form-data.
- The incoming file is available on `req.file` after Multer parsing.
- Azure credentials are provided through environment variables.
- The Azure container name is configured before storage execution.
- Downloads are streamed directly to the response.
- Downstream callers will inspect the response body for the normalized metadata on upload, list, and delete operations.

## Constraints
- Do not use Express routes to implement storage business logic.
- Do not store uploads on local disk.
- Do not require controllers to perform cloud SDK operations.
- Do not require `StorageService` to know about Azure-specific SDK details beyond the provider contract.
- Do not persist upload metadata to MongoDB in this phase.
- Do not return download URLs in place of streamed file responses.

## Future Enhancements
- Authentication
- Authorization
- File validation by MIME type
- Virus scanning
- Image optimization
- Pagination
- Signed URL generation
- Database persistence for file records

## Summary
These requirements describe the implemented Azure-backed storage module with upload, download, delete, and list operations. The constraints keep the architecture modular, testable, and ready for future expansion.
