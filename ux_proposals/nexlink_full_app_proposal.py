from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import textwrap


ROOT = Path(__file__).resolve().parent
OUT_DIR = ROOT / "nexlink_refactor"
OUT_DIR.mkdir(exist_ok=True)

W, H = 1600, 1040
NAVY = "#2e3d50"
NAVY_2 = "#243449"
BG = "#f6f8fb"
CARD = "#ffffff"
LINE = "#dce4ef"
TEXT = "#111827"
MUTED = "#64748b"
SOFT = "#eef3f8"
BLUE = "#2563eb"
TEAL = "#0d9488"
GREEN = "#059669"
AMBER = "#f59e0b"
RED = "#ef4444"


def font(size, bold=False):
    base = "C:/Windows/Fonts/"
    return ImageFont.truetype(base + ("seguisb.ttf" if bold else "segoeui.ttf"), size)


F = {
    "tiny": font(13, True),
    "xs": font(15, True),
    "sm": font(17),
    "sm_b": font(17, True),
    "md": font(22),
    "md_b": font(22, True),
    "lg": font(30, True),
    "xl": font(40, True),
    "num": font(34, True),
}


def make_canvas():
    return Image.new("RGB", (W, H), BG)


def rounded(draw, xy, r=14, fill=CARD, outline=LINE, width=1):
    draw.rounded_rectangle(xy, radius=r, fill=fill, outline=outline, width=width)


def text(draw, x, y, s, key="sm", fill=TEXT):
    draw.text((x, y), str(s), font=F[key], fill=fill)


def wrapped(draw, x, y, s, width=44, key="sm", fill=MUTED, line=25):
    rows = textwrap.wrap(str(s), width=width)
    for i, row in enumerate(rows):
        text(draw, x, y + i * line, row, key, fill)
    return y + max(1, len(rows)) * line


def badge(draw, x, y, label, bg="#eff6ff", fg=BLUE):
    w = draw.textbbox((0, 0), label, font=F["tiny"])[2] + 24
    rounded(draw, (x, y, x + w, y + 30), 8, bg, bg)
    text(draw, x + 12, y + 6, label, "tiny", fg)
    return x + w + 8


def metric(draw, x, y, w, title, value, delta, color=BLUE):
    rounded(draw, (x, y, x + w, y + 132), 14)
    text(draw, x + 18, y + 18, title.upper(), "tiny", BLUE)
    text(draw, x + 18, y + 48, value, "num")
    badge(draw, x + 18, y + 92, delta, "#e8f7ef" if "+" in delta else "#fff7ed", GREEN if "+" in delta else AMBER)
    rounded(draw, (x + w - 58, y + 22, x + w - 20, y + 60), 10, "#edf2f7", "#edf2f7")
    draw.text((x + w - 47, y + 27), "•", font=F["md_b"], fill=color)


def bar(draw, x, y, w, label, value, color=BLUE):
    text(draw, x, y, label, "sm_b")
    text(draw, x + w - 45, y, f"{value}%", "sm_b", color)
    rounded(draw, (x, y + 28, x + w, y + 38), 5, "#e5eaf1", "#e5eaf1")
    rounded(draw, (x, y + 28, x + int(w * value / 100), y + 38), 5, color, color)


def ring(draw, cx, cy, value, color, label=""):
    r = 44
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill="#e5eaf1")
    draw.pieslice((cx - r, cy - r, cx + r, cy + r), -90, -90 + 360 * value / 100, fill=color)
    draw.ellipse((cx - r + 14, cy - r + 14, cx + r - 14, cy + r - 14), fill=CARD)
    bbox = draw.textbbox((0, 0), f"{value}%", font=F["md_b"])
    text(draw, cx - (bbox[2] - bbox[0]) / 2, cy - 17, f"{value}%", "md_b")
    if label:
        bbox = draw.textbbox((0, 0), label, font=F["tiny"])
        text(draw, cx - (bbox[2] - bbox[0]) / 2, cy + 12, label, "tiny", MUTED)


