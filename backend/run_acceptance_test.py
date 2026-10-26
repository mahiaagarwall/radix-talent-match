"""Acceptance Test Script for Talent Check (Owner: Krishna Khanna).

Compares two different candidate profiles against the same company
and explains score differences and gaps across all 12 categories.
"""

from app.services.profile_loader import get_candidate_profile
from app.services.company_requirements import get_company_by_id_or_name
from app.services.readiness_scorer import compare_candidates_readiness

def main():
    ananya = get_candidate_profile("Ananya Rao")
    karthik = get_candidate_profile("Karthik Subramaniam")
    google = get_company_by_id_or_name("Google")

    comp = compare_candidates_readiness(ananya, karthik, google)

    print("=" * 86)
    print(f"ACCEPTANCE TEST: CANDIDATE COMPARISON AGAINST {comp['company_name']}")
    print("=" * 86)
    print(f"Candidate A: {comp['candidate_a']['candidate_name']} -> Readiness Score: {comp['candidate_a']['readiness_score']}/100")
    print(f"Candidate B: {comp['candidate_b']['candidate_name']} -> Readiness Score: {comp['candidate_b']['readiness_score']}/100")
    print(f"Score Difference: {comp['score_difference']} points ({comp['leader']} leads)")
    print("\nOVERALL EXPLANATION:")
    print(comp["overall_explanation"])

    print("\n" + "=" * 86)
    print("12 RADIX CATEGORIES COMPARISON BREAKDOWN:")
    print("=" * 86)
    header = f"{'CODE':<6} | {'CATEGORY':<30} | {'REQ':<4} | {'ANANYA':<8} | {'KARTHIK':<8} | {'DIFF':<5} | {'LEADER':<12}"
    print(header)
    print("-" * len(header))

    for c in comp["category_comparisons"]:
        diff_str = f"+{c['difference']}" if c["difference"] > 0 else str(c["difference"])
        print(f"{c['category_code']:<6} | {c['category_name']:<30} | {c['required_level']:<4} | {c['candidate_a_level']:<8} | {c['candidate_b_level']:<8} | {diff_str:<5} | {c['leader']:<12}")
        print(f"       -> {c['explanation']}")
    print("=" * 86)

if __name__ == "__main__":
    main()
