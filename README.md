# nodejs-tutorial-hello-world

A minimal HTTP server written in plain Node.js. It has one route: `GET /hello` returns the text `Hello world`. Every other method or path returns `Not Found`.

The project is a reference for beginners. Without any framework, it shows how a Node.js server is created, how it routes and logs requests, how it validates its configuration and how it shuts down cleanly. It uses only the `http` module that is built into Node.js, so there are no packages to install.

The project has three files:

| File | Purpose |
|------|---------|
| `server.js` | The whole application |
| `package.json` | Project metadata and the `npm start` script |
| `README.md` | This guide |

## Prerequisites

- **Node.js 18.0.0 or later.** For a new install, download the current LTS (long-term support) release from https://nodejs.org. npm, the Node.js package manager, is installed together with Node.js.
- **curl**, a command-line tool that sends HTTP requests. It is preinstalled on macOS, most Linux distributions and Windows 10 and later. On Windows PowerShell it is called as `curl.exe` (see [Testing the server](#testing-the-server)). A web browser also works for the `/hello` request.

To check your Node.js version, open a terminal (Terminal on macOS, a shell on Linux, PowerShell or Command Prompt on Windows) and run:

```sh
node --version
```

Expected output: a version number of `v18.0.0` or higher, for example:

```text
v24.22.0
```

## Installation

1. Get a copy of the project folder: download it and extract it, or clone it with Git.
2. Open a terminal and change into the project folder, the folder that contains `server.js`:

   ```sh
   cd nodejs-tutorial-hello-world
   ```

   A new terminal usually starts in your home folder. This command works only if the project folder is directly inside the folder the terminal is in. If the folder has a different name or is somewhere else, use its path instead. For example, if the folder is in your Downloads folder:

   ```sh
   cd ~/Downloads/nodejs-tutorial-hello-world
   ```

   Here `~` means your home folder. PowerShell accepts the same command. In Command Prompt, use `cd %USERPROFILE%\Downloads\nodejs-tutorial-hello-world` instead.

   To fill in the path without typing it, type `cd` followed by a space. Then drag the project folder from Finder (macOS), File Explorer (Windows) or your file manager (Linux) into the terminal window. Its path appears after `cd`. Press Enter. In Command Prompt, if the folder is on another drive, such as `D:`, type `cd /d` instead of `cd`.

   If the terminal reports `No such file or directory` or a similar error, see [Troubleshooting](#troubleshooting).

There is no `npm install` step. The project has no dependencies, so there is nothing to download.

## Running the server

Start the server from the project folder with either of these commands. Both run the same program.

**Option 1: run it with Node.js**

```sh
node server.js
```

Expected output:

```text
Server listening on port 3000
```

**Option 2: run it through npm**

```sh
npm start
```

Expected output:

```text

> nodejs-tutorial-hello-world@1.0.0 start
> node server.js

Server listening on port 3000
```

npm prints the two lines that start with `>` and the blank lines around them, to show which script it runs. They do not come from the server.

The server keeps running, so the terminal stays busy and shows no new prompt. Leave it open: every request the server receives is logged there. To test the server, open a second terminal.

## Testing the server

Run these commands in a second terminal while the server is running in the first one.

**Request the greeting:**

```sh
curl http://localhost:3000/hello
```

Expected output:

```text
Hello world
```

The response body has no trailing newline, so the output does not end with a line break. In bash, the usual shell on Linux, your shell prompt appears on the same line, right after `Hello world`. In zsh, the default shell on macOS, a highlighted `%` appears right after `Hello world` and your prompt moves to the next line. The `%` only marks the missing newline; it is not part of the response.

You can also open `http://localhost:3000/hello` in a web browser. The browser may also request `/favicon.ico` on its own; the server logs that request too and answers it with `Not Found`.

**See the status line and headers:** the `-i` option makes curl print the status line and the response headers before the body.

```sh
curl -i http://localhost:3000/hello
```

Expected output:

```text
HTTP/1.1 200 OK
Content-Type: text/plain
Content-Length: 11
Date: Mon, 19 Oct 2026 22:24:41 GMT
Connection: keep-alive
Keep-Alive: timeout=5

Hello world
```

`200 OK` means success. `Content-Length: 11` is the size of `Hello world` in bytes. Node.js adds the `Date`, `Connection` and `Keep-Alive` headers itself. Your `Date` line shows the current time, so it will differ.

**Request a path that does not exist:**

```sh
curl -i http://localhost:3000/invalid
```

Expected output:

```text
HTTP/1.1 404 Not Found
Content-Type: text/plain
Content-Length: 9
Date: Mon, 19 Oct 2026 22:24:47 GMT
Connection: keep-alive
Keep-Alive: timeout=5

Not Found
```

**Use a method other than GET:** the `-X POST` option sends a POST request. Only `GET` is routed to `/hello`, so this request gets `Not Found` too.

```sh
curl -i -X POST http://localhost:3000/hello
```

Expected output:

```text
HTTP/1.1 404 Not Found
Content-Type: text/plain
Content-Length: 9
Date: Mon, 19 Oct 2026 22:24:53 GMT
Connection: keep-alive
Keep-Alive: timeout=5

Not Found
```

**On Windows PowerShell**, type `curl.exe` instead of `curl`, for example `curl.exe http://localhost:3000/hello`. In Windows PowerShell 5.1, `curl` is an alias for the `Invoke-WebRequest` command, which takes different options. In Command Prompt, `curl` works as shown.

**Request log:** the server terminal prints one line for every request, in the form `<timestamp> <method> <path>`. The timestamp is the moment the request arrived, in ISO 8601 format and in UTC. After the four commands above, the server terminal shows:

```text
Server listening on port 3000
2026-10-19T22:24:35.121Z GET /hello
2026-10-19T22:24:41.508Z GET /hello
2026-10-19T22:24:47.932Z GET /invalid
2026-10-19T22:24:53.264Z POST /hello
```

Your timestamps will differ. If you started the server with `npm start`, npm's lines appear above `Server listening on port 3000`.

## Stopping the server

Go back to the server terminal and press CTRL+C (hold the Control key and press C).

Expected output:

```text
Received SIGINT, shutting down server
```

Your terminal may show `^C` just before it, on the same line. SIGINT is the signal that CTRL+C sends. The server stops accepting connections, closes the open ones and exits with status 0, which means success. On macOS and Linux you can check the status right after the server stops:

```sh
echo $?
```

Expected output:

```text
0
```

The server normally exits at once. If a client is still receiving data, its connection can stay open for about five seconds before the server force-closes it, and the process exits after that. Pressing CTRL+C a second time stops the server immediately.

If you started the server with `npm start`, npm may report its own interrupted status even though the server itself exited cleanly: `echo $?` can print `130` instead of `0`. In Windows Command Prompt, npm may also ask `Terminate batch job (Y/N)?`; type `Y` and press Enter.

## Configuration

The server has one setting: the `PORT` environment variable, which sets the port it listens on.

- Default: `3000`, used when `PORT` is not set.
- Allowed values: whole numbers from 1024 to 65535.
- Ports below 1024 are privileged and are not accepted.

**macOS and Linux:**

```sh
PORT=8080 node server.js
```

This sets `PORT` for that one command only. The same form works with npm: `PORT=8080 npm start`.

**Windows PowerShell:**

```powershell
$env:PORT = "8080"
node server.js
```

**Windows Command Prompt:** run `set PORT=8080` on its own line, then start the server:

```bat
set PORT=8080
node server.js
```

Expected output on every platform:

```text
Server listening on port 8080
```

To test it, put the new port in the URL:

```sh
curl http://localhost:8080/hello
```

Expected output:

```text
Hello world
```

In PowerShell and Command Prompt, the variable stays set until you clear it or close the terminal.

In Command Prompt, do not write `set PORT=8080 && node server.js` on one line. Command Prompt then stores the value with a trailing space, `"8080 "`, and the server rejects it:

```text
Configuration error: PORT must be an integer between 1024 and 65535, but received "8080 ". Set PORT to a whole number such as 8080, or unset it to use the default port 3000.
```

**Invalid values:** the server checks `PORT` before it starts. For an invalid value it prints one error message and exits immediately with status 1, without starting the server. Two examples, in macOS and Linux syntax:

```sh
PORT=abc node server.js
```

Expected output:

```text
Configuration error: PORT must be an integer between 1024 and 65535, but received "abc". Set PORT to a whole number such as 8080, or unset it to use the default port 3000.
```

```sh
PORT=80 node server.js
```

Expected output:

```text
Configuration error: PORT 80 is below 1024. Ports below 1024 are privileged and are not accepted; choose a port between 1024 and 65535 such as 8080, or unset PORT to use the default port 3000.
```

**Going back to the default port:** clear the variable, then start the server again.

- macOS and Linux: `unset PORT` (needed only if you set it with `export PORT=8080`)
- Windows PowerShell: `Remove-Item Env:PORT`
- Windows Command Prompt: `set PORT=`

## Troubleshooting

**The server prints `Startup error: port 3000 is already in use.`** The full message is:

```text
Startup error: port 3000 is already in use. Stop the process that is using it, or choose another port, for example: PORT=8080 node server.js
```

Another program is already listening on that port, often a copy of this server running in another terminal. Stop that program, for example with CTRL+C in its terminal, or start this server on another port as shown in [Configuration](#configuration). The server that printed this message exits with status 1.

**The server prints a line that starts with `Configuration error:`.** The `PORT` value is invalid. The message shows the value it received and what is allowed. Correct `PORT`, or clear it to use the default port, as described in [Configuration](#configuration).

**The server prints a line that starts with `Server error:`.** The operating system reported a problem that the server cannot work around. The text after `Server error:` names it, including a short error code such as `EMFILE`, which means the server has too many files open; on macOS and Linux every connection counts as an open file. The server then stops accepting connections, closes the open ones as it does for CTRL+C, and exits with status 1. Fix the reported problem, for example by closing programs you no longer need, especially any that are connected to the server, then start the server again with `node server.js`.

**curl reports an error or keeps waiting, but the server is still running and prints nothing new.** The server may have run out of open files. Node.js then closes new connections at once or leaves them waiting, and the server's code is never told, so it prints neither an error nor a request line. Stop the server with CTRL+C, close programs you no longer need, especially any that are connected to the server, and start the server again. On macOS and Linux, `ulimit -n` shows how many files a program started from that terminal may open.

**The terminal reports `command not found` or `not recognized` for `node` or `npm`.** Node.js is not installed, or the terminal cannot find it. Install Node.js as described in [Prerequisites](#prerequisites), then open a new terminal and run `node --version` again.

**The terminal reports `No such file or directory`, `Cannot find module` or `ENOENT`.** The terminal is not in the project folder, the folder that contains `server.js`. The message depends on the command you ran:

- `cd` reports `No such file or directory`. In zsh, the default shell on macOS, it reports `no such file or directory`. On Windows, PowerShell reports `Cannot find path` and Command Prompt reports `The system cannot find the path specified`.
- `node server.js` reports `Error: Cannot find module`, followed by a path that ends in `server.js`.
- `npm start` reports `code ENOENT` and a path that ends in `package.json`. Newer npm versions also print `Could not read package.json`.

Change into the project folder as described in [Installation](#installation), then run the command again.

**curl reports `Failed to connect to localhost port 3000`.** The server is not running, or it listens on another port. Start it as described in [Running the server](#running-the-server), and use the port from its `Server listening on port` line in the URL.
