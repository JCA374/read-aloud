#!/usr/bin/env python3
"""Writes doc.pdf, the test PDF: two pages with a title, paragraphs, a word split by a hyphen at a line
end, and paragraphs split by a wider gap. Plain PDF, standard fonts, no tools needed."""
from pathlib import Path

PAGES = [
    [("F2", 20, 72, 760, "The Lighthouse Keeper"),
     ("F1", 12, 72, 720, "When the old keeper retired after forty-one years, the light-"),
     ("F1", 12, 72, 705, "house went dark for the first time. Nobody in the village knew"),
     ("F1", 12, 72, 690, "how to light the lamp."),
     ("F1", 12, 72, 655, "His granddaughter came back from the city. She had counted the"),
     ("F1", 12, 72, 640, "stairs as a child, and she remembered every step. On the third"),
     ("F1", 12, 72, 625, "evening the light was burning over the sea again.")],
    [("F1", 12, 72, 760, "The village held a small party on the harbour. Everyone agreed"),
     ("F1", 12, 72, 745, "that the light had never looked brighter than it did that night.")],
]


def esc(s):
    return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


objs = []  # object bodies; object n is objs[n-1]
objs.append(b"<< /Type /Catalog /Pages 2 0 R /Lang (en) >>")
objs.append(None)  # pages, filled in below
objs.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
objs.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")
kids = []
for lines in PAGES:
    stream = "".join(f"BT /{f} {size} Tf {x} {y} Td ({esc(t)}) Tj ET\n" for f, size, x, y, t in lines).encode()
    objs.append(b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"endstream")
    objs.append(b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents %d 0 R >>" % (len(objs)))
    kids.append(len(objs))
objs[1] = b"<< /Type /Pages /Kids [%s] /Count %d >>" % (b" ".join(b"%d 0 R" % k for k in kids), len(kids))
objs.append(b"<< /Title (The Lighthouse Keeper) >>")

out = bytearray(b"%PDF-1.4\n")
offsets = []
for i, body in enumerate(objs, 1):
    offsets.append(len(out))
    out += b"%d 0 obj\n" % i + body + b"\nendobj\n"
xref = len(out)
out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1)
out += b"".join(b"%010d 00000 n \n" % o for o in offsets)
out += b"trailer\n<< /Size %d /Root 1 0 R /Info %d 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, len(objs), xref)
Path(__file__).with_name("doc.pdf").write_bytes(out)
