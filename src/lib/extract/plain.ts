// txt / md / markdown: decode the bytes (BOM and UTF-16 aware) and pass the text through.

export function decodeText(bytes: Uint8Array): string {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3))
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2))
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2))
  }
  // BOM-less UTF-16: many NUL bytes in alternating positions.
  if (bytes.length >= 4) {
    const n = Math.min(bytes.length, 200)
    let even = 0
    let odd = 0
    for (let i = 0; i < n; i++) {
      if (bytes[i] !== 0) continue
      if (i % 2 === 0) even++
      else odd++
    }
    if (odd > n / 4 && even === 0) return new TextDecoder('utf-16le').decode(bytes)
    if (even > n / 4 && odd === 0) return new TextDecoder('utf-16be').decode(bytes)
  }
  return new TextDecoder('utf-8').decode(bytes)
}

export function plainToText(bytes: Uint8Array): string {
  return decodeText(bytes).replace(/\r\n?/g, '\n')
}
