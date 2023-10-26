---
'@l2beat/backend-tools': minor
---

All logging methods in Logger now accept variadic arguments of any type.
The `reportError` option callback now receives full context of the logged message.
Added documentation for the `Logger` class.
Logging in the `json` format now outputs a `"parameters"` property.
