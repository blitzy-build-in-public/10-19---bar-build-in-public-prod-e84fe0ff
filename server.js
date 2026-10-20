// Minimal Node.js HTTP server tutorial, built on the node:http module alone with no framework.
// GET /hello answers "Hello world"; every other method and path answers "Not Found".
// Run it with `node server.js` or `npm start`. PORT sets the port (default 3000). CTRL+C stops it.

'use strict';

const http = require('node:http');

const DEFAULT_PORT = 3000;

const MIN_PORT = 1024;

const MAX_PORT = 65535;

const SHUTDOWN_TIMEOUT_MS = 5000;

// Turns the raw PORT environment value into a validated port number, or into an actionable error message.
function resolvePort(rawPort) {
  if (rawPort === undefined) {
    return { port: DEFAULT_PORT };
  }
  if (rawPort === '') {
    return {
      error: `Configuration error: PORT is set but empty. Set PORT to an integer between ${MIN_PORT} and ${MAX_PORT} (for example PORT=8080), or unset it to use the default port ${DEFAULT_PORT}.`,
    };
  }
  // Neither conversion validates on its own: parseInt() accepts '3000abc', and Number() accepts ' 3000 ',
  // '3e3' and '0x0BB8'. So the digits-only test runs first. Without the m flag, $ matches only at the end
  // of the input, and \d matches only the ASCII digits 0-9.
  if (!/^\d+$/.test(rawPort)) {
    return {
      error: `Configuration error: PORT must be an integer between ${MIN_PORT} and ${MAX_PORT}, but received ${JSON.stringify(rawPort)}. Set PORT to a whole number such as 8080, or unset it to use the default port ${DEFAULT_PORT}.`,
    };
  }
  const port = Number(rawPort);
  // The range messages print the raw digit string, so a huge value never renders as 1e+20.
  if (port < MIN_PORT) {
    return {
      error: `Configuration error: PORT ${rawPort} is below ${MIN_PORT}. Ports below ${MIN_PORT} are privileged and are not accepted; choose a port between ${MIN_PORT} and ${MAX_PORT} such as 8080, or unset PORT to use the default port ${DEFAULT_PORT}.`,
    };
  }
  if (port > MAX_PORT) {
    return {
      error: `Configuration error: PORT ${rawPort} is above ${MAX_PORT}, the highest valid TCP port. Choose a port between ${MIN_PORT} and ${MAX_PORT} such as 8080, or unset PORT to use the default port ${DEFAULT_PORT}.`,
    };
  }
  return { port };
}

// Returns the path part of the request target: everything before the first '?', exactly as received.
function getRequestPath(requestUrl) {
  // The URL constructor is not used: it reads '//hello' as host 'hello' with path '/', and it collapses
  // dot segments, so '/a/../hello' would match '/hello'. Instead the target is scanned character by
  // character up to the first '?'. The path collects in a property of a const object, because every
  // binding in this file is const.
  const scanned = { path: '' };
  for (const character of requestUrl) {
    if (character === '?') {
      break;
    }
    scanned.path += character;
  }
  return scanned.path;
}

// Writes one request log line to stdout: <ISO-8601 timestamp> <HTTP method> <request path>.
function logRequest(method, path) {
  console.log(`${new Date().toISOString()} ${method} ${path}`);
}

// Writes a complete plain-text response, then closes the response stream.
function sendText(response, statusCode, body) {
  // An explicit Content-Length sends the body as is; without it Node.js falls back to chunked transfer encoding.
  response.writeHead(statusCode, {
    'Content-Type': 'text/plain',
    'Content-Length': Buffer.byteLength(body),
  });
  response.end(body);
}

// Route handler for GET /hello. Route handlers receive only the response, because none of them reads the request.
function handleHello(response) {
  sendText(response, 200, 'Hello world');
}

// Catch-all handler for every method and path that no route matches.
function handleNotFound(response) {
  sendText(response, 404, 'Not Found');
}

// Route table keyed by '<method> <path>'. Adding a route means one handler function and one entry here.
// A Map is used instead of a plain object so that no inherited key, such as 'constructor', can ever match.
const routes = new Map([
  ['GET /hello', handleHello],
]);

// Request listener: logs the request, then dispatches it to its route handler or to the catch-all handler.
function handleRequest(request, response) {
  const path = getRequestPath(request.url);
  // Logging runs before routing, so requests that end in 404 are logged too.
  logRequest(request.method, path);
  // Matching is an exact, case-sensitive comparison of the method and the undecoded path.
  const routeHandler = routes.get(`${request.method} ${path}`) ?? handleNotFound;
  try {
    routeHandler(response);
  } catch (error) {
    handleRequestError(error, response);
  }
}

