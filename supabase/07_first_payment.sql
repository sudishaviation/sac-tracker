-- 07: tuition is billed by HAA directly; SAC only notes the first payment.
update public.step_templates set
  title = 'First payment made to HAA',
  help = 'Your first payment to HAA, made from your HAA payment portal (you need your NOCs to transfer from Nepal). Tick it and add the amount in USD if you like. HAA invoices all later payments directly — you do not need to track them here.',
  fields = '[{"k": "date", "t": "date", "l": "Paid on"}, {"k": "amount_usd", "t": "number", "l": "Amount paid (USD) \u2014 optional"}]'::jsonb,
  fee_key = null
where key = 'tuition_transfer';
