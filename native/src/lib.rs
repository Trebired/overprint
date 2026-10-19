mod channel;
mod dither;
mod tone;

use std::cell::RefCell;

thread_local! {
    static PIXELS: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };
}

pub(crate) fn with_pixels<T>(len: usize, work: impl FnOnce(&mut [u8]) -> T) -> T {
    PIXELS.with(|cell| {
            let mut pixels = cell.borrow_mut();
            let end = len.min(pixels.len());
            work(&mut pixels[..end])
    })
}

#[no_mangle]
pub extern "C" fn reserve(len: usize) -> *mut u8 {
    PIXELS.with(|cell| {
            let mut pixels = cell.borrow_mut();
            if pixels.len() < len {
                pixels.resize(len, 0);
            }
            pixels.as_mut_ptr()
    })
}

#[no_mangle]
pub extern "C" fn release() {
    PIXELS.with(|cell| {
            let mut pixels = cell.borrow_mut();
            pixels.clear();
            pixels.shrink_to_fit();
    });
    dither::release();
}

#[no_mangle]
pub extern "C" fn tint(red: u8, green: u8, blue: u8) {
    tone::set_tint(red, green, blue);
}

#[no_mangle]
pub extern "C" fn coverage(width: usize, height: usize) {
    with_pixels(width * height * 4, tone::coverage);
}

#[no_mangle]
pub extern "C" fn dither(width: usize, height: usize, mode: u32, threshold: f32) {
    with_pixels(width * height * 4, |pixels| {
            dither::run(pixels, width, height, mode, threshold)
    });
}

#[no_mangle]
pub extern "C" fn separate(width: usize, height: usize, channel: u32) {
    with_pixels(width * height * 4, |pixels| {
            channel::separate(pixels, channel)
    });
}
