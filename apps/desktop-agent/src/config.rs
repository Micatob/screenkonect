use anyhow::Result;
use serde::Deserialize;
use std::path::PathBuf;

#[derive(Debug, Clone, Deserialize)]
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
        let mut join_url = None;
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
                "--join-url" => {
                    // One-click mode: paste the full join link from the technician,
                    // e.g. https://support.example.com/join/ABC12345?token=xxx
                    i += 1;
                    join_url = Some(args[i].clone());
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
                    println!("  --url <URL>           Server base URL, e.g. http://192.168.1.10:8090 (or use --join-url)");
                    println!("  --token <TOKEN>       Session join token (or use --join-url)");
                    println!("  --join-url <LINK>     Full join link from technician (sets server + token in one paste)");
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

        // --join-url derives --url (server base) and --token from one pasted link.
        let (url, token) = match join_url {
            Some(link) => parse_join_url(&link)?,
            None => (
                url.ok_or_else(|| anyhow::anyhow!("--url is required (or pass --join-url <link>)"))?,
                token.ok_or_else(|| anyhow::anyhow!("--token is required (or pass --join-url <link>)"))?,
            ),
        };

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

/// Split a full join link into (server base url, token).
/// Accepts https://host[:port]/join/CODE?token=xxx and screenkonect://join?session=CODE&token=xxx
fn parse_join_url(link: &str) -> Result<(String, String)> {
    let token = link
        .split("token=")
        .nth(1)
        .map(|s| s.split('&').next().unwrap_or("").to_string())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| anyhow::anyhow!("join link has no token= parameter"))?;

    // screenkonect://join?session=CODE&token=... has no http base; server must come from --url
    if link.starts_with("screenkonect://") {
        return Err(anyhow::anyhow!(
            "screenkonect:// links carry no server address - also pass --url http(s)://<server>:<port>"
        ));
    }

    // https://host[:port]/join/CODE?... -> base is https://host[:port]
    let base = link
        .split("/join/")
        .next()
        .ok_or_else(|| anyhow::anyhow!("join link has no /join/ path"))?
        .trim_end_matches('/')
        .to_string();
    if !(base.starts_with("http://") || base.starts_with("https://")) {
        return Err(anyhow::anyhow!("could not read server address from join link"));
    }

    Ok((base, token))
}

pub fn load_config() -> Result<Config> {
    Config::from_args()
}
