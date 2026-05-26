/**
 * Vue SFC uchun AST parser wrapper.
 * @vue/compiler-sfc orqali template + script bloklarini parse qiladi.
 */
import { parse as parseSFC } from '@vue/compiler-sfc';
import { parse as parseDOM } from '@vue/compiler-dom';
import { parseJS } from './js-parser.js';

/**
 * @param {string} src - SFC source code
 * @returns {Object} {
 *   descriptor,         // SFC descriptor
 *   templateAst,        // parsed template AST (or null)
 *   scriptAst,          // parsed script <script> AST (or null)
 *   scriptSetupAst,     // parsed <script setup> AST (or null)
 *   scriptOffset,       // line offset of script block (for line correction)
 *   scriptSetupOffset,
 *   templateOffset,
 * }
 */
export function parseVueSFC(src) {
  let descriptor;
  try {
    const { descriptor: d, errors } = parseSFC(src, { sourceMap: false });
    descriptor = d;
  } catch {
    return emptyResult();
  }

  if (!descriptor) return emptyResult();

  // Script blocks (script va script setup)
  const scriptBlock = descriptor.script;
  const scriptSetupBlock = descriptor.scriptSetup;
  const templateBlock = descriptor.template;

  const isTs =
    scriptBlock?.lang === 'ts' ||
    scriptBlock?.lang === 'tsx' ||
    scriptSetupBlock?.lang === 'ts' ||
    scriptSetupBlock?.lang === 'tsx';

  const scriptAst = scriptBlock
    ? parseJS(scriptBlock.content, { typescript: isTs, sourceType: 'module' })
    : null;

  const scriptSetupAst = scriptSetupBlock
    ? parseJS(scriptSetupBlock.content, { typescript: isTs, sourceType: 'module' })
    : null;

  // Template AST — @vue/compiler-dom parse (oddiy AST, transformation'siz)
  let templateAst = null;
  if (templateBlock) {
    try {
      templateAst = parseDOM(templateBlock.content, { comments: true });
    } catch {
      templateAst = null;
    }
  }

  return {
    descriptor,
    templateAst,
    scriptAst,
    scriptSetupAst,
    scriptOffset: scriptBlock?.loc?.start?.line ? scriptBlock.loc.start.line : 0,
    scriptSetupOffset: scriptSetupBlock?.loc?.start?.line ? scriptSetupBlock.loc.start.line : 0,
    templateOffset: templateBlock?.loc?.start?.line ? templateBlock.loc.start.line : 0,
    templateContent: templateBlock?.content || '',
    scriptContent: scriptBlock?.content || '',
    scriptSetupContent: scriptSetupBlock?.content || '',
  };
}

/**
 * Template node uchun (descriptor.template.loc.start.line + 1) ofset bilan
 * SFC ichidagi haqiqiy line raqamiga aylantirish. Vue compiler template
 * source'ni 1-based hisoblaydi.
 */
export function templateLineToSFCLine(node, templateOffset) {
  if (!node?.loc?.start?.line) return templateOffset + 1;
  return templateOffset + node.loc.start.line;
}

/**
 * Script ichidagi node uchun SFC line raqamiga aylantirish.
 * Script bloki <script> tag'idan keyin (offset + 1) keladi.
 */
export function scriptLineToSFCLine(node, scriptOffset) {
  if (!node?.loc?.start?.line) return scriptOffset + 1;
  return scriptOffset + node.loc.start.line;
}

/**
 * Template AST node uchun atribut topish helper.
 */
export function findAttr(node, name) {
  if (!node?.props) return null;
  for (const p of node.props) {
    if (p.type === 6 /* ATTRIBUTE */ && p.name === name) return p;
    if (p.type === 7 /* DIRECTIVE */ && p.name === name) return p;
  }
  return null;
}

/**
 * Template AST node — directive shorthand topish (`:key`, `:style` etc).
 * Vue 3 AST: directive type=7, name='bind', arg.content='key'.
 */
export function findDirective(node, dirName, argName = null) {
  if (!node?.props) return null;
  for (const p of node.props) {
    if (p.type !== 7) continue;
    if (p.name !== dirName) continue;
    if (argName === null) return p;
    if (p.arg?.content === argName) return p;
  }
  return null;
}

/**
 * Template AST tree'ni rekursiv kezish — ELEMENT (type=1) node'larga visitor chaqirish.
 */
export function walkTemplate(node, visitor) {
  if (!node) return;
  if (node.type === 1 /* ELEMENT */ || node.type === 0 /* ROOT */) {
    if (node.type === 1) visitor(node);
    if (node.children) {
      for (const child of node.children) walkTemplate(child, visitor);
    }
  }
}

/**
 * Template interpolation (Mustache {{ }}) node'larini topish.
 * Vue AST: type=5 (INTERPOLATION) ichida type=4 (SIMPLE_EXPRESSION) content.
 */
export function walkInterpolations(node, visitor) {
  if (!node) return;
  if (node.type === 5 /* INTERPOLATION */) {
    visitor(node);
  }
  if (node.children) {
    for (const child of node.children) walkInterpolations(child, visitor);
  }
}

function emptyResult() {
  return {
    descriptor: null,
    templateAst: null,
    scriptAst: null,
    scriptSetupAst: null,
    scriptOffset: 0,
    scriptSetupOffset: 0,
    templateOffset: 0,
    templateContent: '',
    scriptContent: '',
    scriptSetupContent: '',
  };
}
