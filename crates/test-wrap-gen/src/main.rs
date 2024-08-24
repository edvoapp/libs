use std::fs::File;
use std::path::PathBuf;

use deno_ast::parse_module;
use deno_ast::swc::ast::Decl;
use deno_ast::swc::ast::FnDecl;
use deno_ast::swc::ast::Stmt;
use deno_ast::MediaType;
use deno_ast::ParseParams;
use deno_ast::SourceTextInfo;
use std::io::Write;

// TODO: pre-commit hook that runs this

fn main() -> std::io::Result<()> {
    // Empty out the wrappers dir
    for entry in std::fs::read_dir("./packages/tests/playwright-wrappers")? {
        std::fs::remove_file(entry?.path())?;
    }

    // read the tests dir
    for entry in std::fs::read_dir("./packages/ui/src/tests/e2e")? {
        let file = entry?.path();
        if file.to_str().unwrap().ends_with(".ts") {
            println!("Name: {}", file.display());
            do_file(file, "e2e")?;
        }
    }

    // read the tests dir
    for entry in std::fs::read_dir("./packages/ui/src/tests/unit")? {
        let file = entry?.path();
        if file.to_str().unwrap().ends_with(".ts") {
            println!("Name: {}", file.display());
            do_file(file, "spec")?;
        }
    }

    Ok(())
}

fn handle_fn(
    FnDecl {
        ident,
        declare: _,
        function: _,
    }: &FnDecl,
    output_file: &mut File,
    test_namespace: &str,
) -> std::io::Result<()> {
    let sym = ident.sym.to_string();
    println!("{sym:?}");

    if sym.starts_with("helper_") {
        // skips helpers
        return Ok(());
    }

    write!(
        output_file,
        r"
  test('{sym}', async () => {{
    try {{
      // The test will automatically pass if no errors are thrown
      await page.evaluate(() => (window as any).{test_namespace}.{sym}());
    }} catch (err) {{
      // If an error is thrown, explicitly fail the test.
      throw new Error(`Test failed due to error: ${{err}}`);
    }}
  }});
"
    )
}

fn do_file(path: PathBuf, ext: &str) -> std::io::Result<()> {
    let filename = path.as_path().file_name().unwrap().to_str().unwrap();
    if filename == "index.ts" {
        return Ok(());
    }
    let test_name = &filename[..filename.len() - 3];
    let e = format!(".{}.ts", ext);
    let mut output_file = std::fs::File::create(format!(
        "./packages/tests/playwright-wrappers/{}",
        filename.replace(".ts", &e)
    ))?;

    let specifier = path.to_str().unwrap().to_owned();
    let source_text = std::fs::read_to_string(&path).unwrap();
    let parsed_source = parse_module(ParseParams {
        specifier,
        media_type: MediaType::TypeScript,
        text_info: SourceTextInfo::new(source_text.into()),
        capture_tokens: true,
        maybe_syntax: None,
        scope_analysis: false,
    })
    .expect("should parse");

    let module = parsed_source.module();
    // if filename == "topic.ts" {
    //     println!("{:#?}", module);
    // }

    write!(
        output_file,
        r"import {{ expect, test, Page }} from '@playwright/test';

    test.describe('test {test_name}', () => {{
      let page: Page;

      test.beforeAll(async ({{ browser }}) => {{
        page = await browser.newPage();
        page.on('console', m => console.log(m.type(), m.text()));
        await page.goto('/test/auto/anon');
        await page.waitForSelector('#app > .desktop-layout');
      }});
    "
    )?;

    let test_namespace = if ext == "e2e" { "tests" } else { "unitTests" };

    for item in module.body.iter() {
        match item {
            deno_ast::swc::ast::ModuleItem::ModuleDecl(s) => match s {
                deno_ast::swc::ast::ModuleDecl::Import(_) => {}
                deno_ast::swc::ast::ModuleDecl::ExportDecl(e) => {
                    match e.decl {
                        Decl::Class(_) => {}
                        Decl::Fn(ref func) => handle_fn(func, &mut output_file, test_namespace)?,
                        Decl::Var(_) => {}
                        Decl::Using(_) => {}
                        Decl::TsInterface(_) => {}
                        Decl::TsTypeAlias(_) => {}
                        Decl::TsEnum(_) => {}
                        Decl::TsModule(_) => {}
                    };
                }
                deno_ast::swc::ast::ModuleDecl::ExportNamed(_) => {}
                deno_ast::swc::ast::ModuleDecl::ExportDefaultDecl(_) => {}
                deno_ast::swc::ast::ModuleDecl::ExportDefaultExpr(_) => {}
                deno_ast::swc::ast::ModuleDecl::ExportAll(_) => {}
                deno_ast::swc::ast::ModuleDecl::TsImportEquals(_) => {}
                deno_ast::swc::ast::ModuleDecl::TsExportAssignment(_) => {}
                deno_ast::swc::ast::ModuleDecl::TsNamespaceExport(_) => {}
            },
            deno_ast::swc::ast::ModuleItem::Stmt(s) => match s {
                Stmt::Block(_) => {}
                Stmt::Empty(_) => {}
                Stmt::Debugger(_) => {}
                Stmt::With(_) => {}
                Stmt::Return(_) => {}
                Stmt::Labeled(_) => {}
                Stmt::Break(_) => {}
                Stmt::Continue(_) => {}
                Stmt::If(_) => {}
                Stmt::Switch(_) => {}
                Stmt::Throw(_) => {}
                Stmt::Try(_) => {}
                Stmt::While(_) => {}
                Stmt::DoWhile(_) => {}
                Stmt::For(_) => {}
                Stmt::ForIn(_) => {}
                Stmt::ForOf(_) => {}
                Stmt::Decl(d) => match d {
                    Decl::Class(_) => {}
                    Decl::Fn(func) => handle_fn(func, &mut output_file, test_namespace)?,
                    Decl::Var(_) => {}
                    Decl::Using(_) => {}
                    Decl::TsInterface(_) => {}
                    Decl::TsTypeAlias(_) => {}
                    Decl::TsEnum(_) => {}
                    Decl::TsModule(_) => {}
                },
                Stmt::Expr(_) => {}
            },
        };
    }

    write!(
        output_file,
        r"
  test.afterAll(() => page.close());
}});
"
    )
}
