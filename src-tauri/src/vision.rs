use candle_core::{DType, Device, Result as TensorResult, Tensor};
use candle_nn::{
    conv2d, layer_norm, linear, Conv2d, Conv2dConfig, LayerNorm, Linear, Module, VarBuilder,
};
use image::{ImageReader, Limits, RgbImage};
use std::{path::Path, sync::Mutex};
use tauri::Manager;

#[tauri::command]
#[specta::specta]
pub async fn recognize_chess_image(app: tauri::AppHandle, path: String) -> Result<String, String> {
    let model = app
        .path()
        .resolve(
            "vision/chessq-lite-v4.safetensors",
            tauri::path::BaseDirectory::Resource,
        )
        .map_err(|e| e.to_string())?;
    tokio::task::spawn_blocking(move || recognize(&path, &model))
        .await
        .map_err(|e| format!("Image recognition task failed: {e}"))?
}

const SIZE: usize = 644;
const SYMBOLS: &[u8; 13] = b".PNBRQKpnbrqk";
static MODEL: Mutex<Option<ChessQLite>> = Mutex::new(None);

pub fn recognize(path: &str, weights: &Path) -> Result<String, String> {
    let mut guard = MODEL
        .lock()
        .map_err(|_| "Image recognizer is unavailable".to_string())?;
    let input = preprocess(path)?;
    if guard.is_none() {
        *guard = Some(
            ChessQLite::load(weights)
                .map_err(|e| format!("Could not load bundled ChessQ Lite V4 weights: {e}"))?,
        );
    }
    let model = guard.as_ref().ok_or("Image recognizer is unavailable")?;
    let logits = model
        .forward(input)
        .map_err(|e| format!("Image recognition failed: {e}"))?;
    placement(&logits)
}

fn preprocess(path: &str) -> Result<Vec<f32>, String> {
    let mut reader = ImageReader::open(path)
        .map_err(|e| format!("Could not open image: {e}"))?
        .with_guessed_format()
        .map_err(|e| format!("Could not read image: {e}"))?;
    let mut limits = Limits::default();
    limits.max_image_width = Some(16384);
    limits.max_image_height = Some(16384);
    limits.max_alloc = Some(128 * 1024 * 1024);
    reader.limits(limits);
    let image = reader
        .decode()
        .map_err(|e| format!("Could not decode image: {e}"))?
        .to_rgb8();
    resize_normalize(&image)
}

fn weights(source: usize) -> Vec<Vec<(usize, f32)>> {
    let scale = source as f32 / SIZE as f32;
    let support = scale.max(1.0);
    (0..SIZE)
        .map(|i| {
            let center = (i as f32 + 0.5) * scale;
            let start = ((center - support + 0.5) as isize).max(0) as usize;
            let end = ((center + support + 0.5) as usize).min(source);
            let mut taps: Vec<_> = (start..end)
                .map(|j| {
                    (
                        j,
                        (1.0 - ((j as f32 + 0.5 - center) / support).abs()).max(0.0),
                    )
                })
                .collect();
            let sum: f32 = taps.iter().map(|(_, w)| w).sum();
            for (_, weight) in &mut taps {
                *weight /= sum;
            }
            taps
        })
        .collect()
}

fn resize_normalize(image: &RgbImage) -> Result<Vec<f32>, String> {
    let (width, height) = (image.width() as usize, image.height() as usize);
    if width == 0 || height == 0 {
        return Err("Image is empty".to_string());
    }
    let horizontal = weights(width);
    let vertical = weights(height);
    let mut row_buffer = vec![0.0f32; height * SIZE * 3];
    for y in 0..height {
        for (x, taps) in horizontal.iter().enumerate() {
            for &(sx, weight) in taps {
                let pixel = image.get_pixel(sx as u32, y as u32);
                for c in 0..3 {
                    row_buffer[(y * SIZE + x) * 3 + c] += pixel[c] as f32 / 255.0 * weight;
                }
            }
        }
    }
    let mean = [0.485, 0.456, 0.406];
    let std = [0.229, 0.224, 0.225];
    let mut input = vec![0.0; 3 * SIZE * SIZE];
    for (y, taps) in vertical.iter().enumerate() {
        for x in 0..SIZE {
            for c in 0..3 {
                let value: f32 = taps
                    .iter()
                    .map(|&(sy, weight)| row_buffer[(sy * SIZE + x) * 3 + c] * weight)
                    .sum();
                input[c * SIZE * SIZE + y * SIZE + x] = (value - mean[c]) / std[c];
            }
        }
    }
    Ok(input)
}

