"use client";

import { useState } from "react";
import { useAssets } from "@/lib/assets-context";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select } from "./ui/select";

interface BulkActionsBarProps {
  selectedIds: string[];
  onClearSelection: () => void;
}

export function BulkActionsBar({ selectedIds, onClearSelection }: BulkActionsBarProps) {
  const { bulkAddTag, bulkRemoveTag, bulkMoveToCollection, collections } = useAssets();
  const [tag, setTag] = useState("");
  const [removeTag, setRemoveTag] = useState("");
  const [collectionId, setCollectionId] = useState(collections[0]?.id ?? "");
  const [confirmMove, setConfirmMove] = useState(false);

  if (selectedIds.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Select assets to enable bulk actions.
      </p>
    );
  }

  const collection = collections.find((c) => c.id === collectionId);

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {selectedIds.length} asset{selectedIds.length !== 1 ? "s" : ""} selected
        </p>
        <Button type="button" variant="secondary" className="text-xs" onClick={onClearSelection}>
          Clear selection
        </Button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="space-y-2">
          <label htmlFor="bulk-add-tag" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Add tag
          </label>
          <div className="flex gap-2">
            <Input
              id="bulk-add-tag"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="Tag name"
            />
            <Button
              type="button"
              onClick={() => {
                bulkAddTag(selectedIds, tag);
                setTag("");
              }}
            >
              Add
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="bulk-remove-tag" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Remove tag
          </label>
          <div className="flex gap-2">
            <Input
              id="bulk-remove-tag"
              value={removeTag}
              onChange={(e) => setRemoveTag(e.target.value)}
              placeholder="Tag to remove"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                bulkRemoveTag(selectedIds, removeTag);
                setRemoveTag("");
              }}
            >
              Remove
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="bulk-collection" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Move to collection
          </label>
          <div className="flex flex-wrap gap-2">
            <Select
              id="bulk-collection"
              value={collectionId}
              onChange={(e) => {
                setCollectionId(e.target.value);
                setConfirmMove(false);
              }}
            >
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            {!confirmMove ? (
              <Button type="button" variant="secondary" onClick={() => setConfirmMove(true)}>
                Move…
              </Button>
            ) : (
              <>
                <p className="w-full text-xs text-zinc-600 dark:text-zinc-400">
                  Move {selectedIds.length} asset{selectedIds.length !== 1 ? "s" : ""} to{" "}
                  {collection?.name}?
                </p>
                <Button type="button" onClick={() => {
                  bulkMoveToCollection(selectedIds, collectionId);
                  setConfirmMove(false);
                }}>
                  Confirm
                </Button>
                <Button type="button" variant="secondary" onClick={() => setConfirmMove(false)}>
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
