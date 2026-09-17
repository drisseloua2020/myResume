from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import math
import textwrap


ROOT = Path(__file__).resolve().parent
OUT = ROOT / "improvement_page_proposal.png"
W, H = 1700, 1320

COLORS = {
    "bg": "#f5f7fa",
    "white": "#ffffff",
    "ink": "#0f172a",
    "muted": "#64748b",
    "line": "#dbe3ef",
    "soft": "#eef4fb",
    "nav": "#243449",
    "blue": "#2563eb",
    "teal": "#0d9488",
    "green": "#059669",
    "amber": "#f59e0b",
    "red": "#ef4444",
    "slate": "#334155",
}


def font(size, bold=False):
    base = "C:/Windows/Fonts/"
    name = "seguisb.ttf" if bold else "segoeui.ttf"
    return ImageFont.truetype(base + name, size)


F = {
    "xs": font(16, True),
    "sm": font(19),
    "sm_b": font(19, True),
    "md": font(24),
    "md_b": font(24, True),
    "lg": font(32, True),
    "xl": font(44, True),
    "num": font(38, True),
}


img = Image.new("RGB", (W, H), COLORS["bg"])
draw = ImageDraw.Draw(img)


def rounded(xy, r=14, fill=COLORS["white"], outline=COLORS["line"], width=2):
    draw.rounded_rectangle(xy, radius=r, fill=fill, outline=outline, width=width)


def text(x, y, s, f="sm", fill=COLORS["ink"]):
    draw.text((x, y), s, font=F[f], fill=fill)


def wrap_text(s, width):
    return textwrap.wrap(s, width=width)


def paragraph(x, y, s, width_chars=46, f="sm", fill=COLORS["muted"], line=29):
    for i, row in enumerate(wrap_text(s, width_chars)):
        text(x, y + i * line, row, f, fill)
    return y + max(1, len(wrap_text(s, width_chars))) * line


def badge(x, y, label, fill="#eff6ff", fg=COLORS["blue"]):
    tw = draw.textbbox((0, 0), label, font=F["xs"])[2]
    rounded((x, y, x + tw + 26, y + 34), r=8, fill=fill, outline=fill, width=1)
    text(x + 13, y + 7, label, "xs", fg)
    return x + tw + 36


def progress_ring(cx, cy, value, color, label=None, radius=55):
    draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill="#e2e8f0")
    start = -90
    end = start + 360 * value / 100
    draw.pieslice((cx - radius, cy - radius, cx + radius, cy + radius), start=start, end=end, fill=color)
    inner = radius - 17
    draw.ellipse((cx - inner, cy - inner, cx + inner, cy + inner), fill=COLORS["white"])
    value_text = f"{value}%"
    bbox = draw.textbbox((0, 0), value_text, font=F["md_b"])
    draw.text((cx - (bbox[2] - bbox[0]) / 2, cy - 18), value_text, font=F["md_b"], fill=COLORS["ink"])
    if label:
        bbox = draw.textbbox((0, 0), label, font=F["xs"])
        draw.text((cx - (bbox[2] - bbox[0]) / 2, cy + 12), label, font=F["xs"], fill=COLORS["muted"])


def score_card(x, y, w, h, title, value, desc, color):
    rounded((x, y, x + w, y + h), r=14)
    text(x + 24, y + 24, title.upper(), "xs", COLORS["blue"])
    paragraph(x + 24, y + 61, desc, width_chars=20, f="sm", line=28)
    progress_ring(x + w - 72, y + 78, value, color, radius=52)


def metric_bar(x, y, label, value, color):
    text(x, y, label, "sm_b")
    pct = f"{value}%"
    tw = draw.textbbox((0, 0), pct, font=F["sm_b"])[2]
    text(x + 190 - tw, y, pct, "sm_b", color)
    rounded((x, y + 34, x + 190, y + 45), r=6, fill="#e2e8f0", outline="#e2e8f0", width=1)
    rounded((x, y + 34, x + int(190 * value / 100), y + 45), r=6, fill=color, outline=color, width=1)


def line_chart(x, y, w, h, title, desc, points, color):
    rounded((x, y, x + w, y + h), r=14)
    text(x + 24, y + 22, title.upper(), "xs", COLORS["blue"])
    paragraph(x + 24, y + 55, desc, width_chars=44, f="sm", line=28)
    left, top = x + 34, y + 128
    cw, ch = w - 68, h - 170
    for tick in range(0, 101, 25):
        yy = top + ch - (tick / 100) * ch
        draw.line((left, yy, left + cw, yy), fill="#e2e8f0", width=1)
    coords = []
    for i, (label, val) in enumerate(points):
        xx = left + (cw * i / (len(points) - 1))
        yy = top + ch - (val / 100) * ch
        coords.append((xx, yy, label, val))
    for a, b in zip(coords, coords[1:]):
        draw.line((a[0], a[1], b[0], b[1]), fill=color, width=7)
    for xx, yy, label, val in coords:
        draw.ellipse((xx - 8, yy - 8, xx + 8, yy + 8), fill=COLORS["white"], outline=color, width=4)
        bbox = draw.textbbox((0, 0), label, font=F["xs"])
        draw.text((xx - (bbox[2] - bbox[0]) / 2, y + h - 34), label, font=F["xs"], fill=COLORS["muted"])


