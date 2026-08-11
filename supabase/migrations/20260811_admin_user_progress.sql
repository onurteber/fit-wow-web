-- Admin paneli: kullanıcı ilerleme tablosu (başlangıçtan bu yana)
--
-- Dönem (7/30/90 gün) mantığı kaldırıldı: her kullanıcı için ilk kilo kaydından
-- son kilo kaydına kadar olan toplam ilerleme hesaplanır.

create or replace function public.get_admin_user_progress(
  p_meaningful_change_kg numeric default 0.5,
  p_maintain_tolerance_kg numeric default 1.0,
  p_goal_reached_kg numeric default 0.5
)
returns table (
  user_id uuid,
  user_name text,
  username text,
  goal_type text,
  goal_weight_kg numeric,
  entry_count integer,
  first_date date,
  first_weight_kg numeric,
  last_date date,
  last_weight_kg numeric,
  weight_delta_kg numeric,
  min_weight_kg numeric,
  max_weight_kg numeric,
  tracked_days integer,
  days_since_last_entry integer,
  weekly_change_kg numeric,
  first_kg_to_goal numeric,
  last_kg_to_goal numeric,
  goal_progress_percent numeric,
  progress_status text
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not exists (
    select 1 from public.admin_accounts a where a.id = auth.uid()
  ) then
    raise exception 'Bu veri sadece admin hesaplarına açık.' using errcode = '42501';
  end if;

  return query
  with agg as (
    select
      we.user_id as uid,
      count(*)::int as entry_count,
      min(we.date)::date as first_date,
      max(we.date)::date as last_date,
      (array_agg(we.weight_kg::numeric order by we.date asc, we.created_at asc, we.id asc))[1] as first_weight_kg,
      (array_agg(we.weight_kg::numeric order by we.date desc, we.created_at desc, we.id desc))[1] as last_weight_kg,
      min(we.weight_kg)::numeric as min_weight_kg,
      max(we.weight_kg)::numeric as max_weight_kg
    from public.weight_entries we
    where we.weight_kg is not null
    group by we.user_id
  ),
  base as (
    select
      p.id as uid,
      coalesce(nullif(btrim(p.display_name), ''), nullif('@' || p.username, '@'), p.id::text) as user_name,
      p.username::text as username,
      p.goal_type::text as goal_type,
      p.goal_weight_kg::numeric as goal_weight_kg,
      a.entry_count,
      a.first_date,
      a.last_date,
      round(a.first_weight_kg, 2) as first_weight_kg,
      round(a.last_weight_kg, 2) as last_weight_kg,
      round(a.min_weight_kg, 2) as min_weight_kg,
      round(a.max_weight_kg, 2) as max_weight_kg,
      round(a.last_weight_kg - a.first_weight_kg, 2) as weight_delta_kg,
      (a.last_date - a.first_date)::int as tracked_days,
      (current_date - a.last_date)::int as days_since_last_entry
    from public.profiles p
    join agg a on a.uid = p.id
  ),
  calc as (
    select
      b.*,
      case
        when b.tracked_days >= 1
          then round(b.weight_delta_kg * 7.0 / b.tracked_days, 2)
      end as weekly_change_kg,
      case
        when b.goal_weight_kg is not null
          then round(abs(b.first_weight_kg - b.goal_weight_kg), 2)
      end as first_kg_to_goal,
      case
        when b.goal_weight_kg is not null
          then round(abs(b.last_weight_kg - b.goal_weight_kg), 2)
      end as last_kg_to_goal
    from base b
  ),
  classified as (
    select
      c.*,
      case
        when c.first_kg_to_goal is not null and c.first_kg_to_goal > 0.01
          then round(
            ((c.first_kg_to_goal - c.last_kg_to_goal) / c.first_kg_to_goal) * 100,
            1
          )
      end as goal_progress_percent,
      case
        -- tek kayıt ya da aynı gün içindeki kayıtlar: kıyas yapılamaz
        when c.entry_count < 2 or c.tracked_days < 1
          then 'yetersiz_veri'

        -- hedef kiloya ulaşmış (tolerans içinde)
        when c.last_kg_to_goal is not null
         and c.last_kg_to_goal <= p_goal_reached_kg
          then 'hedefe_ulasti'

        -- hedef kilosu tanımlıysa yön hedefe göre belirlenir
        when c.last_kg_to_goal is not null
         and c.last_kg_to_goal < c.first_kg_to_goal - p_meaningful_change_kg
          then 'ilerleme'
        when c.last_kg_to_goal is not null
         and c.last_kg_to_goal > c.first_kg_to_goal + p_meaningful_change_kg
          then 'kotuye_gidiyor'
        when c.last_kg_to_goal is not null
          then 'stabil'

        -- hedef kilosu yoksa hedef tipine göre
        when c.goal_type = 'weight_loss'
         and c.weight_delta_kg <= -p_meaningful_change_kg
          then 'ilerleme'
        when c.goal_type = 'weight_loss'
         and c.weight_delta_kg >= p_meaningful_change_kg
          then 'kotuye_gidiyor'

        when c.goal_type in ('weight_gain', 'muscle_gain')
         and c.weight_delta_kg >= p_meaningful_change_kg
          then 'ilerleme'
        when c.goal_type in ('weight_gain', 'muscle_gain')
         and c.weight_delta_kg <= -p_meaningful_change_kg
          then 'kotuye_gidiyor'

        when c.goal_type = 'maintain'
         and abs(c.weight_delta_kg) <= p_maintain_tolerance_kg
          then 'hedefe_ulasti'
        when c.goal_type = 'maintain'
          then 'kotuye_gidiyor'

        when c.goal_type in ('weight_loss', 'weight_gain', 'muscle_gain')
          then 'stabil'

        else 'belirsiz'
      end as progress_status
    from calc c
  )
  select
    cl.uid,
    cl.user_name,
    cl.username,
    cl.goal_type,
    cl.goal_weight_kg,
    cl.entry_count,
    cl.first_date,
    cl.first_weight_kg,
    cl.last_date,
    cl.last_weight_kg,
    cl.weight_delta_kg,
    cl.min_weight_kg,
    cl.max_weight_kg,
    cl.tracked_days,
    cl.days_since_last_entry,
    cl.weekly_change_kg,
    cl.first_kg_to_goal,
    cl.last_kg_to_goal,
    cl.goal_progress_percent,
    cl.progress_status
  from classified cl
  order by
    case cl.progress_status
      when 'kotuye_gidiyor' then 1
      when 'stabil' then 2
      when 'ilerleme' then 3
      when 'hedefe_ulasti' then 4
      when 'yetersiz_veri' then 5
      else 6
    end,
    abs(cl.weight_delta_kg) desc,
    cl.last_date desc;
end;
$$;

revoke all on function public.get_admin_user_progress(numeric, numeric, numeric) from public, anon;
grant execute on function public.get_admin_user_progress(numeric, numeric, numeric) to authenticated;