// Contains a failing route handler: reports the error on stderr and keeps every internal detail out of the response.
function handleRequestError(error, response) {
  // JavaScript can throw any value, not only an Error, so error.message cannot be assumed. An Error contributes
  // its message, and any other value, such as a string or null, is converted to text by the template literal.
  try {
    console.error(`Request handling failed: ${error instanceof Error ? error.message : error}`);
  } catch {
    // Checking or converting the value can itself throw, for example for a Symbol, for an object created with
    // Object.create(null), or for a revoked Proxy. The backstop must not fail, so such a value is named by its
    // type and the backstop still reaches the safe-response or abort path below.
    console.error(`Request handling failed: a thrown ${typeof error} could not be converted to text`);
  }
  if (!response.headersSent) {
    sendText(response, 500, 'Internal Server Error');
  } else {
    // Once the headers are sent the status can no longer change, so the response is aborted instead.
    response.destroy();
  }
}

// Records a new connection with no output yet, and forgets it once it closes.
function trackConnection(openConnections, socket) {
  openConnections.set(socket, null);
  socket.on('close', () => openConnections.delete(socket));
}

// Records the response as the latest output of its connection until the response has flushed.
function trackResponse(openConnections, request, response) {
  // Shutdown uses this to tell an idle connection from one still sending. It is needed because
  // server.closeAllConnections() does not exist in Node.js 18.0.0, and because a connection must not
  // close while its response is still flushing.
  const socket = request.socket;
  openConnections.set(socket, response);
  // Once the latest response has flushed, true stands in for it: everything owed is on the socket. A finished
  // response is not kept until the next request, because holding it through keep-alive idle time makes memory
  // grow under concurrent load. The check skips a connection that has since closed, and one whose latest
  // output is now a newer response or a CONNECT reply.
  response.once('finish', () => {
    if (openConnections.get(socket) === response) {
      openConnections.set(socket, true);
    }
  });
}

// Rejects a CONNECT without tunnelling: logs it, sends the fixed 404 once earlier responses flush, then times it out.
function handleConnect(openConnections, request, socket) {
  // A socket handed to the 'connect' event has no error handler, so a client reset would crash the process.
  // A reset on a rejected tunnel is a client-side event, not a server fault, so nothing is written to stderr.
  // The listener goes on first, because the reply may have to wait for earlier responses.
  socket.on('error', () => socket.destroy());
  // Node.js emits CONNECT on the 'connect' event, never on 'request'. With no listener it closes the socket
  // without any response, which would skip both the request log and the catch-all 404.
  logRequest(request.method, getRequestPath(request.url));
  // What the connection still owed before the CONNECT: null when no request came first, true when every
  // earlier response has flushed, and otherwise the latest earlier response.
  const earlierOutput = openConnections.get(socket);
  // The reply goes straight to the socket, so the socket itself is the connection's latest output. Shutdown
  // therefore waits for the socket's own 'finish', which follows the reply.
  openConnections.set(socket, socket);
  // The socket has left Node.js's HTTP response machinery, so the 404 is written as a raw HTTP/1.1 message
  // instead of through sendText. It is written only while the connection is still open and tracked.
  const reply = () => {
    if (openConnections.get(socket) === socket) {
      const body = 'Not Found';
      socket.end(`HTTP/1.1 404 Not Found\r\nContent-Type: text/plain\r\nContent-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n${body}`);
      // The socket has left Node.js's HTTP machinery, so none of its timeouts applies, and a client that never reads
      // the reply or never closes its side would hold the socket and its file descriptor indefinitely. The timer
      // gives such a client the same SHUTDOWN_TIMEOUT_MS that shutdown gives, and unref() keeps it from delaying an
      // exit that is already possible. It acts only while the entry is still the socket: a closed connection has no
      // entry, and once shutdown has half-closed the connection the entry is true and shutdown's fallback is the
      // deadline instead.
      const closeTimer = setTimeout(() => {
        if (openConnections.get(socket) === socket) {
          socket.destroy();
        }
      }, SHUTDOWN_TIMEOUT_MS);
      closeTimer.unref();
    }
  };
  // Responses to requests pipelined ahead of the CONNECT may still be queued inside Node.js. The latest of them
  // finishes last, so the reply waits for it; otherwise the raw reply would overtake them and cut them off.
  if (earlierOutput !== null && earlierOutput !== true && !earlierOutput.writableFinished) {
    earlierOutput.once('finish', reply);
  } else {
    reply();
  }
}

// Reports a server error with an actionable message on stderr, then shuts the server down with exit code 1.
function handleServerError(error, port, server, openConnections) {
  // The suggested command must name a port other than the one that failed, or following it would fail
  // the same way: 8080 as a rule, and 8081 when 8080 itself is the port that failed.
  const suggestedPort = port === 8080 ? 8081 : 8080;
  if (error.code === 'EADDRINUSE') {
    console.error(`Startup error: port ${port} is already in use. Stop the process that is using it, or choose another port, for example: PORT=${suggestedPort} node server.js`);
  } else if (error.code === 'EACCES') {
    console.error(`Startup error: permission denied while binding to port ${port}. Choose another port between ${MIN_PORT} and ${MAX_PORT}, for example: PORT=${suggestedPort} node server.js`);
  } else {
    console.error(`Server error: ${error.message}. Shutting down. Resolve the reported problem, then start the server again with: node server.js`);
  }
  stopServer(server, openConnections, 1);
}

