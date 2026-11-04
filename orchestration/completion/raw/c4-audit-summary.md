
### root (/): {"info":0,"low":0,"moderate":1,"high":7,"critical":2,"total":10} (production-only: {"info":0,"low":0,"moderate":1,"high":6,"critical":2,"total":9})
| Package | Severity | Scope | Direct | Advisory / via | Dependency path (first effect) | Fix available |
|---|---|---|---|---|---|---|
| proxy-addr | critical | production | transitive | proxy-addr vulnerable to IP spoofing via IPv4-mapped IPv6 trust subnet (GHSA-jqcg-44mw-7w3h) | -; at node_modules/proxy-addr | yes |
| tar | critical | production | transitive | node-tar Vulnerable to Arbitrary File Creation/Overwrite via Hardlink Path Traversal (GHSA-34x7-hfp2-rc4v); node-tar is Vulnerable to Arbitrary File Overwrite and Symlink | affects @mapbox/node-pre-gyp; at node_modules/tar | yes |
| @mapbox/node-pre-gyp | high | production | transitive | tar | -; at node_modules/@mapbox/node-pre-gyp | yes |
| body-parser | high | production | transitive | body-parser vulnerable to Denial of Service via trailing bytes after a compressed request body (GHSA-27r3-jxmh-p828) | -; at node_modules/body-parser | yes |
| brace-expansion | high | production | transitive | brace-expansion: DoS via unbounded expansion length causing an out-of-memory process crash (GHSA-mh99-v99m-4gvg); brace-expansion: DoS via unbounded intermediate arrays,  | -; at node_modules/brace-expansion | yes |
| fast-xml-parser | high | production | transitive | fast-xml-parser: Repeated DOCTYPE declarations reset entity expansion limits (GHSA-8r6m-32jq-jx6q) | -; at node_modules/fast-xml-parser | yes |
| follow-redirects | high | dev only | transitive | follow-redirects array-form headers bypass cross-origin credential stripping (GHSA-q3jh-wrc6-jgq8); follow-redirects sensitiveHeaders regex escaping can expose credential | -; at node_modules/follow-redirects | yes |
| ip-address | high | production | transitive | ip-address: Address4 decodes leading-zero octets as decimal while resolvers decode them as octal, allowing SSRF and trust-boundary bypass (GHSA-mwp4-54f8-5fhr); ip-addres | -; at node_modules/ip-address | yes |
| multer | high | production | direct | multer vulnerable to Denial of Service via crafted multipart field names (GHSA-wc9g-mqfw-jrwm); multer vulnerable to Denial of Service via file descriptor leak on aborted | -; at node_modules/multer | yes |
| qs | moderate | production | transitive | qs array-limit bypass via bracket-key comma parsing (GHSA-x5fp-wj9c-mxmx); qs: Denial of Service via Attacker Controlled isBuffer (GHSA-4mjr-xmp4-gh2g); qs : qs.stringify | -; at node_modules/qs | yes |

### backend: {"info":0,"low":0,"moderate":2,"high":6,"critical":1,"total":9} (production-only: {"info":0,"low":0,"moderate":2,"high":6,"critical":1,"total":9})
| Package | Severity | Scope | Direct | Advisory / via | Dependency path (first effect) | Fix available |
|---|---|---|---|---|---|---|
| proxy-addr | critical | production | transitive | proxy-addr vulnerable to IP spoofing via IPv4-mapped IPv6 trust subnet (GHSA-jqcg-44mw-7w3h) | -; at node_modules/proxy-addr | yes |
| axios | high | production | direct | Axios: Prototype pollution gadget in fetch adapter can alter outbound requests (GHSA-vh66-26gq-q6x8); Axios: Prototype-Pollution Gadget in the Default Instance Allows Inh | -; at node_modules/axios | yes |
| body-parser | high | production | transitive | body-parser vulnerable to Denial of Service via trailing bytes after a compressed request body (GHSA-27r3-jxmh-p828) | -; at node_modules/body-parser | yes |
| compression | high | production | direct | compression vulnerable to Denial of Service via memory leak on premature response close (GHSA-vc2v-76pw-4v95) | -; at node_modules/compression | yes |
| follow-redirects | high | production | transitive | follow-redirects array-form headers bypass cross-origin credential stripping (GHSA-q3jh-wrc6-jgq8); follow-redirects sensitiveHeaders regex escaping can expose credential | -; at node_modules/follow-redirects | yes |
| multer | high | production | direct | multer vulnerable to Denial of Service via a pending asynchronous fileFilter after request teardown (GHSA-q7qp-rjg7-q26m) | -; at node_modules/multer | yes |
| undici | high | production | transitive | undici vulnerable to Denial of Service via unbounded memory in the EventSource parser (GHSA-4qv8-2p9j-2685); undici vulnerable to Subresource Integrity bypass via non-low | -; at node_modules/undici | yes |
| ip-address | moderate | production | transitive | ip-address: Address6 matches a zone identifier in quadratic time ahead of its length limit, allowing a single long string to stall the process (GHSA-rxp7-6hxx-x8q5) | -; at node_modules/ip-address | yes |
| qs | moderate | production | transitive | qs : qs.stringify with arrayFormat 'comma' throws an uncaught TypeError on array elements carrying a non-callable own toString (DoS) (GHSA-6pq8-jhm2-2vcw) | -; at node_modules/qs | yes |

