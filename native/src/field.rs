const FLAT: u32 = 0;
const LINEAR: u32 = 1;
const RADIAL: u32 = 2;

pub struct Field {
    pub kind: u32,
    pub shape: [f32; 4],
    pub range: [f32; 2],
}

impl Field {
    fn along(&self, u: f32, v: f32) -> f32 {
        let [a, b, c, d] = self.shape;
        match self.kind {
            LINEAR => {
                let (dx, dy) = (c - a, d - b);
                let length = (dx * dx + dy * dy).max(f32::EPSILON);
                ((u - a) * dx + (v - b) * dy) / length
            }
            RADIAL => ((u - a).powi(2) + (v - b).powi(2)).sqrt() / c.max(f32::EPSILON),
            _ => 0.0,
        }
    }

    pub fn darkness(&self, u: f32, v: f32) -> f32 {
        if self.kind == FLAT {
            return self.shape[0].clamp(0.0, 1.0);
        }
        let t = self.along(u, v).clamp(0.0, 1.0);
        (self.range[0] + (self.range[1] - self.range[0]) * t).clamp(0.0, 1.0)
    }
}

pub fn fill(pixels: &mut [u8], width: usize, height: usize, field: &Field) {
    for (index, pixel) in pixels.chunks_exact_mut(4).enumerate() {
        let u = ((index % width) as f32 + 0.5) / width as f32;
        let v = ((index / width) as f32 + 0.5) / height as f32;
        let light = (255.0 * (1.0 - field.darkness(u, v)) + 0.5) as u8;
        pixel.copy_from_slice(&[light, light, light, 255]);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn linear_field_runs_from_dark_to_light() {
        let field = Field { kind: LINEAR, range: [1.0, 0.0], shape: [0.0, 0.5, 1.0, 0.5] };
        assert!(field.darkness(0.0, 0.5) > 0.99);
        assert!(field.darkness(1.0, 0.5) < 0.01);
        assert!((field.darkness(0.5, 0.2) - 0.5).abs() < 0.01);
    }

    #[test]
    fn radial_field_fades_from_the_centre() {
        let field = Field { kind: RADIAL, range: [1.0, 0.0], shape: [0.5, 0.5, 0.5, 0.0] };
        assert!(field.darkness(0.5, 0.5) > 0.99);
        assert!(field.darkness(1.0, 0.5) < 0.01);
    }
}
