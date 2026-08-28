alter table public.transactions
  drop constraint if exists transactions_tx_hash_key;

alter table public.transactions
  drop constraint if exists transactions_tx_kind_user_key;

alter table public.transactions
  add constraint transactions_tx_kind_user_key unique (tx_hash, kind, user_id);
