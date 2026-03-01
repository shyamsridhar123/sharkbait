#!/usr/bin/env python3
"""
Algorithmic ocean art generator for Sharkbait.
Creates generative ocean/underwater-themed static art using mathematical patterns.
Inspired by the 'algorithmic-art' skill philosophy.
"""

import math
import random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUTPUT_DIR = '/home/shyamsridhar/code/sharkbait/sharkbait/public/art'


def perlin_noise_1d(x, seed=42):
    """Simple 1D noise approximation."""
    random.seed(int(x) + seed)
    a = random.random()
    random.seed(int(x) + 1 + seed)
    b = random.random()
    t = x - int(x)
    # Smoothstep
    t = t * t * (3 - 2 * t)
    return a * (1 - t) + b * t


def noise_2d(x, y, seed=42):
    """Simple 2D noise."""
    n = int(x * 374761393 + y * 668265263 + seed * 1274126177)
    n = (n << 13) ^ n
    return 1.0 - ((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 1073741824.0


def create_ocean_flow_field(width=1200, height=800, seed=42):
    """Create a flow field visualization of ocean currents."""
    print("Creating ocean flow field art...")
    random.seed(seed)

    img = Image.new('RGB', (width, height), (5, 15, 40))
    draw = ImageDraw.Draw(img)

    # Color palette - deep ocean
    colors = [
        (10, 30, 80),    # deep blue
        (20, 60, 120),   # mid blue
        (40, 100, 170),  # ocean blue
        (80, 150, 200),  # light ocean
        (120, 190, 220), # surface blue
        (180, 220, 240), # foam white-blue
        (255, 127, 39),  # nemo orange (rare accent)
    ]

    # Draw flow field particles
    num_particles = 4000
    for p in range(num_particles):
        # Start position
        px = random.random() * width
        py = random.random() * height

        # Build a path following the flow field
        path = []
        steps = random.randint(30, 80)
        for s in range(steps):
            # Flow direction based on noise
            nx = px / 200.0
            ny = py / 200.0
            angle = noise_2d(nx, ny, seed) * math.pi * 4
            # Add a gentle current pull
            angle += math.sin(py / height * math.pi) * 0.5

            dx = math.cos(angle) * 2.0
            dy = math.sin(angle) * 2.0

            px += dx
            py += dy

            # Keep in bounds
            if px < 0 or px >= width or py < 0 or py >= height:
                break

            path.append((int(px), int(py)))

        if len(path) < 2:
            continue

        # Color based on depth (y position)
        depth_ratio = py / height
        ci = int(depth_ratio * (len(colors) - 2))
        ci = max(0, min(ci, len(colors) - 2))

        # Occasional orange accent (1 in 50)
        if random.random() < 0.02:
            color = colors[-1]  # Nemo orange
            alpha_mod = 1.0
        else:
            color = colors[ci]
            alpha_mod = 0.4 + random.random() * 0.4

        # Draw the path
        r = int(color[0] * alpha_mod)
        g = int(color[1] * alpha_mod)
        b = int(color[2] * alpha_mod)

        line_width = 1 if random.random() > 0.1 else 2
        draw.line(path, fill=(r, g, b), width=line_width)

    # Add some bright points (bioluminescence)
    for _ in range(200):
        bx = random.randint(0, width - 1)
        by = random.randint(0, height - 1)
        br = random.randint(1, 3)
        brightness = random.randint(150, 255)
        draw.ellipse([bx - br, by - br, bx + br, by + br],
                     fill=(brightness, brightness, int(brightness * 0.9)))

    # Soft blur for a painted quality
    img = img.filter(ImageFilter.GaussianBlur(radius=0.5))

    img.save(f'{OUTPUT_DIR}/ocean-flow-field.png', quality=95)
    print(f"  Saved: {OUTPUT_DIR}/ocean-flow-field.png")
    return img


def create_coral_reef_pattern(width=1200, height=600, seed=42):
    """Create a generative coral reef pattern — Voronoi-inspired."""
    print("Creating coral reef pattern...")
    random.seed(seed)

    img = Image.new('RGB', (width, height), (10, 25, 60))
    draw = ImageDraw.Draw(img)

    # Generate coral "cells" using circle packing
    corals = []
    max_attempts = 5000
    for _ in range(max_attempts):
        cx = random.randint(0, width)
        cy = random.randint(0, height)
        cr = random.randint(8, 50)

        # Check overlap
        overlaps = False
        for ox, oy, or_ in corals:
            dist = math.sqrt((cx - ox)**2 + (cy - oy)**2)
            if dist < cr + or_ + 2:
                overlaps = True
                break

        if not overlaps:
            corals.append((cx, cy, cr))

    # Coral color palette
    coral_colors = [
        (255, 100, 100),  # red coral
        (255, 150, 80),   # orange coral
        (200, 80, 160),   # purple coral
        (100, 200, 150),  # green coral
        (255, 200, 100),  # yellow coral
        (180, 100, 200),  # lavender
        (100, 180, 220),  # blue coral
        (255, 120, 160),  # pink coral
    ]

    for cx, cy, cr in corals:
        color = random.choice(coral_colors)
        # Ring pattern
        for ring in range(cr, 0, -4):
            intensity = 0.5 + (ring / cr) * 0.5
            r = int(color[0] * intensity)
            g = int(color[1] * intensity)
            b = int(color[2] * intensity)
            draw.ellipse([cx - ring, cy - ring, cx + ring, cy + ring],
                         fill=(r, g, b), outline=(r // 2, g // 2, b // 2), width=1)

        # Coral branches/tentacles
        num_branches = random.randint(3, 8)
        for br in range(num_branches):
            angle = (br / num_branches) * math.pi * 2 + random.random() * 0.5
            bx = cx + int(math.cos(angle) * cr * 1.3)
            by = cy + int(math.sin(angle) * cr * 1.3)
            draw.line([(cx, cy), (bx, by)], fill=color, width=2)
            # Tiny polyp at end
            draw.ellipse([bx - 3, by - 3, bx + 3, by + 3], fill=color)

    # Floating particles / plankton
    for _ in range(300):
        px = random.randint(0, width)
        py = random.randint(0, height)
        pr = random.randint(1, 2)
        draw.ellipse([px - pr, py - pr, px + pr, py + pr],
                     fill=(200, 230, 255))

    img = img.filter(ImageFilter.GaussianBlur(radius=0.8))
    img.save(f'{OUTPUT_DIR}/coral-reef-pattern.png', quality=95)
    print(f"  Saved: {OUTPUT_DIR}/coral-reef-pattern.png")
    return img


def create_depth_gradient_banner(width=1200, height=600, seed=42):
    """Create a rich ocean depth zones banner with life at each level."""
    print("Creating depth gradient banner...")
    random.seed(seed)

    img = Image.new('RGB', (width, height))
    draw = ImageDraw.Draw(img)

    # 5-zone gradient: sunlit -> twilight -> midnight -> abyssal -> hadal
    zones = [
        ((30, 150, 240), (10, 100, 200)),    # Sunlit (0-200m)
        ((10, 100, 200), (5, 50, 130)),      # Twilight (200-1000m)
        ((5, 50, 130), (3, 20, 60)),         # Midnight (1000-4000m)
        ((3, 20, 60), (2, 8, 25)),           # Abyssal (4000-6000m)
        ((2, 8, 25), (1, 3, 10)),            # Hadal (6000m+)
    ]

    zone_h = height // len(zones)
    for zi, (top, bot) in enumerate(zones):
        for y in range(zone_h):
            abs_y = zi * zone_h + y
            if abs_y >= height:
                break
            ratio = y / zone_h
            r = int(top[0] * (1 - ratio) + bot[0] * ratio)
            g = int(top[1] * (1 - ratio) + bot[1] * ratio)
            b = int(top[2] * (1 - ratio) + bot[2] * ratio)
            draw.line([(0, abs_y), (width, abs_y)], fill=(r, g, b))

    # Light rays from surface – strong, reaching into twilight zone
    for ray in range(12):
        rx = random.randint(30, width - 30)
        ray_w = random.randint(20, 50)
        max_reach = random.randint(int(height * 0.3), int(height * 0.5))
        for ry in range(0, max_reach):
            ratio = ry / max_reach
            alpha = max(0, int(90 * (1 - ratio * ratio)))
            if alpha <= 0:
                break
            spread = int(ry * 0.1)
            c_r = min(255, 20 + alpha // 2)
            c_g = min(255, 40 + int(alpha * 0.8))
            c_b = min(255, 80 + alpha)
            draw.line([(rx - spread, ry), (rx + ray_w + spread, ry)],
                      fill=(c_r, c_g, c_b), width=1)

    # Caustic shimmer in sunlit zone
    for cx in range(0, width, 5):
        for cy in range(0, zone_h, 7):
            noise = math.sin(cx * 0.06) * math.cos(cy * 0.08) + math.sin((cx + cy) * 0.04) * 0.5
            if noise > 0.7:
                bright = int(noise * 35)
                draw.ellipse([cx - 1, cy - 1, cx + 2, cy + 2],
                             fill=(bright + 15, bright + 25, bright + 45))

    # --- Sunlit zone life: fish schools, surface ripples ---
    for school in range(5):
        sx = random.randint(50, width - 50)
        sy = random.randint(20, zone_h - 20)
        school_color = random.choice([
            (180, 210, 240), (200, 180, 140), (160, 200, 180),
            (220, 200, 150), (180, 180, 220),
        ])
        for f in range(random.randint(6, 15)):
            fx = sx + random.randint(-35, 35)
            fy = sy + random.randint(-15, 15)
            fs = random.randint(3, 5)
            draw.ellipse([fx - fs, fy - fs // 2, fx + fs, fy + fs // 2], fill=school_color)
            draw.polygon([(fx + fs, fy), (fx + fs + 3, fy - 2), (fx + fs + 3, fy + 2)], fill=school_color)

    # Sea turtle silhouette
    turtle_x = random.randint(200, width - 200)
    turtle_y = random.randint(30, zone_h - 30)
    ts = 20
    draw.ellipse([turtle_x - ts, turtle_y - int(ts * 0.6), turtle_x + ts, turtle_y + int(ts * 0.6)],
                 fill=(40, 120, 180))
    draw.ellipse([turtle_x + ts - 5, turtle_y - 5, turtle_x + ts + 8, turtle_y + 5],
                 fill=(50, 130, 185))
    for flipper in [(-1, -1), (-1, 1), (1, -1), (1, 1)]:
        fx = turtle_x + flipper[0] * ts
        fy = turtle_y + flipper[1] * int(ts * 0.7)
        draw.polygon([(turtle_x + flipper[0] * 5, turtle_y + flipper[1] * int(ts * 0.4)),
                      (fx, fy), (turtle_x + flipper[0] * int(ts * 0.6), turtle_y)],
                     fill=(45, 125, 182))

    # --- Twilight zone: jellyfish, larger fish ---
    twilight_top = zone_h
    twilight_bot = zone_h * 2

    for jf in range(6):
        jx = random.randint(50, width - 50)
        jy = random.randint(twilight_top + 15, twilight_bot - 15)
        jc = random.choice([(120, 80, 160), (80, 120, 170), (150, 100, 140), (100, 140, 180)])
        jr = random.randint(8, 16)
        draw.ellipse([jx - jr, jy - jr, jx + jr, jy + int(jr * 0.4)], fill=jc)
        # Tentacles
        for tent in range(random.randint(3, 6)):
            tx_off = random.randint(-int(jr * 0.6), int(jr * 0.6))
            t_len = random.randint(15, 40)
            points = [(jx + tx_off, jy + int(jr * 0.3))]
            for seg in range(1, t_len // 5):
                wave = math.sin(seg * 0.8 + tent * 2) * 4
                points.append((jx + tx_off + int(wave), jy + int(jr * 0.3) + seg * 5))
            if len(points) >= 2:
                draw.line(points, fill=jc, width=1)

    # --- Midnight zone: bioluminescence, anglerfish ---
    midnight_top = zone_h * 2
    midnight_bot = zone_h * 3

    # Bioluminescent particles
    for _ in range(80):
        bx = random.randint(0, width)
        by = random.randint(midnight_top, midnight_bot)
        br = random.randint(1, 3)
        bc = random.choice([
            (40, 200, 200), (30, 180, 255), (100, 255, 180),
            (200, 150, 255), (80, 220, 150),
        ])
        # Glow halo
        draw.ellipse([bx - br - 3, by - br - 3, bx + br + 3, by + br + 3],
                     fill=(bc[0] // 6, bc[1] // 6, bc[2] // 6))
        draw.ellipse([bx - br, by - br, bx + br, by + br], fill=bc)

    # Anglerfish silhouette with lure
    ax = random.randint(300, width - 300)
    ay = random.randint(midnight_top + 30, midnight_bot - 30)
    # Body
    draw.ellipse([ax - 25, ay - 15, ax + 20, ay + 18], fill=(8, 15, 35))
    # Mouth
    draw.polygon([(ax + 20, ay - 5), (ax + 35, ay + 3), (ax + 20, ay + 10)], fill=(8, 15, 35))
    # Teeth
    for tooth in range(4):
        ty_t = ay - 3 + tooth * 4
        draw.line([(ax + 22 + tooth * 3, ty_t), (ax + 25 + tooth * 2, ty_t + 2)],
                  fill=(30, 40, 60), width=1)
    # Lure
    lure_x = ax - 15
    lure_y = ay - 30
    draw.line([(ax - 10, ay - 12), (lure_x, lure_y)], fill=(20, 30, 50), width=1)
    # Glowing lure
    for gr in range(8, 0, -1):
        intensity = int((8 - gr) / 8 * 180)
        draw.ellipse([lure_x - gr, lure_y - gr, lure_x + gr, lure_y + gr],
                     fill=(intensity // 3, intensity, intensity + 20))

    # --- Abyssal zone: sparse bioluminescence, tube worms ---
    abyssal_top = zone_h * 3
    abyssal_bot = zone_h * 4

    for _ in range(30):
        bx = random.randint(0, width)
        by = random.randint(abyssal_top, abyssal_bot)
        br = 1
        bc = random.choice([(20, 120, 120), (15, 100, 180), (60, 150, 100)])
        draw.ellipse([bx - br - 2, by - br - 2, bx + br + 2, by + br + 2],
                     fill=(bc[0] // 4, bc[1] // 4, bc[2] // 4))
        draw.ellipse([bx - br, by - br, bx + br, by + br], fill=bc)

    # Hydrothermal vent with tube worms
    vent_x = random.randint(400, width - 200)
    vent_y = abyssal_bot - 10
    # Vent chimney
    draw.rectangle([vent_x - 15, vent_y - 50, vent_x + 15, vent_y], fill=(30, 25, 20))
    draw.rectangle([vent_x - 20, vent_y - 55, vent_x + 20, vent_y - 45], fill=(35, 28, 22))
    # Vent plume (dark smoker)
    for py_v in range(vent_y - 55, vent_y - 100, -3):
        spread = int((vent_y - 55 - py_v) * 0.3)
        alpha = max(3, int(20 - (vent_y - 55 - py_v) * 0.3))
        draw.line([(vent_x - spread, py_v), (vent_x + spread, py_v)],
                  fill=(alpha + 5, alpha, alpha - 2), width=2)
    # Tube worms
    for tw in range(8):
        twx = vent_x + random.randint(-35, 35)
        twh = random.randint(20, 40)
        draw.rectangle([twx - 1, vent_y - twh, twx + 1, vent_y], fill=(15, 12, 10))
        # Red plume tip
        draw.ellipse([twx - 3, vent_y - twh - 4, twx + 3, vent_y - twh + 2],
                     fill=(140, 30, 30))

    # --- Hadal zone: near-total darkness, sparse life ---
    hadal_top = zone_h * 4

    for _ in range(10):
        bx = random.randint(0, width)
        by = random.randint(hadal_top, height - 5)
        draw.ellipse([bx - 1, by - 1, bx + 1, by + 1],
                     fill=(15, 60, 60))

    # Zone labels
    try:
        font_sm = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 14)
        font_lg = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 16)
    except (OSError, IOError):
        font_sm = ImageFont.load_default()
        font_lg = font_sm

    zone_labels = [
        ("SUNLIT ZONE  0-200m", 10),
        ("TWILIGHT ZONE  200-1000m", zone_h + 8),
        ("MIDNIGHT ZONE  1000-4000m", zone_h * 2 + 8),
        ("ABYSSAL ZONE  4000-6000m", zone_h * 3 + 8),
        ("HADAL ZONE  6000m+", zone_h * 4 + 8),
    ]
    for label, ly in zone_labels:
        # Shadow
        draw.text((22, ly + 1), label, fill=(0, 0, 0), font=font_sm)
        # Text
        alpha_text = max(40, 220 - ly // 2)
        draw.text((20, ly), label, fill=(alpha_text, alpha_text, min(255, alpha_text + 30)), font=font_sm)

    img = img.filter(ImageFilter.GaussianBlur(radius=0.6))
    img.save(f'{OUTPUT_DIR}/depth-gradient-banner.png', quality=95)
    print(f"  Saved: {OUTPUT_DIR}/depth-gradient-banner.png ({img.size[0]}x{img.size[1]})")
    return img


if __name__ == '__main__':
    create_ocean_flow_field()
    create_coral_reef_pattern()
    create_depth_gradient_banner()
    print("\nAll algorithmic art assets created!")