// Handles CTRL+C: logs the shutdown and requests exit code 0 without clearing an earlier server failure.
function handleSigint(server, openConnections) {
  console.log('Received SIGINT, shutting down server');
  stopServer(server, openConnections, 0);
}

// Closes one connection without cutting off its output.
function closeWhenFlushed(openConnections, socket) {
  const pendingOutput = openConnections.get(socket);
  // The connection has already closed and been forgotten.
  if (pendingOutput === undefined) {
    return;
  }
  // No request ever arrived on this connection, so nothing is owed on it.
  if (pendingOutput === null) {
    socket.destroy();
    return;
  }
  // The latest output, a response or a CONNECT socket, is still being written. end() returning, or writableEnded,
  // does not mean the output has been handed to the operating system; only writableFinished and the 'finish'
  // event do. A CONNECT socket finishes only once its reply has been written and handed over, so shutdown never
  // half-closes it before the reply is queued. After 'finish' the check runs again, because a pipelined request
  // may have produced a newer response, or a CONNECT, in the meantime.
  if (pendingOutput !== true && !pendingOutput.writableFinished) {
    pendingOutput.once('finish', () => closeWhenFlushed(openConnections, socket));
    return;
  }
  // Everything owed has been handed to the operating system. The entry becomes true to mark the connection as
  // half-closed by shutdown, so a CONNECT socket's own close timer stands down and shutdown's fallback is the
  // deadline instead.
  openConnections.set(socket, true);
  // Half-close: the FIN is queued behind every byte already handed to the operating system, so it never overtakes
  // a just-finished response or a CONNECT reply, but nothing guarantees that the client receives them. Ending an
  // already-ended CONNECT socket again is harmless.
  socket.end();
}

// Stops the listener, drains sockets with a forced-cleanup fallback, and preserves any fatal exit status.
function stopServer(server, openConnections, exitCode) {
  // The exit code is only recorded here; the process ends on its own once the event loop is empty.
  // process.exit() is not called, because it can cut off output still queued on a POSIX pipe.
  // A shutdown already under way for a server error keeps exit code 1, even if CTRL+C follows.
  if (process.exitCode !== 1) {
    process.exitCode = exitCode;
  }
  server.close();
  for (const socket of openConnections.keys()) {
    closeWhenFlushed(openConnections, socket);
  }
  // Forced cleanup for clients that stop reading, keep pipelining, or never close their side after the FIN.
  // unref() keeps the timer from delaying an exit that is already possible.
  const fallbackTimer = setTimeout(() => {
    for (const socket of openConnections.keys()) {
      socket.destroy();
    }
  }, SHUTDOWN_TIMEOUT_MS);
  fallbackTimer.unref();
}

// Creates the server, wires its events, binds it to the port and installs the CTRL+C handler.
function startServer(port) {
  // Every open connection, mapped to its latest output: null until a request arrives, the latest response
  // while it is still being written, true once it has flushed, and the socket itself after a CONNECT request,
  // whose reply is written straight to the socket. Once shutdown half-closes a connection, its entry is true.
  const openConnections = new Map();
  const server = http.createServer(handleRequest);
  // Registered after handleRequest so tracking follows dispatch; output may still be flushing.
  server.on('request', (request, response) => trackResponse(openConnections, request, response));
  // Node.js answers an Expect value other than 100-continue with an empty 417 and skips 'request', unless a
  // 'checkExpectation' listener exists. Re-emitting it on 'request' routes such a request like any other,
  // through handleRequest and then trackResponse, without reading the header.
  server.on('checkExpectation', (request, response) => server.emit('request', request, response));
  server.on('connect', (request, socket) => handleConnect(openConnections, request, socket));
  server.on('connection', (socket) => trackConnection(openConnections, socket));
  server.on('error', (error) => handleServerError(error, port, server, openConnections));
  // The startup line is written in the listen callback, so it appears only after the bind has succeeded.
  server.listen(port, () => console.log(`Server listening on port ${port}`));
  // once() removes the handler after the first CTRL+C, so a second CTRL+C falls back to Node.js's default
  // behaviour and ends the process immediately.
  process.once('SIGINT', () => handleSigint(server, openConnections));
}

// Entry point: PORT is validated first, so an invalid value never reaches listen() and no server is created.
const portResult = resolvePort(process.env.PORT);
if (portResult.error) {
  console.error(portResult.error);
  process.exitCode = 1;
} else {
  startServer(portResult.port);
}
