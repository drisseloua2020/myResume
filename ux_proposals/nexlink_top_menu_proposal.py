from pathlib import Path
from PIL import Image, ImageDraw

from nexlink_full_app_proposal import (
    W,
    H,
    NAVY,
    NAVY_2,
    BG,
    CARD,
    LINE,
    TEXT,
    MUTED,
    BLUE,
    TEAL,
    GREEN,
    AMBER,
    RED,
    F,
    rounded,
    text,
    wrapped,
    badge,
    metric,
    bar,
    ring,
    sparkline,
    table,
)


ROOT = Path(__file__).resolve().parent
OUT_DIR = ROOT / "nexlink_top_menu_refactor"
OUT_DIR.mkdir(exist_ok=True)


USER_NAV = ["All Resumes", "Resume Editor", "Improvements", "Analysis", "Jobs", "Auto-Apply", "Approval"]
ADMIN_NAV = ["Overview", "Users", "Features", "Automation", "Audit"]


def make_canvas():
    return Image.new("RGB", (W, H), BG)


def draw_top_shell(active, page_title, crumb, admin=False):
    img = make_canvas()
    draw = ImageDraw.Draw(img)
    top_h = 76
    draw.rectangle((0, 0, W, top_h), fill=NAVY)
    rounded(draw, (42, 18, 78, 54), 9, BLUE, BLUE)
    text(draw, 50, 25, "My", "sm_b", CARD)
    text(draw, 92, 24, "Resumes", "md_b", CARD)

    nav = ADMIN_NAV if admin else USER_NAV
    nav_x = 280
    for label in nav:
      active_state = label == active
      if active_state:
          rounded(draw, (nav_x - 14, 20, nav_x + draw.textbbox((0, 0), label, font=F["sm_b"])[2] + 16, 56), 10, CARD, CARD)
          text(draw, nav_x, 29, label, "sm_b", NAVY)
      else:
          text(draw, nav_x, 29, label, "sm_b", "#d6dee8")
      nav_x += draw.textbbox((0, 0), label, font=F["sm_b"])[2] + 40

    rounded(draw, (W - 332, 18, W - 156, 56), 18, "#40536a", "#40536a")
    text(draw, W - 308, 28, "Today New Leads 27", "tiny", "#e5edf7")
    rounded(draw, (W - 142, 18, W - 96, 56), 18, "#40536a", "#40536a")
    text(draw, W - 130, 28, "9", "sm_b", "#fef3c7")
    rounded(draw, (W - 76, 18, W - 38, 56), 19, CARD, CARD)
    text(draw, W - 64, 26, "R", "sm_b", NAVY)

    x, y, w = 42, top_h + 28, W - 84
    text(draw, x, y, page_title, "md_b")
    text(draw, x, y + 30, f"Home / {crumb}", "tiny", MUTED)
    rounded(draw, (x + 420, y - 4, x + 790, y + 36), 19, "#eef2f7", "#eef2f7")
    text(draw, x + 448, y + 7, "Search resumes, jobs, packets...", "sm", "#8190a3")
    return img, draw, x, y + 72, w


def top_onboarding():
    img, draw, x, y, w = draw_top_shell("Resume Editor", "Career Profile Setup", "Onboarding")
    rounded(draw, (x, y, x + w, y + 128), 16, NAVY_2, NAVY_2)
    text(draw, x + 26, y + 24, "PROFILE WIZARD", "tiny", "#cfe2ff")
    text(draw, x + 26, y + 56, "Build the profile foundation before editing.", "xl", CARD)
    badge(draw, x + w - 150, y + 44, "Step 3 of 5", CARD, NAVY)
    yy = y + 158
    metric(draw, x, yy, 360, "Profile completion", "64%", "+18%")
    metric(draw, x + 390, yy, 360, "Inputs captured", "12", "+4")
    metric(draw, x + 780, yy, 360, "Resume imported", "1", "+1")
    metric(draw, x + 1170, yy, 310, "Next action", "Role", "Select", AMBER)
    rounded(draw, (x, yy + 164, x + 700, yy + 510), 16)
    text(draw, x + 24, yy + 190, "CURRENT FOCUS", "tiny", BLUE)
    text(draw, x + 24, yy + 224, "What type of role are you targeting?", "lg")
    for i, label in enumerate(["Technical Support", "Application Support", "Junior QA", "Customer Success"]):
        rounded(draw, (x + 24, yy + 286 + i * 52, x + 650, yy + 328 + i * 52), 10, "#f8fafc")
        text(draw, x + 44, yy + 296 + i * 52, label, "sm_b")
        badge(draw, x + 548, yy + 291 + i * 52, "Select", "#eff6ff", BLUE)
    rounded(draw, (x + 730, yy + 164, x + w, yy + 510), 16)
    text(draw, x + 756, yy + 190, "UPLOAD AND SCAN", "tiny", BLUE)
    text(draw, x + 756, yy + 224, "Resume intake", "lg")
    wrapped(draw, x + 756, yy + 270, "Drag in a resume, import profile data, or continue with manual answers.", 52)
    ring(draw, x + w - 124, yy + 250, 72, TEAL, "Scan")
    bar(draw, x + 756, yy + 372, 450, "Contact details", 90, GREEN)
    bar(draw, x + 756, yy + 432, 450, "Career direction", 58, AMBER)
    return img


