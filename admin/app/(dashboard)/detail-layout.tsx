import Link from 'next/link';
import type { ReactNode } from 'react';

import type { DeletableTable } from './actions';
import { DeleteButton } from './delete-button';

interface DetailField {
  readonly label: string;
  readonly value: ReactNode;
}

interface DeleteActionSpec {
  readonly table: DeletableTable;
  readonly id: string;
  readonly confirmLabel: string;
}

interface DetailLayoutProps {
  readonly backHref: string;
  readonly backLabel: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly fields?: readonly DetailField[];
  readonly body?: ReactNode;
  readonly media?: ReactNode;
  readonly deleteAction?: DeleteActionSpec;
  readonly children?: ReactNode;
}

// Shared shell for every content type's detail view -- back link, title,
// an optional key-value field grid, free-form body text, media, a delete
// action, and a children escape hatch for anything bespoke (e.g. missions'
// ordered stops list).
export function DetailLayout({
  backHref,
  backLabel,
  title,
  subtitle,
  fields,
  body,
  media,
  deleteAction,
  children,
}: DetailLayoutProps) {
  return (
    <div className="max-w-2xl space-y-6">
      <Link
        className="text-xs text-muted underline decoration-dotted hover:text-content"
        href={backHref}
      >
        ← {backLabel}
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h1 className="text-lg font-semibold text-content">{title}</h1>
          {subtitle ? <p className="text-xs text-muted">{subtitle}</p> : null}
        </div>
        {deleteAction ? (
          <DeleteButton
            confirmLabel={deleteAction.confirmLabel}
            id={deleteAction.id}
            table={deleteAction.table}
          />
        ) : null}
      </div>

      {fields && fields.length > 0 ? (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg border border-border bg-surface p-4 text-sm">
          {fields.map((field) => (
            <div key={field.label}>
              <dt className="text-xs text-muted">{field.label}</dt>
              <dd className="text-content">{field.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {body ? (
        <div className="whitespace-pre-wrap text-sm text-content">{body}</div>
      ) : null}
      {media}
      {children}
    </div>
  );
}
