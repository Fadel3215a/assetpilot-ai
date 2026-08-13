"use client";

import { useState } from "react";
import type { Asset, Collection } from "@/types";
import { getCurrentVersion } from "@/lib/utils";
import { useAssets } from "@/lib/assets-context";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Input } from "./ui/input";
import { Select } from "./ui/select";

interface MetadataEditorProps {
  asset: Asset;
  collections: Collection[];
}

export function MetadataEditor({ asset, collections }: MetadataEditorProps) {
  const { updateAssetMetadata } = useAssets();
  const version = getCurrentVersion(asset);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(asset.name);
  const [description, setDescription] = useState(version.metadata.description);
  const [tagsInput, setTagsInput] = useState(asset.tags.join(", "));
  const [collectionId, setCollectionId] = useState(asset.collectionId);
  const [usageNotes, setUsageNotes] = useState(asset.usageNotes ?? "");
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setName(asset.name);
    setDescription(getCurrentVersion(asset).metadata.description);
    setTagsInput(asset.tags.join(", "));
    setCollectionId(asset.collectionId);
    setUsageNotes(asset.usageNotes ?? "");
    setError(null);
  };

  const handleSave = () => {
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const result = updateAssetMetadata(asset.id, {
      name: name.trim() || asset.name,
      description: description.trim(),
      tags,
      collectionId,
      usageNotes: usageNotes.trim(),
    });

    if (result.ok) {
      setEditing(false);
      setError(null);
    } else {
      setError(result.error ?? "Could not save changes.");
    }
  };

  const handleCancel = () => {
    resetForm();
    setEditing(false);
  };

  return (
    <div id="metadata-editor">
      <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Metadata Editor</h3>
          <p className="text-xs text-muted">
            Curator-managed fields — changes apply to this session.
          </p>
        </div>
        {!editing && (
          <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
            Edit metadata
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            <div>
              <label htmlFor="meta-name" className="mb-1 block text-xs font-medium text-muted">
                Asset name
              </label>
              <Input id="meta-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="meta-description" className="mb-1 block text-xs font-medium text-muted">
                Description
              </label>
              <textarea
                id="meta-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="field-textarea"
              />
            </div>
            <div>
              <label htmlFor="meta-tags" className="mb-1 block text-xs font-medium text-muted">
                Tags (comma-separated)
              </label>
              <Input id="meta-tags" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
            </div>
            <div>
              <label htmlFor="meta-collection" className="mb-1 block text-xs font-medium text-muted">
                Collection
              </label>
              <Select id="meta-collection" value={collectionId} onChange={(e) => setCollectionId(e.target.value)}>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label htmlFor="meta-usage" className="mb-1 block text-xs font-medium text-muted">
                Usage notes
              </label>
              <textarea
                id="meta-usage"
                value={usageNotes}
                onChange={(e) => setUsageNotes(e.target.value)}
                rows={2}
                className="field-textarea"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="submit">Save Changes</Button>
              <Button type="button" variant="secondary" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="meta-label">Usage notes</dt>
              <dd className="mt-1">{asset.usageNotes?.trim() || "—"}</dd>
            </div>
          </dl>
        )}
      </CardContent>
      </Card>
    </div>
  );
}