def sparkline(draw, x, y, w, h, values, color=BLUE):
    pts = []
    for i, value in enumerate(values):
        px = x + i * (w / (len(values) - 1))
        py = y + h - (value / 100) * h
        pts.append((px, py))
    for a, b in zip(pts, pts[1:]):
        draw.line((a[0], a[1], b[0], b[1]), fill=color, width=4)
    for px, py in pts:
        draw.ellipse((px - 4, py - 4, px + 4, py + 4), fill=CARD, outline=color, width=3)


def table(draw, x, y, w, rows, headers):
    rounded(draw, (x, y, x + w, y + 48 + len(rows) * 52), 14)
    col_w = w / len(headers)
    for i, head in enumerate(headers):
        text(draw, x + 18 + i * col_w, y + 17, head.upper(), "tiny", MUTED)
    draw.line((x + 14, y + 48, x + w - 14, y + 48), fill=LINE, width=1)
    for r, row in enumerate(rows):
        yy = y + 58 + r * 52
        for i, cell in enumerate(row):
            text(draw, x + 18 + i * col_w, yy, cell, "sm_b" if i == 0 else "sm", TEXT if i == 0 else MUTED)


def draw_shell(active, page_title, crumb):
    img = make_canvas()
    draw = ImageDraw.Draw(img)
    sidebar_w = 252
    top_h = 76
    draw.rectangle((0, 0, sidebar_w, H), fill=NAVY_2)
    rounded(draw, (22, 22, 58, 58), 10, BLUE, BLUE)
    text(draw, 31, 29, "My", "sm_b", CARD)
    text(draw, 72, 28, "Resumes", "md_b", CARD)
    nav = [
        ("Workspace", ["All Resumes", "Resume Editor", "Improvements", "Analysis"]),
        ("Applications", ["Jobs", "Auto-Apply", "Approval"]),
        ("Admin", ["Overview", "Users", "Features", "Automation", "Audit"]),
    ]
    y = 100
    for group, items in nav:
        text(draw, 28, y, group.upper(), "tiny", "#93a4b8")
        y += 34
        for item in items:
            is_active = item == active
            fill = CARD if is_active else NAVY_2
            fg = NAVY if is_active else "#cbd5e1"
            rounded(draw, (18, y - 4, sidebar_w - 18, y + 36), 10, fill, fill)
            draw.text((32, y + 5), "●", font=F["tiny"], fill=BLUE if is_active else "#7b8fa6")
            text(draw, 56, y + 2, item, "sm_b", fg)
            y += 46
        y += 16
    rounded(draw, (22, H - 178, sidebar_w - 22, H - 34), 14, "#33475f", "#33475f")
    text(draw, 42, H - 154, "Upgrade to Pro", "sm_b", CARD)
    wrapped(draw, 42, H - 126, "Unlimited resumes, job matching, and application packet review.", 22, "tiny", "#dbe7f3", 20)
    badge(draw, 42, H - 70, "Upgrade", "#e8f0f8", NAVY)

    draw.rectangle((sidebar_w, 0, W, top_h), fill=CARD)
    draw.line((sidebar_w, top_h, W, top_h), fill=LINE, width=1)
    text(draw, sidebar_w + 34, 18, page_title, "md_b")
    text(draw, sidebar_w + 34, 47, f"Home / {crumb}", "tiny", MUTED)
    rounded(draw, (sidebar_w + 430, 18, sidebar_w + 780, 56), 18, "#f2f5f8", "#f2f5f8")
    text(draw, sidebar_w + 455, 28, "Search resumes, jobs, packets...", "sm", "#8a99aa")
    badge(draw, W - 392, 23, "Today New Leads 27", "#eef6ff", BLUE)
    badge(draw, W - 228, 23, "New alerts", "#fff7ed", AMBER)
    rounded(draw, (W - 72, 18, W - 34, 56), 19, NAVY, NAVY)
    text(draw, W - 60, 26, "R", "sm_b", CARD)
    return img, draw, sidebar_w + 30, top_h + 28, W - sidebar_w - 60


