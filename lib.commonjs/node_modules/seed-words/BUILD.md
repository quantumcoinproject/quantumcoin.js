## Generating Typescript Definitions

    npx -p typescript tsc seedwords.js --declaration --allowJs --emitDeclarationOnly --outDir dist

## Generating README.md

    jsdoc2md seedwords.js >README.md