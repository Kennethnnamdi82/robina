// Optional Windows test setup: download ONLY mongod.exe from the official large ZIP.
// Range requests avoid downloading hundreds of MB of debug symbols. No production DB access.
import { mkdir, rename, createWriteStream } from 'node:fs';
import { promisify } from 'node:util';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';
import { createInflateRaw, crc32 } from 'node:zlib';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'win32') throw new Error('This helper is Windows-only; normal MongoMemoryServer setup works on Linux.');
const url = 'https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-7.0.24.zip';
const directory = fileURLToPath(new URL('../.cache/test-mongodb/', import.meta.url));
await promisify(mkdir)(directory, { recursive: true });
async function range(start, end) {
  const response = await fetch(url, { headers: { range: `bytes=${start}-${end}` }, signal: AbortSignal.timeout(45000) });
  if (response.status !== 206 || !response.headers.get('content-range')) throw new Error('Official MongoDB download did not honor byte range');
  return response;
}
const head = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(30000) });
if (!head.ok) throw new Error('Official MongoDB archive unavailable');
const size = Number(head.headers.get('content-length'));
if (!Number.isSafeInteger(size) || size < 65536) throw new Error('Unexpected MongoDB archive size');
const tail = Buffer.from(await (await range(size - 65536, size - 1)).arrayBuffer());
let end = -1;
for (let i = tail.length - 22; i >= 0; i--) if (tail.readUInt32LE(i) === 0x06054b50) { end = i; break; }
if (end < 0) throw new Error('ZIP central directory missing');
const directorySize = tail.readUInt32LE(end + 12), directoryOffset = tail.readUInt32LE(end + 16);
if (directorySize > 1_000_000) throw new Error('Unexpected central directory');
const entries = Buffer.from(await (await range(directoryOffset, directoryOffset + directorySize - 1)).arrayBuffer());
let target;
for (let offset = 0; offset + 46 <= entries.length;) {
  if (entries.readUInt32LE(offset) !== 0x02014b50) throw new Error('Invalid ZIP directory entry');
  const nameLength = entries.readUInt16LE(offset + 28), extraLength = entries.readUInt16LE(offset + 30), commentLength = entries.readUInt16LE(offset + 32);
  const name = entries.toString('utf8', offset + 46, offset + 46 + nameLength);
  if (name.endsWith('/bin/mongod.exe')) target = { method: entries.readUInt16LE(offset + 10),
    crc: entries.readUInt32LE(offset + 16), compressed: entries.readUInt32LE(offset + 20),
    uncompressed: entries.readUInt32LE(offset + 24), position: entries.readUInt32LE(offset + 42) };
  offset += 46 + nameLength + extraLength + commentLength;
}
if (!target || target.method !== 8 || target.compressed > 200_000_000 || target.uncompressed > 600_000_000) throw new Error('Unexpected mongod.exe ZIP entry');
const local = Buffer.from(await (await range(target.position, target.position + 29)).arrayBuffer());
if (local.readUInt32LE(0) !== 0x04034b50) throw new Error('Invalid local ZIP header');
const start = target.position + 30 + local.readUInt16LE(26) + local.readUInt16LE(28);
console.log(`Downloading official mongod.exe only (${Math.ceil(target.compressed / 1048576)} MiB compressed)`);
let checksum = 0, bytes = 0;
const check = new Transform({ transform(chunk, _encoding, callback) { checksum = crc32(chunk, checksum); bytes += chunk.length; callback(null, chunk); } });
const chunkSize = 512 * 1024, chunks = new Array(Math.ceil(target.compressed / chunkSize));
let next = 0, complete = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (next < chunks.length) {
    const index = next++, first = start + index * chunkSize, last = Math.min(first + chunkSize - 1, start + target.compressed - 1);
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await range(first, last);
        const chunk = Buffer.from(await response.arrayBuffer());
        if (chunk.length !== last - first + 1) throw new Error('Partial range length mismatch');
        chunks[index] = chunk;
        if (++complete % 8 === 0 || complete === chunks.length) console.log(`MongoDB test download: ${complete}/${chunks.length} chunks`);
        break;
      } catch (error) { if (attempt >= 2) throw error; }
    }
  }
}));
await pipeline(Readable.from(chunks), createInflateRaw(), check, createWriteStream(directory + 'mongod.exe.partial'));
if (checksum !== target.crc || bytes !== target.uncompressed) throw new Error('Official archive entry CRC/size mismatch');
await promisify(rename)(directory + 'mongod.exe.partial', directory + 'mongod.exe');
console.log('Verified ZIP entry CRC and size. Test binary: ' + directory + 'mongod.exe');
