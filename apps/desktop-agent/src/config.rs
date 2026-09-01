use anyhow::Result;
use serde::Deserialize;
use std::path::PathBuf;

#[derive(Debug, Deserialize)]
pub struct Config {
    pub url: String,
    pub token: String,
    pub monitor: usize,
    pub quality: u8,
    pub max_width: u32,
    pub fps: u32,
    pub log_level: String,
}

impl Config {
    pub fn from_args() -> Result<Self> {
        let args: Vec<String> = std::env::args().collect();
        
        let mut url = None;
        let mut token = None;
        let mut monitor = 0;
        let mut quality = 80;
        let mut max_width = 1920;
        let mut fps = 30;
        let mut log_level = "info".to_string();

        let mut i = 1;
        while i < args.len() {
            match args[i].as_str() {
                "--url" => {
                    i += 1;
                    url = Some(args[i].clone());
                }
                "--token" => {
                    i += 1;
                    token = Some(args[i].clone());
                }
                "--monitor" => {
                    i += 1;
                    monitor = args[i].parse()?;
                }
                "--quality" => {
                    i += 1;
                    quality = args[i].parse()?;
                }
                "--max-width" => {
                    i += 1;
                    max_width = args[i].parse()?;
                }
                "--fps" => {
                    i += 1;
                    fps = args[i].parse()?;
                }
                "--log-level" => {
                    i += 1;
                    log_level = args[i].clone();
                }
                "--help" => {
                    println!("ScreenKonect Agent");
                    println!("");
                    println!("Usage: screenkonect-agent [OPTIONS]");
                    println!("");
                    println!("Options:");
                    println!("  --url <URL>           WebSocket signaling server URL (required)");
                    println!("  --token <TOKEN>       Session join token (required)");
                    println!("  --monitor <INDEX>     Monitor index to share (default: 0)");
                    println!("  --quality <LEVEL>     JPEG quality 1-100 (default: 80)");
                    println!("  --max-width <PIXELS>  Maximum capture width (default: 1920)");
                    println!("  --fps <FRAMES>        Target frames per second (default: 30)");
                    println!("  --log-level <LEVEL>   Log level: debug, info, warn, error (default: info)");
                    println!("  --help                Show this help message");
                    std::process::exit(0);
                }
                _ => {
                    eprintln!("Unknown option: {}", args[i]);
                    std::process::exit(1);
                }
            }
            i += 1;
        }

        let url = url.ok_or_else(|| anyhow::anyhow!("--url is required"))?;
        let token = token.ok_or_else(|| anyhow::anyhow!("--token is required"))?;

        Ok(Config {
            url,
            token,
            monitor,
            quality,
            max_width,
            fps,
            log_level,
        })
    }
}

pub fn load_config() -> Result<Config> {
    Config::from_args()
}
