import * as z from 'zod';

export const DELETE_ACCOUNT_KEYWORD = 'USUŃ' as const;
export const DELETE_ACCOUNT_ERROR =
  'Wpisz dokładnie „USUŃ”, aby potwierdzić usunięcie konta.' as const;

export const DeleteAccountSchema = z.object(
  {
    confirmation: z.literal(DELETE_ACCOUNT_KEYWORD, {
      error: DELETE_ACCOUNT_ERROR,
    }),
  },
  {
    error: DELETE_ACCOUNT_ERROR,
  }
);

export type DeleteAccountInput = z.infer<typeof DeleteAccountSchema>;
