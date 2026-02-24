"""
Test creating the sailing result CSV from JSON data.
Run: python test_calculation.py
"""
from pathlib import Path

from Calculation import generate_result_csv_for_event


def test_create_csv():
    """Load sample data and create the result CSV file."""
    base = Path(__file__).resolve().parent
    output_path = base / "result_sample.csv"

    rows = generate_result_csv_for_event(
        "1",
        output_csv_path=output_path,
    )

    assert output_path.exists(), "CSV file was not created"
    content = output_path.read_text()
    assert "RANK" in content and "Sail Number" in content and "TOTAL" in content and "NET" in content
    assert len(rows) > 0
    print("OK: Created", output_path)
    print(content)


if __name__ == "__main__":
    test_create_csv()
