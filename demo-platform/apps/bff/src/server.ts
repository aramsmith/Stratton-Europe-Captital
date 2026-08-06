import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";

export function createRequestHandler(_request: IncomingMessage, response: ServerResponse) {
  if (_request.method === "GET" && _request.url === "/healthz") {
    response.statusCode = 200;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ status: "ok" }));
    return;
  }

  response.statusCode = 404;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify({ error: "not_found" }));
}

export function createApp() {
  return createServer(createRequestHandler);
}

const isDirectRun = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (isDirectRun) {
  const port = Number(process.env.PORT ?? 3001);

  createApp().listen(port, () => {
    console.log(`Stratton demo BFF listening on ${port}`);
  });
}