def top_resumes():
    img, draw, x, y, w = draw_top_shell("All Resumes", "Resume Library", "All Resumes")
    for i, args in enumerate([
        ("Saved resumes", "8", "+2.57%", BLUE),
        ("Shared links", "12", "+4", TEAL),
        ("Ready to apply", "5", "+15%", GREEN),
        ("Needs edits", "3", "-1", AMBER),
    ]):
        metric(draw, x + i * 382, y, 352, *args)
    rounded(draw, (x, y + 162, x + w, y + 260), 16)
    text(draw, x + 24, y + 190, "Resume search and filters", "lg")
    for i, label in enumerate(["Role", "Template", "Readiness", "Updated", "Shared"]):
        badge(draw, x + 760 + i * 126, y + 198, label, "#f2f5f8", NAVY)
    rows = [
        ["Alex Resume", "Application Support", "82%", "Today", "Active"],
        ["Technical Support v2", "Support Specialist", "76%", "Yesterday", "Draft"],
        ["Customer Engineer", "Support Engineer", "71%", "2 days", "Shared"],
        ["Junior QA", "QA Analyst", "63%", "5 days", "Hold"],
    ]
    table(draw, x, y + 292, w, rows, ["Name", "Target", "Ready", "Updated", "Status"])
    rounded(draw, (x, y + 596, x + w, y + 852), 16)
    text(draw, x + 24, y + 624, "Template performance", "lg")
    sparkline(draw, x + 46, y + 704, 620, 90, [45, 58, 52, 74, 82, 76], TEAL)
    for i, label in enumerate(["Modern Tech", "Classic Pro", "ATS Simple"]):
        bar(draw, x + 790, y + 680 + i * 62, 540, label, [82, 76, 68][i], [GREEN, BLUE, AMBER][i])
    return img


def top_editor():
    img, draw, x, y, w = draw_top_shell("Resume Editor", "Resume Editor", "Editor")
    rounded(draw, (x, y, x + w, y + 112), 16, NAVY_2, NAVY_2)
    text(draw, x + 26, y + 24, "EDITOR WORKBENCH", "tiny", "#cfe2ff")
    text(draw, x + 26, y + 56, "Edit sections with live readiness.", "xl", CARD)
    badge(draw, x + w - 120, y + 42, "Save", CARD, NAVY)
    rounded(draw, (x, y + 144, x + 660, y + 850), 16)
    text(draw, x + 24, y + 172, "SECTION EDITOR", "tiny", BLUE)
    for i, field in enumerate(["Target role", "Professional summary", "Experience bullet", "Skills group", "Education"]):
        yy = y + 222 + i * 106
        text(draw, x + 24, yy, field, "sm_b")
        rounded(draw, (x + 24, yy + 30, x + 630, yy + 78), 10, "#f8fafc")
        text(draw, x + 44, yy + 43, f"Edit {field.lower()}...", "sm", MUTED)
    rounded(draw, (x + 690, y + 144, x + w, y + 850), 16)
    text(draw, x + 718, y + 172, "LIVE PREVIEW", "tiny", BLUE)
    rounded(draw, (x + 760, y + 226, x + w - 86, y + 800), 8, "#fbfcfe")
    text(draw, x + 806, y + 264, "Alex Resume", "lg")
    for i, width in enumerate([420, 520, 470, 560, 390, 500]):
        rounded(draw, (x + 806, y + 334 + i * 44, x + 806 + width, y + 344 + i * 44), 5, "#dbe5f0", "#dbe5f0")
    ring(draw, x + w - 150, y + 222, 76, AMBER, "Ready")
    return img