def tab_button(x, y, label, active=False):
    tw = draw.textbbox((0, 0), label, font=F["sm_b"])[2]
    fill = COLORS["white"] if active else "#eef2f7"
    fg = COLORS["blue"] if active else COLORS["muted"]
    rounded((x, y, x + tw + 28, y + 40), r=9, fill=fill, outline="#eef2f7", width=1)
    text(x + 14, y + 9, label, "sm_b", fg)
    return x + tw + 38


# Top navigation
draw.rectangle((0, 0, W, 72), fill=COLORS["nav"])
rounded((42, 18, 78, 54), r=8, fill=COLORS["blue"], outline=COLORS["blue"], width=1)
text(50, 24, "My", "sm_b", COLORS["white"])
text(92, 22, "Resumes", "md_b", COLORS["white"])
nav_x = 280
for label in ["All Resumes", "Resume Editor", "Improvements", "Analysis", "Jobs", "Auto-Apply", "Approval"]:
    fill = COLORS["white"] if label == "Improvements" else "#cbd5e1"
    text(nav_x, 25, label, "sm_b", fill)
    nav_x += draw.textbbox((0, 0), label, font=F["sm_b"])[2] + 38

# Layout columns
left_x, left_w = 38, 250
main_x, main_w = 318, 980
right_x, right_w = 1328, 334
top_y = 104

# Left metric rail
rounded((left_x, top_y, left_x + left_w, 1228), r=16)
text(left_x + 24, top_y + 24, "SCORES", "xs", COLORS["blue"])
metric_bar(left_x + 24, top_y + 72, "Profile", 82, COLORS["teal"])
metric_bar(left_x + 24, top_y + 148, "Resume", 76, COLORS["amber"])
metric_bar(left_x + 24, top_y + 224, "Application", 64, COLORS["red"])
draw.line((left_x + 24, top_y + 304, left_x + left_w - 24, top_y + 304), fill=COLORS["line"], width=2)
text(left_x + 24, top_y + 334, "REVIEW MODE", "xs", COLORS["blue"])
paragraph(left_x + 24, top_y + 371, "The journey menu is removed. The left column now keeps only high-signal completion metrics.", 23, "sm", COLORS["muted"], 28)
badge(left_x + 24, top_y + 475, "Cleaner left rail", "#ecfeff", COLORS["teal"])

# Main header
rounded((main_x, top_y, main_x + main_w, 236), r=16, fill=COLORS["nav"], outline=COLORS["nav"], width=1)
text(main_x + 28, top_y + 24, "RESUME IMPROVEMENTS", "xs", "#bfdbfe")
text(main_x + 28, top_y + 55, "Improve the profile, resume, and application readiness.", "lg", COLORS["white"])
paragraph(main_x + 28, top_y + 101, "A dashboard-style Improvement page that turns resume inputs into completion scores, recommended fixes, keyword coverage, and application preflight checks.", 78, "sm", "#dbeafe", 28)
rounded((main_x + main_w - 116, top_y + 42, main_x + main_w - 32, top_y + 92), r=10, fill=COLORS["white"], outline=COLORS["white"], width=1)
text(main_x + main_w - 88, top_y + 54, "Fix", "md_b", COLORS["nav"])

# Score cards
card_y = 260
score_card(main_x, card_y, 310, 155, "Profile completion", 82, "Identity, contact, target direction, summary, skills, and career evidence.", COLORS["teal"])
score_card(main_x + 335, card_y, 310, 155, "Resume completion", 76, "Required sections, structure, role focus, and visible proof.", COLORS["amber"])
score_card(main_x + 670, card_y, 310, 155, "Application", 64, "How close this profile is to a safe first application batch.", COLORS["red"])

