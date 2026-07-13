# Storage Module Documentation

## Overview
The storage module provides Azure Blob Storage support for the backend. It currently implements four operations: upload, download, delete, and list files. The module is structured so HTTP handling, storage orchestration, and cloud SDK calls remain separated.

### Purpose
- Accept file uploads from clients through a multipart/form-data endpoint.
- Stream downloaded blobs directly to the client without returning a download URL.
- Support blob deletion and metadata listing for stored files.
- Keep storage logic cloud-provider agnostic through `StorageService`.
- Isolate Azure SDK usage inside `AzureBlobProvider`.

## Architecture
The module uses a layered design:

- `middleware/upload.js` configures Multer with in-memory storage and a 10 MB upload limit.
- `routes/storage.js` defines the storage HTTP routes.
- `StorageController` handles request validation and HTTP responses.
- `StorageService` performs provider-agnostic storage orchestration.
- `AzureBlobProvider` contains Azure-specific SDK calls.
- Azure Blob Storage is the backing store.

```mermaid
flowchart TD
  A[Client] --> B[POST /api/v1/storage/upload]
  A --> C[GET /api/v1/storage/files]
  A --> D[GET /api/v1/storage/download/:blobName]
  A --> E[DELETE /api/v1/storage/:blobName]

  B --> F[upload.single("file")]
  F --> G[StorageController.upload]
  C --> H[StorageController.list]
  D --> I[StorageController.download]
  E --> J[StorageController.delete]

  G --> K[StorageService.uploadFile]
  H --> L[StorageService.listFiles]
  I --> M[StorageService.downloadFile]
  J --> N[StorageService.deleteFile]

  K --> O[AzureBlobProvider.uploadBlob]
  L --> P[AzureBlobProvider.listBlobs]
  M --> Q[AzureBlobProvider.downloadBlob]
  N --> R[AzureBlobProvider.deleteBlob]

  O --> S[Azure Blob Storage]
  P --> S
  Q --> S
  R --> S
```

`StorageService` remains cloud-provider agnostic. If the backend storage provider changes later, the controller and route contract can stay the same.

## Folder Structure

```text
backend/src/
├── config/
│   └── azure.js
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
    ├── testAzureUpload.js
    ├── testStorageServiceDelete.js
    ├── testStorageServiceDownload.js
    ├── testStorageServiceListFiles.js
    └── testStorageServiceUpload.js
```

## Upload Flow
The upload request flow is:

```text
Client
↓
POST /api/v1/storage/upload
↓
upload.single("file")
↓
StorageController.upload
↓
StorageService.uploadFile
↓
AzureBlobProvider.uploadBlob
↓
Azure Blob Storage
↓
JSON metadata response
```

### Upload Responsibilities
| Layer | Responsibility |
|---|---|
| Client | Sends a multipart/form-data request with a single file field named `file`. |
| `upload.single("file")` | Parses the request in memory and populates `req.file`. |
| `StorageController` | Returns `400` when no file is provided and forwards valid uploads to the service. |
| `StorageService` | Validates the Multer file shape, generates a unique stored name, and calls the provider. |
| `AzureBlobProvider` | Creates the blob in Azure, then reads blob properties for returned metadata. |
| Azure Blob Storage | Stores the uploaded file in the configured container. |

### Upload Details
- The request must use `multipart/form-data`.
- The file field name must be `file`.
- Multer uses `memoryStorage()`, so the file is kept in memory, not written to disk.
- The upload limit is 10 MB.
- `StorageService` generates a unique blob name using the `stored-<timestamp>-<uuid><extension>` pattern.
- The returned metadata includes `originalName`, `storedName`, `path`, `url`, `contentType`, `size`, and `uploadedAt`.

## Download Flow
The download endpoint streams the blob directly to the client.

```text
Client
↓
GET /api/v1/storage/download/:blobName
↓
StorageController.download
↓
StorageService.downloadFile
↓
AzureBlobProvider.downloadBlob
↓
Readable stream piped to the response
```

### Download Responsibilities
| Layer | Responsibility |
|---|---|
| Client | Requests a stored blob by name. |
| `StorageController` | Validates `blobName`, sets response headers, and pipes the stream to the response. |
| `StorageService` | Delegates the download to the configured provider. |
| `AzureBlobProvider` | Retrieves the blob stream and metadata from Azure Blob Storage. |

### Download Headers
The response is a streamed file response, not a JSON payload.

- `Content-Type`: set from the blob metadata
- `Content-Length`: set from the blob metadata
- `Content-Disposition`: set to `attachment; filename="<blobName>"`

## Delete Flow
The delete endpoint removes a blob by name.

```text
Client
↓
DELETE /api/v1/storage/:blobName
↓
StorageController.delete
↓
StorageService.deleteFile
↓
AzureBlobProvider.deleteBlob
↓
Azure Blob Storage
↓
JSON delete response
```

