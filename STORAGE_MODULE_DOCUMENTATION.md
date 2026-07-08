# Storage Module Documentation

## Overview
The storage module provides file upload support for the IEEE ERP backend. Its current responsibility is to accept a single file from a multipart/form-data request, validate that a file exists at the controller boundary, and upload the file to Azure Blob Storage through a provider abstraction.

### Purpose
- Accept files from clients through a standard HTTP upload endpoint.
- Keep the upload flow separated from HTTP routing concerns.
- Keep storage logic cloud-provider agnostic through `StorageService`.
- Isolate Azure SDK usage inside `AzureBlobProvider`.

### High-Level Architecture
The module follows a layered design:

- `upload.js` handles multipart parsing with Multer.
- `storage.js` defines the HTTP route.
- `StorageController` handles request/response behavior.
- `StorageService` contains upload orchestration and naming logic.
- `AzureBlobProvider` contains Azure SDK calls.

```mermaid
flowchart TD
  A[Frontend] --> B[POST /api/storage/upload]
  B --> C[upload.single("file")]
  C --> D[StorageController]
  D --> E[StorageService]
  E --> F[AzureBlobProvider]
  F --> G[Azure Blob Storage]
  G --> H[Metadata Response]
```

`StorageService` is the abstraction layer that keeps the module cloud-provider agnostic. If the storage backend changes later, only the provider implementation should need to change.

## Folder Structure

```text
backend/src/
├── controllers/
│   └── storageController.js
├── middleware/
│   └── upload.js
├── routes/
│   └── storage.js
├── services/
│   └── storage/
│       ├── StorageService.js
│       └── storage-provider/
│           ├── AzureBlobProvider.js
│           └── index.js
└── tests/
    ├── storageApiTestServer.js
    └── testStorageServiceUpload.js
```

## Upload Request Flow
The complete upload lifecycle is:

```text
Frontend
↓
POST /api/storage/upload
↓
upload.single("file")
↓
StorageController
↓
StorageService
↓
AzureBlobProvider
↓
Azure Blob Storage
↓
Metadata Response
```

### Layer Responsibilities
| Layer | Responsibility |
|---|---|
| Frontend | Sends a multipart/form-data request containing one file field named `file`. |
| `POST /api/storage/upload` | Public upload endpoint exposed by the storage router. |
| `upload.single("file")` | Parses the multipart request and places the uploaded file on `req.file`. |
| `StorageController` | Checks that `req.file` exists and converts the request into a service call. |
| `StorageService` | Validates the file shape, generates a unique stored name, and orchestrates provider upload. |
| `AzureBlobProvider` | Performs Azure SDK upload operations and reads blob properties. |
| Azure Blob Storage | Persists the file in the configured container. |
| Metadata Response | Returns normalized upload metadata to the caller. |

## API Documentation

### Endpoint
`POST /api/storage/upload`

### Request
- `Content-Type: multipart/form-data`
- Field: `file`

### Success Response
HTTP status: `201 Created`

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

### Returned Fields
| Field | Description |
|---|---|
| `originalName` | The original filename supplied by the client. |
| `storedName` | The unique filename used for blob storage. |
| `path` | The provider-normalized stored path or blob name. |
| `url` | The blob URL returned by Azure Blob Storage. |
| `contentType` | The MIME type associated with the uploaded file. |
| `size` | The stored file size in bytes. |
| `uploadedAt` | ISO 8601 timestamp indicating when the upload metadata was assembled. |

## Components

### StorageController
- Receives the HTTP request.
- Verifies that `req.file` exists.
- Returns HTTP `400` with `No file uploaded.` if the file is missing.
- Calls `storageService.uploadFile(req.file)`.
- Returns HTTP `201` with the upload metadata on success.
- Passes unexpected errors to `next(error)`.

### StorageService
- Contains the business logic for file upload orchestration.
- Validates the Multer file shape.
- Generates a unique stored filename while preserving the original extension.
- Delegates upload work to the configured provider through `uploadBlob({ buffer, blobName, contentType })`.
- Returns provider-independent metadata.
- Remains cloud-provider agnostic.

