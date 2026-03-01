#!/usr/bin/env python3
"""
Finding Nemo style animated GIFs for Sharkbait project.
Uses real clipart images composited onto rich animated ocean backgrounds.
"""

import math
import random
import sys
sys.path.insert(0, '/tmp/anthropic-skills/skills/slack-gif-creator')

from core.gif_builder import GIFBuilder
from core.frame_composer import create_gradient_background
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUTPUT_DIR = '/home/shyamsridhar/code/sharkbait/sharkbait/public/gifs'
IMAGE_DIR = '/home/shyamsridhar/code/sharkbait/sharkbait/public/images'

# All source sprites face LEFT. Flip=True makes them face RIGHT.
# When swimming left-to-right, use flip=True.
# When swimming right-to-left, use flip=False (default).


def load_sprite(filename, target_width):
    """Load a PNG sprite, resize proportionally, return RGBA Image."""
    img = Image.open(f'{IMAGE_DIR}/{filename}').convert('RGBA')
    aspect = img.height / img.width
    target_height = int(target_width * aspect)
    return img.resize((target_width, target_height), Image.Resampling.LANCZOS)


def paste_sprite(frame, sprite, x, y, flip=False):
    """Paste an RGBA sprite onto an RGB frame at (x, y) center position."""
    s = sprite
    if flip:
        s = s.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    if frame.mode != 'RGBA':
        frame = frame.convert('RGBA')
    px = x - s.width // 2
    py = y - s.height // 2
    temp = Image.new('RGBA', frame.size, (0, 0, 0, 0))
    temp.paste(s, (px, py), s)
    result = Image.alpha_composite(frame, temp)
    return result.convert('RGB')


def get_font(size):
    """Get the best available font."""
    try:
        return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", size)
    except (OSError, IOError):
        return ImageFont.load_default()


# ─── Rich Environment Drawing ────────────────────────────────────────────


def draw_caustics(draw, W, H, frame_idx, intensity=0.4):
    """Draw animated underwater caustic light patterns on the upper portion."""
    for cx in range(0, W, 6):
        for cy in range(0, min(H, int(H * 0.5)), 8):
            noise = math.sin(cx * 0.08 + frame_idx * 0.25) * math.cos(cy * 0.1 + frame_idx * 0.15)
            noise += math.sin((cx + cy) * 0.05 + frame_idx * 0.3) * 0.5
            if noise > 0.6:
                bright = int(noise * 40 * intensity)
                depth_fade = max(0, 1.0 - cy / (H * 0.5))
                bright = int(bright * depth_fade)
                if bright > 3:
                    draw.ellipse([cx - 2, cy - 2, cx + 3, cy + 3],
                                 fill=(bright + 10, bright + 20, bright + 40))


