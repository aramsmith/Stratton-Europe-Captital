import hashlib
import json
import re
from collections import Counter
from datetime import datetime
from pathlib import Path

import fitz


ROOT = Path(__file__).resolve().parent.parent
INPUT = ROOT / "deck" / "architecture-decision-executive-brief-slides.pdf"
OUTPUT = ROOT / "deck" / "deck.pdf"
TEMP = ROOT / "deck" / "deck.sanitising.pdf"


def metadata_values(document):
    return {
        key: value for key, value in document.metadata.items()
        if value and key not in {"format", "encryption"}
    }


def field_category(field):
    if field in {"creator", "producer"}:
        return "browser_or_platform_fingerprint"
    if field in {"creationDate", "modDate"}:
        return "timestamp"
    if field == "title":
        return "document_title"
    return "other_metadata"


pre_document = fitz.open(INPUT)
pre_metadata = metadata_values(pre_document)
pre_metadata_values = list(pre_metadata.values())
pre_fields = sorted(pre_metadata)
pre_categories = Counter(field_category(field) for field in pre_fields)
document_format = pre_document.metadata.get("format")
pre_xmp_present = bool(pre_document.get_xml_metadata())
pre_page_count = pre_document.page_count
pre_document.set_metadata({})
pre_document.del_xml_metadata()
pre_document.save(TEMP, garbage=4, clean=True, deflate=True)
pre_document.close()
TEMP.replace(OUTPUT)
INPUT.unlink()

post_document = fitz.open(OUTPUT)
post_metadata = metadata_values(post_document)
post_xmp_present = bool(post_document.get_xml_metadata())
post_page_count = post_document.page_count
post_image_counts = [len(page.get_images(full=True)) for page in post_document]
post_document.close()
raw = OUTPUT.read_bytes()
raw_text = raw.decode("latin-1", errors="ignore")

dynamic_literals = {
    "local_username": Path.home().name,
    "user_profile_path": str(Path.home()),
    "workspace_absolute_path": str(ROOT),
}
dynamic_literals = {key: value for key, value in dynamic_literals.items() if value}
pre_value_matches = sum(
    1 for value in pre_metadata_values
    if value and value.casefold() in raw_text.casefold()
)
dynamic_match_categories = [
    category for category, value in dynamic_literals.items()
    if value.casefold() in raw_text.casefold()
]
workspace_path_match_count = len(re.findall(
    r"(?:[A-Za-z]:[\\/](?:Users|Projects)[^\x00\r\n<>()]*|/(?:Users|home)/[^\x00\r\n<>()]*)",
    raw_text,
    re.IGNORECASE,
))
metadata_markers = {
    "Title": bool(re.search(r"/Title\b", raw_text)),
    "Creator": bool(re.search(r"/Creator\b", raw_text)),
    "Producer": bool(re.search(r"/Producer\b", raw_text)),
    "CreationDate": bool(re.search(r"/CreationDate\b", raw_text)),
    "ModDate": bool(re.search(r"/ModDate\b", raw_text)),
    "XmpXml": bool(re.search(r"<(?:x:xmpmeta|rdf:RDF)\b", raw_text, re.IGNORECASE)),
}

receipt = {
    "schemaVersion": "1.0.0",
    "recordType": "AFF_PHASE_6_PDF_METADATA_SANITISATION",
    "generatedAt": datetime.now().astimezone().isoformat(),
    "modelPlanRevision": "18",
    "tool": f"PyMuPDF {fitz.VersionBind} available in the local authoring environment; not added to deck dependencies",
    "intermediatePath": "deck/architecture-decision-executive-brief-slides.pdf",
    "canonicalPath": "deck/deck.pdf",
    "canonicalisationAndSanitisation": [
        "Read the DECKIO engine export produced after the project system-font source change and hardened browser build.",
        "Rewrote all ten pages into a cleaned PDF while preserving page image resources.",
        "Removed document information metadata.",
        "Removed XMP metadata.",
        "Wrote deck/deck.pdf and deleted the intermediate PDF.",
    ],
    "pre": {
        "fieldsPresent": pre_fields,
        "fieldCount": len(pre_fields),
        "fieldCategoryCounts": dict(sorted(pre_categories.items())),
        "valuesDeliberatelyNotRetained": True,
        "documentFormat": document_format,
        "xmpPresent": pre_xmp_present,
        "pageCount": pre_page_count,
    },
    "post": {
        "metadata": post_metadata or None,
        "xmpPresent": post_xmp_present,
        "metadataMarkers": metadata_markers,
        "dynamicLocalLiteralMatchCount": len(dynamic_match_categories),
        "dynamicLocalLiteralMatchCategories": dynamic_match_categories,
        "preMetadataValueMatchCount": pre_value_matches,
        "workspacePathMatchCount": workspace_path_match_count,
        "pageCount": post_page_count,
        "imageCountByPage": post_image_counts,
        "bytes": len(raw),
        "sha256": hashlib.sha256(raw).hexdigest(),
        "startsWithPdfHeader": raw.startswith(b"%PDF-"),
        "endsWithEof": raw.rstrip().endswith(b"%%EOF"),
    },
    "dynamicChecks": {
        "localUsernameDerivedAtRuntime": "local_username" in dynamic_literals,
        "userProfilePathDerivedAtRuntime": "user_profile_path" in dynamic_literals,
        "workspacePathDerivedAtRuntime": "workspace_absolute_path" in dynamic_literals,
        "preMetadataValuesComparedInMemory": len(pre_metadata_values),
        "sensitiveLiteralValuesRetained": False,
    },
    "intermediatePresentAfterSanitisation": INPUT.exists(),
    "licensingConclusion": "NONE",
}
receipt["overallStatus"] = "PASS" if (
    receipt["post"]["metadata"] is None
    and not receipt["post"]["xmpPresent"]
    and not any(receipt["post"]["metadataMarkers"].values())
    and receipt["post"]["dynamicLocalLiteralMatchCount"] == 0
    and receipt["post"]["preMetadataValueMatchCount"] == 0
    and receipt["post"]["workspacePathMatchCount"] == 0
    and receipt["post"]["pageCount"] == 10
    and all(count >= 1 for count in receipt["post"]["imageCountByPage"])
    and receipt["post"]["startsWithPdfHeader"]
    and receipt["post"]["endsWithEof"]
    and not receipt["intermediatePresentAfterSanitisation"]
) else "FAIL"

(ROOT / "evidence" / "pdf-metadata-sanitisation.json").write_text(
    json.dumps(receipt, indent=2, ensure_ascii=False) + "\n",
    encoding="utf-8",
    newline="\n",
)
print(json.dumps(receipt, indent=2, ensure_ascii=False))
if receipt["overallStatus"] != "PASS":
    raise SystemExit(1)
