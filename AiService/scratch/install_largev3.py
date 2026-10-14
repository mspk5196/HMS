import os
# Force the environment to use the ultra-fast Rust downloader
os.environ["HF_HUB_ENABLE_HF_TRANSFER"] = "1"

from faster_whisper.utils import download_model

print("Starting high-speed download...")
download_model("large-v3")
print("Done!")