def screen_onboarding():
    img, draw, x, y, w = draw_shell("Resume Editor", "Career Profile Setup", "Onboarding")
    rounded(draw, (x, y, x + w, y + 142), 16, NAVY, NAVY)
    text(draw, x + 26, y + 24, "PROFILE WIZARD", "tiny", "#cfe2ff")
    text(draw, x + 26, y + 58, "Build the profile foundation before editing.", "xl", CARD)
    badge(draw, x + w - 168, y + 46, "Step 3 of 5", CARD, NAVY)
    yy = y + 172
    metric(draw, x, yy, 290, "Profile completion", "64%", "+18%")
    metric(draw, x + 315, yy, 290, "Inputs captured", "12", "+4")
    metric(draw, x + 630, yy, 290, "Resume imported", "1", "+1")
    rounded(draw, (x, yy + 164, x + 590, yy + 502), 16)
    text(draw, x + 24, yy + 188, "CURRENT FOCUS", "tiny", BLUE)
    text(draw, x + 24, yy + 222, "What type of role are you targeting?", "lg")
    for i, label in enumerate(["Technical Support", "Application Support", "Junior QA", "Customer Success"]):
        rounded(draw, (x + 24, yy + 282 + i * 50, x + 540, yy + 322 + i * 50), 10, "#f8fafc")
        text(draw, x + 44, yy + 292 + i * 50, label, "sm_b")
        badge(draw, x + 430, yy + 287 + i * 50, "Select", "#eff6ff", BLUE)
    rounded(draw, (x + 620, yy + 164, x + w, yy + 502), 16)
    text(draw, x + 646, yy + 188, "UPLOAD AND SCAN", "tiny", BLUE)
    text(draw, x + 646, yy + 222, "Resume intake", "lg")
    wrapped(draw, x + 646, yy + 268, "Drag in a resume, import LinkedIn data, or continue with manual profile answers.", 48)
    ring(draw, x + w - 130, yy + 252, 72, TEAL, "Scan")
    bar(draw, x + 646, yy + 366, 340, "Contact details", 90, GREEN)
    bar(draw, x + 646, yy + 426, 340, "Career direction", 58, AMBER)
    return img


def screen_resumes():
    img, draw, x, y, w = draw_shell("All Resumes", "Resume Library", "All Resumes")
    metric(draw, x, y, 280, "Saved resumes", "8", "+2.57%")
    metric(draw, x + 305, y, 280, "Shared links", "12", "+4")
    metric(draw, x + 610, y, 280, "Ready to apply", "5", "+15%")
    metric(draw, x + 915, y, 280, "Needs edits", "3", "-1", AMBER)
    rounded(draw, (x, y + 162, x + w, y + 262), 16)
    text(draw, x + 24, y + 190, "Resume search and filters", "lg")
    for i, label in enumerate(["Role", "Template", "Readiness", "Updated", "Shared"]):
        badge(draw, x + 520 + i * 116, y + 196, label, "#f2f5f8", NAVY)
    rows = [
        ["Alex Resume", "Application Support", "82%", "Today", "Active"],
        ["Technical Support v2", "Support Specialist", "76%", "Yesterday", "Draft"],
        ["Customer Engineer", "Support Engineer", "71%", "2 days", "Shared"],
        ["Junior QA", "QA Analyst", "63%", "5 days", "Hold"],
    ]
    table(draw, x, y + 292, w, rows, ["Name", "Target", "Ready", "Updated", "Status"])
    rounded(draw, (x, y + 592, x + w, y + 848), 16)
    text(draw, x + 24, y + 618, "Template performance", "lg")
    sparkline(draw, x + 42, y + 696, 520, 90, [45, 58, 52, 74, 82, 76], TEAL)
    for i, label in enumerate(["Modern Tech", "Classic Pro", "ATS Simple"]):
        bar(draw, x + 650, y + 674 + i * 62, 420, label, [82, 76, 68][i], [GREEN, BLUE, AMBER][i])
    return img


