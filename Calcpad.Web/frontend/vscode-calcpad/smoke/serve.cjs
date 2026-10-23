// Minimal static file server for the smoke-test page. Dev-only.
const { createServer } = require('node:http')
const { readFile } = require('node:fs/promises')
const { join, extname } = require('node:path')

const root = process.argv[2]
const port = Number(process.argv[3] ?? 8123)
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.mjs': 'text/javascript' }

createServer(async (req, res) => {
  const path = req.url === '/' ? '/index.html' : req.url.split('?')[0]
  try {
    const body = await readFile(join(root, path))
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404).end('not found')
  }
}).listen(port, '127.0.0.1', () => console.log(`serving ${root} on http://127.0.0.1:${port}`))