### AzureBlobProvider
- Owns all Azure SDK interaction.
- Validates the Azure upload inputs.
- Builds a `BlobServiceClient` from the Azure connection string.
- Ensures the container exists.
- Uploads the file buffer to Azure Blob Storage.
- Retrieves blob properties after upload.
- Returns normalized blob metadata.

### `upload.js` Middleware
- Uses Multer with `memoryStorage()`.
- Keeps uploaded files in memory instead of writing them to disk.
- Applies a 10 MB file size limit.
- Leaves file type validation to later layers.
- Exports the configured Multer instance so the route can choose `single`, `array`, or `fields`.

### `storage.js` Route
- Creates the `POST /upload` endpoint.
- Applies `upload.single('file')`.
- Calls `storageController.upload.bind(storageController)`.
- Contains no business logic, Azure code, database access, or file validation.

## Azure Configuration
The following environment variables are used by the storage module.

| Variable | Purpose | Used By |
|---|---|---|
| `AZURE_STORAGE_CONNECTION_STRING` | Azure connection string used to create the BlobServiceClient. | `AzureBlobProvider` |
| `AZURE_STORAGE_ACCOUNT_NAME` | Azure storage account name used for configuration and future provider logic. | `config/azure.js` |
| `AZURE_STORAGE_CONTAINER_NAME` | Target container name for uploaded blobs. | `AzureBlobProvider` |
| `AZURE_STORAGE_ENDPOINT` | Optional endpoint placeholder for future configuration expansion. | `config/azure.js` |
| `MAX_FILE_SIZE` | Generic upload size configuration placeholder. | `config/azure.js` |
| `ALLOWED_FILE_TYPES` | Generic MIME type configuration placeholder. | `config/azure.js` |
| `UPLOAD_TEMP_DIR` | Temporary upload path placeholder for future workflows. | `.env` / `.env.example` |
| `UPLOAD_ALLOWED_EXTENSIONS` | Allowed file extension placeholder for future workflows. | `.env` / `.env.example` |

## Error Handling

### 400 No file uploaded
Returned by `StorageController` when `req.file` is missing.

### 500 Internal Server Error
Unexpected errors are passed to `next(error)` by `StorageController`. A centralized Express error handler should format the final response.

### Azure Configuration Missing
`AzureBlobProvider` throws explicit errors when required Azure environment variables are missing, including:
- `AZURE_STORAGE_CONNECTION_STRING`
- `AZURE_STORAGE_CONTAINER_NAME`

### Upload Failures
If Azure upload or property retrieval fails, `AzureBlobProvider` throws a contextual error containing the blob name and underlying failure message.

## Integration Guide
A consuming team can upload a file by sending a multipart/form-data request with a single `file` field.

### Axios Example
```javascript
import axios from 'axios';

const formData = new FormData();
formData.append('file', selectedFile);

const response = await axios.post('/api/storage/upload', formData, {
  headers: {
    'Content-Type': 'multipart/form-data'
  }
});

console.log(response.data);
```

### Expected Response for Team 2
Team 2 should expect:
- HTTP `201` on success.
- A response body with `success: true`.
- A `message` field containing `File uploaded successfully.`
- A `data` object containing the normalized upload metadata.

## Testing
The storage module was validated using the following approaches.

| Test | Purpose |
|---|---|
| Standalone `StorageService` test | Verifies the service upload workflow and returned metadata. |
| Standalone Express test server | Provides a simple local server for route-level integration testing. |
| Postman upload test | Confirms the HTTP endpoint accepts multipart uploads. |
| Azure Blob verification | Confirms the blob is created in the configured Azure container. |

## Future Improvements
Planned follow-up work may include:

- Delete endpoint
- List endpoint
- Download endpoint
- Signed URLs
- Authentication
- Authorization
- File validation
- Virus scanning
- Image optimization

## Summary
The storage module currently provides a production-style upload pipeline with a controller, service, provider abstraction, and in-memory Multer parsing. It is ready for integration with another team that needs a stable `/api/storage/upload` contract without reading the implementation source code.
