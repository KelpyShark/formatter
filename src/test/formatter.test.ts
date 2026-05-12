/**
 * Unit tests for the KelpyShark formatter (no VS Code API needed).
 *
 * Run with:  npx ts-node src/test/formatter.test.ts
 * Or after compiling:  node out/src/test/formatter.test.js
 */

import { formatSource } from '../extension';

let passed = 0;
let failed = 0;

function test(name: string, input: string, expected: string): void {
    const actual = formatSource(input);
    if (actual === expected) {
        console.log(`  ✓  ${name}`);
        passed++;
    } else {
        console.error(`  ✗  ${name}`);
        console.error(`     Input:    ${JSON.stringify(input)}`);
        console.error(`     Expected: ${JSON.stringify(expected)}`);
        console.error(`     Got:      ${JSON.stringify(actual)}`);
        failed++;
    }
}

console.log('\nKelpyShark Formatter Tests\n');

// ── Indentation ───────────────────────────────────────────────────────────────

test('indent inside function',
    'def foo() {\nprint "hi"\n}',
    'def foo() {\n    print "hi"\n}\n'
);

test('nested indentation',
    'def foo() {\nif x {\nprint x\n}\n}',
    'def foo() {\n    if x {\n        print x\n    }\n}\n'
);

test('closing brace at correct indent',
    'if true {\nprint 1\n}\nprint 2',
    'if true {\n    print 1\n}\nprint 2\n'
);

// ── Operators ─────────────────────────────────────────────────────────────────

test('spaces around ==',
    'if x==5 {}',
    'if x == 5 {}\n'
);

test('spaces around !=',
    'if x!=5 {}',
    'if x != 5 {}\n'
);

test('spaces around assignment',
    'x=10',
    'x = 10\n'
);

test('compound assignment +=',
    'x+=1',
    'x += 1\n'
);

test('compound assignment -=',
    'x-=2',
    'x -= 2\n'
);

// ── Spacing ───────────────────────────────────────────────────────────────────

test('space after comma',
    'foo(a,b,c)',
    'foo(a, b, c)\n'
);

test('space before opening brace',
    'if true{',
    'if true {\n'
);

// ── Comments ──────────────────────────────────────────────────────────────────

test('preserve single-line comment',
    '# hello world',
    '# hello world\n'
);

test('trailing comment preserved',
    'x = 1 # set x',
    'x = 1  # set x\n'
);

// ── Blank lines ───────────────────────────────────────────────────────────────

test('collapse double blank lines',
    'x = 1\n\n\ny = 2',
    'x = 1\n\ny = 2\n'
);

test('no trailing blank lines',
    'x = 1\n\n\n',
    'x = 1\n'
);

// ── Strings ───────────────────────────────────────────────────────────────────

test('do not modify string contents',
    'x = "hello==world"',
    'x = "hello==world"\n'
);

test('do not modify string with comma',
    'x = "a,b,c"',
    'x = "a,b,c"\n'
);

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
