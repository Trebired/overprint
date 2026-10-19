pub fn lightness(pixel: &[u8]) -> f32 {
    let luma = 0.299 * pixel[0] as f32 + 0.587 * pixel[1] as f32 + 0.114 * pixel[2] as f32;
    255.0 - (255.0 - luma) * pixel[3] as f32 / 255.0
}

use std::cell::Cell;

thread_local! {
    static TINT: Cell<[u8; 3]> = const { Cell::new([0, 0, 0]) };
}

pub fn set_tint(red: u8, green: u8, blue: u8) {
    TINT.with(|tint| tint.set([red, green, blue]));
}

fn paint(pixel: &mut [u8]) {
    let [red, green, blue] = TINT.with(Cell::get);
    pixel[0] = red;
    pixel[1] = green;
    pixel[2] = blue;
}

pub fn ink(pixel: &mut [u8], amount: f32) {
    paint(pixel);
    pixel[3] = (amount + 0.5) as u8;
}

pub fn mark(pixel: &mut [u8], inked: bool) {
    paint(pixel);
    pixel[3] = if inked { 255 } else { 0 };
}

pub fn coverage(pixels: &mut [u8]) {
    for pixel in pixels.chunks_exact_mut(4) {
        let amount = 255.0 - lightness(pixel);
        ink(pixel, amount);
    }
}
