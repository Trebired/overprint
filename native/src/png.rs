use std::cell::RefCell;

const SIGNATURE: [u8; 8] = [137, 80, 78, 71, 13, 10, 26, 10];
const MASK: u32 = 1;

thread_local! {
    static OUTPUT: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };
}

fn crc_table() -> [u32; 256] {
    let mut table = [0u32; 256];
    for (index, slot) in table.iter_mut().enumerate() {
        let mut value = index as u32;
        for _ in 0..8 {
            value = if value & 1 == 1 { 0xedb8_8320 ^ (value >> 1) } else { value >> 1 };
        }
        *slot = value;
    }
    table
}

fn crc(table: &[u32; 256], bytes: &[u8]) -> u32 {
    let mut value = 0xffff_ffffu32;
    for byte in bytes {
        value = table[((value ^ *byte as u32) & 0xff) as usize] ^ (value >> 8);
    }
    value ^ 0xffff_ffff
}

fn chunk(out: &mut Vec<u8>, table: &[u32; 256], kind: &[u8; 4], data: &[u8]) {
    out.extend_from_slice(&(data.len() as u32).to_be_bytes());
    let start = out.len();
    out.extend_from_slice(kind);
    out.extend_from_slice(data);
    let sum = crc(table, &out[start..]);
    out.extend_from_slice(&sum.to_be_bytes());
}

fn adler(bytes: &[u8]) -> u32 {
    let (mut low, mut high) = (1u32, 0u32);
    for chunk in bytes.chunks(5552) {
        for byte in chunk {
            low += *byte as u32;
            high += low;
        }
        low %= 65521;
        high %= 65521;
    }
    (high << 16) | low
}

fn zlib(raw: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(raw.len() + raw.len() / 65535 * 5 + 11);
    out.extend_from_slice(&[0x78, 0x01]);
    let blocks: Vec<&[u8]> = if raw.is_empty() { vec![raw] } else { raw.chunks(65535).collect() };
    for (index, block) in blocks.iter().enumerate() {
        out.push(u8::from(index + 1 == blocks.len()));
        let length = block.len() as u16;
        out.extend_from_slice(&length.to_le_bytes());
        out.extend_from_slice(&(!length).to_le_bytes());
        out.extend_from_slice(block);
    }
    out.extend_from_slice(&adler(raw).to_be_bytes());
    out
}

fn header(width: usize, height: usize, depth: u8, color: u8) -> Vec<u8> {
    let mut data = Vec::with_capacity(13);
    data.extend_from_slice(&(width as u32).to_be_bytes());
    data.extend_from_slice(&(height as u32).to_be_bytes());
    data.extend_from_slice(&[depth, color, 0, 0, 0]);
    data
}

fn rgba_rows(pixels: &[u8], width: usize) -> Vec<u8> {
    let mut raw = Vec::with_capacity(pixels.len() + pixels.len() / (width * 4).max(1));
    for row in pixels.chunks_exact(width * 4) {
        raw.push(0);
        raw.extend_from_slice(row);
    }
    raw
}

fn mask_rows(pixels: &[u8], width: usize) -> Vec<u8> {
    let stride = width.div_ceil(8);
    let mut raw = Vec::with_capacity((stride + 1) * pixels.len() / (width * 4).max(1));
    for row in pixels.chunks_exact(width * 4) {
        raw.push(0);
        let mut packed = vec![0u8; stride];
        for (column, pixel) in row.chunks_exact(4).enumerate() {
            if pixel[3] > 127 {
                packed[column / 8] |= 0x80 >> (column % 8);
            }
        }
        raw.extend_from_slice(&packed);
    }
    raw
}

fn palette(pixels: &[u8]) -> Vec<u8> {
    let ink = pixels.chunks_exact(4).find(|pixel| pixel[3] > 127).unwrap_or(&[0, 0, 0, 255]);
    vec![0, 0, 0, ink[0], ink[1], ink[2]]
}

pub fn encode(pixels: &[u8], width: usize, height: usize, mode: u32) -> usize {
    let table = crc_table();
    let mut out = Vec::new();
    out.extend_from_slice(&SIGNATURE);
    if mode == MASK {
        chunk(&mut out, &table, b"IHDR", &header(width, height, 1, 3));
        chunk(&mut out, &table, b"PLTE", &palette(pixels));
        chunk(&mut out, &table, b"tRNS", &[0, 255]);
        let raw = mask_rows(pixels, width);
        chunk(&mut out, &table, b"IDAT", &zlib(&raw));
    } else {
        chunk(&mut out, &table, b"IHDR", &header(width, height, 8, 6));
        let raw = rgba_rows(pixels, width);
        chunk(&mut out, &table, b"IDAT", &zlib(&raw));
    }
    chunk(&mut out, &table, b"IEND", &[]);
    let length = out.len();
    OUTPUT.with(|cell| *cell.borrow_mut() = out);
    length
}

pub fn output() -> *const u8 {
    OUTPUT.with(|cell| cell.borrow().as_ptr())
}

pub fn release() {
    OUTPUT.with(|cell| {
            let mut out = cell.borrow_mut();
            out.clear();
            out.shrink_to_fit();
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn adler_matches_the_zlib_reference_value() {
        assert_eq!(adler(b"Wikipedia"), 0x11e6_0398);
    }

    #[test]
    fn crc_matches_the_png_reference_value() {
        assert_eq!(crc(&crc_table(), b"IEND"), 0xae42_6082);
    }

    #[test]
    fn mask_png_opens_with_signature_and_palette_header() {
        let pixels = [0u8, 120, 191, 255, 0, 0, 0, 0].repeat(4);
        let length = encode(&pixels, 4, 2, MASK);
        let bytes = OUTPUT.with(|cell| cell.borrow().clone());
        assert_eq!(bytes.len(), length);
        assert_eq!(&bytes[..8], &SIGNATURE);
        assert_eq!(&bytes[12..16], b"IHDR");
        assert_eq!(bytes[24], 1);
        assert_eq!(bytes[25], 3);
    }
}
