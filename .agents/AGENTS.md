# IEEE Finance Pro Workspace Rules

This file sets the global constraints for all agentic operations in this workspace.

## 🔒 API Contract Constraints
- **Prefix**: Prefix all API routes with `/api/v1`.
- **Response Wrapper**: All successful responses must use:
  ```json
  {
    "success": true,
    "data": { },
    "meta": { }
  }
  ```
- **Error Wrapper**: All failed responses must return the correct HTTP status code and match:
  ```json
  {
    "success": false,
    "error": {
      "code": "ERROR_CODE",
      "message": "Human-readable error description"
    }
  }
  ```
- **Object Serialization**: Replace all `_id` and `__v` outputs with `id` at the serialization layer.

## 🌿 Git Branching Rule
- All Team 5 work must be developed, tested, and committed exclusively into the `T5` branch.
