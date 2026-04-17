/**
 * LoansPage — legacy import name, now a thin re-export of LoansListPage.
 *
 * Phase 62-03 ships the real list page as `LoansListPage`. This module
 * keeps the existing `import { LoansPage } from "@/features/loans/LoansPage"`
 * in `routes/index.tsx` valid so the route keeps working during Wave 3 →
 * Wave 4 overlap. Plan 62-04 performs the direct router swap to
 * `LoansListPage` + the Lingui extraction sweep.
 */
export { LoansListPage as LoansPage } from "./LoansListPage";
