"""
Unit & algorithmic tests for Ticket #104: Topic Clusters.

Acceptance criteria verified:
1. cluster ID stability test (same topic keeps its ID across runs)
2. versioned cutover test: no reader sees mixed versions
3. job is idempotent and completes in minutes at 10K posts
4. cluster count is a config value (30-50, default 40)
5. split cluster proportional point sharing & strict mix point conservation
6. fast publish-time assignment via 40 dot products (< 1 ms, no model call)
"""
import time
import pytest
import numpy as np

from app.services.clustering_service import (
    assign_to_nearest_cluster,
    compute_transition_matrix,
    fit_clusters,
    get_cluster_config,
    match_clusters_to_old,
    normalize_centres,
    remap_mix,
)
from app.services.recluster_orchestrator import execute_clustering


# ---------------------------------------------------------------------------
# Test Helpers
# ---------------------------------------------------------------------------


def generate_synthetic_embeddings(
    n_samples_per_cluster: int = 15,
    n_clusters: int = 40,
    dim: int = 768,
    noise_scale: float = 0.05,
    random_seed: int = 42,
    true_centers: np.ndarray | None = None,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Generate synthetic well-separated 768-d unit embeddings around known cluster centers.
    """
    rng = np.random.default_rng(random_seed)

    # True centers on unit sphere
    if true_centers is None:
        raw_centers = rng.normal(size=(n_clusters, dim))
        true_centers = raw_centers / np.linalg.norm(raw_centers, axis=1, keepdims=True)
    else:
        n_clusters = len(true_centers)
        dim = true_centers.shape[1]

    embeddings = []
    ground_truth_labels = []

    for k in range(n_clusters):
        center = true_centers[k]
        noise = rng.normal(scale=noise_scale, size=(n_samples_per_cluster, dim))
        samples = center + noise
        # Normalize each sample to unit length
        unit_samples = samples / np.linalg.norm(samples, axis=1, keepdims=True)
        embeddings.append(unit_samples)
        ground_truth_labels.extend([k] * n_samples_per_cluster)

    X = np.vstack(embeddings)
    y = np.array(ground_truth_labels, dtype=int)
    return X, y, true_centers


# ---------------------------------------------------------------------------
# Acceptance Criterion 1: Cluster ID Stability Test
# ---------------------------------------------------------------------------


def test_cluster_id_stability():
    """
    Criterion: Same topic keeps its ID across reclustering runs.

    We fit version 1, perturb the data slightly (e.g. 5% perturbation + library growth),
    fit version 2, and apply match_clusters_to_old via Hungarian assignment.
    The re-matched cluster IDs should align with the old cluster IDs with high fidelity.
    """
    k = 40
    X_v1, _, true_centers = generate_synthetic_embeddings(
        n_samples_per_cluster=20,
        n_clusters=k,
        dim=768,
        noise_scale=0.04,
        random_seed=42,
    )

    # Version 1 fit
    v1_centres, v1_labels = fit_clusters(X_v1, n_clusters=k, n_init=10, random_state=42)

    # Version 2: Sample new posts around the SAME underlying topic centers
    # with slight noise to simulate weekly topic library evolution
    X_v2, _, _ = generate_synthetic_embeddings(
        n_samples_per_cluster=25,
        n_clusters=k,
        dim=768,
        noise_scale=0.06,
        random_seed=123,
        true_centers=true_centers,
    )

    v2_raw_centres, v2_raw_labels = fit_clusters(
        X_v2, n_clusters=k, n_init=10, random_state=999
    )

    # Stable matching
    matched_centres, matched_labels, raw_to_stable_id = match_clusters_to_old(
        old_centres=v1_centres,
        new_centres=v2_raw_centres,
        new_labels=v2_raw_labels,
    )

    # Compute similarity between matched centres and v1 centres
    # For every cluster i, dot(v1_centres[i], matched_centres[i]) should be very high (> 0.90)
    cosine_sims = np.sum(v1_centres * matched_centres, axis=1)

    # Verify high cluster center persistence
    mean_sim = float(np.mean(cosine_sims))
    stable_count = int(np.sum(cosine_sims > 0.85))

    assert mean_sim > 0.85, f"Mean stability similarity too low: {mean_sim:.4f}"
    assert stable_count >= 35, f"Expected >= 35/40 clusters to persist (>0.85), got {stable_count}"
    assert len(set(raw_to_stable_id.values())) == k, "All cluster IDs must be unique"


# ---------------------------------------------------------------------------
# Acceptance Criterion 2: Versioned Cutover Test
# ---------------------------------------------------------------------------


def test_versioned_cutover():
    """
    Criterion: No reader sees mixed versions.
    Simulates staging version 2 while readers query version 1,
    then executes cutover so readers only see version 2.
    """
    k = 30
    X, _, _ = generate_synthetic_embeddings(n_samples_per_cluster=10, n_clusters=k)
    posts_v1 = [
        {"_id": f"post_{i}", "embedding": X[i].tolist(), "clusterId": None}
        for i in range(len(X))
    ]

    # Initial clustering: version 1
    v1_plan = execute_clustering(
        post_data=posts_v1,
        old_clusters=[],
        current_version=0,
        n_clusters=k,
    )

    # Mock DB state
    cluster_store: dict[int, list[dict]] = {1: v1_plan["cluster_docs"]}
    post_store = {
        p["postId"]: {"clusterId": p["clusterId"], "version": 1}
        for p in v1_plan["post_assignments"]
    }
    system_metadata = {"active_version": 1}

    # Reader queries active version: must only see version 1
    reader_version = system_metadata["active_version"]
    reader_clusters = cluster_store[reader_version]
    assert all(c["version"] == 1 for c in reader_clusters)
    assert all(p["version"] == 1 for p in post_store.values())

    # Now stage Version 2 (background reclustering job running)
    posts_for_v2 = [
        {
            "_id": pid,
            "embedding": posts_v1[i]["embedding"],
            "clusterId": post_store[pid]["clusterId"],
        }
        for i, pid in enumerate(post_store.keys())
    ]

    v2_plan = execute_clustering(
        post_data=posts_for_v2,
        old_clusters=v1_plan["cluster_docs"],
        current_version=1,
        n_clusters=k,
    )

    # Staging phase: write version 2 clusters to store
    cluster_store[2] = v2_plan["cluster_docs"]

    # In-between assertion: while V2 is staged, reader STILL queries active_version (V1)
    reader_active = system_metadata["active_version"]
    assert reader_active == 1
    assert all(c["version"] == 1 for c in cluster_store[reader_active])

    # Atomic cutover phase
    # Update post assignments to V2
    for assign in v2_plan["post_assignments"]:
        post_store[assign["postId"]] = {
            "clusterId": assign["clusterId"],
            "version": 2,
        }

    # Flip active version atomically
    system_metadata["active_version"] = 2

    # Post-cutover reader query: immediately sees Version 2 exclusively
    new_reader_active = system_metadata["active_version"]
    assert new_reader_active == 2
    assert all(c["version"] == 2 for c in cluster_store[new_reader_active])
    assert all(p["version"] == 2 for p in post_store.values())


# ---------------------------------------------------------------------------
# Acceptance Criterion 3: 10K Posts Scalability & Idempotency
# ---------------------------------------------------------------------------


def test_performance_10k_posts_and_idempotency():
    """
    Criterion: Job is idempotent and completes in minutes at 10K posts.
    We test on 10,000 synthetic 768-d embeddings.
    Must complete clustering and matching in seconds (well within threshold).
    """
    k = 40
    dim = 768
    n_total = 10_000

    rng = np.random.default_rng(42)
    raw = rng.normal(size=(n_total, dim))
    embeddings = raw / np.linalg.norm(raw, axis=1, keepdims=True)

    t0 = time.time()
    centres_run1, labels_run1 = fit_clusters(
        embeddings,
        n_clusters=k,
        n_init=10,
        random_state=42,
    )
    duration_run1 = time.time() - t0

    # Must complete in under 30 seconds
    assert duration_run1 < 30.0, f"Clustering took too long: {duration_run1:.2f}s"

    # Idempotency check: running again with identical data and seed yields identical output
    centres_run2, labels_run2 = fit_clusters(
        embeddings,
        n_clusters=k,
        n_init=10,
        random_state=42,
    )
    np.testing.assert_allclose(centres_run1, centres_run2, atol=1e-6)
    np.testing.assert_array_equal(labels_run1, labels_run2)

    # Test Hungarian matching on 10K posts
    t1 = time.time()
    reordered_c, reordered_l, _ = match_clusters_to_old(
        old_centres=centres_run1,
        new_centres=centres_run2,
        new_labels=labels_run2,
    )
    matching_duration = time.time() - t1
    assert matching_duration < 1.0, f"Matching took too long: {matching_duration:.2f}s"
    np.testing.assert_array_equal(labels_run1, reordered_l)


# ---------------------------------------------------------------------------
# Acceptance Criterion 4: Configurable Cluster Count (30-50)
# ---------------------------------------------------------------------------


def test_cluster_count_config(monkeypatch):
    """
    Criterion: cluster count is a config value (30-50, default 40).
    """
    # Default without env var
    monkeypatch.delenv("TOPIC_N_CLUSTERS", raising=False)
    assert get_cluster_config() == 40

    # Custom valid values
    monkeypatch.setenv("TOPIC_N_CLUSTERS", "35")
    assert get_cluster_config() == 35

    monkeypatch.setenv("TOPIC_N_CLUSTERS", "50")
    assert get_cluster_config() == 50

    monkeypatch.setenv("TOPIC_N_CLUSTERS", "30")
    assert get_cluster_config() == 30

    # Invalid values below 30 or above 50 must raise ValueError
    monkeypatch.setenv("TOPIC_N_CLUSTERS", "20")
    with pytest.raises(ValueError, match="between 30 and 50"):
        get_cluster_config()

    monkeypatch.setenv("TOPIC_N_CLUSTERS", "60")
    with pytest.raises(ValueError, match="between 30 and 50"):
        get_cluster_config()

    monkeypatch.setenv("TOPIC_N_CLUSTERS", "abc")
    with pytest.raises(ValueError, match="Must be an integer"):
        get_cluster_config()


# ---------------------------------------------------------------------------
# Split Cluster Proportional Point Sharing & Mix Remapping Test
# ---------------------------------------------------------------------------


def test_mix_point_conservation_and_proportional_split():
    """
    Verifies that:
    1. A split cluster shares points by how many of its posts went to each part.
    2. Total mix points are strictly conserved (v_new = v_old * M).
    """
    k = 5
    # Simulate old and new post labels for 10 posts in old cluster 0
    # Old cluster 0 had 10 posts: 7 move to new cluster 0, 3 move to new cluster 2.
    # Other clusters are stable.
    old_labels = np.array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4])
    new_labels = np.array([0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 1, 2, 3, 4])

    M = compute_transition_matrix(old_labels, new_labels, n_clusters=k)

    # Check row 0 transition probabilities:
    # 7/10 = 0.70 to new cluster 0
    # 3/10 = 0.30 to new cluster 2
    assert abs(M[0, 0] - 0.7) < 1e-6
    assert abs(M[0, 2] - 0.3) < 1e-6
    assert np.allclose(np.sum(M, axis=1), 1.0)

    # User mix test: user has 100 points in cluster 0 and 50 in cluster 1
    user_mix = {"0": 100.0, "1": 50.0}
    remapped = remap_mix(user_mix, M)

    # Invariant: points strictly conserved (150 total)
    assert sum(user_mix.values()) == pytest.approx(150.0)
    assert sum(remapped.values()) == pytest.approx(150.0)

    # Cluster 0 should receive 70 points, cluster 2 gets 30 points, cluster 1 retains 50 points
    assert remapped[0] == pytest.approx(70.0)
    assert remapped[2] == pytest.approx(30.0)
    assert remapped[1] == pytest.approx(50.0)


# ---------------------------------------------------------------------------
# Fast Publish-Time Assignment Test
# ---------------------------------------------------------------------------


def test_fast_assignment_dot_product():
    """
    Flow 1 (assign): New posts get nearest cluster centre at publish time
    (40 dot products, no model call).
    Verifies speed (< 1 ms) and exact argmax cosine similarity.
    """
    k = 40
    dim = 768
    rng = np.random.default_rng(99)

    centres = rng.normal(size=(k, dim))
    centres = centres / np.linalg.norm(centres, axis=1, keepdims=True)

    # Test sample
    sample = rng.normal(size=(dim,))
    sample = sample / np.linalg.norm(sample)

    t0 = time.perf_counter()
    best_id, best_score = assign_to_nearest_cluster(sample, centres)
    elapsed_ms = (time.perf_counter() - t0) * 1000.0

    # Must be sub-millisecond
    assert elapsed_ms < 1.0, f"Assignment took {elapsed_ms:.4f} ms (expected < 1 ms)"

    # Verify score matches manual dot product
    expected_scores = np.dot(centres, sample)
    assert best_id == int(np.argmax(expected_scores))
    assert best_score == pytest.approx(float(expected_scores[best_id]))