def screen_editor():
    img, draw, x, y, w = draw_shell("Resume Editor", "Resume Editor", "Editor")
    rounded(draw, (x, y, x + w, y + 116), 16, NAVY, NAVY)
    text(draw, x + 26, y + 24, "EDITOR WORKBENCH", "tiny", "#cfe2ff")
    text(draw, x + 26, y + 56, "Edit sections with live readiness.", "xl", CARD)
    badge(draw, x + w - 118, y + 42, "Save", CARD, NAVY)
    left_w = 560
    rounded(draw, (x, y + 146, x + left_w, y + 840), 16)
    text(draw, x + 24, y + 172, "SECTION EDITOR", "tiny", BLUE)
    fields = ["Target role", "Professional summary", "Experience bullet", "Skills group", "Education"]
    for i, field in enumerate(fields):
        yy = y + 218 + i * 104
        text(draw, x + 24, yy, field, "sm_b")
        rounded(draw, (x + 24, yy + 30, x + left_w - 24, yy + 78), 10, "#f8fafc")
        text(draw, x + 44, yy + 43, f"Edit {field.lower()}...", "sm", MUTED)
    rounded(draw, (x + left_w + 26, y + 146, x + w, y + 840), 16)
    text(draw, x + left_w + 52, y + 172, "LIVE PREVIEW", "tiny", BLUE)
    rounded(draw, (x + left_w + 72, y + 224, x + w - 72, y + 792), 8, "#fbfcfe")
    text(draw, x + left_w + 106, y + 262, "Alex Resume", "lg")
    for i, width in enumerate([320, 420, 380, 450, 340, 410]):
        rounded(draw, (x + left_w + 106, y + 326 + i * 42, x + left_w + 106 + width, y + 336 + i * 42), 5, "#dbe5f0", "#dbe5f0")
    ring(draw, x + w - 134, y + 214, 76, AMBER, "Ready")
    return img


def screen_improvements():
    img, draw, x, y, w = draw_shell("Improvements", "Resume Improvements", "Improvements")
    metric(draw, x, y, 280, "Profile", "82%", "+18%")
    metric(draw, x + 305, y, 280, "Resume", "76%", "+12%")
    metric(draw, x + 610, y, 280, "Application", "64%", "+8%", AMBER)
    rounded(draw, (x + 915, y, x + 1195, y + 132), 16)
    ring(draw, x + 1010, y + 66, 64, RED, "Ready")
    text(draw, x + 1082, y + 42, "Fix blockers", "md_b")
    rounded(draw, (x, y + 162, x + w, y + 344), 16)
    text(draw, x + 24, y + 190, "HIGH-LEVEL PROFILE OVERVIEW", "tiny", BLUE)
    text(draw, x + 24, y + 224, "Alex Resume", "lg")
    wrapped(draw, x + 24, y + 267, "Support-focused profile with API troubleshooting, SQL, documentation, and customer issue resolution signals.", 92)
    for i, label in enumerate(["Target role", "Saved resumes", "Experience", "Visible skills"]):
        badge(draw, x + 40 + i * 210, y + 308, label, "#f2f5f8", NAVY)
    rounded(draw, (x, y + 374, x + 590, y + 620), 16)
    text(draw, x + 24, y + 402, "CUMULATIVE RESUME CREATION", "tiny", BLUE)
    sparkline(draw, x + 42, y + 480, 500, 80, [88, 74, 62, 86, 76], BLUE)
    rounded(draw, (x + 620, y + 374, x + w, y + 620), 16)
    text(draw, x + 646, y + 402, "IMPROVEMENT WORKBENCH", "tiny", BLUE)
    for i, label in enumerate(["Fix plan", "Keywords", "Sections", "Batch"]):
        badge(draw, x + 646 + i * 112, y + 452, label, CARD if i == 0 else "#e9eef5", BLUE if i == 0 else MUTED)
    for i, label in enumerate(["Add measurable outcome", "Tune target role", "Expand skills"]):
        rounded(draw, (x + 646, y + 508 + i * 56, x + w - 28, y + 548 + i * 56), 10, "#f8fafc")
        text(draw, x + 666, y + 518 + i * 56, label, "sm_b")
        badge(draw, x + w - 150, y + 513 + i * 56, "Fix", "#fff7ed", AMBER)
    return img


