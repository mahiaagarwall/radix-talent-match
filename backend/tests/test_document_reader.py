import pytest

from app.services.document_reader import DocumentError, read_document
from conftest import CANDIDATES, make_docx, make_pdf, sample_bytes


@pytest.mark.parametrize("candidate", CANDIDATES)
@pytest.mark.parametrize("kind", ["pdf", "docx"])
def test_reads_every_sample(candidate, kind):
    text = read_document(f"{candidate}.{kind}", sample_bytes(candidate, kind))
    assert candidate in text
    assert "Technical Skills" in text
    assert "• " in text  # bullets normalised the same way for PDF and DOCX


def code_of(filename, data):
    with pytest.raises(DocumentError) as err:
        read_document(filename, data)
    return err.value.code


def test_empty_file():
    assert code_of("cv.pdf", b"") == "empty"


def test_unsupported_types():
    assert code_of("cv.txt", b"hello") == "unsupported"
    assert code_of("cv.doc", b"hello") == "unsupported"


def test_corrupt_files():
    assert code_of("cv.pdf", b"not a pdf at all") == "corrupt"
    assert code_of("cv.pdf", b"%PDF-1.7 garbage garbage") == "corrupt"
    assert code_of("cv.docx", b"PK but not really a zip") == "corrupt"


def test_encrypted_pdf():
    assert code_of("cv.pdf", make_pdf(encrypt=True)) == "encrypted"


def test_pdf_without_text_layer_is_reported_not_ocrd():
    assert code_of("scan.pdf", make_pdf()) == "no_text"


def test_docx_without_text():
    assert code_of("blank.docx", make_docx([])) == "no_text"
