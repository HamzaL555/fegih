import { ReactNode } from 'react';
import { UseQueryResult } from '@tanstack/react-query';

import { RemoteState } from '@/components/RemoteState';

export function RemoteQueryView<T>({
  query,
  children,
  select,
  isEmpty,
  loadingLabel,
  emptyTitle,
  emptyDescription,
}: {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
  select?: (data: T) => boolean;
  isEmpty?: boolean;
  loadingLabel?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const empty = isEmpty ?? (select ? select(query.data as T) : false);
  return (
    <RemoteState
      isLoading={query.isPending}
      isError={query.isError}
      error={query.error}
      isEmpty={empty}
      onRetry={() => void query.refetch()}
      loadingLabel={loadingLabel}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
    >
      {query.data !== undefined ? children(query.data) : null}
    </RemoteState>
  );
}