fn placement(logits: &[f32]) -> Result<String, String> {
    if logits.len() != 64 * 13 || logits.iter().any(|x| !x.is_finite()) {
        return Err("Invalid ChessQ model output".to_string());
    }
    let mut fen = String::new();
    for (rank, squares) in logits.chunks_exact(8 * 13).enumerate() {
        if rank > 0 {
            fen.push('/');
        }
        let mut empty = 0u8;
        for square in squares.chunks_exact(13) {
            // Strict comparison preserves the first index on ties.
            let class = (1..13).fold(0, |best, i| if square[i] > square[best] { i } else { best });
            if class == 0 {
                empty += 1;
            } else {
                if empty > 0 {
                    fen.push((b'0' + empty) as char);
                    empty = 0;
                }
                fen.push(SYMBOLS[class] as char);
            }
        }
        if empty > 0 {
            fen.push((b'0' + empty) as char);
        }
    }
    Ok(fen)
}

const DIM: usize = 384;
const GRID: usize = 46;

struct Attention {
    qkv: Linear,
    output: Linear,
    heads: usize,
}

impl Attention {
    fn encoder(vb: VarBuilder) -> TensorResult<Self> {
        Ok(Self {
            qkv: linear(DIM, 3 * DIM, vb.pp("qkv"))?,
            output: linear(DIM, DIM, vb.pp("proj"))?,
            heads: 6,
        })
    }

    fn decoder(vb: VarBuilder) -> TensorResult<Self> {
        Ok(Self {
            qkv: Linear::new(
                vb.get((3 * DIM, DIM), "in_proj_weight")?,
                Some(vb.get(3 * DIM, "in_proj_bias")?),
            ),
            output: linear(DIM, DIM, vb.pp("out_proj"))?,
            heads: 8,
        })
    }

    fn forward(&self, query: &Tensor, memory: Option<&Tensor>) -> TensorResult<Tensor> {
        let qkv = self.qkv.forward(query)?;
        let projected_memory = memory.map(|m| self.qkv.forward(m)).transpose()?;
        let kv = projected_memory.as_ref().unwrap_or(&qkv);
        let q_len = query.dim(0)?;
        let k_len = kv.dim(0)?;
        let width = DIM / self.heads;
        let q = qkv
            .narrow(1, 0, DIM)?
            .reshape((q_len, self.heads, width))?
            .transpose(0, 1)?
            .contiguous()?;
        let k = kv
            .narrow(1, DIM, DIM)?
            .reshape((k_len, self.heads, width))?
            .permute((1, 2, 0))?
            .contiguous()?;
        let v = kv
            .narrow(1, 2 * DIM, DIM)?
            .reshape((k_len, self.heads, width))?
            .transpose(0, 1)?
            .contiguous()?;
        let scores = (q.matmul(&k)? / (width as f64).sqrt())?;
        let values = candle_nn::ops::softmax_last_dim(&scores)?.matmul(&v)?;
        self.output.forward(
            &values
                .transpose(0, 1)?
                .reshape((q_len, DIM))?
                .contiguous()?,
        )
    }
}

struct EncoderLayer {
    norm1: LayerNorm,
    norm2: LayerNorm,
    attention: Attention,
    fc1: Linear,
    fc2: Linear,
    scale1: Tensor,
    scale2: Tensor,
}

impl EncoderLayer {
    fn load(vb: VarBuilder) -> TensorResult<Self> {
        Ok(Self {
            norm1: layer_norm(DIM, 1e-6, vb.pp("norm1"))?,
            norm2: layer_norm(DIM, 1e-6, vb.pp("norm2"))?,
            attention: Attention::encoder(vb.pp("attn"))?,
            fc1: linear(DIM, 4 * DIM, vb.pp("mlp.fc1"))?,
            fc2: linear(4 * DIM, DIM, vb.pp("mlp.fc2"))?,
            scale1: vb.get(DIM, "ls1.gamma")?,
            scale2: vb.get(DIM, "ls2.gamma")?,
        })
    }
    fn forward(&self, x: &Tensor) -> TensorResult<Tensor> {
        let attention = self
            .attention
            .forward(&self.norm1.forward(x)?, None)?
            .broadcast_mul(&self.scale1)?;
        let x = (x + attention)?;
        let mlp = self
            .fc2
            .forward(&self.fc1.forward(&self.norm2.forward(&x)?)?.gelu_erf()?)?
            .broadcast_mul(&self.scale2)?;
        x + mlp
    }
}

struct DecoderLayer {
    norm1: LayerNorm,
    norm2: LayerNorm,
    norm3: LayerNorm,
    self_attention: Attention,
    cross_attention: Attention,
    fc1: Linear,
    fc2: Linear,
}

