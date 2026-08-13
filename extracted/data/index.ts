export { collections } from "./collections";
export { enrichMockAssets } from "./asset-enrichment";
export { mockComparisons } from "./mock-comparisons";

import { enrichMockAssets } from "./asset-enrichment";
import { mockActivity, rawMockAssets } from "./mock-assets";

export const mockAssets = enrichMockAssets(rawMockAssets);
export { mockActivity };