def top_improvements():
    img, draw, x, y, w = draw_top_shell("Improvements", "Resume Improvements", "Improvements")
    for i, args in enumerate([
        ("Profile", "82%", "+18%", TEAL),
        ("Resume", "76%", "+12%", AMBER),
        ("Application", "64%", "+8%", RED),
    ]):
        metric(draw, x + i * 356, y, 326, *args)
    rounded(draw, (x + 1090, y, x + w, y + 132), 16)
    ring(draw, x + 1180, y + 66, 64, RED, "Ready")
    text(draw, x + 1252, y + 42, "Fix blockers", "md_b")
    rounded(draw, (x, y + 162, x + w, y + 344), 16)
    text(draw, x + 24, y + 190, "HIGH-LEVEL PROFILE OVERVIEW", "tiny", BLUE)
    text(draw, x + 24, y + 224, "Alex Resume", "lg")
    wrapped(draw, x + 24, y + 267, "Support-focused profile with API troubleshooting, SQL, documentation, and customer issue resolution signals.", 120)
    for i, label in enumerate(["Target role", "Saved resumes", "Experience", "Visible skills"]):
        badge(draw, x + 40 + i * 230, y + 308, label, "#f2f5f8", NAVY)
    rounded(draw, (x, y + 374, x + 720, y + 640), 16)
    text(draw, x + 24, y + 402, "CUMULATIVE RESUME CREATION", "tiny", BLUE)
    sparkline(draw, x + 42, y + 486, 620, 90, [88, 74, 62, 86, 76], BLUE)
    rounded(draw, (x + 750, y + 374, x + w, y + 640), 16)
    text(draw, x + 778, y + 402, "IMPROVEMENT WORKBENCH", "tiny", BLUE)
    for i, label in enumerate(["Fix plan", "Keywords", "Sections", "Batch"]):
        badge(draw, x + 778 + i * 124, y + 454, label, CARD if i == 0 else "#e9eef5", BLUE if i == 0 else MUTED)
    for i, label in enumerate(["Add measurable outcome", "Tune target role", "Expand skills"]):
        rounded(draw, (x + 778, y + 514 + i * 56, x + w - 36, y + 554 + i * 56), 10, "#f8fafc")
        text(draw, x + 798, y + 524 + i * 56, label, "sm_b")
        badge(draw, x + w - 160, y + 519 + i * 56, "Fix", "#fff7ed", AMBER)
    return img


def top_analysis():
    img, draw, x, y, w = draw_top_shell("Analysis", "Profile Analysis", "Analysis")
    for i, args in enumerate([
        ("Profile category", "Tech", "+88%", BLUE),
        ("Resume quality", "78%", "+12%", TEAL),
        ("Skill coverage", "66%", "-4%", AMBER),
    ]):
        metric(draw, x + i * 382, y, 352, *args)
    rounded(draw, (x, y + 162, x + 640, y + 620), 16)
    text(draw, x + 24, y + 190, "PROFILE SUMMARY", "tiny", BLUE)
    text(draw, x + 24, y + 224, "Technical Career Builder", "lg")
    wrapped(draw, x + 24, y + 270, "Best positioned for software, IT, support, cloud, and systems roles.", 56)
    for i, (label, val) in enumerate([("Completeness", 88), ("Bullets", 72), ("Risk safety", 90), ("Skills", 66)]):
        bar(draw, x + 24, y + 372 + i * 58, 520, label, val, [GREEN, AMBER, GREEN, BLUE][i])
    rounded(draw, (x + 672, y + 162, x + w, y + 620), 16)
    text(draw, x + 700, y + 190, "REPORT TABS", "tiny", BLUE)
    for i, label in enumerate(["User profile", "Resume", "Things needed", "Jobs to apply"]):
        badge(draw, x + 700 + i * 158, y + 230, label, CARD if i == 0 else "#e9eef5", BLUE if i == 0 else MUTED)
    table(draw, x + 700, y + 304, 680, [["System design", "2-4 weeks", "Build proof"], ["API support", "1 week", "Rewrite bullets"], ["SQL", "1 week", "Add examples"]], ["Skill", "Timeline", "Action"])
    return img


