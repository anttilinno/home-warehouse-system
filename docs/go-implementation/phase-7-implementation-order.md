## Phase 7: Implementation Order

Execute in this order, writing tests first for each (TDD):

| Order | Domain | Rationale |
|-------|--------|-----------|
| 1 | Shared utilities | uuid, pagination, errors - foundation |
| 2 | User | Authentication foundation |
| 3 | Workspace | Multi-tenancy foundation |
| 4 | Workspace Member | RBAC, depends on User + Workspace |
| 5 | Notification | Standalone, references User |
| 6 | Category | Hierarchical, simpler than Location |
| 7 | Location | Hierarchical + search |
| 8 | Container | Depends on Location |
| 9 | Company | Simple CRUD |
| 10 | Label | Simple CRUD |
| 11 | Item | Core catalog, depends on Category, Company, Labels |
| 12 | Inventory | Depends on Item, Location, Container |
| 13 | Borrower | Simple CRUD |
| 14 | Loan | Complex, depends on Inventory, Borrower |
| 15 | Movement | Audit trail, depends on Inventory |
| 16 | Activity Log | Cross-cutting |
| 17 | Favorite | User preferences |
| 18 | Attachment | File handling |
| 19 | Deleted Records | PWA sync support |

---

