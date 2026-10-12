'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DecomposeTopicRow } from '@/features/ai/components/ai-dialog-rows';
import { estimateFromTopics } from '@/features/ai/drafts';
import type { DecompositionDraft, Topic } from '@/features/ai/schemas';

const SESSION_30 = 30;
const SESSION_45 = 45;
const SESSION_60 = 60;
const SESSION_75 = 75;
const SESSION_90 = 90;
const SESSION_105 = 105;
const SESSION_120 = 120;
const SESSION_135 = 135;
const SESSION_150 = 150;
const SESSION_165 = 165;
const SESSION_180 = 180;

export const SESSION_OPTIONS = [
  SESSION_30,
  SESSION_45,
  SESSION_60,
  SESSION_75,
  SESSION_90,
  SESSION_105,
  SESSION_120,
  SESSION_135,
  SESSION_150,
  SESSION_165,
  SESSION_180,
] as const;

export const DEFAULT_NEW_TOPIC_MINUTES = 45;

export interface DecomposeReviewStepProps {
  draft: DecompositionDraft;
  onDraftChange: (draft: DecompositionDraft) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

interface DecomposeSessionSelectProps {
  sessionMinutes: number;
  onChange: (sessionMinutes: number) => void;
}

function DecomposeSessionSelect({ sessionMinutes, onChange }: DecomposeSessionSelectProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Label htmlFor="decompose-session-select" className="text-xs">Długość sesji pracy:</Label>
      <select
        id="decompose-session-select"
        value={sessionMinutes}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs outline-none"
      >
        {SESSION_OPTIONS.map((mins) => (
          <option key={mins} value={mins}>{mins} min</option>
        ))}
      </select>
    </div>
  );
}

interface DecomposeReviewFooterProps {
  estimateMinutes: number;
  canSubmit: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function DecomposeReviewFooter({
  estimateMinutes,
  canSubmit,
  isSubmitting,
  onCancel,
  onConfirm,
}: DecomposeReviewFooterProps) {
  return (
    <>
      <div className="flex items-center justify-between border-t border-border pt-2 text-xs">
        <span className="text-muted-foreground">Łączny szacowany czas:</span>
        <span className="font-medium">{estimateMinutes} min</span>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} disabled={isSubmitting} type="button">Anuluj</Button>
        <Button onClick={onConfirm} disabled={isSubmitting || !canSubmit} type="button">
          {isSubmitting ? 'Zapisywanie...' : 'Utwórz zadanie'}
        </Button>
      </div>
    </>
  );
}

export function DecomposeReviewStep({
  draft,
  onDraftChange,
  onConfirm,
  onCancel,
  isSubmitting,
}: DecomposeReviewStepProps) {
  const handleAddTopic = () => {
    const newTopic: Topic = { title: 'Nowy temat', workMinutes: DEFAULT_NEW_TOPIC_MINUTES };
    const topics = [...draft.topics, newTopic];
    onDraftChange({ ...draft, topics, estimateMinutes: estimateFromTopics(topics) });
  };
  const handleTitleChange = (index: number, title: string) => {
    onDraftChange({ ...draft, topics: draft.topics.map((t, i) => (i === index ? { ...t, title } : t)) });
  };
  const handleMinutesChange = (index: number, workMinutes: number) => {
    const topics = draft.topics.map((t, i) => (i === index ? { ...t, workMinutes } : t));
    onDraftChange({ ...draft, topics, estimateMinutes: estimateFromTopics(topics) });
  };
  const handleRemoveTopic = (index: number) => {
    const topics = draft.topics.filter((_, i) => i !== index);
    onDraftChange({ ...draft, topics, estimateMinutes: estimateFromTopics(topics) });
  };

  return (
    <div className="space-y-4 py-2" data-slot="decompose-review-step">
      {draft.summary && (
        <div className="rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground leading-relaxed">
          {draft.summary}
        </div>
      )}
      <DecomposeSessionSelect
        sessionMinutes={draft.sessionMinutes}
        onChange={(sessionMinutes) => onDraftChange({ ...draft, sessionMinutes })}
      />
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">Tematy do zrobienia:</span>
          <Button type="button" variant="ghost" size="xs" onClick={handleAddTopic} className="text-xs text-primary">
            + Dodaj temat
          </Button>
        </div>
        <ScrollArea className="max-h-52 pr-2">
          <div className="space-y-2">
            {draft.topics.map((topic, index) => (
              <DecomposeTopicRow
                key={index}
                index={index}
                title={topic.title}
                workMinutes={topic.workMinutes}
                canRemove={draft.topics.length > 1}
                onTitleChange={(title) => handleTitleChange(index, title)}
                onMinutesChange={(mins) => handleMinutesChange(index, mins)}
                onRemove={() => handleRemoveTopic(index)}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
      <DecomposeReviewFooter
        estimateMinutes={draft.estimateMinutes}
        canSubmit={draft.topics.length > 0}
        isSubmitting={isSubmitting}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    </div>
  );
}