def top_jobs():
    img, draw, x, y, w = draw_top_shell("Jobs", "Jobs To Apply", "Jobs")
    for i, args in enumerate([
        ("Average fit", "78%", "+9%", GREEN),
        ("Ready now", "5", "+2", BLUE),
        ("Review", "7", "-1", AMBER),
    ]):
        metric(draw, x + i * 382, y, 352, *args)
    rounded(draw, (x, y + 162, x + 460, y + 820), 16)
    text(draw, x + 24, y + 190, "FILTERS", "tiny", BLUE)
    for i, label in enumerate(["Remote", "Support", "SQL", "Entry/Mid", "High fit"]):
        badge(draw, x + 24, y + 232 + i * 48, label, "#f2f5f8", NAVY)
    text(draw, x + 24, y + 520, "Batch builder", "lg")
    ring(draw, x + 124, y + 626, 78, GREEN, "Fit")
    wrapped(draw, x + 210, y + 584, "Select 3-5 close-fit roles before preparing application packets.", 24)
    rows = [["Technical Support Specialist", "82", "Ready"], ["Application Support Analyst", "76", "Tailor"], ["Customer Support Engineer", "72", "Review"], ["Junior QA Analyst", "68", "Hold"]]
    table(draw, x + 492, y + 162, w - 492, rows, ["Role", "Fit", "Status"])
    return img


def top_auto_apply():
    img, draw, x, y, w = draw_top_shell("Auto-Apply", "Auto-Apply Preparation", "Auto-Apply")
    for i, args in enumerate([
        ("Packets", "5", "+5", BLUE),
        ("Questions", "3", "+1", AMBER),
        ("Submissions", "0", "Gate on", GREEN),
    ]):
        metric(draw, x + i * 382, y, 352, *args)
    cols = [("Prepare packets", ["Resume version", "Cover note", "Tracker entry"]), ("Resolve questions", ["Salary", "Work auth", "Custom question"]), ("Approval staging", ["Batch 01", "Audit trail", "No submission"])]
    col_w = (w - 50) / 3
    for i, (title, cards) in enumerate(cols):
        cx = x + i * (col_w + 25)
        rounded(draw, (cx, y + 162, cx + col_w, y + 760), 16)
        text(draw, cx + 24, y + 190, f"STEP {i + 1}", "tiny", BLUE)
        text(draw, cx + 24, y + 224, title, "lg")
        for j, card in enumerate(cards):
            rounded(draw, (cx + 24, y + 298 + j * 120, cx + col_w - 24, y + 386 + j * 120), 12, "#f8fafc")
            text(draw, cx + 44, y + 318 + j * 120, card, "md_b")
            badge(draw, cx + 44, y + 352 + j * 120, ["Ready", "Review", "Blocked"][min(j, 2)], ["#dcfce7", "#fef3c7", "#fee2e2"][min(j, 2)], [GREEN, AMBER, RED][min(j, 2)])
    return img


def top_approval():
    img, draw, x, y, w = draw_top_shell("Approval", "Human Approval", "Approval")
    for i, args in enumerate([
        ("Needs approval", "5", "+5", BLUE),
        ("Safe", "2", "+2", GREEN),
        ("Risk", "1", "Fix", RED),
    ]):
        metric(draw, x + i * 382, y, 352, *args)
    rounded(draw, (x, y + 162, x + 430, y + 820), 16)
    text(draw, x + 24, y + 190, "QUEUE", "tiny", BLUE)
    for i, role in enumerate(["Technical Support Specialist", "Application Support Analyst", "Customer Support Engineer", "Junior QA Analyst"]):
        rounded(draw, (x + 24, y + 232 + i * 104, x + 406, y + 316 + i * 104), 12, "#eff6ff" if i == 0 else "#f8fafc")
        text(draw, x + 44, y + 252 + i * 104, role, "sm_b")
        badge(draw, x + 44, y + 280 + i * 104, ["Safe", "Check", "Input", "Risk"][i], ["#dcfce7", "#fef3c7", "#fef3c7", "#fee2e2"][i], [GREEN, AMBER, AMBER, RED][i])
    rounded(draw, (x + 462, y + 162, x + w, y + 820), 16)
    text(draw, x + 490, y + 190, "SELECTED PACKET", "tiny", BLUE)
    text(draw, x + 490, y + 224, "Technical Support Specialist", "lg")
    for i, title in enumerate(["Resume changes", "Application answers", "Risk check"]):
        rounded(draw, (x + 490, y + 306 + i * 130, x + w - 34, y + 400 + i * 130), 12, "#f8fafc")
        text(draw, x + 514, y + 328 + i * 130, title, "md_b")
        wrapped(draw, x + 514, y + 362 + i * 130, "Show source, change summary, risk, and approval controls before any external submission.", 70, "sm", MUTED, 23)
    return img


