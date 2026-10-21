-- Advance directly to a later fulfillment stage in one transaction. Reuse the
-- existing checks and audit events; a failure rolls back every intermediate step.
create function public.advance_order(p_order uuid,p_status text,p_tracking text default '',p_courier text default '',p_reason text default '')
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare
  o orders%rowtype;
  stages text[] := array['pending','confirmed','processing','packed','shipped','out_for_delivery','delivered'];
  current_index int;
  target_index int;
  step int;
begin
  if not can_manage('orders') then raise exception 'Forbidden'; end if;
  select * into o from orders where id=p_order for update;
  if not found then raise exception 'Order not found'; end if;
  current_index := array_position(stages,o.status);
  target_index := array_position(stages,p_status);
  if current_index is null or target_index is null or target_index <= current_index then
    raise exception 'Invalid order transition';
  end if;
  for step in current_index+1..target_index loop
    perform public.transition_order(p_order,stages[step],p_tracking,p_courier,p_reason);
    -- now() is identical across the transaction. Give generated stage events
    -- distinct timestamps so the existing timeline keeps them in stage order.
    update public.admin_audit_logs set created_at=clock_timestamp()
      where entity='orders' and entity_id=p_order::text
        and action='ORDER_TRANSITION' and actor_id=auth.uid()
        and details->>'from'=stages[step-1] and details->>'to'=stages[step]
        and created_at=now();
  end loop;
end $$;
revoke all on function public.advance_order(uuid,text,text,text,text) from public;
grant execute on function public.advance_order(uuid,text,text,text,text) to authenticated;