# Profile overview
overview_y = 440
rounded((main_x, overview_y, main_x + main_w, 650), r=16)
text(main_x + 24, overview_y + 22, "HIGH-LEVEL PROFILE OVERVIEW", "xs", COLORS["blue"])
text(main_x + 24, overview_y + 56, "Alex Resume", "lg")
paragraph(main_x + 24, overview_y + 100, "Support-focused technical profile with API troubleshooting, SQL, documentation, and customer issue resolution signals. Needs stronger quantified outcomes before a broad apply batch.", 84, "sm", COLORS["muted"], 28)
bx, by = main_x + 24, overview_y + 158
items = [("Target role", "Application Support Analyst"), ("Saved resumes", "4"), ("Experience", "3 entries"), ("Visible skills", "9"), ("Education", "State University"), ("Contact", "Ready")]
for i, (k, v) in enumerate(items):
    x = bx + (i % 3) * 310
    y = by + (i // 3) * 72
    rounded((x, y, x + 288, y + 58), r=10, fill="#f8fafc")
    text(x + 14, y + 9, k.upper(), "xs", COLORS["muted"])
    text(x + 14, y + 30, v, "sm_b", COLORS["ink"])

# Charts
line_chart(main_x, 676, 475, 260, "Cumulative resume creation", "Progress from profile basics to a ready resume.", [("ID", 88), ("Role", 74), ("Exp", 62), ("Skills", 86), ("Ready", 76)], COLORS["blue"])
line_chart(main_x + 505, 676, 475, 260, "Cumulative improvement", "Lift from baseline content into proof, keywords, and application readiness.", [("Base", 48), ("Profile", 82), ("Resume", 76), ("Proof", 58), ("Apply", 64)], COLORS["teal"])

# Workbench
work_y = 962
rounded((main_x, work_y, main_x + main_w, 1128), r=16)
text(main_x + 24, work_y + 20, "IMPROVEMENT WORKBENCH", "xs", COLORS["blue"])
text(main_x + 24, work_y + 52, "Plan, tune, check, and batch.", "md_b")
tx = main_x + 540
for i, label in enumerate(["Fix plan", "Keywords", "Sections", "Batch"]):
    tx = tab_button(tx, work_y + 24, label, active=i == 0)
actions = [
    ("Add one measurable outcome", "High impact", "Needs evidence"),
    ("Tune resume to target role", "High impact", "Ready to tune"),
    ("Expand role-matched skills", "Medium impact", "Needs keywords"),
]
ax = main_x + 24
for i, (title, impact, status) in enumerate(actions):
    x = ax + i * 310
    rounded((x, work_y + 96, x + 290, work_y + 146), r=10, fill="#f8fafc")
    text(x + 14, work_y + 106, title, "sm_b")
    badge(x + 14, work_y + 135, impact, "#fee2e2" if "High" in impact else "#fef3c7", COLORS["red"] if "High" in impact else COLORS["amber"])
    badge(x + 142, work_y + 135, status, "#eff6ff", COLORS["blue"])

# Right rail
rounded((right_x, top_y, right_x + right_w, 1290), r=16)
text(right_x + 24, top_y + 24, "APPLICATION READINESS", "xs", COLORS["blue"])
progress_ring(right_x + 95, top_y + 116, 64, COLORS["red"], label="Ready", radius=60)
paragraph(right_x + 24, top_y + 198, "Needs stronger resume proof before broad applications. Keep applications focused until blockers are fixed.", 31, "sm", COLORS["muted"], 28)
draw.line((right_x + 24, top_y + 330, right_x + right_w - 24, top_y + 330), fill=COLORS["line"], width=2)
text(right_x + 24, top_y + 360, "SUGGESTED JOB TARGETS", "xs", COLORS["blue"])
yy = top_y + 400
for label, c, fg in [
    ("Application Support Analyst", "#eff6ff", COLORS["blue"]),
    ("Technical Support Specialist", "#f8fafc", COLORS["slate"]),
    ("Customer Support Engineer", "#f8fafc", COLORS["slate"]),
    ("Junior QA Analyst", "#f8fafc", COLORS["slate"]),
]:
    badge(right_x + 24, yy, label, c, fg)
    yy += 44
draw.line((right_x + 24, yy + 16, right_x + right_w - 24, yy + 16), fill=COLORS["line"], width=2)
text(right_x + 24, yy + 48, "PREFLIGHT CHECKS", "xs", COLORS["blue"])
yy += 88
checks = [("Profile above 70%", True), ("Resume above 70%", True), ("Target role selected", True), ("Measurable proof", False), ("Job post attached", False)]
for label, ready in checks:
    rounded((right_x + 24, yy, right_x + right_w - 24, yy + 48), r=10, fill="#f8fafc")
    text(right_x + 40, yy + 12, label, "sm_b")
    badge(right_x + right_w - 105, yy + 8, "Ready" if ready else "Fix", "#dcfce7" if ready else "#fef3c7", COLORS["green"] if ready else COLORS["amber"])
    yy += 60
draw.line((right_x + 24, yy + 8, right_x + right_w - 24, yy + 8), fill=COLORS["line"], width=2)
text(right_x + 24, yy + 40, "RECOMMENDED BATCH", "xs", COLORS["blue"])
text(right_x + 24, yy + 74, "3-5 roles", "num")
paragraph(right_x + 24, yy + 124, "Small test batch. Apply only to close-fit roles while tightening proof and keywords.", 30, "sm", COLORS["muted"], 28)

img.save(OUT)
print(OUT)
