# Storage Module Requirements

## Functional Requirements

| ID | Requirement |
|---|---|
| FR-1 | Accept a single uploaded file. |
| FR-2 | Upload using multipart/form-data. |
| FR-3 | Store files in Azure Blob Storage. |
| FR-4 | Generate unique filenames. |
| FR-5 | Preserve original filename in the returned metadata. |
| FR-6 | Return metadata after upload. |
| FR-7 | Return HTTP 201 on success. |
| FR-8 | Support provider abstraction. |
| FR-9 | Keep `StorageService` cloud independent. |
| FR-10 | Accept in-memory Multer uploads. |

## Non Functional Requirements

### Performance
- Upload handling should avoid writing temporary files to disk.
- Metadata assembly should be lightweight and synchronous where possible.

### Reliability
- Missing files should fail fast with a clear 400 response.
- Azure failures should surface with contextual errors.

### Availability
- The upload service should remain available through the main backend application.
- The standalone test server is for local validation only.

### Scalability
- The provider abstraction should allow future storage backends without changing service consumers.

### Maintainability
- HTTP handling, business logic, and cloud SDK calls are separated into distinct layers.

### Security
- The middleware currently avoids disk storage.
- File type validation, authentication, and authorization are deferred to future work.

### Extensibility
- The service is structured so future storage providers can be added.

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
| `AZURE_STORAGE_CONNECTION_STRING` | Connection string used to create the Azure `BlobServiceClient`. |
| `AZURE_STORAGE_ACCOUNT_NAME` | Azure storage account name placeholder used by configuration. |
| `AZURE_STORAGE_CONTAINER_NAME` | Azure container name used for uploads. |
| `AZURE_STORAGE_ENDPOINT` | Optional Azure endpoint placeholder. |
| `MAX_FILE_SIZE` | Generic upload size configuration placeholder. |
| `ALLOWED_FILE_TYPES` | Generic MIME type configuration placeholder. |
| `UPLOAD_TEMP_DIR` | Upload temp path placeholder for future workflows. |
| `UPLOAD_ALLOWED_EXTENSIONS` | Upload extension placeholder for future workflows. |
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

### Request
- Method: `POST`
- Path: `/api/storage/upload`
- Content-Type: `multipart/form-data`
- Field name: `file`

### Response
- HTTP `201` on success.
- HTTP `400` when no file is provided.
- HTTP `500` for unexpected failures.

### Response Body
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

## Assumptions
- Upload requests arrive as multipart/form-data.
- The incoming file is available on `req.file` after Multer parsing.
- Azure credentials are provided through environment variables.
- The Azure container name is configured before upload execution.
- Downstream callers will inspect the response body for the normalized metadata.

## Constraints
- Do not use Express routes to implement storage business logic.
- Do not store uploads on local disk.
- Do not require controllers to perform cloud SDK operations.
- Do not require `StorageService` to know about Azure-specific SDK details beyond the provider contract.
- Do not persist upload metadata to MongoDB in this phase.

## Future Enhancements
- Delete support
- List support
- Download support
- Signed URL generation
- Authentication
- Authorization
- File validation by MIME type
- Virus scanning
- Image optimization
- Database persistence for file records

## Summary
These requirements describe the implemented upload-only storage module and the surrounding constraints that keep the architecture modular, testable, and ready for future expansion.
