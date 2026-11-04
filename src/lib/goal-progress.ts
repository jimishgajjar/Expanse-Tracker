// Both the goal cards and Planning use the same definition of confirmed progress.
export type GoalProgress = {
  id:string; name:string; opening:string; reserved:string; outside:string;
  confirmed:string; reviewed:boolean; version:number;
};

export const goalProgressSelect = `SELECT g.id,g.name,g.target_amount,g.deadline::text AS deadline,g.color,g.created_at,
  g.saved_amount::text AS opening,hold.amount::text AS reserved,verified.amount::text AS outside,
  (hold.amount+verified.amount)::text AS confirmed,coalesce(r.version,0) AS version,
  coalesce(r.opening=g.saved_amount,false) AS reviewed
  FROM goals g
  CROSS JOIN LATERAL (SELECT coalesce(sum(delta),0.00) AS amount FROM goal_reservations
    WHERE workspace_id=g.workspace_id AND goal_id=g.id) hold
  LEFT JOIN LATERAL (SELECT opening,outside,version FROM goal_opening_reviews
    WHERE workspace_id=g.workspace_id AND goal_id=g.id ORDER BY version DESC LIMIT 1) r ON true
  CROSS JOIN LATERAL (SELECT CASE WHEN r.opening=g.saved_amount THEN r.outside ELSE 0.00 END AS amount) verified`;
