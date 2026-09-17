from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import textwrap

import nexlink_top_menu_proposal as p


OUT_DIR = Path(__file__).resolve().parent / "nexlink_top_menu_refined"
OUT_DIR.mkdir(exist_ok=True)

W, H = p.W, p.H
NAVY = p.NAVY
NAVY_2 = p.NAVY_2
BG = "#f5f7fb"
CARD = "#ffffff"
LINE = "#e6ebf2"
TEXT = "#263445"
MUTED = "#78869a"
BLUE = NAVY
TEAL = "#15a297"
GREEN = "#20b26b"
AMBER = "#f4a62a"
RED = "#f05252"


def font(size, bold=False):
    # Render with the closest local sans fallback; implementation target is Instrument Sans.
    base = "C:/Windows/Fonts/"
    return ImageFont.truetype(base + ("seguisb.ttf" if bold else "segoeui.ttf"), size)


F = {
    "tiny": font(10, True),
    "xs": font(11, True),
    "sm": font(12),
    "sm_b": font(12, True),
    "md": font(15),
    "md_b": font(15, True),
    "lg": font(20, True),
    "xl": font(27, True),
    "num": font(24, True),
}


def make_canvas():
    return Image.new("RGB", (W, H), BG)


def rounded(draw, xy, r=8, fill=CARD, outline=LINE, width=1):
    draw.rounded_rectangle(xy, radius=r, fill=fill, outline=outline, width=width)


def text(draw, x, y, s, key="sm", fill=TEXT):
    draw.text((x, y), str(s), font=F[key], fill=fill)


def wrapped(draw, x, y, s, width=44, key="sm", fill=MUTED, line=18):
    rows = textwrap.wrap(str(s), width=width)
    for i, row in enumerate(rows):
        text(draw, x, y + i * line, row, key, fill)
    return y + max(1, len(rows)) * line


def badge(draw, x, y, label, bg="#eef3f8", fg=BLUE):
    tw = draw.textbbox((0, 0), label, font=F["tiny"])[2]
    rounded(draw, (x, y, x + tw + 18, y + 22), 6, bg, bg)
    text(draw, x + 9, y + 5, label, "tiny", fg)
    return x + tw + 24


def action_button(draw, x, y):
    rounded(draw, (x, y, x + 24, y + 24), 7, "#eef3f8", "#eef3f8")
    text(draw, x + 8, y + 2, "⋯", "sm_b", "#738095")


def metric(draw, x, y, w, title, value, delta, color=BLUE):
    rounded(draw, (x, y, x + w, y + 104), 9)
    text(draw, x + 16, y + 16, title.upper(), "tiny", BLUE)
    action_button(draw, x + w - 40, y + 14)
    text(draw, x + 16, y + 43, value, "num")
    badge(draw, x + 16, y + 76, delta, "#eaf8f0" if "+" in str(delta) else "#fff6e6", GREEN if "+" in str(delta) else AMBER)


def bar(draw, x, y, w, label, value, color=BLUE):
    text(draw, x, y, label, "sm_b")
    text(draw, x + w - 32, y, f"{value}%", "tiny", color)
    rounded(draw, (x, y + 22, x + w, y + 29), 4, "#e7edf4", "#e7edf4")
    rounded(draw, (x, y + 22, x + int(w * value / 100), y + 29), 4, color, color)


def ring(draw, cx, cy, value, color, label=""):
    r = 34
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill="#e7edf4")
    draw.pieslice((cx - r, cy - r, cx + r, cy + r), -90, -90 + 360 * value / 100, fill=color)
    draw.ellipse((cx - r + 11, cy - r + 11, cx + r - 11, cy + r - 11), fill=CARD)
    bbox = draw.textbbox((0, 0), f"{value}%", font=F["md_b"])
    text(draw, cx - (bbox[2] - bbox[0]) / 2, cy - 13, f"{value}%", "md_b")
    if label:
        bbox = draw.textbbox((0, 0), label, font=F["tiny"])
        text(draw, cx - (bbox[2] - bbox[0]) / 2, cy + 9, label, "tiny", MUTED)


def sparkline(draw, x, y, w, h, values, color=BLUE):
    for tick in range(0, 101, 25):
        yy = y + h - tick / 100 * h
        draw.line((x, yy, x + w, yy), fill="#edf1f6", width=1)
    pts = []
    for i, value in enumerate(values):
        px = x + i * (w / (len(values) - 1))
        py = y + h - (value / 100) * h
        pts.append((px, py))
    for a, b in zip(pts, pts[1:]):
        draw.line((a[0], a[1], b[0], b[1]), fill=color, width=3)
    for px, py in pts:
        draw.ellipse((px - 3, py - 3, px + 3, py + 3), fill=CARD, outline=color, width=2)