def screen_analysis():
    img, draw, x, y, w = draw_shell("Analysis", "Profile Analysis", "Analysis")
    metric(draw, x, y, 280, "Profile category", "Tech", "+88%")
    metric(draw, x + 305, y, 280, "Resume quality", "78%", "+12%")
    metric(draw, x + 610, y, 280, "Skill coverage", "66%", "-4%", AMBER)
    rounded(draw, (x, y + 162, x + 520, y + 592), 16)
    text(draw, x + 24, y + 190, "PROFILE SUMMARY", "tiny", BLUE)
    text(draw, x + 24, y + 224, "Technical Career Builder", "lg")
    wrapped(draw, x + 24, y + 270, "Best positioned for software, IT, support, cloud, and systems roles.", 47)
    for i, (label, val) in enumerate([("Completeness", 88), ("Bullets", 72), ("Risk safety", 90), ("Skills", 66)]):
        bar(draw, x + 24, y + 370 + i * 58, 420, label, val, [GREEN, AMBER, GREEN, BLUE][i])
    rounded(draw, (x + 550, y + 162, x + w, y + 592), 16)
    text(draw, x + 574, y + 190, "REPORT TABS", "tiny", BLUE)
    for i, label in enumerate(["User profile", "Resume", "Things needed", "Jobs to apply"]):
        badge(draw, x + 574 + i * 146, y + 228, label, CARD if i == 0 else "#e9eef5", BLUE if i == 0 else MUTED)
    table(draw, x + 574, y + 294, 560, [["System design", "2-4 weeks", "Build proof"], ["API support", "1 week", "Rewrite bullets"], ["SQL", "1 week", "Add examples"]], ["Skill", "Timeline", "Action"])
    return img


def screen_jobs():
    img, draw, x, y, w = draw_shell("Jobs", "Jobs To Apply", "Jobs")
    metric(draw, x, y, 280, "Average fit", "78%", "+9%")
    metric(draw, x + 305, y, 280, "Ready now", "5", "+2")
    metric(draw, x + 610, y, 280, "Review", "7", "-1", AMBER)
    rounded(draw, (x, y + 162, x + 480, y + 820), 16)
    text(draw, x + 24, y + 190, "FILTERS", "tiny", BLUE)
    for i, label in enumerate(["Remote", "Support", "SQL", "Entry/Mid", "High fit"]):
        badge(draw, x + 24, y + 230 + i * 48, label, "#f2f5f8", NAVY)
    text(draw, x + 24, y + 520, "Batch builder", "lg")
    ring(draw, x + 124, y + 626, 78, GREEN, "Fit")
    wrapped(draw, x + 210, y + 584, "Select 3-5 close-fit roles before preparing application packets.", 24)
    rows = [["Technical Support Specialist", "82", "Ready"], ["Application Support Analyst", "76", "Tailor"], ["Customer Support Engineer", "72", "Review"], ["Junior QA Analyst", "68", "Hold"]]
    table(draw, x + 510, y + 162, w - 510, rows, ["Role", "Fit", "Status"])
    return img


