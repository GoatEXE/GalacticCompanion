# About This Page
- I've collected information about Star Wars: Age of Rebellion, a table top roleplaying game, and created a reference for it for nearseamless information gathering. 
- I intend to use this web app for personal use only.
- I am not affiliated with the linked content in any way
- This page dynamically uses markdown files and translates them into JSON to populate cards in the Rules Reference section. 

# Adding Cards to the References Documentation
- See [docs/CONTENT_GUIDE.md](docs/CONTENT_GUIDE.md) for the content format, citation guidance, and Markdown-vs-YAML recommendation.
- Create a markdown file in the `Markdown/<Ruleset>/` subdirectory.
- Add the card title, Font Awesome icon classes, and repo-relative file path to the matching root manifest, such as `personnel_manifest.json` or `vehicle_manifest.json`.
- Before publishing content changes, run `node tools/validate-content.js`.

# Quick Format Note
- Keep prose in Markdown and structure/metadata in JSON manifests. Avoid YAML for now because this static browser app would need a YAML parser dependency or custom parsing without a clear benefit for the current content.

# Credits
- Font Awesome used for icons.
- Favicon from svgrepo.com .
- Background images came from a collection of desktop wallpapers I've kept throughout the years. I'd honor the artists if I knew where they came from.
- Linked sources and core rules are owned by their respective domain owners.
- Made with love from Arkansas.