// deflate crudo con las apis nativas del navegador (y de node): sin dependencias.
async function pipe(bytes, stream) {
  const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}
export const deflate = (b) => pipe(b, new CompressionStream('deflate-raw'));
export const inflate = (b) => pipe(b, new DecompressionStream('deflate-raw'));