def screen_auto_apply():
    img, draw, x, y, w = draw_shell("Auto-Apply", "Auto-Apply Preparation", "Auto-Apply")
    metric(draw, x, y, 280, "Packets", "5", "+5")
    metric(draw, x + 305, y, 280, "Questions", "3", "+1", AMBER)
    metric(draw, x + 610, y, 280, "Submissions", "0", "Gate on", BLUE)
    cols = [("Prepare packets", ["Resume version", "Cover note", "Tracker entry"]), ("Resolve questions", ["Salary", "Work auth", "Custom question"]), ("Approval staging", ["Batch 01", "Audit trail", "No submission"])]
    for i, (title, cards) in enumerate(cols):
        cx = x + i * 405
        rounded(draw, (cx, y + 162, cx + 380, y + 760), 16)
        text(draw, cx + 24, y + 190, f"STEP {i + 1}", "tiny", BLUE)
        text(draw, cx + 24, y + 224, title, "lg")
        for j, card in enumerate(cards):
            rounded(draw, (cx + 24, y + 298 + j * 120, cx + 356, y + 386 + j * 120), 12, "#f8fafc")
            text(draw, cx + 44, y + 318 + j * 120, card, "md_b")
            badge(draw, cx + 44, y + 352 + j * 120, ["Ready", "Review", "Blocked"][min(j, 2)], ["#dcfce7", "#fef3c7", "#fee2e2"][min(j, 2)], [GREEN, AMBER, RED][min(j, 2)])
    return img


def screen_approval():
    img, draw, x, y, w = draw_shell("Approval", "Human Approval", "Approval")
    metric(draw, x, y, 280, "Needs approval", "5", "+5")
    metric(draw, x + 305, y, 280, "Safe", "2", "+2")
    metric(draw, x + 610, y, 280, "Risk", "1", "Fix", RED)
    rounded(draw, (x, y + 162, x + 410, y + 820), 16)
    text(draw, x + 24, y + 190, "QUEUE", "tiny", BLUE)
    for i, role in enumerate(["Technical Support Specialist", "Application Support Analyst", "Customer Support Engineer", "Junior QA Analyst"]):
        rounded(draw, (x + 24, y + 230 + i * 104, x + 386, y + 314 + i * 104), 12, "#eff6ff" if i == 0 else "#f8fafc")
        text(draw, x + 44, y + 250 + i * 104, role, "sm_b")
        badge(draw, x + 44, y + 278 + i * 104, ["Safe", "Check", "Input", "Risk"][i], ["#dcfce7", "#fef3c7", "#fef3c7", "#fee2e2"][i], [GREEN, AMBER, AMBER, RED][i])
    rounded(draw, (x + 440, y + 162, x + w, y + 820), 16)
    text(draw, x + 466, y + 190, "SELECTED PACKET", "tiny", BLUE)
    text(draw, x + 466, y + 224, "Technical Support Specialist", "lg")
    for i, title in enumerate(["Resume changes", "Application answers", "Risk check"]):
        rounded(draw, (x + 466, y + 306 + i * 130, x + w - 32, y + 400 + i * 130), 12, "#f8fafc")
        text(draw, x + 488, y + 328 + i * 130, title, "md_b")
        wrapped(draw, x + 488, y + 362 + i * 130, "Show source, change summary, risk, and approval controls before any external submission.", 58, "sm", MUTED, 23)
    return img


