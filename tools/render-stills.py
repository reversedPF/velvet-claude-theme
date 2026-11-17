"""Render each Velvet scene, held still, to a JPEG for the still backdrop.

The still backdrop is a plain picture the app decodes once, so the blur and grain
filters are paid for here, at build time, and never on the person's GPU.

    python tools/render-stills.py <scenes-dir> stills

<scenes-dir> holds the velvet-<name>.svg files tools/generate-scenes.js writes.
Needs Google Chrome (or Microsoft Edge) and Pillow. Each JPEG must stay under 1 MiB.
"""
import os
import shutil
import subprocess
import sys
import tempfile

from PIL import Image

W, H = 2560, 1440
LIMIT = 1024 * 1024
STILL = '<style>*{animation:none!important}</style></svg>'
BROWSERS = [
    os.environ.get('CHROME', ''),
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    shutil.which('google-chrome') or '',
    shutil.which('chromium') or '',
]


def browser():
    for path in BROWSERS:
        if path and os.path.exists(path):
            return path
    sys.exit('No Chrome or Edge found; set CHROME to its path.')


def main(scenes_dir, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    exe = browser()
    names = sorted(f[len('velvet-'):-len('.svg')] for f in os.listdir(scenes_dir)
                   if f.startswith('velvet-') and f.endswith('.svg'))
    if not names:
        sys.exit(f'No velvet-*.svg in {scenes_dir}; run tools/generate-scenes.js first.')
    with tempfile.TemporaryDirectory() as tmp:
        for name in names:
            with open(os.path.join(scenes_dir, f'velvet-{name}.svg'), encoding='utf-8') as f:
                svg = f.read().replace('</svg>', STILL, 1)
            src = os.path.join(tmp, f'{name}.svg')
            png = os.path.join(tmp, f'{name}.png')
            with open(src, 'w', encoding='utf-8') as f:
                f.write(svg)
            subprocess.run([
                exe, '--headless=new', '--hide-scrollbars', '--force-device-scale-factor=1',
                f'--user-data-dir={os.path.join(tmp, "profile")}',
                f'--window-size={W},{H}', f'--screenshot={png}', 'file:///' + src.replace('\\', '/'),
            ], check=True, capture_output=True)
            out = os.path.join(out_dir, f'velvet-{name}.jpg')
            image = Image.open(png).convert('RGB')
            if image.size != (W, H):
                sys.exit(f'{name}: rendered {image.size}, expected {(W, H)}')
            for quality in (88, 84, 80, 76, 72):
                image.save(out, 'JPEG', quality=quality, optimize=True, progressive=True)
                if os.path.getsize(out) < LIMIT:
                    break
            size = os.path.getsize(out)
            print(f'{name}: {size // 1024} KiB at quality {quality}' + ('' if size < LIMIT else ' OVER LIMIT'))


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