### Delete Responsibilities
| Layer | Responsibility |
|---|---|
| Client | Sends the blob name as the `blobName` path parameter. |
| `StorageController` | Returns `400` when the parameter is missing and forwards valid requests to the service. |
| `StorageService` | Delegates deletion to the configured provider and normalizes the returned metadata. |
| `AzureBlobProvider` | Deletes the blob from Azure Blob Storage. |

## List Files Flow
The list endpoint returns blob metadata only.

```text
Client
↓
GET /api/v1/storage/files
↓
StorageController.list
↓
StorageService.listFiles
↓
AzureBlobProvider.listBlobs
↓
JSON metadata response
```

### List Responsibilities
| Layer | Responsibility |
|---|---|
| Client | Requests the current blob inventory. |
| `StorageController` | Returns the list and the total `count`. |
| `StorageService` | Delegates to the configured provider. |
| `AzureBlobProvider` | Enumerates blobs and returns metadata only. |

### List Output Fields
The list response includes metadata only and does not download file contents.

- `blobName`
- `size`
- `contentType`
- `lastModified`
- `etag`
- `count`

## Controller Responsibilities

### StorageController
- `upload(req, res, next)` returns `400` if `req.file` is missing and `201` on success.
- `download(req, res, next)` validates `blobName`, sets stream headers, and pipes the readable stream to the response.
- `list(req, res, next)` returns the blob array and `count`.
- `delete(req, res, next)` validates `blobName` and returns deletion metadata.
- Unexpected errors are passed to `next(error)`.

## Service Responsibilities

### StorageService
- Validates the Multer upload shape before calling the provider.
- Generates a unique blob name while preserving the original file extension.
- Remains cloud-provider agnostic by calling provider methods such as `uploadBlob`, `downloadBlob`, `listBlobs`, and `deleteBlob`.
- Normalizes returned metadata so the controller can respond consistently.

## Provider Responsibilities

### AzureBlobProvider
- Owns all Azure SDK interaction.
- Builds a `BlobServiceClient` from the configured connection string.
- Ensures the target container exists for upload.
- Uploads blob data, streams downloads, deletes blobs, and lists blob metadata.
- Returns normalized Azure metadata including `etag` and `lastModified` where available.
- Keeps Azure-specific code isolated from the service and controller layers.

## Middleware Responsibilities

### upload.js
- Uses Multer with `memoryStorage()`.
- Applies a 10 MB `fileSize` limit.
- Keeps file validation outside the middleware so the controller and service can handle request logic explicitly.

## API Documentation

### Base Path
The main backend mounts the storage router under `/api/v1/storage`.

The standalone storage test server mounts the same router under `/api/storage` for local validation only.

### 1. Upload File

#### Endpoint
`POST /api/v1/storage/upload`

#### Purpose
Upload a single file to Azure Blob Storage and return normalized metadata.

#### Request
- `Content-Type: multipart/form-data`
- Field name: `file`

#### Parameters
| Name | Location | Required | Description |
|---|---|---|---|
| `file` | form-data field | Yes | Single file to upload. |

#### Response
HTTP `201 Created`

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

#### Status Codes
| Status | Meaning |
|---|---|
| 201 | Upload succeeded. |
| 400 | No file was provided. |
| 500 | Unexpected controller, service, or provider error. |

#### Example Request
```bash
curl -X POST http://localhost:5000/api/v1/storage/upload \
  -F "file=@./example.txt"
```

#### Example Response
See the JSON example above.

#### Possible Errors
- `No file uploaded.` when `req.file` is missing.
- Azure configuration errors when required connection values are absent.
- Provider errors if upload or metadata retrieval fails.

### 2. List Files

#### Endpoint
`GET /api/v1/storage/files`

#### Purpose
Return metadata for all blobs in the configured Azure container.

#### Request
- No body is required.

#### Parameters
- None.

#### Response
HTTP `200 OK`

```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "blobName": "stored-1710000000000-acde1234-acde-1234abcd5678.txt",
      "size": 30,
      "contentType": "text/plain",
      "lastModified": "2026-07-08T15:37:13.114Z",
      "etag": "\"0x8DC123456789ABC\""
    }
  ]
}
```

#### Status Codes
| Status | Meaning |
|---|---|
| 200 | List retrieved successfully. |
| 500 | Unexpected controller, service, or provider error. |

#### Example Request
```bash
curl http://localhost:5000/api/v1/storage/files
```

#### Example Response
See the JSON example above.

#### Possible Errors
- Azure configuration errors when required connection values are absent.
- Provider errors if blob enumeration fails.

### 3. Download File

#### Endpoint
`GET /api/v1/storage/download/:blobName`

#### Purpose
Stream a stored blob directly to the client.

#### Request
- No body is required.

#### Parameters
| Name | Location | Required | Description |
|---|---|---|---|
| `blobName` | path | Yes | Name of the blob to stream. |