def screen_admin():
    img, draw, x, y, w = draw_shell("Overview", "Admin Console", "Admin Overview")
    metric(draw, x, y, 280, "Users", "1,249", "+2.57%")
    metric(draw, x + 305, y, 280, "Approval queue", "19", "+7", AMBER)
    metric(draw, x + 610, y, 280, "Automation", "Gate", "+on", GREEN)
    metric(draw, x + 915, y, 280, "Audit", "100%", "+15%")
    rounded(draw, (x, y + 162, x + 560, y + 604), 16)
    text(draw, x + 24, y + 190, "FEATURE CONTROLS", "tiny", BLUE)
    for i, label in enumerate(["All resumes", "Resume editor", "Improvements", "Analysis", "Jobs", "Auto-apply"]):
        rounded(draw, (x + 24, y + 234 + i * 58, x + 530, y + 276 + i * 58), 10, "#f8fafc")
        text(draw, x + 44, y + 244 + i * 58, label, "sm_b")
        badge(draw, x + 420, y + 239 + i * 58, "On", "#dcfce7", GREEN)
    rows = [["Maya Chen", "Pro", "Active", "Open"], ["Alex Resume", "Free", "Active", "Open"], ["Jordan Lee", "Pro", "Review", "Open"]]
    table(draw, x + 590, y + 162, w - 590, rows, ["User", "Plan", "Status", "Action"])
    rounded(draw, (x + 590, y + 500, x + w, y + 820), 16)
    text(draw, x + 616, y + 528, "ACTIVITY", "tiny", BLUE)
    for i, label in enumerate(["Auto-apply packet uses salary answer", "Resume import scanned", "Profile analysis generated", "Admin changed feature flag"]):
        text(draw, x + 636, y + 576 + i * 52, label, "sm_b")
        badge(draw, x + w - 150, y + 570 + i * 52, "Review" if i == 0 else "Log", "#fef3c7" if i == 0 else "#eff6ff", AMBER if i == 0 else BLUE)
    return img


SCREENS = [
    ("nexlink_01_onboarding.png", "Onboarding", screen_onboarding),
    ("nexlink_02_all_resumes.png", "All Resumes", screen_resumes),
    ("nexlink_03_resume_editor.png", "Resume Editor", screen_editor),
    ("nexlink_04_improvements.png", "Improvements", screen_improvements),
    ("nexlink_05_analysis.png", "Analysis", screen_analysis),
    ("nexlink_06_jobs.png", "Jobs", screen_jobs),
    ("nexlink_07_auto_apply.png", "Auto-Apply", screen_auto_apply),
    ("nexlink_08_approval.png", "Approval", screen_approval),
    ("nexlink_09_admin_console.png", "Admin Console", screen_admin),
]


def make_contact_sheet(generated):
    thumb_w, thumb_h = 500, 325
    sheet_w, sheet_h = 1680, 1420
    sheet = Image.new("RGB", (sheet_w, sheet_h), BG)
    draw = ImageDraw.Draw(sheet)
    text(draw, 48, 34, "NexLink-inspired full-app UX proposal", "xl")
    wrapped(draw, 48, 88, "All primary ResumeForge screens refactored into a CRM-style dashboard system: left navigation, top utility bar, compact cards, tables, progress widgets, notifications, and action panels. Purple accents are replaced with the current navy brand color.", 130, "sm", MUTED, 26)
    badge(draw, 48, 150, "Brand navy rgb(46 61 80)", "#e8f0f8", NAVY)
    badge(draw, 252, 150, "NexLink-style dashboard shell", "#eff6ff", BLUE)
    badge(draw, 492, 150, "Proposal only", "#f8fafc", MUTED)
    start_y = 210
    for i, (path, label) in enumerate(generated):
        col = i % 3
        row = i // 3
        x = 48 + col * 535
        y = start_y + row * 390
        rounded(draw, (x, y, x + thumb_w + 18, y + thumb_h + 54), 18)
        img = Image.open(path).resize((thumb_w, thumb_h))
        sheet.paste(img, (x + 9, y + 44))
        text(draw, x + 18, y + 14, f"{i + 1:02d}. {label}", "md_b")
    out = OUT_DIR / "nexlink_full_app_contact_sheet.png"
    sheet.save(out)
    return out


if __name__ == "__main__":
    generated = []
    for filename, label, maker in SCREENS:
        out = OUT_DIR / filename
        maker().save(out)
        generated.append((out, label))
    contact = make_contact_sheet(generated)
    print(contact)
    for path, _ in generated:
        print(path)