def draw_light_rays(draw, W, H, frame_idx, count=8, reach=0.7):
    """Draw volumetric light rays from the surface."""
    for ray in range(count):
        rx = int((ray * (W // count) + frame_idx * 5) % (W + 60)) - 30
        ray_w = random.Random(ray + 100).randint(20, 40)
        max_y = int(H * reach)
        for ry in range(0, max_y):
            ratio = ry / max_y
            alpha = max(0, int(45 * (1 - ratio * ratio)))
            if alpha <= 0:
                break
            spread = int(ry * 0.08)
            r = min(255, 15 + alpha)
            g = min(255, 25 + int(alpha * 1.2))
            b = min(255, 50 + int(alpha * 1.5))
            draw.line([(rx - spread, ry), (rx + ray_w + spread, ry)],
                      fill=(r, g, b), width=1)


def draw_bubbles(draw, bubbles, frame_idx, h_mod=480):
    """Draw shimmering floating bubbles with proper reflections."""
    for bx, by, br, speed in bubbles:
        y_offset = (frame_idx * speed) % h_mod
        by_anim = (by - y_offset) % h_mod
        wobble = math.sin(frame_idx * 0.3 + bx * 0.1) * 5
        x = int(bx + wobble)
        y = int(by_anim)
        # Outer glow
        draw.ellipse([x - br - 1, y - br - 1, x + br + 1, y + br + 1],
                     fill=None, outline=(100, 160, 220), width=1)
        # Main bubble
        draw.ellipse([x - br, y - br, x + br, y + br],
                     fill=None, outline=(160, 215, 255), width=2)
        # Specular highlight
        hr = max(1, br // 3)
        hx = x - br // 3
        hy = y - br // 3
        draw.ellipse([hx, hy, hx + hr, hy + hr], fill=(220, 240, 255))
        # Secondary highlight
        if br > 5:
            draw.ellipse([x + br // 4, y + br // 4,
                          x + br // 4 + 2, y + br // 4 + 2],
                         fill=(200, 230, 250))


def draw_coral_cluster(draw, base_x, base_y, seed, scale=1.0):
    """Draw a rich coral formation at a given position."""
    rng = random.Random(seed)
    coral_types = [
        # (color, shape_type)
        ((200, 60, 80), 'branch'),
        ((240, 130, 60), 'fan'),
        ((180, 50, 160), 'brain'),
        ((100, 200, 120), 'tube'),
        ((240, 180, 80), 'fan'),
        ((220, 80, 120), 'branch'),
    ]
    num = rng.randint(2, 4)
    for _ in range(num):
        ctype = rng.choice(coral_types)
        color = ctype[0]
        shape = ctype[1]
        ox = rng.randint(-20, 20)
        oy = rng.randint(-5, 5)
        cx = base_x + int(ox * scale)
        cy = base_y + int(oy * scale)
        s = int(rng.randint(8, 18) * scale)

        if shape == 'branch':
            for branch in range(rng.randint(3, 6)):
                angle = rng.uniform(-0.8, 0.8) - math.pi / 2
                length = rng.randint(int(s * 0.8), int(s * 1.5))
                ex = cx + int(math.cos(angle) * length)
                ey = cy + int(math.sin(angle) * length)
                draw.line([(cx, cy), (ex, ey)], fill=color, width=max(2, s // 5))
                # Polyp tip
                tr = max(2, s // 6)
                draw.ellipse([ex - tr, ey - tr, ex + tr, ey + tr], fill=color)
        elif shape == 'fan':
            for a in range(5):
                angle = -math.pi / 2 + (a - 2) * 0.3
                for seg in range(3, int(s * 0.8)):
                    sx_p = cx + int(math.cos(angle) * seg * 1.5)
                    sy_p = cy + int(math.sin(angle) * seg * 1.5)
                    draw.ellipse([sx_p - 1, sy_p - 1, sx_p + 1, sy_p + 1], fill=color)
        elif shape == 'brain':
            draw.ellipse([cx - s, cy - int(s * 0.7), cx + s, cy + int(s * 0.7)],
                         fill=color, outline=(color[0]//2, color[1]//2, color[2]//2), width=2)
            # Ridges
            for ridge in range(3):
                ry = cy - int(s * 0.4) + ridge * int(s * 0.4)
                draw.arc([cx - s + 3, ry - 3, cx + s - 3, ry + 3], 0, 180,
                         fill=(color[0]//2, color[1]//2, color[2]//2), width=1)
        elif shape == 'tube':
            for t_i in range(rng.randint(2, 4)):
                tx = cx + rng.randint(-10, 10)
                th = rng.randint(s, s * 2)
                tw = max(3, s // 3)
                draw.rectangle([tx - tw, cy - th, tx + tw, cy], fill=color)
                draw.ellipse([tx - tw - 1, cy - th - tw, tx + tw + 1, cy - th + tw],
                             fill=(min(255, color[0] + 40), min(255, color[1] + 40), min(255, color[2] + 40)))


def draw_anemone(draw, x, y, frame_idx, seed, scale=1.0):
    """Draw a sea anemone with waving tentacles."""
    rng = random.Random(seed)
    base_color = rng.choice([(200, 80, 150), (180, 60, 200), (240, 120, 80), (100, 200, 160)])
    # Base
    bw = int(20 * scale)
    bh = int(10 * scale)
    draw.ellipse([x - bw, y - bh, x + bw, y + bh], fill=base_color)
    # Tentacles
    num_tentacles = rng.randint(8, 14)
    for t in range(num_tentacles):
        angle = -math.pi / 2 + (t - num_tentacles / 2) * (math.pi / (num_tentacles + 2))
        wave = math.sin(frame_idx * 0.2 + t * 0.7 + seed * 0.1) * 0.3
        angle += wave
        length = int(rng.randint(15, 30) * scale)
        segments = 6
        px, py = x, y
        for seg in range(segments):
            seg_wave = math.sin(frame_idx * 0.15 + t * 0.5 + seg * 0.8) * (2 + seg)
            nx = px + int(math.cos(angle) * (length / segments)) + int(seg_wave * 0.3)
            ny = py + int(math.sin(angle) * (length / segments))
            draw.line([(px, py), (nx, ny)], fill=base_color, width=max(1, 3 - seg // 2))
            px, py = nx, ny
        # Tip glow
        tip_color = (min(255, base_color[0] + 60), min(255, base_color[1] + 60), min(255, base_color[2] + 60))
        draw.ellipse([px - 2, py - 2, px + 2, py + 2], fill=tip_color)


def draw_seaweed(draw, W, H, frame_idx, density=55):
    """Draw rich animated seaweed."""
    for sx in range(25, W, density):
        rng = random.Random(sx + 7)
        num_segs = rng.randint(5, 9)
        green = rng.randint(90, 150)
        color_base = (rng.randint(10, 30), green, rng.randint(30, 60))
        leaf_w_base = rng.randint(5, 9)
        for j in range(num_segs):
            seg_y = H - 28 - j * 18
            wobble = math.sin(frame_idx * 0.12 + sx * 0.025 + j * 0.45) * (5 + j * 2.5)
            w = max(2, leaf_w_base - j)
            # Leaf shape
            draw.ellipse([sx + int(wobble) - w, seg_y - 10,
                          sx + int(wobble) + w, seg_y + 10],
                         fill=color_base)
            # Stem
            if j < num_segs - 1:
                next_wobble = math.sin(frame_idx * 0.12 + sx * 0.025 + (j + 1) * 0.45) * (5 + (j + 1) * 2.5)
                draw.line([(sx + int(wobble), seg_y - 10),
                           (sx + int(next_wobble), seg_y - 28)],
                          fill=(color_base[0], max(0, color_base[1] - 20), color_base[2]), width=2)


def draw_sandy_bottom(draw, W, H, detail=True):
    """Draw a detailed sandy ocean floor with ripples."""
    sand_top = H - 35
    for y in range(sand_top, H):
        ratio = (y - sand_top) / 35
        r = int(195 + ratio * 25)
        g = int(165 + ratio * 20)
        b = int(105 + ratio * 15)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    if detail:
        # Sand ripples
        for ripple in range(0, W, 30):
            rng = random.Random(ripple + 42)
            ry = sand_top + rng.randint(5, 20)
            rw = rng.randint(15, 25)
            draw.arc([ripple - rw, ry - 3, ripple + rw, ry + 3], 0, 180,
                     fill=(180, 155, 95), width=1)

        # Gravel / shells
        rng = random.Random(999)
        for _ in range(50):
            gx = rng.randint(0, W)
            gy = rng.randint(sand_top + 3, H - 3)
            gr = rng.randint(1, 3)
            c = rng.randint(155, 210)
            draw.ellipse([gx - gr, gy - gr, gx + gr, gy + gr], fill=(c, c - 20, c - 40))

        # Tiny starfish / shells
        rng2 = random.Random(888)
        for _ in range(4):
            sx = rng2.randint(20, W - 20)
            sy = rng2.randint(sand_top + 8, H - 8)
            sc = rng2.choice([(220, 180, 120), (200, 100, 80), (180, 160, 200)])
            draw.ellipse([sx - 4, sy - 4, sx + 4, sy + 4], fill=sc)
            draw.ellipse([sx - 2, sy - 2, sx + 2, sy + 2],
                         fill=(min(255, sc[0] + 30), min(255, sc[1] + 30), min(255, sc[2] + 30)))


def draw_small_fish_school(draw, base_x, base_y, frame_idx, seed, count=6, color=None):
    """Draw a school of small background fish."""
    rng = random.Random(seed)
    if color is None:
        color = rng.choice([
            (180, 200, 220), (150, 180, 210), (170, 190, 230),
            (200, 180, 160), (220, 200, 150),
        ])
    for f in range(count):
        offset_x = rng.randint(-40, 40)
        offset_y = rng.randint(-20, 20)
        bob = math.sin(frame_idx * 0.2 + f * 1.2 + seed) * 3
        fx = base_x + offset_x
        fy = base_y + offset_y + int(bob)
        fs = rng.randint(4, 7)
        # Body
        draw.ellipse([fx - fs, fy - fs // 2, fx + fs, fy + fs // 2], fill=color)
        # Tail
        draw.polygon([(fx + fs, fy), (fx + fs + 4, fy - 3), (fx + fs + 4, fy + 3)], fill=color)


def draw_jellyfish(draw, x, y, frame_idx, seed, scale=1.0):
    """Draw a translucent jellyfish."""
    rng = random.Random(seed)
    color = rng.choice([(180, 100, 220), (100, 180, 220), (220, 150, 180), (150, 220, 200)])
    # Bell
    bell_w = int(18 * scale)
    bell_h = int(14 * scale)
    bob = math.sin(frame_idx * 0.15 + seed) * 4
    bx = x
    by = y + int(bob)
    draw.ellipse([bx - bell_w, by - bell_h, bx + bell_w, by + bell_h // 2],
                 fill=color, outline=(color[0] - 30, color[1] - 30, color[2] - 30), width=1)
    # Inner glow
    draw.ellipse([bx - bell_w + 4, by - bell_h + 4, bx + bell_w - 4, by + bell_h // 2 - 2],
                 fill=(min(255, color[0] + 40), min(255, color[1] + 40), min(255, color[2] + 40)))
    # Tentacles
    for t in range(rng.randint(4, 7)):
        tx = bx + rng.randint(-int(bell_w * 0.7), int(bell_w * 0.7))
        ty_start = by + bell_h // 2 - 2
        length = int(rng.randint(15, 35) * scale)
        points = []
        for seg in range(length // 4):
            wave = math.sin(frame_idx * 0.2 + t * 0.8 + seg * 0.6) * (3 + seg)
            points.append((tx + int(wave), ty_start + seg * 4))
        if len(points) >= 2:
            draw.line(points, fill=color, width=1)


# ─── GIF Generators ──────────────────────────────────────────────────────


def create_swimming_nemo_gif():
    """Nemo swimming across a rich ocean scene."""
    print("Creating swimming Nemo GIF...")
    W, H = 480, 480
    builder = GIFBuilder(width=W, height=H, fps=15)
    num_frames = 36

    # Nemo faces LEFT by default. Swimming L-to-R needs flip=True
    nemo = load_sprite('clownfish.png', 85)

    random.seed(42)
    bubbles = [(random.randint(20, W - 20), random.randint(20, H - 20),
                random.randint(4, 10), random.randint(2, 6)) for _ in range(18)]

    for i in range(num_frames):
        t = i / num_frames
        frame = create_gradient_background(W, H, (5, 50, 120), (2, 12, 40))
        draw = ImageDraw.Draw(frame)

        # Caustic light patterns
        draw_caustics(draw, W, H, i, intensity=0.5)
        draw_light_rays(draw, W, H, i, count=7, reach=0.6)

        # Background fish schools
        school_x = int((200 + i * 4) % (W + 60)) - 30
        draw_small_fish_school(draw, school_x, 100, i, seed=111, count=8)
        draw_small_fish_school(draw, W - school_x, 200, i, seed=222, count=5)

        # Jellyfish in background
        draw_jellyfish(draw, 380, 120, i, seed=55, scale=0.7)
        draw_jellyfish(draw, 80, 180, i, seed=66, scale=0.5)

        # Coral on the sea floor
        draw_coral_cluster(draw, 60, H - 45, seed=10, scale=1.2)
        draw_coral_cluster(draw, 200, H - 40, seed=20, scale=0.9)
        draw_coral_cluster(draw, 350, H - 42, seed=30, scale=1.1)
        draw_coral_cluster(draw, 440, H - 38, seed=40, scale=0.8)

        # Anemones
        draw_anemone(draw, 130, H - 38, i, seed=50, scale=1.0)
        draw_anemone(draw, 400, H - 40, i, seed=60, scale=0.8)

        draw_seaweed(draw, W, H, i, density=50)
        draw_sandy_bottom(draw, W, H)
        draw_bubbles(draw, bubbles, i, h_mod=H)

        # Nemo: swimming LEFT to RIGHT → flip=True
        nemo_x = int(W * 0.1 + t * W * 0.8)
        nemo_y = int(H * 0.38 + math.sin(t * math.pi * 4) * 28)
        frame = paste_sprite(frame, nemo, nemo_x, nemo_y, flip=True)

        builder.add_frame(frame)

    builder.save(f'{OUTPUT_DIR}/nemo-swimming.gif', num_colors=164)


def create_just_keep_swimming_gif():
    """Dory with 'Just keep swimming' in a rich underwater scene."""
    print("Creating 'Just Keep Swimming' GIF...")
    W, H = 480, 480
    builder = GIFBuilder(width=W, height=H, fps=12)
    num_frames = 40

    dory = load_sprite('blue-tang.png', 100)

    random.seed(99)
    bubbles = [(random.randint(20, W - 20), random.randint(20, H - 20),
                random.randint(4, 10), random.randint(2, 5)) for _ in range(14)]

    for i in range(num_frames):
        t = i / num_frames
        frame = create_gradient_background(W, H, (6, 45, 130), (2, 12, 45))
        draw = ImageDraw.Draw(frame)

        draw_caustics(draw, W, H, i, intensity=0.35)
        draw_light_rays(draw, W, H, i, count=6, reach=0.55)

        # Background schools
        draw_small_fish_school(draw, int(100 + i * 3) % W, 130, i, seed=333, count=7)

        # Jellyfish
        draw_jellyfish(draw, 400, 90, i, seed=77, scale=0.6)
        draw_jellyfish(draw, 60, 250, i, seed=88, scale=0.5)

        draw_bubbles(draw, bubbles, i, h_mod=H)

        # Dory: swimming back and forth. Velocity determines flip direction.
        # x velocity: cos component of the sine path
        dory_x = int(W * 0.5 + math.sin(t * math.pi * 2) * 60)
        dory_y = int(H * 0.38 + math.sin(t * math.pi * 3) * 22)
        # velocity_x > 0 means moving right → flip=True (since sprite faces left)
        velocity_x = math.cos(t * math.pi * 2)
        flip = velocity_x > 0

        frame = paste_sprite(frame, dory, dory_x, dory_y, flip=flip)

        draw = ImageDraw.Draw(frame)
        font = get_font(26)
        text = "Just keep swimming..."
        bbox = draw.textbbox((0, 0), text, font=font)
        text_w = bbox[2] - bbox[0]
        text_x = (W - text_w) // 2
        text_y = int(H * 0.80) + int(math.sin(t * math.pi * 2) * 4)

        # Glow effect
        draw.text((text_x + 1, text_y + 1), text, fill=(0, 20, 60), font=font)
        draw.text((text_x - 1, text_y - 1), text, fill=(0, 20, 60), font=font)
        draw.text((text_x, text_y), text, fill=(190, 230, 255), font=font)

        builder.add_frame(frame)

    builder.save(f'{OUTPUT_DIR}/just-keep-swimming.gif', num_colors=164)


def create_sharkbait_ooh_ha_ha_gif():
    """The iconic 'Sharkbait, ooh ha ha!' initiation scene in the tank."""
    print("Creating 'Sharkbait ooh ha ha' GIF...")
    W, H = 480, 480
    builder = GIFBuilder(width=W, height=H, fps=12)
    num_frames = 42

    nemo = load_sprite('clownfish.png', 60)
    phrases = ["SHARKBAIT", "OOH HA HA!", "SHARKBAIT", "OOH HA HA!"]

    for i in range(num_frames):
        t = i / num_frames
        frame = create_gradient_background(W, H, (50, 140, 190), (20, 85, 145))
        draw = ImageDraw.Draw(frame)

        # Tank glass border with refraction effect
        draw.rectangle([0, 0, W - 1, H - 1], outline=(170, 215, 235), width=10)
        draw.rectangle([10, 10, W - 11, H - 11], outline=(120, 185, 215), width=4)
        # Glass corner highlights
        for corner_y in range(0, 50):
            alpha = max(0, 60 - corner_y * 2)
            draw.line([(12, corner_y + 12), (50, corner_y + 12)],
                      fill=(min(255, 140 + alpha), min(255, 200 + alpha), min(255, 220 + alpha)), width=1)

        # Caustics in tank
        draw_caustics(draw, W, H, i, intensity=0.25)

        # Gravel floor with more detail
        rng = random.Random(77)
        sand_y = H - 55
        for y in range(sand_y, H - 14):
            ratio = (y - sand_y) / (H - 14 - sand_y)
            draw.line([(14, y), (W - 14, y)],
                      fill=(int(130 + ratio * 20), int(110 + ratio * 15), int(80 + ratio * 10)))
        for _ in range(80):
            gx = rng.randint(18, W - 18)
            gy = rng.randint(sand_y + 2, H - 18)
            gr = rng.randint(2, 5)
            c = rng.randint(90, 160)
            draw.ellipse([gx - gr, gy - gr, gx + gr, gy + gr], fill=(c, c - 15, c - 35))

        # Tank decorations: coral and plants
        draw_coral_cluster(draw, 50, sand_y, seed=101, scale=0.9)
        draw_coral_cluster(draw, W - 50, sand_y, seed=102, scale=0.8)
        draw_anemone(draw, W // 2 - 80, sand_y, i, seed=103, scale=0.7)
        draw_anemone(draw, W // 2 + 80, sand_y, i, seed=104, scale=0.7)

        # Bubbles from tank filter
        tank_bubbles = [(W - 40 + random.Random(b).randint(-5, 5),
                         H - 60 - b * 50, random.Random(b + 1).randint(2, 5),
                         random.Random(b + 2).randint(3, 6)) for b in range(6)]
        draw_bubbles(draw, tank_bubbles, i, h_mod=H)

        # The Tank Gang orbiting in formation
        center_x, center_y = W // 2, H // 2 - 20
        gang_colors = [
            (50, 50, 55),     # Gill (dark, scarred)
            (180, 160, 60),   # Bubbles (yellow)
            (240, 90, 110),   # Peach (starfish pink)
            (80, 200, 100),   # Gurgle (green)
            (220, 80, 180),   # Deb (purple)
            (100, 190, 240),  # Jacques (blue/white)
        ]
        orbit_r = 110
        for f_idx in range(6):
            angle = (f_idx / 6) * math.pi * 2 + t * math.pi * 2
            fx = int(center_x + math.cos(angle) * orbit_r)
            fy = int(center_y + math.sin(angle) * orbit_r * 0.5)
            col = gang_colors[f_idx]
            # More detailed fish
            fs = 16
            draw.ellipse([fx - fs, fy - fs // 2 - 1, fx + fs, fy + fs // 2 + 1],
                         fill=col, outline=(max(0, col[0] - 40), max(0, col[1] - 40), max(0, col[2] - 40)), width=2)
            d = 1 if math.cos(angle) > 0 else -1
            # Fins
            draw.polygon([(fx - fs * d, fy), (fx - (fs + 10) * d, fy - 8), (fx - (fs + 10) * d, fy + 8)], fill=col)
            draw.polygon([(fx, fy - fs // 2), (fx + 4 * d, fy - fs // 2 - 6), (fx + 8 * d, fy - fs // 2)],
                         fill=(min(255, col[0] + 20), min(255, col[1] + 20), min(255, col[2] + 20)))
            # Eye
            ex = fx + 7 * d
            draw.ellipse([ex - 4, fy - 4, ex + 4, fy + 2], fill=(255, 255, 255))
            draw.ellipse([ex - 2 + d, fy - 3, ex + 2 + d, fy + 1], fill=(0, 0, 0))

        # Nemo in center, bobbing (faces left by default, no flip needed as he's just floating)
        bob = math.sin(t * math.pi * 6) * 10
        frame = paste_sprite(frame, nemo, center_x, center_y + int(bob))

        # Cycling text with glow
        draw = ImageDraw.Draw(frame)
        phase = int(t * len(phrases)) % len(phrases)
        text = phrases[phase]
        font = get_font(36)
        bbox = draw.textbbox((0, 0), text, font=font)
        tw = bbox[2] - bbox[0]
        tx = (W - tw) // 2
        ty = 30

        shake_x = int(math.sin(i * 1.5) * 5)
        shake_y = int(math.cos(i * 1.8) * 3)

        # Glow outline
        for gdx in [-1, 0, 1]:
            for gdy in [-1, 0, 1]:
                draw.text((tx + shake_x + gdx + 2, ty + shake_y + gdy + 2), text, fill=(0, 20, 60), font=font)
        draw.text((tx + shake_x, ty + shake_y), text, fill=(255, 250, 190), font=font)

        builder.add_frame(frame)

    builder.save(f'{OUTPUT_DIR}/sharkbait-ooh-ha-ha.gif', num_colors=164)


def create_eac_current_gif():
    """East Australian Current with Nemo and turtle surfing the flow."""
    print("Creating EAC Current GIF...")
    W, H = 480, 200
    builder = GIFBuilder(width=W, height=H, fps=15)
    num_frames = 36

    # Both face LEFT. For rightward travel in the current, flip=True
    nemo = load_sprite('clownfish.png', 45)
    turtle = load_sprite('sea-turtle.png', 100)

    random.seed(22)
    bubbles = [(random.randint(20, W - 20), random.randint(10, H - 10),
                random.randint(3, 7), random.randint(3, 6)) for _ in range(10)]

    for i in range(num_frames):
        t = i / num_frames
        frame = create_gradient_background(W, H, (3, 65, 150), (1, 25, 80))
        draw = ImageDraw.Draw(frame)

        # Dense current flow lines with varying intensity
        for cy in range(0, H, 12):
            points = []
            for cx_pt in range(0, W + 15, 6):
                wave = (math.sin((cx_pt + i * 20) * 0.018 + cy * 0.04) * 5 +
                        math.sin((cx_pt + i * 12) * 0.03 + cy * 0.02) * 3)
                points.append((cx_pt, cy + int(wave)))
            if len(points) >= 2:
                intensity = int(30 + abs(math.sin(cy * 0.05)) * 25)
                draw.line(points, fill=(intensity, intensity + 40, intensity + 80), width=1)

        # Speed streaks (many, varied)
        for sl in range(15):
            rng = random.Random(sl + 500)
            sy = rng.randint(10, H - 10)
            sx_start = int((i * 22 + sl * 35) % (W + 100)) - 50
            length = rng.randint(25, 70)
            alpha = rng.randint(60, 140)
            draw.line([(sx_start, sy), (sx_start + length, sy)],
                      fill=(alpha, alpha + 50, alpha + 70), width=rng.randint(1, 3))

        # Small background fish being swept along
        for sf in range(4):
            rng = random.Random(sf + 300)
            sfx = int((i * 15 + sf * 130) % (W + 80)) - 40
            sfy = rng.randint(20, H - 20)
            sfc = (rng.randint(120, 200), rng.randint(150, 220), rng.randint(180, 240))
            draw.ellipse([sfx - 4, sfy - 2, sfx + 4, sfy + 2], fill=sfc)
            draw.polygon([(sfx + 4, sfy), (sfx + 8, sfy - 2), (sfx + 8, sfy + 2)], fill=sfc)

        draw_bubbles(draw, bubbles, i, h_mod=H)

        # Turtle: riding the current rightward → flip=True
        turtle_x = int(W * 0.30 + math.sin(t * math.pi * 2) * 18)
        turtle_y = int(H * 0.50 + math.sin(t * math.pi * 3) * 10)
        frame = paste_sprite(frame, turtle, turtle_x, turtle_y, flip=True)

        # Nemo: ahead of turtle, rightward → flip=True
        nemo_x = int(W * 0.68 + math.sin(t * math.pi * 4) * 14)
        nemo_y = int(H * 0.36 + math.cos(t * math.pi * 3) * 10)
        frame = paste_sprite(frame, nemo, nemo_x, nemo_y, flip=True)

        # "Righteous!" text with glow
        draw = ImageDraw.Draw(frame)
        font = get_font(20)
        wobble = int(math.sin(t * math.pi * 4) * 3)
        tx = W - 150
        ty = 12 + wobble
        for gdx in [-1, 0, 1]:
            for gdy in [-1, 0, 1]:
                draw.text((tx + gdx, ty + gdy), "Righteous!", fill=(0, 30, 70), font=font)
        draw.text((tx, ty), "Righteous!", fill=(130, 255, 130), font=font)

        builder.add_frame(frame)

    builder.save(f'{OUTPUT_DIR}/eac-current.gif', num_colors=164)


def create_ocean_divider_gif():
    """Animated ocean wave divider for README."""
    print("Creating ocean divider GIF...")
    W, H = 800, 40
    builder = GIFBuilder(width=W, height=H, fps=12)
    num_frames = 24

    for i in range(num_frames):
        frame = Image.new('RGB', (W, H), (13, 17, 23))
        draw = ImageDraw.Draw(frame)

        # Multi-layer waves
        for layer, (color, amp, freq, speed) in enumerate([
            ((15, 50, 110), 6, 0.04, 8),
            ((25, 80, 170), 8, 0.03, 12),
            ((40, 110, 210), 5, 0.05, 10),
        ]):
            points = []
            for x in range(0, W + 5, 3):
                y = H // 2 + int(math.sin((x + i * speed) * freq) * amp +
                                  math.sin((x + i * (speed * 0.7)) * freq * 1.5) * (amp * 0.4))
                points.append((x, y))
            if len(points) >= 2:
                draw.line(points, fill=color, width=2 if layer == 1 else 1)

        # Sparkle dots
        for s in range(8):
            sx = int((s * 105 + i * 18) % W)
            sy = H // 2 + int(math.sin((sx + i * 12) * 0.03) * 8 +
                               math.sin((sx + i * 8) * 0.05) * 4)
            brightness = int(180 + math.sin(i * 0.5 + s) * 75)
            draw.ellipse([sx - 2, sy - 2, sx + 2, sy + 2],
                         fill=(brightness, brightness, 255))

        builder.add_frame(frame)

    builder.save(f'{OUTPUT_DIR}/ocean-divider.gif', num_colors=48)


if __name__ == '__main__':
    create_swimming_nemo_gif()
    create_just_keep_swimming_gif()
    create_sharkbait_ooh_ha_ha_gif()
    create_eac_current_gif()
    create_ocean_divider_gif()
    print("\nAll Finding Nemo GIFs created!")
