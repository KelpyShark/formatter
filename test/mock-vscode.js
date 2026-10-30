const Module = require('node:module');
const originalLoad = Module._load;

Module._load = function (request, parent, isMain) {
    if (request === 'vscode') {
        return {};
    }
    return originalLoad.call(this, request, parent, isMain);
};
