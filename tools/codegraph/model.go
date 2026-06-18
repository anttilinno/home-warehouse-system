package main

// Symbol is one Go declaration (func/method/type/var/const) extracted from
// go/packages + go/types. ID is filled by the store after upsert.
type Symbol struct {
	ID        int64
	PkgPath   string // module-relative, e.g. internal/domain/warehouse/item
	Name      string
	Kind      string // func | method | type | var | const
	Recv      string // receiver type name for methods, else ""
	Exported  bool
	Generated bool // file carries the "Code generated ... DO NOT EDIT." marker
	File      string
	Line      int
	Signature string
	Doc       string
}

// Edge is a directed, typed relation between two extracted symbols. Edges whose
// endpoints fall outside the loaded module (stdlib, third-party) are dropped.
type Edge struct {
	Src  *Symbol
	Dst  *Symbol
	Kind string // calls | references | imports
}
