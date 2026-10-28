use crate::tone::lightness;

const EDGE_BLUR: f32 = 1.6;
const SKY_BLUR: f32 = 3.5;
const SKY_GRADIENT: f32 = 0.035;
const SKY_CORE: usize = 3;
const TONE_BLUR: f32 = 4.5;
const LEAF_BLUR: f32 = 3.0;
const LOW_RATIO: f32 = 0.45;

struct Grid {
    width: usize,
    height: usize,
}

impl Grid {
    fn len(&self) -> usize {
        self.width * self.height
    }

    fn at(&self, x: isize, y: isize) -> usize {
        let x = x.clamp(0, self.width as isize - 1) as usize;
        let y = y.clamp(0, self.height as isize - 1) as usize;
        y * self.width + x
    }
}

fn kernel(sigma: f32) -> Vec<f32> {
    let reach = (sigma * 3.0).ceil() as isize;
    let mut weights: Vec<f32> = (-reach..=reach).map(|i| (-((i * i) as f32) / (2.0 * sigma * sigma)).exp()).collect();
    let sum: f32 = weights.iter().sum();
    weights.iter_mut().for_each(|weight| *weight /= sum);
    weights
}

fn blur(grid: &Grid, source: &[f32], sigma: f32) -> Vec<f32> {
    let weights = kernel(sigma);
    let reach = (weights.len() / 2) as isize;
    let mut across = vec![0.0; grid.len()];
    let mut out = vec![0.0; grid.len()];
    for y in 0..grid.height as isize {
        for x in 0..grid.width as isize {
            let sum = (-reach..=reach).map(|i| source[grid.at(x + i, y)] * weights[(i + reach) as usize]).sum();
            across[grid.at(x, y)] = sum;
        }
    }
    for y in 0..grid.height as isize {
        for x in 0..grid.width as isize {
            let sum = (-reach..=reach).map(|i| across[grid.at(x, y + i)] * weights[(i + reach) as usize]).sum();
            out[grid.at(x, y)] = sum;
        }
    }
    out
}

fn gradient(grid: &Grid, image: &[f32]) -> (Vec<f32>, Vec<f32>) {
    let mut magnitude = vec![0.0; grid.len()];
    let mut direction = vec![0.0; grid.len()];
    for y in 1..grid.height as isize - 1 {
        for x in 1..grid.width as isize - 1 {
            let p = |dx: isize, dy: isize| image[grid.at(x + dx, y + dy)];
            let gx = -p(-1, -1) - 2.0 * p(-1, 0) - p(-1, 1) + p(1, -1) + 2.0 * p(1, 0) + p(1, 1);
            let gy = -p(-1, -1) - 2.0 * p(0, -1) - p(1, -1) + p(-1, 1) + 2.0 * p(0, 1) + p(1, 1);
            magnitude[grid.at(x, y)] = (gx * gx + gy * gy).sqrt();
            direction[grid.at(x, y)] = gy.atan2(gx);
        }
    }
    (magnitude, direction)
}

fn flood_sky(grid: &Grid, steep: &[f32]) -> Vec<bool> {
    let mut sky = vec![false; grid.len()];
    let mut stack: Vec<usize> = (0..grid.width).filter(|&x| steep[grid.width + x] < SKY_GRADIENT).collect();
    stack.iter().for_each(|&x| sky[x] = true);
    while let Some(index) = stack.pop() {
        let (x, y) = ((index % grid.width) as isize, (index / grid.width) as isize);
        for (dx, dy) in [(1, 0), (-1, 0), (0, 1), (0, -1)] {
            let (nx, ny) = (x + dx, y + dy);
            if nx < 0 || ny < 0 || nx >= grid.width as isize || ny >= grid.height as isize {
                continue;
            }
            let next = grid.at(nx, ny);
            if !sky[next] && steep[next] < SKY_GRADIENT {
                sky[next] = true;
                stack.push(next);
            }
        }
    }
    sky
}

fn sky_core(grid: &Grid, sky: &[bool]) -> Vec<bool> {
    let reach = SKY_CORE as isize;
    let mut core = vec![false; grid.len()];
    for y in 0..grid.height as isize {
        for x in 0..grid.width as isize {
            core[grid.at(x, y)] = (-reach..=reach).all(|d| sky[grid.at(x, y + d)] && sky[grid.at(x + d, y)]);
        }
    }
    core
}