def top_admin():
    img, draw, x, y, w = draw_top_shell("Overview", "Admin Console", "Admin Overview", admin=True)
    for i, args in enumerate([
        ("Users", "1,249", "+2.57%", BLUE),
        ("Approval queue", "19", "+7", AMBER),
        ("Automation", "Gate", "+on", GREEN),
        ("Audit", "100%", "+15%", BLUE),
    ]):
        metric(draw, x + i * 382, y, 352, *args)
    rounded(draw, (x, y + 162, x + 620, y + 604), 16)
    text(draw, x + 24, y + 190, "FEATURE CONTROLS", "tiny", BLUE)
    for i, label in enumerate(["All resumes", "Resume editor", "Improvements", "Analysis", "Jobs", "Auto-apply"]):
        rounded(draw, (x + 24, y + 234 + i * 58, x + 590, y + 276 + i * 58), 10, "#f8fafc")
        text(draw, x + 44, y + 244 + i * 58, label, "sm_b")
        badge(draw, x + 494, y + 239 + i * 58, "On", "#dcfce7", GREEN)
    table(draw, x + 652, y + 162, w - 652, [["Maya Chen", "Pro", "Active", "Open"], ["Alex Resume", "Free", "Active", "Open"], ["Jordan Lee", "Pro", "Review", "Open"]], ["User", "Plan", "Status", "Action"])
    rounded(draw, (x + 652, y + 500, x + w, y + 820), 16)
    text(draw, x + 680, y + 528, "ACTIVITY", "tiny", BLUE)
    for i, label in enumerate(["Auto-apply packet uses salary answer", "Resume import scanned", "Profile analysis generated", "Admin changed feature flag"]):
        text(draw, x + 700, y + 576 + i * 52, label, "sm_b")
        badge(draw, x + w - 160, y + 570 + i * 52, "Review" if i == 0 else "Log", "#fef3c7" if i == 0 else "#eff6ff", AMBER if i == 0 else BLUE)
    return img


SCREENS = [
    ("top_menu_01_onboarding.png", "Onboarding", top_onboarding),
    ("top_menu_02_all_resumes.png", "All Resumes", top_resumes),
    ("top_menu_03_resume_editor.png", "Resume Editor", top_editor),
    ("top_menu_04_improvements.png", "Improvements", top_improvements),
    ("top_menu_05_analysis.png", "Analysis", top_analysis),
    ("top_menu_06_jobs.png", "Jobs", top_jobs),
    ("top_menu_07_auto_apply.png", "Auto-Apply", top_auto_apply),
    ("top_menu_08_approval.png", "Approval", top_approval),
    ("top_menu_09_admin_console.png", "Admin Console", top_admin),
]


def make_contact_sheet(generated):
    thumb_w, thumb_h = 500, 325
    sheet_w, sheet_h = 1680, 1420
    sheet = Image.new("RGB", (sheet_w, sheet_h), BG)
    draw = ImageDraw.Draw(sheet)
    text(draw, 48, 34, "NexLink-inspired UX proposal with original top menu", "xl")
    wrapped(draw, 48, 88, "Keeps the current ResumeForge horizontal navigation at the top while refactoring each content screen into NexLink-style dashboard cards, compact metrics, tables, progress widgets, and action panels. Purple accents are replaced with the current navy brand color.", 130, "sm", MUTED, 26)
    badge(draw, 48, 150, "Original top menu retained", "#e8f0f8", NAVY)
    badge(draw, 252, 150, "NexLink content system", "#eff6ff", BLUE)
    badge(draw, 460, 150, "Brand navy rgb(46 61 80)", "#f8fafc", NAVY)
    start_y = 210
    for i, (path, label) in enumerate(generated):
        col = i % 3
        row = i // 3
        xx = 48 + col * 535
        yy = start_y + row * 390
        rounded(draw, (xx, yy, xx + thumb_w + 18, yy + thumb_h + 54), 18)
        img = Image.open(path).resize((thumb_w, thumb_h))
        sheet.paste(img, (xx + 9, yy + 44))
        text(draw, xx + 18, yy + 14, f"{i + 1:02d}. {label}", "md_b")
    out = OUT_DIR / "top_menu_full_app_contact_sheet.png"
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