impl DecoderLayer {
    fn load(vb: VarBuilder) -> TensorResult<Self> {
        Ok(Self {
            norm1: layer_norm(DIM, 1e-5, vb.pp("norm1"))?,
            norm2: layer_norm(DIM, 1e-5, vb.pp("norm2"))?,
            norm3: layer_norm(DIM, 1e-5, vb.pp("norm3"))?,
            self_attention: Attention::decoder(vb.pp("self_attn"))?,
            cross_attention: Attention::decoder(vb.pp("multihead_attn"))?,
            fc1: linear(DIM, 4 * DIM, vb.pp("linear1"))?,
            fc2: linear(4 * DIM, DIM, vb.pp("linear2"))?,
        })
    }
    fn forward(&self, x: &Tensor, memory: &Tensor) -> TensorResult<Tensor> {
        let x = self
            .norm1
            .forward(&(x + self.self_attention.forward(x, None)?)?)?;
        let x = self
            .norm2
            .forward(&(&x + self.cross_attention.forward(&x, Some(memory))?)?)?;
        let mlp = self.fc2.forward(&self.fc1.forward(&x)?.relu()?)?;
        self.norm3.forward(&(x + mlp)?)
    }
}

pub struct ChessQLite {
    patch: Conv2d,
    cls: Tensor,
    position: Tensor,
    queries: Tensor,
    encoder: Vec<EncoderLayer>,
    encoder_norm: LayerNorm,
    decoder: Vec<DecoderLayer>,
    norm: LayerNorm,
    head: Linear,
}

impl ChessQLite {
    pub fn load(path: &Path) -> TensorResult<Self> {
        let device = Device::Cpu;
        let vb = VarBuilder::from_buffered_safetensors(std::fs::read(path)?, DType::F32, &device)?;
        let mut queries = vb.get((64, DIM), "queries.square_id.weight")?;
        for (name, count) in [("file", 8), ("rank", 8), ("color", 2)] {
            let indices = vb
                .get(64, &format!("queries.{name}_idx"))?
                .to_dtype(DType::U32)?;
            let embedding = vb.get((count, DIM), &format!("queries.{name}_emb.weight"))?;
            queries = (queries + embedding.index_select(&indices, 0)?)?;
        }
        Ok(Self {
            patch: conv2d(
                3,
                DIM,
                14,
                Conv2dConfig {
                    stride: 14,
                    ..Default::default()
                },
                vb.pp("encoder.patch_embed.proj"),
            )?,
            cls: vb.get((1, 1, DIM), "encoder.cls_token")?.squeeze(0)?,
            position: position_embedding(&vb.get((1, 1370, DIM), "encoder.pos_embed")?)?,
            queries,
            encoder: (0..12)
                .map(|i| EncoderLayer::load(vb.pp(format!("encoder.blocks.{i}"))))
                .collect::<TensorResult<_>>()?,
            encoder_norm: layer_norm(DIM, 1e-6, vb.pp("encoder.norm"))?,
            decoder: (0..4)
                .map(|i| DecoderLayer::load(vb.pp(format!("decoder.layers.{i}"))))
                .collect::<TensorResult<_>>()?,
            norm: layer_norm(DIM, 1e-5, vb.pp("norm"))?,
            head: linear(DIM, 13, vb.pp("head"))?,
        })
    }

    pub fn forward(&self, input: Vec<f32>) -> TensorResult<Vec<f32>> {
        let input = Tensor::from_vec(input, (1, 3, 644, 644), &Device::Cpu)?;
        let patch = self
            .patch
            .forward(&input)?
            .flatten_from(2)?
            .transpose(1, 2)?
            .squeeze(0)?;
        let mut memory = (Tensor::cat(&[&self.cls, &patch], 0)? + &self.position)?;
        for layer in &self.encoder {
            memory = layer.forward(&memory)?;
        }
        memory = self.encoder_norm.forward(&memory)?;
        let mut queries = self.queries.clone();
        for layer in &self.decoder {
            queries = layer.forward(&queries, &memory)?;
        }
        self.head
            .forward(&self.norm.forward(&queries)?)?
            .flatten_all()?
            .to_vec1()
    }
}

fn cubic(x: f32) -> f32 {
    let x = x.abs();
    if x < 1.0 {
        ((1.5 * x - 2.5) * x) * x + 1.0
    } else if x < 2.0 {
        ((-0.5 * x + 2.5) * x - 4.0) * x + 2.0
    } else {
        0.0
    }
}

