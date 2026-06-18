package main

import (
	"go/ast"
	"go/token"
	"go/types"
	"regexp"
	"strings"

	"golang.org/x/tools/go/packages"
)

// genMarker matches the canonical "// Code generated ... DO NOT EDIT." line
// (sqlc, protoc, stringer, etc.) so generated files can be flagged.
var genMarker = regexp.MustCompile(`^// Code generated .* DO NOT EDIT\.$`)

// Extract loads every package under patterns (e.g. "./...") rooted at dir and
// returns the symbol set plus the call/reference/import edges between symbols
// that live inside the loaded module. Edges to stdlib/third-party are dropped.
func Extract(dir string, patterns ...string) ([]*Symbol, []*Edge, error) {
	cfg := &packages.Config{
		Mode: packages.NeedName | packages.NeedFiles | packages.NeedSyntax |
			packages.NeedTypes | packages.NeedTypesInfo | packages.NeedDeps |
			packages.NeedImports | packages.NeedModule,
		Dir: dir,
	}
	pkgs, err := packages.Load(cfg, patterns...)
	if err != nil {
		return nil, nil, err
	}
	if packages.PrintErrors(pkgs) > 0 {
		// Type errors degrade edge accuracy but don't abort — partial graph is
		// still useful for refactor triage.
	}

	modPrefix := modulePrefix(pkgs)

	// objSym maps each defining types.Object to its Symbol so Uses occurrences
	// in any package resolve to the same node (identity across the load).
	objSym := map[types.Object]*Symbol{}
	var symbols []*Symbol

	// Pass 1 — collect declared symbols across all loaded packages.
	for _, pkg := range pkgs {
		if pkg.TypesInfo == nil {
			continue
		}
		genFiles := generatedFiles(pkg)
		relPkg := strings.TrimPrefix(pkg.PkgPath, modPrefix)
		for ident, obj := range pkg.TypesInfo.Defs {
			s := symbolFor(ident, obj, pkg.Fset, relPkg, genFiles, pkg.Syntax)
			if s == nil {
				continue
			}
			objSym[obj] = s
			symbols = append(symbols, s)
		}
	}

	// Pass 2 — walk bodies for calls/references. (imports/implements/embeds
	// edges are deferred to a later pass; they need pkg + interface-set nodes.)
	var edges []*Edge
	seen := map[[3]any]bool{}
	add := func(src, dst *Symbol, kind string) {
		if src == nil || dst == nil || src == dst {
			return
		}
		k := [3]any{src, dst, kind}
		if seen[k] {
			return
		}
		seen[k] = true
		edges = append(edges, &Edge{Src: src, Dst: dst, Kind: kind})
	}

	for _, pkg := range pkgs {
		if pkg.TypesInfo == nil {
			continue
		}
		for _, file := range pkg.Syntax {
			edgesFromFile(file, pkg.TypesInfo, objSym, add)
		}
	}
	return symbols, edges, nil
}

// symbolFor builds a Symbol from a definition, or nil for things we don't index
// (blank/unnamed idents, struct fields, func params/locals, labels).
func symbolFor(ident *ast.Ident, obj types.Object, fset *token.FileSet, relPkg string, gen map[string]bool, files []*ast.File) *Symbol {
	if obj == nil || ident.Name == "_" {
		return nil
	}
	kind, recv := "", ""
	switch o := obj.(type) {
	case *types.Func:
		kind = "func"
		if sig, ok := o.Type().(*types.Signature); ok && sig.Recv() != nil {
			kind = "method"
			recv = recvName(sig.Recv().Type())
		}
	case *types.TypeName:
		kind = "type"
	case *types.Var:
		if !o.IsField() && obj.Parent() == obj.Pkg().Scope() {
			kind = "var" // package-level var only
		} else {
			return nil
		}
	case *types.Const:
		kind = "const"
	default:
		return nil
	}

	pos := fset.Position(ident.Pos())
	return &Symbol{
		PkgPath:   relPkg,
		Name:      ident.Name,
		Kind:      kind,
		Recv:      recv,
		Exported:  obj.Exported(),
		Generated: gen[pos.Filename],
		File:      pos.Filename,
		Line:      pos.Line,
		Signature: types.ObjectString(obj, func(*types.Package) string { return "" }),
		Doc:       docFor(ident, files),
	}
}

// edgesFromFile walks one file, tracking the enclosing top-level func/method so
// each Uses occurrence becomes a calls/references edge from that symbol.
func edgesFromFile(file *ast.File, info *types.Info, objSym map[types.Object]*Symbol, add func(src, dst *Symbol, kind string)) {
	for _, decl := range file.Decls {
		fn, ok := decl.(*ast.FuncDecl)
		if !ok || fn.Body == nil {
			continue
		}
		src := objSym[info.ObjectOf(fn.Name)]
		if src == nil {
			continue
		}
		ast.Inspect(fn.Body, func(n ast.Node) bool {
			switch e := n.(type) {
			case *ast.CallExpr:
				if dst := usedSym(callee(e.Fun), info, objSym); dst != nil {
					add(src, dst, "calls")
				}
			case *ast.Ident:
				if dst := usedSym(e, info, objSym); dst != nil {
					add(src, dst, "references")
				}
			}
			return true
		})
	}
}

// callee unwraps the function expression of a call to its name ident
// (handles plain f() and pkg.F() / x.M() selector forms).
func callee(fun ast.Expr) *ast.Ident {
	switch f := fun.(type) {
	case *ast.Ident:
		return f
	case *ast.SelectorExpr:
		return f.Sel
	}
	return nil
}

func usedSym(id *ast.Ident, info *types.Info, objSym map[types.Object]*Symbol) *Symbol {
	if id == nil {
		return nil
	}
	if obj := info.Uses[id]; obj != nil {
		return objSym[obj]
	}
	return nil
}

func recvName(t types.Type) string {
	if p, ok := t.(*types.Pointer); ok {
		t = p.Elem()
	}
	if n, ok := t.(*types.Named); ok {
		return n.Obj().Name()
	}
	return ""
}

// docFor returns the godoc for ident's enclosing declaration, if any.
func docFor(ident *ast.Ident, files []*ast.File) string {
	for _, f := range files {
		for _, d := range f.Decls {
			switch decl := d.(type) {
			case *ast.FuncDecl:
				if decl.Name == ident && decl.Doc != nil {
					return strings.TrimSpace(decl.Doc.Text())
				}
			case *ast.GenDecl:
				for _, spec := range decl.Specs {
					switch s := spec.(type) {
					case *ast.TypeSpec:
						if s.Name == ident && decl.Doc != nil {
							return strings.TrimSpace(decl.Doc.Text())
						}
					case *ast.ValueSpec:
						for _, n := range s.Names {
							if n == ident && decl.Doc != nil {
								return strings.TrimSpace(decl.Doc.Text())
							}
						}
					}
				}
			}
		}
	}
	return ""
}

func generatedFiles(pkg *packages.Package) map[string]bool {
	gen := map[string]bool{}
	for i, file := range pkg.Syntax {
		for _, cg := range file.Comments {
			for _, c := range cg.List {
				if genMarker.MatchString(c.Text) {
					gen[pkg.Fset.Position(file.Pos()).Filename] = true
				}
			}
		}
		_ = i
	}
	return gen
}

func modulePrefix(pkgs []*packages.Package) string {
	for _, p := range pkgs {
		if p.Module != nil && p.Module.Path != "" {
			return p.Module.Path + "/"
		}
	}
	return ""
}
