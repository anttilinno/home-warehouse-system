package main

import (
	"context"
	"fmt"
	"os"
	"sort"
	"text/tabwriter"
)

// archQuery is a named, read-only architecture report over the symbol/edge
// graph. All are pure SQL traversal — no embeddings required (that's A2).
type archQuery struct {
	desc string
	sql  string
}

// layerExpr maps a pkg_path to its architectural layer. Reused across reports
// so the layering rules live in exactly one place.
const layerExpr = `CASE
    WHEN %[1]s LIKE 'internal/api%%'    THEN 'api'
    WHEN %[1]s LIKE 'internal/domain%%' THEN 'domain'
    WHEN %[1]s LIKE 'internal/infra%%'  THEN 'infra'
    WHEN %[1]s LIKE 'internal/shared%%' THEN 'shared'
    WHEN %[1]s LIKE 'internal/jobs%%' OR %[1]s LIKE 'internal/worker%%' THEN 'jobs'
    WHEN %[1]s LIKE 'cmd/%%'            THEN 'cmd'
    ELSE 'other' END`

func archQueries() map[string]archQuery {
	srcLayer := fmt.Sprintf(layerExpr, "ss.pkg_path")
	dstLayer := fmt.Sprintf(layerExpr, "ds.pkg_path")

	return map[string]archQuery{
		"summary": {
			"counts overview",
			`SELECT 'symbols' metric, count(*)::text value FROM symbols
			 UNION ALL SELECT 'edges', count(*)::text FROM edges
			 UNION ALL SELECT 'generated symbols', count(*)::text FROM symbols WHERE generated
			 UNION ALL SELECT 'packages', count(DISTINCT pkg_path)::text FROM symbols`,
		},

		// God-files: most declarations + highest combined fan-in/out. Generated
		// (sqlc) excluded — they're not refactor targets.
		"god-files": {
			"files ranked by size + coupling (sqlc excluded)",
			`SELECT s.file,
			        count(*)                            AS symbols,
			        coalesce(sum(io.fan_in),0)::bigint  AS fan_in,
			        coalesce(sum(io.fan_out),0)::bigint AS fan_out
			 FROM symbols s
			 LEFT JOIN LATERAL (
			     SELECT (SELECT count(*) FROM edges e WHERE e.dst_id = s.id) AS fan_in,
			            (SELECT count(*) FROM edges e WHERE e.src_id = s.id) AS fan_out
			 ) io ON true
			 WHERE NOT s.generated
			 GROUP BY s.file
			 ORDER BY symbols DESC, fan_in + fan_out DESC
			 LIMIT 15`,
		},

		// Hotspots: most-referenced symbols (god-objects / choke points).
		"hotspots": {
			"symbols ranked by fan-in (most depended-upon)",
			`SELECT s.pkg_path, s.name, s.kind, count(*) AS fan_in
			 FROM edges e JOIN symbols s ON s.id = e.dst_id
			 GROUP BY s.id, s.pkg_path, s.name, s.kind
			 ORDER BY fan_in DESC LIMIT 15`,
		},

		// Layer dependency matrix: edge counts between architectural layers.
		"layers": {
			"layer→layer edge matrix",
			`SELECT ` + srcLayer + ` AS src_layer,
			        ` + dstLayer + ` AS dst_layer,
			        count(*) AS edges
			 FROM edges e
			 JOIN symbols ss ON ss.id = e.src_id
			 JOIN symbols ds ON ds.id = e.dst_id
			 WHERE ss.pkg_path <> ds.pkg_path
			 GROUP BY 1,2 ORDER BY 1,3 DESC`,
		},

		// Layering violations, tuned to this codebase's VERTICAL-SLICE layout
		// (domain modules own their HTTP routes and call shared api/middleware
		// helpers — that is by design, NOT a breach, so api/middleware is
		// exempt). Genuine breaches: importing the transport core (api, minus
		// middleware), the shared kernel depending on anything inner, and any
		// dependency on cmd (the composition root).
		"violations": {
			"genuine layer breaches (vertical-slice aware)",
			`WITH e2 AS (
			   SELECT ` + srcLayer + ` AS sl, ` + dstLayer + ` AS dl,
			          ss.pkg_path sp, ss.name sn, ds.pkg_path dp, ds.name dn
			   FROM edges e
			   JOIN symbols ss ON ss.id = e.src_id
			   JOIN symbols ds ON ds.id = e.dst_id
			 )
			 SELECT sl||' → '||dl AS violation, sp||'.'||sn AS from_sym, dp||'.'||dn AS to_sym
			 FROM e2
			 WHERE (dl = 'api'    AND sl NOT IN ('api','cmd') AND dp NOT LIKE 'internal/api/middleware%')
			    OR (sl = 'shared' AND dl <> 'shared')
			    OR (dl = 'cmd'    AND sl <> 'cmd')
			 ORDER BY violation LIMIT 50`,
		},

		// Cross-domain coupling: edges between different bounded-context modules
		// (segment 3 of internal/domain/<module>/...). In a vertical-slice
		// layout these are the real coupling smell — modules should be islands.
		"cross-domain": {
			"edges between different domain modules (module coupling)",
			`WITH dd AS (
			   SELECT split_part(ss.pkg_path,'/',3) sm, split_part(ds.pkg_path,'/',3) dm,
			          ss.pkg_path sp, ss.name sn, ds.pkg_path dp, ds.name dn
			   FROM edges e
			   JOIN symbols ss ON ss.id = e.src_id
			   JOIN symbols ds ON ds.id = e.dst_id
			   WHERE ss.pkg_path LIKE 'internal/domain/%' AND ds.pkg_path LIKE 'internal/domain/%'
			 )
			 SELECT sm AS from_mod, dm AS to_mod, count(*) AS edges
			 FROM dd WHERE sm <> dm
			 GROUP BY 1,2 ORDER BY edges DESC LIMIT 25`,
		},

		// Dead-code candidates: non-exported funcs/methods with zero inbound
		// edges. CANDIDATES ONLY — no reflection/route-table/interface-dispatch
		// awareness yet, so exported symbols and init/main are excluded.
		"deadcode": {
			"unreferenced non-exported funcs/methods (candidates)",
			`SELECT s.pkg_path, s.name, s.kind, s.file, s.line
			 FROM symbols s
			 WHERE s.kind IN ('func','method')
			   AND NOT s.exported AND NOT s.generated
			   AND s.name NOT IN ('init','main')
			   AND NOT EXISTS (SELECT 1 FROM edges e WHERE e.dst_id = s.id)
			 ORDER BY s.pkg_path, s.name LIMIT 50`,
		},

		// Refactor targets: composite score = declarations × coupling per file.
		"targets": {
			"refactor priority = symbols × (fan_in+fan_out)",
			`SELECT s.file, count(*) AS symbols,
			        coalesce(sum((SELECT count(*) FROM edges e WHERE e.dst_id=s.id)
			                   + (SELECT count(*) FROM edges e WHERE e.src_id=s.id)),0)::bigint AS coupling,
			        (count(*) * coalesce(sum((SELECT count(*) FROM edges e WHERE e.dst_id=s.id)
			                              + (SELECT count(*) FROM edges e WHERE e.src_id=s.id)),0))::bigint AS score
			 FROM symbols s WHERE NOT s.generated
			 GROUP BY s.file ORDER BY score DESC LIMIT 15`,
		},
	}
}