### frontend: {"info":0,"low":0,"moderate":4,"high":7,"critical":2,"total":13} (production-only: {"info":0,"low":0,"moderate":2,"high":3,"critical":1,"total":6})
| Package | Severity | Scope | Direct | Advisory / via | Dependency path (first effect) | Fix available |
|---|---|---|---|---|---|---|
| dompurify | critical | production | direct | DOMPurify: IN_PLACE: node-removing afterSanitize hook leaves detached subtree event handlers armed, causing DOM XSS (GHSA-p98j-92pf-mc4p); DOMPurify: IN_PLACE returns a f | -; at node_modules/dompurify | yes |
| proxy-addr | critical | dev only | transitive | proxy-addr vulnerable to IP spoofing via IPv4-mapped IPv6 trust subnet (GHSA-jqcg-44mw-7w3h) | -; at node_modules/proxy-addr | yes |
| axios | high | production | direct | Axios: Prototype pollution gadget in fetch adapter can alter outbound requests (GHSA-vh66-26gq-q6x8); Axios: Prototype-Pollution Gadget in the Default Instance Allows Inh | -; at node_modules/axios | yes |
| body-parser | high | dev only | transitive | body-parser vulnerable to Denial of Service via trailing bytes after a compressed request body (GHSA-27r3-jxmh-p828) | -; at node_modules/body-parser | yes |
| compression | high | dev only | transitive | compression vulnerable to Denial of Service via memory leak on premature response close (GHSA-vc2v-76pw-4v95) | -; at node_modules/compression | yes |
| follow-redirects | high | production | transitive | follow-redirects array-form headers bypass cross-origin credential stripping (GHSA-q3jh-wrc6-jgq8); follow-redirects sensitiveHeaders regex escaping can expose credential | -; at node_modules/follow-redirects | yes |
| source-map-js | high | dev only | transitive | source-map-js allows event-loop denial of service through indexed source-map section offsets (GHSA-68fv-2mgg-jv7q) | -; at node_modules/source-map-js | yes |
| vite | high | dev only | direct | launch-editor: escapeCmdArgs() omits % escaping on Windows (GHSA-698v-4r3x-3vcv); launch-editor: Editor CLI flag misinterpretation causing arbitrary command execution for | -; at node_modules/vite | yes |
| zod | high | production | direct | Zod can exhaust memory while validating oversized constrained collections (GHSA-mrhx-c7xc-m3w5) | -; at node_modules/zod | yes, zod@4.6.7 (semver-major) |
| postcss-selector-parser | moderate | dev only | transitive | PostCSS: Quadratic complexity in flat selector parsing allows CPU exhaustion (GHSA-rj75-hqrm-r3gf) | -; at node_modules/postcss-selector-parser | yes |
| qs | moderate | dev only | transitive | qs : qs.stringify with arrayFormat 'comma' throws an uncaught TypeError on array elements carrying a non-callable own toString (DoS) (GHSA-6pq8-jhm2-2vcw) | -; at node_modules/qs | yes |
| react-router | moderate | production | transitive | React Router: Open redirect via backslash in <Link> and useNavigate (CVE-2025-68470 bypass) (GHSA-wrjc-x8rr-h8h6); React Router: Arbitrary Constructor Injection via deser | affects react-router-dom; at node_modules/react-router | yes, react-router-dom@7.18.5 (semver-major) |
| react-router-dom | moderate | production | direct | react-router | -; at node_modules/react-router-dom | yes, react-router-dom@7.18.5 (semver-major) |
