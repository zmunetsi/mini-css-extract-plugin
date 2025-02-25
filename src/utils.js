import NativeModule from "module";
import path from "path";

function trueFn() {
  return true;
}

function findModuleById(compilation, id) {
  const { modules, chunkGraph } = compilation;

  for (const module of modules) {
    const moduleId =
      typeof chunkGraph !== "undefined"
        ? chunkGraph.getModuleId(module)
        : module.id;

    if (moduleId === id) {
      return module;
    }
  }

  return null;
}

function evalModuleCode(loaderContext, code, filename) {
  const module = new NativeModule(filename, loaderContext);

  module.paths = NativeModule._nodeModulePaths(loaderContext.context); // eslint-disable-line no-underscore-dangle
  module.filename = filename;
  module._compile(code, filename); // eslint-disable-line no-underscore-dangle

  return module.exports;
}

function compareIds(a, b) {
  if (typeof a !== typeof b) {
    return typeof a < typeof b ? -1 : 1;
  }

  if (a < b) {
    return -1;
  }

  if (a > b) {
    return 1;
  }

  return 0;
}

function compareModulesByIdentifier(a, b) {
  return compareIds(a.identifier(), b.identifier());
}

const MODULE_TYPE = "css/mini-extract";
const AUTO_PUBLIC_PATH = "__mini_css_extract_plugin_public_path_auto__";
const ABSOLUTE_PUBLIC_PATH = "webpack:///mini-css-extract-plugin/";
const SINGLE_DOT_PATH_SEGMENT =
  "__mini_css_extract_plugin_single_dot_path_segment__";

function isAbsolutePath(str) {
  return path.posix.isAbsolute(str) || path.win32.isAbsolute(str);
}

const RELATIVE_PATH_REGEXP = /^\.\.?[/\\]/;

function isRelativePath(str) {
  return RELATIVE_PATH_REGEXP.test(str);
}

// TODO simplify for the next major release
function stringifyRequest(loaderContext, request) {
  if (
    typeof loaderContext.utils !== "undefined" &&
    typeof loaderContext.utils.contextify === "function"
  ) {
    return JSON.stringify(
      loaderContext.utils.contextify(loaderContext.context, request)
    );
  }

  const splitted = request.split("!");
  const { context } = loaderContext;

  return JSON.stringify(
    splitted
      .map((part) => {
        // First, separate singlePath from query, because the query might contain paths again
        const splittedPart = part.match(/^(.*?)(\?.*)/);
        const query = splittedPart ? splittedPart[2] : "";
        let singlePath = splittedPart ? splittedPart[1] : part;

        if (isAbsolutePath(singlePath) && context) {
          singlePath = path.relative(context, singlePath);

          if (isAbsolutePath(singlePath)) {
            // If singlePath still matches an absolute path, singlePath was on a different drive than context.
            // In this case, we leave the path platform-specific without replacing any separators.
            // @see https://github.com/webpack/loader-utils/pull/14
            return singlePath + query;
          }

          if (isRelativePath(singlePath) === false) {
            // Ensure that the relative path starts at least with ./ otherwise it would be a request into the modules directory (like node_modules).
            singlePath = `./${singlePath}`;
          }
        }

        return singlePath.replace(/\\/g, "/") + query;
      })
      .join("!")
  );
}

function getUndoPath(filename, outputPath, enforceRelative) {
  let depth = -1;
  let append = "";

  // eslint-disable-next-line no-param-reassign
  outputPath = outputPath.replace(/[\\/]$/, "");

  for (const part of filename.split(/[/\\]+/)) {
    if (part === "..") {
      if (depth > -1) {
        // eslint-disable-next-line no-plusplus
        depth--;
      } else {
        const i = outputPath.lastIndexOf("/");
        const j = outputPath.lastIndexOf("\\");
        const pos = i < 0 ? j : j < 0 ? i : Math.max(i, j);

        if (pos < 0) {
          return `${outputPath}/`;
        }

        append = `${outputPath.slice(pos + 1)}/${append}`;

        // eslint-disable-next-line no-param-reassign
        outputPath = outputPath.slice(0, pos);
      }
    } else if (part !== ".") {
      // eslint-disable-next-line no-plusplus
      depth++;
    }
  }

  return depth > 0
    ? `${"../".repeat(depth)}${append}`
    : enforceRelative
    ? `./${append}`
    : append;
}

export {
  trueFn,
  findModuleById,
  evalModuleCode,
  compareModulesByIdentifier,
  MODULE_TYPE,
  AUTO_PUBLIC_PATH,
  ABSOLUTE_PUBLIC_PATH,
  SINGLE_DOT_PATH_SEGMENT,
  stringifyRequest,
  getUndoPath,
};