// RunQuery executes a named arch report and prints an aligned table.
func (s *Store) RunQuery(ctx context.Context, name string) error {
	q, ok := archQueries()[name]
	if !ok {
		return fmt.Errorf("unknown query %q; %s", name, queryList())
	}
	rows, err := s.pool.Query(ctx, q.sql)
	if err != nil {
		return err
	}
	defer rows.Close()

	w := tabwriter.NewWriter(os.Stdout, 0, 2, 2, ' ', 0)
	defer w.Flush()

	cols := rows.FieldDescriptions()
	for i, c := range cols {
		if i > 0 {
			fmt.Fprint(w, "\t")
		}
		fmt.Fprint(w, string(c.Name))
	}
	fmt.Fprintln(w)

	n := 0
	for rows.Next() {
		vals, err := rows.Values()
		if err != nil {
			return err
		}
		for i, v := range vals {
			if i > 0 {
				fmt.Fprint(w, "\t")
			}
			fmt.Fprintf(w, "%v", trimFile(v))
		}
		fmt.Fprintln(w)
		n++
	}
	if err := rows.Err(); err != nil {
		return err
	}
	fmt.Fprintf(w, "\n(%s — %d rows)\n", q.desc, n)
	return nil
}

// trimFile shortens absolute backend paths for readable output.
func trimFile(v any) any {
	s, ok := v.(string)
	if !ok {
		return v
	}
	const root = "/backend/"
	if i := indexOf(s, root); i >= 0 {
		return s[i+len(root):]
	}
	return s
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}

func queryList() string {
	names := make([]string, 0, len(archQueries()))
	for n := range archQueries() {
		names = append(names, n)
	}
	sort.Strings(names)
	out := "available: "
	for i, n := range names {
		if i > 0 {
			out += ", "
		}
		out += n
	}
	return out
}
