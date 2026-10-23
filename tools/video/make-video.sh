#!/usr/bin/env bash
# Build the intro video: docs/media/intro.mp4, intro.jpg (poster) and intro.vtt (captions).
#   1. tests/chromium.sh tools/video/shots.mjs     (screenshots of the add-on, once)
#   2. tests/chromium.sh tools/video/narrate.mjs   (narration by the add-on's own voices)
#   3. tools/video/make-video.sh                   (slides, timing, captions, encode)
set -e
here=$(cd "$(dirname "$0")" && pwd)
out=$here/out; media=$here/../../docs/media
snap=$HOME/snap/chromium/common/video-slides   # the Chromium snap can't write to /tmp
mkdir -p "$out" "$media" "$snap"
for n in $(seq 1 10); do
  chromium --headless=new --user-data-dir="$snap/profile" --hide-scrollbars --window-size=1280,720 \
    --virtual-time-budget=4000 --screenshot="$snap/slide.png" "file://$here/slides.html?n=$n" >/dev/null 2>&1
  mv "$snap/slide.png" "$out/slide-$(printf %02d "$n").png"
done
python3 "$here/build.py"
cd "$out"
ffmpeg -y -loglevel error -f concat -safe 0 -i slides.txt -i narration.wav \
  -vf "fps=30,format=yuv420p" -c:v libx264 -preset slow -crf 22 -tune stillimage \
  -c:a aac -b:a 96k -shortest -movflags +faststart "$media/intro.mp4"
cp slide-01.png "$media/intro.png"
ffmpeg -y -loglevel error -i slide-01.png -q:v 4 "$media/intro.jpg" && rm "$media/intro.png"
ls -la "$media"
