#!/usr/bin/env node

import * as yaml from "js-yaml";
import * as fs from "node:fs/promises";
import * as path from "node:path";

const rewrite = async (fname) => {
    const doc = yaml.load(await fs.readFile(fname, "utf8"));
    fs.writeFile(fname.replace("yaml", "json"), JSON.stringify(doc));
};

const watcher = async (fname) => {
    await rewrite(fname);
    for await (const _change of fs.watch(fname)) {
        await rewrite(fname);
    }
};

const files = [
    path.resolve(import.meta.dirname, "../syntaxes/par.tmLanguage.yaml"),
];

const args = process.argv.slice(2);
if (args.includes("-w")) {
    await Promise.all(files.map(watcher));
} else {
    await Promise.all(files.map(rewrite));
}