def table(draw, x, y, w, rows, headers):
    row_h = 40
    rounded(draw, (x, y, x + w, y + 42 + len(rows) * row_h), 9)
    col_w = w / len(headers)
    for i, head in enumerate(headers):
        text(draw, x + 16 + i * col_w, y + 15, head.upper(), "tiny", MUTED)
    draw.line((x + 12, y + 42, x + w - 12, y + 42), fill=LINE, width=1)
    for r, row in enumerate(rows):
        yy = y + 54 + r * row_h
        if r % 2:
            rounded(draw, (x + 10, yy - 8, x + w - 10, yy + 22), 5, "#fbfcfe", "#fbfcfe")
        for i, cell in enumerate(row):
            text(draw, x + 16 + i * col_w, yy, cell, "sm_b" if i == 0 else "sm", TEXT if i == 0 else MUTED)


def draw_top_shell(active, page_title, crumb, admin=False):
    img = make_canvas()
    draw = ImageDraw.Draw(img)
    top_h = 62
    draw.rectangle((0, 0, W, top_h), fill=NAVY)
    rounded(draw, (38, 16, 66, 44), 7, "#2f75ff", "#2f75ff")
    text(draw, 45, 22, "My", "xs", CARD)
    text(draw, 78, 21, "Resumes", "md_b", CARD)

    nav = p.ADMIN_NAV if admin else p.USER_NAV
    nav_x = 258
    for label in nav:
        tw = draw.textbbox((0, 0), label, font=F["sm_b"])[2]
        if label == active:
            rounded(draw, (nav_x - 9, 18, nav_x + tw + 10, 44), 7, CARD, CARD)
            text(draw, nav_x, 25, label, "sm_b", NAVY)
        else:
            text(draw, nav_x, 25, label, "sm_b", "#dbe4ee")
        nav_x += tw + 30

    rounded(draw, (W - 332, 16, W - 168, 44), 14, "#40536a", "#40536a")
    text(draw, W - 312, 23, "Today New Leads 27", "tiny", "#e7eef7")
    rounded(draw, (W - 152, 16, W - 112, 44), 14, "#40536a", "#40536a")
    text(draw, W - 139, 23, "9", "xs", "#fff2cc")
    rounded(draw, (W - 82, 16, W - 54, 44), 14, CARD, CARD)
    text(draw, W - 73, 21, "R", "xs", NAVY)

    x, y, w = 40, top_h + 24, W - 80
    text(draw, x, y, page_title, "md_b")
    text(draw, x, y + 22, f"Home / {crumb}", "tiny", MUTED)
    rounded(draw, (x + 380, y - 2, x + 710, y + 28), 15, "#eef2f7", "#eef2f7")
    text(draw, x + 404, y + 7, "Search resumes, jobs, packets...", "sm", "#8794a5")
    return img, draw, x, y + 58, w


def install_refined_tokens():
    p.OUT_DIR = OUT_DIR
    p.BG = BG
    p.CARD = CARD
    p.LINE = LINE
    p.TEXT = TEXT
    p.MUTED = MUTED
    p.BLUE = BLUE
    p.TEAL = TEAL
    p.GREEN = GREEN
    p.AMBER = AMBER
    p.RED = RED
    p.F = F
    p.make_canvas = make_canvas
    p.rounded = rounded
    p.text = text
    p.wrapped = wrapped
    p.badge = badge
    p.metric = metric
    p.bar = bar
    p.ring = ring
    p.sparkline = sparkline
    p.table = table
    p.draw_top_shell = draw_top_shell


def make_contact_sheet(generated):
    thumb_w, thumb_h = 500, 325
    sheet_w, sheet_h = 1680, 1420
    sheet = Image.new("RGB", (sheet_w, sheet_h), BG)
    draw = ImageDraw.Draw(sheet)
    text(draw, 48, 34, "NexLink-accurate top-menu UX proposal", "xl")
    wrapped(
        draw,
        48,
        82,
        "Refined to match NexLink's dashboard details more closely: Instrument Sans target, compact Bootstrap-style type scale, small pill badges, subtle card borders, dense tables, tiny action buttons, and the current navy color replacing the template accent.",
        145,
        "sm",
        MUTED,
        20,
    )
    badge(draw, 48, 132, "Font target: Instrument Sans", "#e8f0f8", NAVY)
    badge(draw, 252, 132, "Compact NexLink density", "#eff6ff", NAVY)
    badge(draw, 454, 132, "Original top menu retained", "#f8fafc", MUTED)
    start_y = 190
    for i, (path, label) in enumerate(generated):
        col = i % 3
        row = i // 3
        x = 48 + col * 535
        y = start_y + row * 390
        rounded(draw, (x, y, x + thumb_w + 18, y + thumb_h + 54), 12)
        img = Image.open(path).resize((thumb_w, thumb_h))
        sheet.paste(img, (x + 9, y + 44))
        text(draw, x + 18, y + 15, f"{i + 1:02d}. {label}", "md_b")
    out = OUT_DIR / "top_menu_refined_contact_sheet.png"
    sheet.save(out)
    return out


if __name__ == "__main__":
    install_refined_tokens()
    generated = []
    for filename, label, maker in p.SCREENS:
        refined_name = filename.replace("top_menu_", "top_menu_refined_")
        out = OUT_DIR / refined_name
        maker().save(out)
        generated.append((out, label))
    contact = make_contact_sheet(generated)
    print(contact)
    for path, _ in generated:
        print(path)
