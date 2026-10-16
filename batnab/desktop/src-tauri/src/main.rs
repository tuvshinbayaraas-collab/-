// Batnab for Windows: one window that opens the website, so it starts from the Start menu and the taskbar like any
// other program. The site itself always comes from batnab.web.app, so it is up to date without reinstalling.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{WebviewUrl, WebviewWindowBuilder};

const SITE: &str = "https://batnab.web.app/";

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(SITE.parse().expect("site address")))
                .title("Batnab")
                .inner_size(1200.0, 820.0)
                .min_inner_size(380.0, 560.0)
                .center()
                // Lets the site know it runs inside the program (it then doesn't offer "Апп татах").
                .initialization_script("window.__BATNAB_DESKTOP__ = true;")
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Batnab could not start");
}
