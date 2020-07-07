# Lightkeeper

An automated lighthouse testing, reporting, and budgeting CLI tool.

## Installation

Install the NPM package:

```sh
npm i -D @codewithkyle/lightkeeper
```

Add the script:

```json
"scripts": {
    "audit": "lightkeeper"
}
```

Run the audit:

```sh
npm run audit
```

## Settings

To test the same URL every time use the `-u` flag.

To output the lightkeeper report JSON add an output directory with the `-o` flag.

```json
"scripts": {
    "audit": "lightkeeper -u https://example.com/ -o ./audits"
}
```
