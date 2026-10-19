use crate::tone::ink;

const RED: u32 = 0;
const GREEN: u32 = 1;
const BLUE: u32 = 2;
const CYAN: u32 = 3;
const MAGENTA: u32 = 4;
const YELLOW: u32 = 5;
const BLACK: u32 = 6;

fn over_white(pixel: &[u8]) -> [f32; 3] {
    let alpha = pixel[3] as f32 / 255.0;
    [0, 1, 2].map(|index| 1.0 - (1.0 - pixel[index] as f32 / 255.0) * alpha)
}

fn process(rgb: [f32; 3], channel: u32) -> f32 {
    let key = 1.0 - rgb[0].max(rgb[1]).max(rgb[2]);
    let part = |value: f32| {
        if key >= 1.0 {
            0.0
        } else {
            (1.0 - value - key) / (1.0 - key)
        }
    };
    match channel {
        CYAN => part(rgb[0]),
        MAGENTA => part(rgb[1]),
        YELLOW => part(rgb[2]),
        BLACK => key,
        _ => 0.0,
    }
}

pub fn separate(pixels: &mut [u8], channel: u32) {
    for pixel in pixels.chunks_exact_mut(4) {
        let rgb = over_white(pixel);
        let amount = match channel {
            RED | GREEN | BLUE => rgb[channel as usize],
            _ => process(rgb, channel),
        };
        ink(pixel, amount * 255.0);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pure_cyan_lands_on_the_cyan_plate_only() {
        for (channel, expected) in [(CYAN, 255), (MAGENTA, 0), (YELLOW, 0), (BLACK, 0)] {
            let mut pixel = [0u8, 255, 255, 255];
            separate(&mut pixel, channel);
            assert_eq!(pixel[3], expected, "channel {channel}");
        }
    }

    #[test]
    fn black_lands_on_the_key_plate() {
        let mut pixel = [0u8, 0, 0, 255];
        separate(&mut pixel, BLACK);
        assert_eq!(pixel[3], 255);
    }
}