fn thin(grid: &Grid, magnitude: &[f32], direction: &[f32]) -> Vec<f32> {
    let mut out = vec![0.0; grid.len()];
    let w = grid.width as isize;
    for y in 1..grid.height as isize - 1 {
        for x in 1..w - 1 {
            let index = grid.at(x, y);
            let angle = (direction[index].to_degrees() + 180.0) % 180.0;
            let step = match angle {
                a if !(22.5..157.5).contains(&a) => 1,
                a if a < 67.5 => w + 1,
                a if a < 112.5 => w,
                _ => w - 1,
            };
            let (before, after) = (magnitude[(index as isize - step) as usize], magnitude[(index as isize + step) as usize]);
            if magnitude[index] >= before && magnitude[index] >= after {
                out[index] = magnitude[index];
            }
        }
    }
    out
}

fn quantile(mut values: Vec<f32>, share: f32) -> f32 {
    if values.is_empty() {
        return 0.0;
    }
    let rank = ((values.len() - 1) as f32 * share.clamp(0.0, 1.0)) as usize;
    let (_, value, _) = values.select_nth_unstable_by(rank, |a, b| a.total_cmp(b));
    *value
}

fn hysteresis(grid: &Grid, ridge: &[f32], core: &[bool], share: f32) -> Vec<bool> {
    let candidates: Vec<f32> = ridge.iter().zip(core).filter(|(v, c)| **v > 0.0 && !**c).map(|(v, _)| *v).collect();
    let high = quantile(candidates, share);
    let low = high * LOW_RATIO;
    let mut edge = vec![false; grid.len()];
    let mut stack: Vec<usize> = (0..grid.len()).filter(|&i| high > 0.0 && ridge[i] >= high && !core[i]).collect();
    stack.iter().for_each(|&i| edge[i] = true);
    let w = grid.width as isize;
    while let Some(index) = stack.pop() {
        for step in [-w - 1, -w, -w + 1, -1, 1, w - 1, w, w + 1] {
            let next = index as isize + step;
            if next < 0 || next >= grid.len() as isize {
                continue;
            }
            let next = next as usize;
            if !edge[next] && ridge[next] >= low && !core[next] {
                edge[next] = true;
                stack.push(next);
            }
        }
    }
    edge
}

fn tone(grid: &Grid, luminance: &[f32], sky: &[bool]) -> Vec<u8> {
    let soft = blur(grid, luminance, TONE_BLUR);
    let ground: Vec<f32> = soft.iter().zip(sky).filter(|(_, s)| !**s).map(|(v, _)| *v).collect();
    let (light, dark) = (quantile(ground.clone(), 0.03), quantile(ground, 0.97));
    let span = (dark - light).max(1e-3);
    soft.iter().zip(sky).map(|(v, s)| if *s { 0 } else { ((1.0 - ((v - light) / span).clamp(0.0, 1.0)) * 255.0) as u8 }).collect()
}

fn leaves(grid: &Grid, pixels: &[u8], luminance: &[f32]) -> Vec<f32> {
    let green: Vec<f32> = (0..grid.len())
    .map(|i| {
            let (r, g, b) = (pixels[i * 4] as i32, pixels[i * 4 + 1] as i32, pixels[i * 4 + 2] as i32);
            if g - r.max(b) > 6 && luminance[i] < 0.62 { 1.0 } else { 0.0 }
    })
    .collect();
    blur(grid, &green, LEAF_BLUR)
}

pub fn fields(pixels: &mut [u8], width: usize, height: usize, detail: f32, blank_sky: bool) {
    let grid = Grid { width, height };
    let luminance: Vec<f32> = pixels.chunks_exact(4).map(|pixel| lightness(pixel) / 255.0).collect();
    let soft = blur(&grid, &luminance, EDGE_BLUR);
    let (magnitude, direction) = gradient(&grid, &soft);
    let sky = if blank_sky { flood_sky(&grid, &gradient(&grid, &blur(&grid, &luminance, SKY_BLUR)).0) } else { vec![false; grid.len()] };
    let core = sky_core(&grid, &sky);
    let edge = hysteresis(&grid, &thin(&grid, &magnitude, &direction), &core, detail);
    let shade = tone(&grid, &luminance, &sky);
    let leaf = leaves(&grid, pixels, &luminance);
    for index in 0..grid.len() {
        let pixel = &mut pixels[index * 4..index * 4 + 4];
        pixel[0] = if edge[index] { 255 } else { 0 };
        pixel[1] = shade[index];
        pixel[2] = if sky[index] { 255 } else { 0 };
        pixel[3] = if leaf[index] > 0.5 && !sky[index] { 255 } else { 0 };
    }
}