#### Response
HTTP `200 OK`

The response body is the file stream itself, not JSON.

Response headers:

- `Content-Type`
- `Content-Length`
- `Content-Disposition`

#### Status Codes
| Status | Meaning |
|---|---|
| 200 | Stream opened successfully and the file is piped to the client. |
| 400 | `blobName` was missing. |
| 500 | Unexpected controller, service, or provider error. |

#### Example Request
```bash
curl -OJ http://localhost:5000/api/v1/storage/download/stored-1710000000000-acde1234-acde-1234abcd5678.txt
```

#### Example Response
```http
HTTP/1.1 200 OK
Content-Type: text/plain
Content-Length: 30
Content-Disposition: attachment; filename="stored-1710000000000-acde1234-acde-1234abcd5678.txt"

<binary stream>
```

#### Possible Errors
- `Blob name is required.` when the path parameter is missing.
- Azure configuration errors when required connection values are absent.
- Provider errors if the blob does not exist or cannot be streamed.

### 4. Delete File

#### Endpoint
`DELETE /api/v1/storage/:blobName`

#### Purpose
Delete a stored blob by name.

#### Request
- No body is required.

#### Parameters
| Name | Location | Required | Description |
|---|---|---|---|
| `blobName` | path | Yes | Name of the blob to delete. |

#### Response
HTTP `200 OK`

```json
{
  "success": true,
  "message": "File deleted successfully.",
  "data": {
    "blobName": "stored-1710000000000-acde1234-acde-1234abcd5678.txt",
    "deleted": true,
    "deletedAt": "2026-07-08T15:37:13.114Z"
  }
}
```

#### Status Codes
| Status | Meaning |
|---|---|
| 200 | Delete succeeded. |
| 400 | `blobName` was missing. |
| 500 | Unexpected controller, service, or provider error. |

#### Example Request
```bash
curl -X DELETE http://localhost:5000/api/v1/storage/stored-1710000000000-acde1234-acde-1234abcd5678.txt
```

#### Example Response
See the JSON example above.

#### Possible Errors
- `Blob name is required.` when the path parameter is missing.
- Azure configuration errors when required connection values are absent.
- Provider errors if the blob does not exist or deletion fails.

## Error Handling

### Missing File on Upload
`StorageController.upload` returns HTTP `400` with `No file uploaded.` when the request does not include `req.file`.

### Missing Blob Name
`StorageController.download` and `StorageController.delete` return HTTP `400` with `Blob name is required.` when `blobName` is missing.

### Azure Configuration Missing
`AzureBlobProvider` throws explicit errors when required Azure environment variables are missing:
- `AZURE_STORAGE_CONNECTION_STRING`
- `AZURE_STORAGE_CONTAINER_NAME`

### Provider Failures
Azure SDK failures are wrapped with contextual messages that include the operation name and blob name when available.

### Centralized Error Handler
Unexpected errors are passed to the shared Express error handler, which returns the appropriate `500` response for this module when no more specific status is set.

## Azure Configuration
The storage module uses the Azure configuration in `backend/src/config/azure.js` and the values consumed by `AzureBlobProvider`.

| Variable | Purpose |
|---|---|
| `AZURE_STORAGE_CONNECTION_STRING` | Required connection string for `BlobServiceClient`. |
| `AZURE_STORAGE_CONTAINER_NAME` | Required target container name. |
| `AZURE_STORAGE_ACCOUNT_NAME` | Account name placeholder in the shared Azure config. |
| `MAX_FILE_SIZE` | Shared configuration value present in `config/azure.js`. The upload middleware still enforces its own 10 MB limit. |
| `ALLOWED_FILE_TYPES` | Shared configuration value present in `config/azure.js`. |

## Testing
The storage module has been validated through standalone scripts and manual endpoint testing.

| Test | Purpose |
|---|---|
| Standalone Upload Test | Exercises `StorageService.uploadFile()` directly. |
| Standalone Download Test | Exercises `StorageService.downloadFile()` directly. |
| Standalone Delete Test | Exercises `StorageService.deleteFile()` directly. |
| Standalone List Files Test | Exercises `StorageService.listFiles()` directly. |
| Standalone Express Test Server | Provides a local server for route-level testing on `/api/storage`. |
| Manual Postman Validation | Confirms the HTTP endpoints behave as expected. |
| Azure Blob Verification | Confirms blobs are created, streamed, listed, and deleted in the configured Azure container. |

## Future Improvements
Current implementation is complete for upload, download, delete, and list operations. Genuine future work includes:

- Authentication
- Authorization
- Database metadata persistence
- Pagination
- File validation
- Signed URLs
- Virus scanning
- Image optimization

## Summary
The storage module now provides a complete Azure-backed file storage flow with upload, streaming download, delete, and list capabilities. The route, controller, service, and provider layers are clearly separated, and the Azure SDK remains isolated inside `AzureBlobProvider`.
