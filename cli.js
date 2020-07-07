#!/usr/bin/env node

const argv = require("yargs").argv;
const prompts = require("prompts");
const path = require("path");
const fs = require("fs");
const cwd = process.cwd();
const packageJson = require("./package.json");
const semver = require("semver");
const version = packageJson.engines.node;
const ora = require("ora");
const lighthouse = require("lighthouse");
const chromeLauncher = require("chrome-launcher");
const chalk = require("chalk");
const boxen = require("boxen");

if (!semver.satisfies(process.version, version)) {
    const rawVersion = version.replace(/[^\d\.]*/, "");
    console.log(`Lightkeeper requires at least Node v${rawVersion} and you have ${process.version}`);
    process.exit(1);
}

class Lightkeeper {
    constructor(url, output, budget) {
        this.outputDir = output ? path.resolve(cwd, output) : null;
        this.budgetFile = budget ? path.resolve(cwd, budget) : null;
        this.chromeFlags = {
            chromeFlags: ["--show-paint-rects"],
        };
        this.chromeConfig = {
            extends: "lighthouse:default",
        };
        this.run(url);
    }

    async audit(url) {
        return chromeLauncher.launch({ chromeFlags: this.chromeFlags.chromeFlags }).then((chrome) => {
            this.chromeFlags.port = chrome.port;
            return lighthouse(url, this.chromeFlags, this.chromeConfig).then((results) => {
                return chrome.kill().then(() => results);
            });
        });
    }

    assembleReport(lighthouseReport, url) {
        const date = new Date(lighthouseReport.fetchTime);
        const report = {
            url: url,
            date: `${date.toLocaleDateString()} at ${date.toLocaleTimeString()}`,
            lighthouse: lighthouseReport.lighthouseVersion,
        };

        report.scores = {
            performance: lighthouseReport.categories.performance.score * 100,
            accessibility: lighthouseReport.categories.accessibility.score * 100,
            seo: lighthouseReport.categories.seo.score * 100,
        };

        report.perf = {
            fcp: lighthouseReport.audits["first-contentful-paint"].score * 100,
            lcp: lighthouseReport.audits["largest-contentful-paint"].score * 100,
            fmp: lighthouseReport.audits["first-meaningful-paint"].score * 100,
            cls: lighthouseReport.audits["cumulative-layout-shift"].score * 100,
            speedIndex: lighthouseReport.audits["speed-index"].score * 100,
            tbt: lighthouseReport.audits["total-blocking-time"].score * 100,
            fip: lighthouseReport.audits["max-potential-fid"].score * 100,
        };

        report.accessibility = {
            ariaRoles: lighthouseReport.audits["aria-roles"].score === 0 ? "Failed" : "Passed",
            contrast: lighthouseReport.audits["color-contrast"].score === 0 ? "Failed" : "Passed",
            alt: lighthouseReport.audits["image-alt"].score === 0 ? "Failed" : "Passed",
            labels: lighthouseReport.audits["label"].score === 0 ? "Failed" : "Passed",
            fontSize: lighthouseReport.audits["font-size"].score ? "Passed" : "Failed",
            tapTargets: lighthouseReport.audits["tap-targets"].score ? "Passed" : "Failed",
        };

        report.quality = {
            weight: `${lighthouseReport.audits["total-byte-weight"].numericValue} bytes`,
            lazyImages: lighthouseReport.audits["offscreen-images"].score ? "Passed" : "Failed",
            minifiedCSS: lighthouseReport.audits["unminified-css"].score ? "Failed" : "Passed",
            minifiedJS: lighthouseReport.audits["unminified-javascript"].score ? "Failed" : "Passed",
            optimizedImages: lighthouseReport.audits["uses-optimized-images"].score ? "Passed" : "Failed",
            responsiveImages: lighthouseReport.audits["uses-responsive-images"].score ? "Passed" : "Failed",
            domSize: lighthouseReport.audits["dom-size"].score ? "Passed" : "Failed",
            noopener: lighthouseReport.audits["external-anchors-use-rel-noopener"].score ? "Passed" : "Failed",
            notifyOnStart: lighthouseReport.audits["notification-on-start"].score ? "Passed" : "Failed",
            vulnerableLibraries: lighthouseReport.audits["no-vulnerable-libraries"].score ? "Passed" : "Failed",
        };

        report.seo = {
            meta: lighthouseReport.audits["meta-description"].score ? "Passed" : "Failed",
            crawlable: lighthouseReport.audits["is-crawlable"].score ? "Passed" : "Failed",
            canonical: lighthouseReport.audits["canonical"].score ? "Passed" : "Failed",
            robots: lighthouseReport.audits["robots-txt"].score ? "Passed" : "Failed",
        };

        return report;
    }

    checkBudget(budget, report) {}

    checkPassFail(value) {
        if (value === "Passed") {
            return chalk.green("Passed");
        }
        return chalk.red("Failed");
    }

