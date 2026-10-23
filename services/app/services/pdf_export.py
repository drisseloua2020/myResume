"""Selectable-text exports with measured pagination and explicit glyph validation."""
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape
import re
from fastapi import HTTPException
from pypdf import PdfReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer


def _font():
    if "ResumeUnicode" not in pdfmetrics.getRegisteredFontNames():
        candidates = [Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"), Path("C:/Windows/Fonts/arial.ttf")]
        font = next((path for path in candidates if path.is_file()), None)
        if not font:
            raise RuntimeError("Install fonts-dejavu-core for Unicode PDF export")
        pdfmetrics.registerFont(TTFont("ResumeUnicode", str(font)))
        cjk_paths = [Path("/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"), Path("C:/Windows/Fonts/msyh.ttc"), Path("C:/Windows/Fonts/simsun.ttc")]
        cjk_font = next((path for path in cjk_paths if path.is_file()), None)
        if cjk_font:
            pdfmetrics.registerFont(TTFont("ResumeCJK", str(cjk_font), subfontIndex=0))
    return pdfmetrics.getFont("ResumeUnicode")


def text_pdf(text: str, title: str = "Resume") -> bytes:
    font = _font()
    fragments = []
    for char in text:
        code = ord(char)
        if char in "\n\r\t" or code in font.face.charToGlyph:
            fragments.append(escape(char))
        elif "ResumeCJK" in pdfmetrics.getRegisteredFontNames() and code in pdfmetrics.getFont("ResumeCJK").face.charToGlyph:
            fragments.append(f'<font name="ResumeCJK">{escape(char)}</font>')
        else:
            raise HTTPException(422, "PDF font does not support a character in this document. Use DOCX or TXT export.")
    stream = BytesIO()
    doc = SimpleDocTemplate(stream, pagesize=(595.28, 841.89), leftMargin=48, rightMargin=48,
                            topMargin=48, bottomMargin=48, title=title, author="MyResumes")
    body = ParagraphStyle("ResumeBody", fontName="ResumeUnicode", fontSize=10, leading=15,
                          alignment=TA_LEFT, splitLongWords=True, spaceAfter=5)
    heading = ParagraphStyle("ResumeHeading", parent=body, fontSize=15, leading=21, spaceAfter=12)
    story = []
    for index, line in enumerate("".join(fragments).splitlines()):
        if line.strip():
            story.append(Paragraph(line, heading if index == 0 else body))
        else:
            story.append(Spacer(1, 7))
    doc.build(story or [Spacer(1, 1)])
    return stream.getvalue()


def validate_pdf(data: bytes) -> dict:
    reader = PdfReader(BytesIO(data))
    extracted = "\n".join(page.extract_text() or "" for page in reader.pages)
    return {"selectableText": bool(extracted.strip()), "imageOnly": not bool(extracted.strip()),
            "pages": len(reader.pages), "method": "Verified with pypdf text extraction"}
