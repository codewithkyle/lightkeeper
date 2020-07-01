#!/usr/bin/env node

const argv = require("yargs").argv;
const prompts = require("prompts");
const path = require("path");
const fs = require("fs");
const cwd = process.cwd();
const packageJson = require("./package.json");
const semver = require("semver");
const version = packageJson.engines.node;

if (!semver.satisfies(process.version, version)) {
    const rawVersion = version.replace(/[^\d\.]*/, "");
    console.log(`Lightkeeper requires at least Node v${rawVersion} and you have ${process.version}`);
    process.exit(1);
}

class Lightkeeper {
    constructor(url, output, budget) {
        this.outputDir = path.resolve(cwd, output);
        this.budgetFile = budget ? path.resolve(cwd, budget) : null;
        this.run();
    }

    async run() {
        try {
            if (!fs.existsSync(this.outputDir)) {
                await fs.mkdir(this.outputDir, { recursive: true });
            }
        } catch (error) {
            console.error(error);
            process.exit(1);
        }
    }
}

let url = argv.u || argv.url || null;
const output = argv.o || argv.output || "audits";
const budget = argv.b || argv.budget || null;
if (!url) {
    (async () => {
        const response = await prompts({
            type: "text",
            name: "value",
            message: "URL to audit:",
            validate: (value) => (!value.length ? `A URL is required.` : true),
        });
        new Lightkeeper(response.value, output, budget);
    })();
} else {
    new Lightkeeper(url, output, budget);
}
