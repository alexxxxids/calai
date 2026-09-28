import 'server-only';
import type { Metadata } from 'next';
import { PlusIcon } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { listTaskTypes } from '@/features/task-types/queries';
import { Button } from '@/components/ui/button';
import { TaskTypeItem } from '@/features/task-types/components/task-type-item';
import { TaskTypeDialog } from '@/features/task-types/components/task-type-dialog';

export const metadata: Metadata = {
  title: 'Typy zadań | CalAI',
  description: 'Zarządzaj kategoriami zadań, kolorami i poziomami obciążenia energią.',
};

export default async function TaskTypesPage() {
  const { supabase, user } = await requireUser();
  const allTypes = await listTaskTypes(supabase, user.id);
  const activeCatalogTypes = allTypes.filter((t) => !t.is_one_off);

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Typy zadań
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Zarządzaj stałymi kategoriami zadań, kolorami w kalendarzu oraz poziomem obciążenia energią.
          </p>
        </div>
        <TaskTypeDialog>
          <Button className="gap-2">
            <PlusIcon className="size-4" aria-hidden="true" />
            Dodaj typ
          </Button>
        </TaskTypeDialog>
      </div>

      <div className="rounded-xl border border-border bg-card divide-y divide-border shadow-xs">
        {activeCatalogTypes.map((taskType) => (
          <TaskTypeItem key={taskType.id} taskType={taskType} />
        ))}
      </div>
    </div>
  );
}
