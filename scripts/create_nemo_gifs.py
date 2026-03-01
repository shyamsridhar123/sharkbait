#!/usr/bin/env python3
"""
Finding Nemo style animated GIFs for Sharkbait project.
Creates multiple themed GIFs using PIL drawing primitives.
"""

import math
import sys
sys.path.insert(0, '/tmp/anthropic-skills/skills/slack-gif-creator')

from core.gif_builder import GIFBuilder
from core.frame_composer import create_gradient_background, create_blank_frame
from core.easing import interpolate, ease_out_cubic
from PIL import Image, ImageDraw, ImageFont

OUTPUT_DIR = '/home/shyamsridhar/code/sharkbait/sharkbait/public/gifs'


def draw_clownfish(draw, cx, cy, size, angle=0, flip=False):
    """Draw a stylized clownfish (Nemo) using PIL primitives."""
    s = size
    direction = -1 if flip else 1

    # Body (orange ellipse)
    body_w = int(s * 1.8)
    body_h = int(s * 1.0)
    draw.ellipse(
        [cx - body_w//2, cy - body_h//2, cx + body_w//2, cy + body_h//2],
        fill=(255, 127, 39), outline=(200, 80, 10), width=2
    )

    # White stripes
    stripe_w = int(s * 0.18)
    for offset in [-int(s*0.35), int(s*0.15), int(s*0.55)]:
        sx = cx + offset * direction
        draw.rectangle(
            [sx - stripe_w//2, cy - body_h//2 + 2, sx + stripe_w//2, cy + body_h//2 - 2],
            fill=(255, 255, 255), outline=(220, 220, 220), width=1
        )

    # Black outlines on stripes
    for offset in [-int(s*0.35), int(s*0.15), int(s*0.55)]:
        sx = cx + offset * direction
        draw.line([(sx - stripe_w//2, cy - body_h//2 + 2), (sx - stripe_w//2, cy + body_h//2 - 2)],
                  fill=(0, 0, 0), width=2)
        draw.line([(sx + stripe_w//2, cy - body_h//2 + 2), (sx + stripe_w//2, cy + body_h//2 - 2)],
                  fill=(0, 0, 0), width=2)

    # Tail fin
    tail_x = cx - int(s * 0.9) * direction
    points = [
        (tail_x, cy),
        (tail_x - int(s*0.5)*direction, cy - int(s*0.4)),
        (tail_x - int(s*0.5)*direction, cy + int(s*0.4)),
    ]
    draw.polygon(points, fill=(255, 160, 50), outline=(200, 80, 10), width=2)

    # Top fin
    fin_points = [
        (cx - int(s*0.2)*direction, cy - body_h//2),
        (cx + int(s*0.1)*direction, cy - body_h//2 - int(s*0.35)),
        (cx + int(s*0.3)*direction, cy - body_h//2),
    ]
    draw.polygon(fin_points, fill=(255, 140, 30), outline=(200, 80, 10), width=2)

    # Eye
    eye_x = cx + int(s * 0.5) * direction
    eye_y = cy - int(s * 0.1)
    eye_r = int(s * 0.15)
    draw.ellipse([eye_x - eye_r, eye_y - eye_r, eye_x + eye_r, eye_y + eye_r],
                 fill=(255, 255, 255), outline=(0, 0, 0), width=2)
    pupil_r = int(s * 0.07)
    px = eye_x + int(s * 0.03) * direction
    draw.ellipse([px - pupil_r, eye_y - pupil_r, px + pupil_r, eye_y + pupil_r],
                 fill=(0, 0, 0))

    # Lucky fin (Nemo's small fin)
    lucky_x = cx + int(s * 0.3) * direction
    lucky_y = cy + int(s * 0.15)
    lfin_points = [
        (lucky_x, lucky_y),
        (lucky_x + int(s*0.25)*direction, lucky_y + int(s*0.2)),
        (lucky_x - int(s*0.05)*direction, lucky_y + int(s*0.15)),
    ]
    draw.polygon(lfin_points, fill=(255, 140, 30), outline=(200, 80, 10), width=1)


def draw_dory(draw, cx, cy, size, flip=False):
    """Draw a stylized Dory (blue tang) using PIL primitives."""
    s = size
    direction = -1 if flip else 1
    body_w = int(s * 2.0)
    body_h = int(s * 1.1)

    # Body (blue)
    draw.ellipse(
        [cx - body_w//2, cy - body_h//2, cx + body_w//2, cy + body_h//2],
        fill=(30, 100, 200), outline=(15, 60, 150), width=2
    )

    # Yellow tail section
    tail_x = cx - int(s * 0.6) * direction
    draw.ellipse(
        [tail_x - int(s*0.3), cy - int(s*0.35), tail_x + int(s*0.3), cy + int(s*0.35)],
        fill=(255, 220, 50), outline=(200, 170, 20), width=2
    )

    # Dark blue/black swatch
    sw_x = cx - int(s * 0.1) * direction
    draw.ellipse(
        [sw_x - int(s*0.4), cy - int(s*0.3), sw_x + int(s*0.15), cy + int(s*0.3)],
        fill=(10, 40, 100), outline=(5, 25, 80), width=1
    )

    # Tail fin
    tail_x2 = cx - int(s * 1.0) * direction
    points = [
        (tail_x2, cy),
        (tail_x2 - int(s*0.45)*direction, cy - int(s*0.35)),
        (tail_x2 - int(s*0.45)*direction, cy + int(s*0.35)),
    ]
    draw.polygon(points, fill=(255, 220, 50), outline=(200, 170, 20), width=2)

    # Eye
    eye_x = cx + int(s * 0.55) * direction
    eye_y = cy - int(s * 0.05)
    eye_r = int(s * 0.14)
    draw.ellipse([eye_x - eye_r, eye_y - eye_r, eye_x + eye_r, eye_y + eye_r],
                 fill=(255, 255, 255), outline=(0, 0, 0), width=2)
    pupil_r = int(s * 0.06)
    draw.ellipse([eye_x - pupil_r, eye_y - pupil_r, eye_x + pupil_r, eye_y + pupil_r],
                 fill=(0, 0, 0))


def draw_bubbles(draw, bubbles, frame_idx):
    """Draw floating bubbles."""
    for bx, by, br, speed in bubbles:
        y_offset = (frame_idx * speed) % 500
        by_anim = (by - y_offset) % 500
        wobble = math.sin(frame_idx * 0.3 + bx * 0.1) * 3
        draw.ellipse(
            [int(bx + wobble - br), int(by_anim - br),
             int(bx + wobble + br), int(by_anim + br)],
            fill=None, outline=(180, 220, 255), width=2
        )
        # Highlight
        highlight_r = max(1, br // 3)
        hx = int(bx + wobble - br // 3)
        hy = int(by_anim - br // 3)
        draw.ellipse([hx, hy, hx + highlight_r, hy + highlight_r],
                     fill=(220, 240, 255))


def create_swimming_nemo_gif():
    """Create a Nemo swimming across ocean background."""
    print("Creating swimming Nemo GIF...")
    W, H = 480, 480
    builder = GIFBuilder(width=W, height=H, fps=15)
    num_frames = 30

    import random
    random.seed(42)
    bubbles = [(random.randint(20, W-20), random.randint(20, H-20),
                random.randint(3, 8), random.randint(2, 5)) for _ in range(15)]

    for i in range(num_frames):
        t = i / num_frames
        frame = create_gradient_background(W, H, (0, 40, 100), (0, 15, 50))
        draw = ImageDraw.Draw(frame)

        # Seaweed at bottom
        for sx in range(30, W, 60):
            for j in range(5):
                seg_y = H - 20 - j * 25
                wobble = math.sin(i * 0.2 + sx * 0.05 + j * 0.5) * 8
                draw.ellipse([sx + int(wobble) - 5, seg_y - 12, sx + int(wobble) + 5, seg_y + 12],
                             fill=(20, 120, 40))

        # Sandy bottom
        draw.rectangle([0, H - 25, W, H], fill=(210, 180, 120))
        for dot_x in range(0, W, 8):
            draw.ellipse([dot_x, H - 18, dot_x + 3, H - 15], fill=(190, 160, 100))

        draw_bubbles(draw, bubbles, i)

        # Nemo swimming with sine wave motion
        nemo_x = int(W * 0.2 + t * W * 0.6)
        nemo_y = int(H * 0.35 + math.sin(t * math.pi * 4) * 30)
        draw_clownfish(draw, nemo_x, nemo_y, 35)

        builder.add_frame(frame)

    builder.save(f'{OUTPUT_DIR}/nemo-swimming.gif', num_colors=96)


def create_just_keep_swimming_gif():
    """Create Dory with 'Just keep swimming' text."""
    print("Creating 'Just Keep Swimming' GIF...")
    W, H = 480, 480
    builder = GIFBuilder(width=W, height=H, fps=12)
    num_frames = 36

    import random
    random.seed(99)
    bubbles = [(random.randint(20, W-20), random.randint(20, H-20),
                random.randint(3, 8), random.randint(2, 5)) for _ in range(12)]

    for i in range(num_frames):
        t = i / num_frames
        frame = create_gradient_background(W, H, (10, 50, 130), (5, 20, 60))
        draw = ImageDraw.Draw(frame)

        # Light rays from surface
        for ray in range(5):
            ray_x = int((ray * 110 + i * 8) % (W + 100)) - 50
            points = [
                (ray_x, 0), (ray_x + 30, 0),
                (ray_x + 60, H), (ray_x - 30, H)
            ]
            # Semi-transparent ray effect with light blue
            for ry in range(0, H, 2):
                alpha = max(0, 255 - ry)
                c = min(255, 40 + alpha // 8)
                draw.line([(ray_x - int(ry*0.05), ry), (ray_x + 30 + int(ry*0.05), ry)],
                          fill=(c, c + 10, c + 30), width=1)

        draw_bubbles(draw, bubbles, i)

        # Dory swimming with gentle bob
        dory_x = int(W * 0.5 + math.sin(t * math.pi * 2) * 40)
        dory_y = int(H * 0.45 + math.sin(t * math.pi * 3) * 15)
        draw_dory(draw, dory_x, dory_y, 40)

        # "Just keep swimming" text that pulses
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22)
        except (OSError, IOError):
            font = ImageFont.load_default()

        text = "Just keep swimming..."
        pulse = 1.0 + math.sin(t * math.pi * 4) * 0.1
        text_y = int(H * 0.82)
        bbox = draw.textbbox((0, 0), text, font=font)
        text_w = bbox[2] - bbox[0]
        text_x = (W - text_w) // 2

        # Text shadow
        draw.text((text_x + 2, text_y + 2), text, fill=(0, 20, 60), font=font)
        draw.text((text_x, text_y), text, fill=(180, 220, 255), font=font)

        builder.add_frame(frame)

    builder.save(f'{OUTPUT_DIR}/just-keep-swimming.gif', num_colors=96)


def create_sharkbait_ooh_ha_ha_gif():
    """Create the iconic 'Sharkbait, ooh ha ha!' scene."""
    print("Creating 'Sharkbait ooh ha ha' GIF...")
    W, H = 480, 480
    builder = GIFBuilder(width=W, height=H, fps=12)
    num_frames = 36

    phrases = [
        "SHARKBAIT",
        "OOH HA HA!",
        "SHARKBAIT",
        "OOH HA HA!",
    ]

    import random
    random.seed(77)

    for i in range(num_frames):
        t = i / num_frames
        # Aquarium tank background (lighter blue, glass effect)
        frame = create_gradient_background(W, H, (60, 150, 200), (30, 100, 160))
        draw = ImageDraw.Draw(frame)

        # Tank glass edges
        draw.rectangle([0, 0, W-1, H-1], outline=(150, 200, 230), width=8)
        draw.rectangle([8, 8, W-9, H-9], outline=(100, 170, 210), width=3)

        # Gravel at bottom
        draw.rectangle([10, H - 40, W - 10, H - 10], fill=(140, 120, 90))
        for gx in range(15, W - 15, 6):
            gy = H - 35 + random.randint(0, 15)
            gr = random.randint(2, 4)
            c = random.randint(100, 160)
            draw.ellipse([gx-gr, gy-gr, gx+gr, gy+gr], fill=(c, c-20, c-40))
        random.seed(77)  # Reset for consistent gravel each frame

        # Small fish (the Tank Gang) arranged in a circle
        num_fish = 6
        center_x, center_y = W // 2, H // 2 - 20
        circle_r = 100
        for f in range(num_fish):
            angle = (f / num_fish) * math.pi * 2 + t * math.pi * 2
            fx = int(center_x + math.cos(angle) * circle_r)
            fy = int(center_y + math.sin(angle) * circle_r * 0.6)

            # Different colored fish for tank gang
            colors = [
                (255, 200, 0),    # Gill (yellow-ish)
                (200, 50, 200),   # Bloat (purple)
                (255, 100, 100),  # Peach (pink/red)
                (100, 255, 100),  # Gurgle (green)
                (255, 180, 50),   # Bubbles (orange)
                (100, 200, 255),  # Deb (light blue)
            ]
            col = colors[f]
            fish_s = 15
            # Simple fish shape
            body = [fx - fish_s, fy - fish_s//2, fx + fish_s, fy + fish_s//2]
            draw.ellipse(body, fill=col, outline=(col[0]//2, col[1]//2, col[2]//2), width=2)
            # Tail
            direction = 1 if math.cos(angle) > 0 else -1
            tail_pts = [
                (fx - fish_s * direction, fy),
                (fx - fish_s * direction - 8 * direction, fy - 6),
                (fx - fish_s * direction - 8 * direction, fy + 6),
            ]
            draw.polygon(tail_pts, fill=col)
            # Eye
            ex = fx + 5 * direction
            draw.ellipse([ex-2, fy-3, ex+2, fy+1], fill=(255, 255, 255))
            draw.ellipse([ex-1, fy-2, ex+1, fy], fill=(0, 0, 0))

        # Nemo in the center
        bob = math.sin(t * math.pi * 6) * 8
        draw_clownfish(draw, center_x, center_y + int(bob), 25)

        # Text phrase cycling
        phase = int(t * len(phrases)) % len(phrases)
        text = phrases[phase]
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 32)
        except (OSError, IOError):
            font = ImageFont.load_default()

        bbox = draw.textbbox((0, 0), text, font=font)
        tw = bbox[2] - bbox[0]
        tx = (W - tw) // 2
        ty = 30

        # Shaky text effect
        shake_x = int(math.sin(i * 1.5) * 3)
        shake_y = int(math.cos(i * 1.8) * 2)

        draw.text((tx + shake_x + 2, ty + shake_y + 2), text, fill=(0, 30, 80), font=font)
        draw.text((tx + shake_x, ty + shake_y), text, fill=(255, 255, 200), font=font)

        builder.add_frame(frame)

    builder.save(f'{OUTPUT_DIR}/sharkbait-ooh-ha-ha.gif', num_colors=96)


def create_eac_current_gif():
    """Create the East Australian Current (EAC) surfing scene."""
    print("Creating EAC Current GIF...")
    W, H = 480, 200
    builder = GIFBuilder(width=W, height=H, fps=15)
    num_frames = 30

    for i in range(num_frames):
        t = i / num_frames
        frame = create_gradient_background(W, H, (0, 80, 160), (0, 40, 100))
        draw = ImageDraw.Draw(frame)

        # Flowing current lines
        for cy in range(0, H, 20):
            points = []
            for cx_pt in range(0, W + 20, 10):
                wave = math.sin((cx_pt + i * 15) * 0.02 + cy * 0.05) * 8
                points.append((cx_pt, cy + int(wave)))
            if len(points) >= 2:
                draw.line(points, fill=(40, 120, 200), width=1)

        # Speed lines
        for sl in range(8):
            sy = 30 + sl * 20
            sx_start = int((i * 20 + sl * 60) % (W + 100)) - 50
            draw.line([(sx_start, sy), (sx_start + 40, sy)],
                      fill=(100, 180, 240), width=2)

        # Turtle (Crush) - simple version
        turtle_x = int(W * 0.3 + math.sin(t * math.pi * 2) * 20)
        turtle_y = int(H * 0.45 + math.sin(t * math.pi * 3) * 10)
        # Shell
        shell_w, shell_h = 35, 25
        draw.ellipse([turtle_x - shell_w, turtle_y - shell_h,
                      turtle_x + shell_w, turtle_y + shell_h],
                     fill=(50, 130, 60), outline=(30, 90, 40), width=3)
        # Shell pattern
        draw.ellipse([turtle_x - shell_w + 8, turtle_y - shell_h + 8,
                      turtle_x + shell_w - 8, turtle_y + shell_h - 8],
                     fill=None, outline=(40, 110, 50), width=2)
        # Head
        head_x = turtle_x + 30
        draw.ellipse([head_x - 8, turtle_y - 8, head_x + 8, turtle_y + 8],
                     fill=(80, 160, 80), outline=(50, 120, 50), width=2)
        # Eye
        draw.ellipse([head_x + 2, turtle_y - 4, head_x + 6, turtle_y],
                     fill=(255, 255, 255))
        draw.ellipse([head_x + 3, turtle_y - 3, head_x + 5, turtle_y - 1],
                     fill=(0, 0, 0))
        # Flippers
        for fy_off in [-1, 1]:
            flipper_pts = [
                (turtle_x - 15, turtle_y + 15 * fy_off),
                (turtle_x - 30, turtle_y + 25 * fy_off + int(math.sin(t * math.pi * 6) * 5)),
                (turtle_x - 5, turtle_y + 20 * fy_off),
            ]
            draw.polygon(flipper_pts, fill=(70, 150, 70), outline=(40, 100, 40), width=2)

        # Nemo riding the current ahead
        nemo_x = int(W * 0.65 + math.sin(t * math.pi * 4) * 15)
        nemo_y = int(H * 0.4 + math.cos(t * math.pi * 3) * 10)
        draw_clownfish(draw, nemo_x, nemo_y, 18)

        # "Righteous!" text
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 16)
        except (OSError, IOError):
            font = ImageFont.load_default()
        draw.text((W - 130, 15), "Righteous!", fill=(150, 255, 150), font=font)

        builder.add_frame(frame)

    builder.save(f'{OUTPUT_DIR}/eac-current.gif', num_colors=96)


def create_ocean_divider_gif():
    """Create a simple animated ocean wave divider for the README."""
    print("Creating ocean divider GIF...")
    W, H = 800, 40
    builder = GIFBuilder(width=W, height=H, fps=12)
    num_frames = 24

    for i in range(num_frames):
        t = i / num_frames
        frame = Image.new('RGB', (W, H), (13, 17, 23))  # GitHub dark bg
        draw = ImageDraw.Draw(frame)

        # Animated wave line
        points = []
        for x in range(0, W + 5, 3):
            y = H // 2 + int(math.sin((x + i * 12) * 0.03) * 8 +
                              math.sin((x + i * 8) * 0.05) * 4)
            points.append((x, y))

        if len(points) >= 2:
            draw.line(points, fill=(30, 100, 200), width=3)

        # Sparkle dots on wave
        for s in range(6):
            sx = int((s * 140 + i * 20) % W)
            sy_wave = H // 2 + int(math.sin((sx + i * 12) * 0.03) * 8 +
                                    math.sin((sx + i * 8) * 0.05) * 4)
            brightness = int(180 + math.sin(i * 0.5 + s) * 75)
            draw.ellipse([sx - 2, sy_wave - 2, sx + 2, sy_wave + 2],
                         fill=(brightness, brightness, 255))

        builder.add_frame(frame)

    builder.save(f'{OUTPUT_DIR}/ocean-divider.gif', num_colors=32)


if __name__ == '__main__':
    create_swimming_nemo_gif()
    create_just_keep_swimming_gif()
    create_sharkbait_ooh_ha_ha_gif()
    create_eac_current_gif()
    create_ocean_divider_gif()
    print("\nAll Finding Nemo GIFs created!")
