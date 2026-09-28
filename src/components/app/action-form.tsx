'use client';

import { startTransition, type ComponentProps, type FormEvent } from 'react';

type ActionFormProps = Omit<ComponentProps<'form'>, 'action' | 'onSubmit'> & {
  /** The `formAction` returned by `useActionState`. */
  action: (formData: FormData) => void;
};

/**
 * A form that keeps what the user typed after the server answers.
 *
 * React resets a `<form action={…}>` after every submission, like a browser does after
 * a classic POST, and that would wipe the fields next to a validation error. So we send
 * the form data ourselves inside a transition, which React does not follow with a reset.
 * The `action` attribute stays for the moment before JavaScript has loaded: then the
 * browser posts the form straight to the Server Action.
 */
export function ActionForm({ action, ...props }: ActionFormProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => action(formData));
  }

  return <form action={action} onSubmit={handleSubmit} {...props} />;
}
