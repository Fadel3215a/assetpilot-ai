/**
 * Hybrid search result shapes (Stage 4.1).
 *
 * Assets are retrieved by combining a pgvector cosine similarity score with a
 * PostgreSQL full-text rank. `AssetSearchHit` carries the individual RAW scores
 * and a fused confidence so the UI can display "why" an asset matched and how
 * strongly it should be ranked.
 */
export interface AssetSearchHit {
  assetId: string;
  /** Fused hybrid confidence in [0, 1]. 1 = strongest match. */
  score: number;
  /** Cosine similarity vs the query embedding in [0, 1]. 0 when not vector-matched. */
  vectorScore: number;
  /** Normalized full-text rank contribution in [0, 1]. 0 when not FTS-matched. */
  textScore: number;
  /** Which retrieval signals produced this hit. */
  matchedBy: ("vector" | "fulltext")[];
}

export interface AssetSearchResult {
  hits: AssetSearchHit[];
}

export interface IndexedAssetLike {
  id: string;
  name: string;
  tags: string[];
  type: string;
  status: string;
  collectionName?: string;
  usageNotes?: string;
  description?: string;
  prompt?: string;
  generator?: string;
  format?: string;
}