fn position_embedding(position: &Tensor) -> TensorResult<Tensor> {
    const SOURCE: usize = 37;
    let position = position.squeeze(0)?;
    let cls = position.narrow(0, 0, 1)?;
    let source = position.narrow(0, 1, SOURCE * SOURCE)?.to_vec2::<f32>()?;
    let taps: Vec<Vec<(usize, f32)>> = (0..GRID)
        .map(|i| {
            let center = (i as f32 + 0.5) * SOURCE as f32 / GRID as f32;
            let start = ((center - 2.0 + 0.5) as isize).max(0) as usize;
            let end = ((center + 2.0 + 0.5) as usize).min(SOURCE);
            let mut taps: Vec<_> = (start..end)
                .map(|j| (j, cubic(j as f32 + 0.5 - center)))
                .collect();
            let sum: f32 = taps.iter().map(|(_, weight)| weight).sum();
            for (_, weight) in &mut taps {
                *weight /= sum;
            }
            taps
        })
        .collect();
    let mut horizontal = vec![0.0f32; SOURCE * GRID * DIM];
    for y in 0..SOURCE {
        for (x, taps) in taps.iter().enumerate() {
            for &(sx, weight) in taps {
                for c in 0..DIM {
                    horizontal[(y * GRID + x) * DIM + c] += source[y * SOURCE + sx][c] * weight;
                }
            }
        }
    }
    let mut output = vec![0.0f32; GRID * GRID * DIM];
    for (y, taps) in taps.iter().enumerate() {
        for x in 0..GRID {
            for &(sy, weight) in taps {
                for c in 0..DIM {
                    output[(y * GRID + x) * DIM + c] +=
                        horizontal[(sy * GRID + x) * DIM + c] * weight;
                }
            }
        }
    }
    Tensor::cat(
        &[
            cls,
            Tensor::from_vec(output, (GRID * GRID, DIM), &Device::Cpu)?,
        ],
        0,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fen_order_symbols_runs_and_ties() {
        let expected = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";
        let mut logits = vec![0.0; 64 * 13];
        let mut square = 0;
        for symbol in expected.bytes() {
            if symbol == b'/' {
                continue;
            }
            if symbol.is_ascii_digit() {
                square += (symbol - b'0') as usize;
            } else {
                let class = SYMBOLS.iter().position(|&x| x == symbol).unwrap();
                logits[square * 13 + class] = 1.0;
                square += 1;
            }
        }
        assert_eq!(placement(&logits).unwrap(), expected);
        assert!(placement(&[f32::NAN; 64 * 13]).is_err());
        assert!(placement(&[]).is_err());
    }

    #[test]
    fn rgb_normalization_and_antialiasing() {
        let image = RgbImage::from_pixel(2, 3, image::Rgb([255, 0, 128]));
        let input = resize_normalize(&image).unwrap();
        for (c, expected) in [
            (1.0 - 0.485) / 0.229,
            -0.456 / 0.224,
            (128.0 / 255.0 - 0.406) / 0.225,
        ]
        .iter()
        .enumerate()
        {
            assert!(input[c * SIZE * SIZE..(c + 1) * SIZE * SIZE]
                .iter()
                .all(|x| (x - expected).abs() < 1e-5));
        }
        for source in [1, 9, 644, 1920] {
            assert!(weights(source)
                .iter()
                .all(|taps| (taps.iter().map(|(_, w)| w).sum::<f32>() - 1.0).abs() < 1e-5));
        }
    }
    #[test]
    fn preprocessing_matches_torchvision_reference() {
        let image = RgbImage::from_fn(1000, 800, |x, y| {
            image::Rgb([
                ((x * 7 + y * 3) % 256) as u8,
                ((x * 11 + y * 13) % 256) as u8,
                ((x * 17 + y * 19) % 256) as u8,
            ])
        });
        let input = resize_normalize(&image).unwrap();
        // torchvision 0.23, Resize(644, antialias=True), ImageNet normalization.
        for (c, y, x, expected) in [
            (0, 0, 0, -2.0581224),
            (0, 17, 29, 0.01918671),
            (0, 643, 643, 0.8020245),
            (1, 0, 0, -1.904169),
            (1, 177, 392, -0.51751983),
            (1, 643, 643, 0.073643535),
            (2, 0, 0, -1.6067047),
            (2, 398, 51, 1.4426742),
            (2, 643, 643, 0.85621375),
        ] {
            let actual = input[c * SIZE * SIZE + y * SIZE + x];
            assert!(
                (actual - expected).abs() < 1e-5,
                "{c},{y},{x}: {actual} != {expected}"
            );
        }
    }
}
