// One-off local viewer for the progress board. Loopback only, serves ONE file, exits after 30 minutes.
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 8099;
const FILE = path.join(__dirname, "index.html");

const server = http.createServer((req, res) => {
  if (req.method !== "GET" || (req.url !== "/" && req.url !== "/index.html")) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    return res.end("Not found");
  }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  fs.createReadStream(FILE).pipe(res);
});

server.listen(PORT, "127.0.0.1", () => console.log(`Progress board: http://127.0.0.1:${PORT}  (closes itself in 30 minutes)`));
setTimeout(() => server.close(() => process.exit(0)), 30 * 60 * 1000).unref?.();
setTimeout(() => process.exit(0), 30 * 60 * 1000 + 2000);
