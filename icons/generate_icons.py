"""Generate Auto Refresh extension icons (16/48/128 PNGs).

Style: rounded-square purple gradient (matches the popup logo) with a white
circular refresh arrow centered on it.
"""
from PIL import Image, ImageDraw
import math
import os

OUT_DIR = os.path.dirname(os.path.abspath(__file__))

# Gradient endpoints (135deg): top-left -> bottom-right
COLOR_A = (124, 109, 245)  # #7c6df5
COLOR_B = (167, 139, 250)  # #a78bfa
WHITE = (255, 255, 255, 255)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient_rounded_square(size, radius_ratio=0.22):
    """Solid rounded square with a 135deg linear gradient."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = img.load()
    # 135deg means direction vector (1, 1)/sqrt(2). Project each pixel onto it,
    # normalized by max projection.
    max_proj = (size - 1) + (size - 1)
    for y in range(size):
        for x in range(size):
            t = (x + y) / max_proj
            r, g, b = lerp(COLOR_A, COLOR_B, t)
            px[x, y] = (r, g, b, 255)

    # Mask to rounded square
    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)
    radius = int(size * radius_ratio)
    md.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    img.putalpha(mask)
    return img


def draw_refresh_arrow(img):
    """Draw a white circular refresh arrow centered on the image."""
    size = img.width
    draw = ImageDraw.Draw(img)

    cx = cy = size / 2
    # Circle radius and stroke proportions tuned to read well at 16px.
    radius = size * 0.30
    stroke = max(2, int(round(size * 0.085)))

    # Arc spans: leave a gap at the top-right where the arrowhead sits.
    # PIL angles: 0deg = 3 o'clock, increasing clockwise.
    start_angle = -60   # just past 12 o'clock, slightly clockwise
    end_angle = 250     # almost full loop

    bbox = (cx - radius, cy - radius, cx + radius, cy + radius)
    draw.arc(bbox, start=start_angle, end=end_angle, fill=WHITE, width=stroke)

    # Arrowhead: triangle at the arc's start point (where the gap is),
    # pointing in the direction of rotation (clockwise -> tangent points
    # roughly down-right at the top of the circle).
    angle_rad = math.radians(start_angle)
    tip_x = cx + radius * math.cos(angle_rad)
    tip_y = cy + radius * math.sin(angle_rad)

    # Tangent direction (clockwise): rotate radial vector +90deg
    tan_x = -math.sin(angle_rad)
    tan_y = math.cos(angle_rad)
    # Outward normal
    nor_x = math.cos(angle_rad)
    nor_y = math.sin(angle_rad)

    head = size * 0.18  # triangle "length" along tangent
    width = size * 0.16  # base width across the tangent

    # Tip points along +tangent (direction of motion)
    p_tip = (tip_x + tan_x * head, tip_y + tan_y * head)
    # Base corners straddle the arc end perpendicular to tangent
    p_left = (tip_x + nor_x * width / 2, tip_y + nor_y * width / 2)
    p_right = (tip_x - nor_x * width / 2, tip_y - nor_y * width / 2)

    draw.polygon([p_tip, p_left, p_right], fill=WHITE)
    return img


def make_icon(size):
    base = gradient_rounded_square(size)
    return draw_refresh_arrow(base)


for s in (16, 48, 128):
    icon = make_icon(s)
    icon.save(os.path.join(OUT_DIR, f"icon{s}.png"))
    print(f"wrote icon{s}.png")
