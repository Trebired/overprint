use crate::tone::{lightness, mark};
use std::cell::RefCell;

const THRESHOLD: u32 = 0;
const BAYER: u32 = 1;
const FLOYD_STEINBERG: u32 = 2;
const ATKINSON: u32 = 3;

const FLOYD_TAPS: [(isize, isize, i32); 4] = [(1, 0, 7), (-1, 1, 3), (0, 1, 5), (1, 1, 1)];
const ATKINSON_TAPS: [(isize, isize, i32); 6] = [
    (1, 0, 2),
    (2, 0, 2),
    (-1, 1, 2),
    (0, 1, 2),
    (1, 1, 2),
    (0, 2, 2),
];
const PAD: usize = 2;

thread_local! {
    static WORK: RefCell<Vec<i32>> = const { RefCell::new(Vec::new()) };
}

pub fn release() {
    WORK.with(|cell| {
            let mut work = cell.borrow_mut();
            work.clear();
            work.shrink_to_fit();
    });
}

pub fn bayer(x: usize, y: usize) -> u32 {
    let (column, row) = (x as u32 & 7, y as u32 & 7);
    let mixed = column ^ row;
    let mut value = 0;
    for bit in 0..3 {
        value = (value << 2) | (((mixed >> bit) & 1) << 1) | ((row >> bit) & 1);
    }
    value
}

fn ordered(pixels: &mut [u8], width: usize, threshold: f32) {
    let shift = threshold - 128.0;
    for (index, pixel) in pixels.chunks_exact_mut(4).enumerate() {
        let level = (bayer(index % width, index / width) as f32 + 0.5) * 4.0 + shift;
        let inked = lightness(pixel) < level;
        mark(pixel, inked);
    }
}

fn flat(pixels: &mut [u8], threshold: f32) {
    for pixel in pixels.chunks_exact_mut(4) {
        let inked = lightness(pixel) < threshold;
        mark(pixel, inked);
    }
}

fn diffuse<const N: usize>(
    pixels: &mut [u8],
    width: usize,
    height: usize,
    threshold: f32,
    taps: &[(isize, isize, i32); N],
) {
    let stride = width + PAD * 2;
    let level = threshold as i32;
    WORK.with(|cell| {
            let mut work = cell.borrow_mut();
            work.clear();
            work.resize(stride * (height + PAD), 0);
            for (y, row) in pixels.chunks_exact(width * 4).enumerate() {
                let start = y * stride + PAD;
                for (cell, pixel) in work[start..start + width]
                .iter_mut()
                .zip(row.chunks_exact(4))
                {
                    *cell = lightness(pixel) as i32;
                }
            }
            let offsets = taps.map(|(dx, dy, weight)| (dy * stride as isize + dx, weight));
            for y in 0..height {
                let row = y * stride + PAD;
                for x in 0..width {
                    let at = row + x;
                    let old = work[at];
                    let new = if old < level { 0 } else { 255 };
                    let error = old - new;
                    for &(offset, weight) in &offsets {
                        work[(at as isize + offset) as usize] += (error * weight) >> 4;
                    }
                    let index = (y * width + x) * 4;
                    mark(&mut pixels[index..index + 4], new == 0);
                }
            }
    });
}

pub fn run(pixels: &mut [u8], width: usize, height: usize, mode: u32, threshold: f32) {
    match mode {
        THRESHOLD => flat(pixels, threshold),
        BAYER => ordered(pixels, width, threshold),
        FLOYD_STEINBERG => diffuse(pixels, width, height, threshold, &FLOYD_TAPS),
        ATKINSON => diffuse(pixels, width, height, threshold, &ATKINSON_TAPS),
        _ => flat(pixels, threshold),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bayer_covers_every_level_once() {
        let mut seen = [false; 64];
        for y in 0..8 {
            for x in 0..8 {
                seen[bayer(x, y) as usize] = true;
            }
        }
        assert!(seen.iter().all(|value| *value));
    }

    #[test]
    fn mid_grey_dithers_to_half_coverage() {
        let (width, height) = (64, 64);
        for mode in [BAYER, FLOYD_STEINBERG, ATKINSON] {
            let mut pixels = [128u8, 128, 128, 255].repeat(width * height);
            run(&mut pixels, width, height, mode, 128.0);
            let inked = pixels
            .chunks_exact(4)
            .filter(|pixel| pixel[3] == 255)
            .count() as f32;
            let share = inked / (width * height) as f32;
            assert!((share - 0.5).abs() < 0.08, "mode {mode} covered {share}");
        }
    }
}