    displayReport(report) {
        let message = "";
        message += `Created: ${chalk.yellow(report.date)}\n`;
        message += `Lighthouse: ${chalk.yellow("v")}${chalk.yellow(report.lighthouse)}\n`;
        message += `URL: ${chalk.blue(report.url)}\n\n`;

        message += `Performance: ${chalk.blue(report.scores.performance)}${chalk.blue("/100")}\n`;
        message += `Accessibility: ${chalk.blue(report.scores.accessibility)}${chalk.blue("/100")}\n`;
        message += `SEO: ${chalk.blue(report.scores.seo)}${chalk.blue("/100")}\n\n`;

        message += `${chalk.magenta("Performance Audit")}\n`;
        message += `FCP: ${chalk.yellow(report.perf.fcp)}\n`;
        message += `LCP: ${chalk.yellow(report.perf.lcp)}\n`;
        message += `FMP: ${chalk.yellow(report.perf.fmp)}\n`;
        message += `CLS: ${chalk.yellow(report.perf.cls)}\n`;
        message += `Speed Index: ${chalk.yellow(report.perf.speedIndex)}\n`;
        message += `Total Blocking Time: ${chalk.yellow(report.perf.tbt)}\n`;
        message += `First Input Delay: ${chalk.yellow(report.perf.fip)}\n\n`;

        message += `${chalk.magenta("Accessibility Audit")}\n`;
        message += `Aria Roles: ${this.checkPassFail(report.accessibility.ariaRoles)}\n`;
        message += `Contrast: ${this.checkPassFail(report.accessibility.contrast)}\n`;
        message += `Alt Attributes: ${this.checkPassFail(report.accessibility.alt)}\n`;
        message += `Input Labels: ${this.checkPassFail(report.accessibility.labels)}\n`;
        message += `Font Sizes: ${this.checkPassFail(report.accessibility.fontSize)}\n`;
        message += `Tap Targets: ${this.checkPassFail(report.accessibility.tapTargets)}\n\n`;

        message += `${chalk.magenta("Quality Audit")}\n`;
        message += `Weight: ${chalk.yellow(report.quality.weight)}\n`;
        message += `Lazy Images: ${this.checkPassFail(report.quality.lazyImages)}\n`;
        message += `Minified CSS: ${this.checkPassFail(report.quality.minifiedCSS)}\n`;
        message += `Minified JS: ${this.checkPassFail(report.quality.minifiedJS)}\n`;
        message += `Optimized Images: ${this.checkPassFail(report.quality.optimizedImages)}\n`;
        message += `Responsive Images: ${this.checkPassFail(report.quality.responsiveImages)}\n`;
        message += `DOM Size: ${this.checkPassFail(report.quality.domSize)}\n`;
        message += `Noopener: ${this.checkPassFail(report.quality.noopener)}\n`;
        message += `Notify On Start: ${this.checkPassFail(report.quality.notifyOnStart)}\n`;
        message += `Vulnerable Libraries: ${this.checkPassFail(report.quality.vulnerableLibraries)}\n\n`;

        message += `${chalk.magenta("SEO Audit")}\n`;
        message += `Meta Description: ${this.checkPassFail(report.seo.meta)}\n`;
        message += `Crawlable: ${this.checkPassFail(report.seo.crawlable)}\n`;
        message += `Canonical Link: ${this.checkPassFail(report.seo.canonical)}\n`;
        message += `Robots.txt File: ${this.checkPassFail(report.seo.robots)}`;

        console.log(boxen(message, { padding: 1 }));
    }

    generateReport(report) {
        const file = path.join(this.outputDir, "lightkeeper-report.json"),
            file2 = path.join(this.outputDir, "lightkeeper-report.json.1"),
            file3 = path.join(this.outputDir, "lightkeeper-report.json.2"),
            file4 = path.join(this.outputDir, "lightkeeper-report.json.3"),
            file5 = path.join(this.outputDir, "lightkeeper-report.json.4"),
            file6 = path.join(this.outputDir, "lightkeeper-report.json.5");

        if (fs.existsSync(file6)) {
            fs.unlinkSync(file6);
        }
        if (fs.existsSync(file5)) {
            fs.renameSync(file5, file6);
        }
        if (fs.existsSync(file4)) {
            fs.renameSync(file4, file5);
        }
        if (fs.existsSync(file3)) {
            fs.renameSync(file3, file4);
        }
        if (fs.existsSync(file2)) {
            fs.renameSync(file2, file3);
        }
        if (fs.existsSync(file)) {
            fs.renameSync(file, file2);
        }
        fs.writeFileSync(file, JSON.stringify(report));
    }

    async run(url) {
        const spinner = ora("Preparing lightkeeper").start();
        try {
            spinner.text = "Running lighthouse audit";
            const lighthouseResponse = await this.audit(url);
            const report = JSON.parse(lighthouseResponse.report);

            spinner.text = "Assembling report";
            const lightkeeperReport = this.assembleReport(report, url);

            if (this.budgetFile) {
                spinner.text = "Comparing the report against your budget";
                const budget = require(this.budgetFile);
                this.checkBudget(budget, lightkeeperReport);
            }

            spinner.succeed(`Lightkeeper has completed the audit`);

            this.displayReport(lightkeeperReport);

            if (this.outputDir) {
                if (!fs.existsSync(this.outputDir)) {
                    await fs.promises.mkdir(this.outputDir, { recursive: true });
                }
                this.generateReport(lightkeeperReport);
            }
        } catch (error) {
            spinner.fail();
            console.error(error);
            process.exit(1);
        }
    }
}

let url = argv.u || argv.url || null;
const output = argv.o || argv.output || null;
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
