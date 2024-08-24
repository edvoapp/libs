const { ESLintUtils } = require('@typescript-eslint/experimental-utils');
const ts = require('typescript');

function hasValidDecorator(node) {
  return (
    node.decorators &&
    node.decorators.length == 1 &&
    ['OwnedProperty', 'WeakProperty'].includes(node.decorators[0].expression.name)
  );
}

module.exports.rules = {
  'owned-property': {
    meta: {
      type: 'error',
      docs: {
        description: 'OwnedProperty descriptor',
      },
      fixable: 'code',
      schema: [], // no options
    },
    create(context) {
      const parserServices = ESLintUtils.getParserServices(context);
      const typeChecker = parserServices.program.getTypeChecker();

      function typeExtends(type, targetTypeName) {
        if (!type.symbol) return false; // Seems to crash getBaseTypes. Not sure why
        if (
          !((type.objectFlags & 8 || type.symbol.flags & (32 /* SymbolFlags.Class */ | 64)) /* SymbolFlags.Interface */)
        ) {
          return false;
        }

        for (const baseType of typeChecker.getBaseTypes(type)) {
          if (baseType.symbol && baseType.symbol.name === targetTypeName) {
            return true;
          }

          // Check if the baseType is a class declaration
          if (baseType.symbol?.valueDeclaration && ts.isClassDeclaration(baseType.symbol.valueDeclaration)) {
            // Recursively check the base type's base types
            if (typeExtends(baseType, targetTypeName)) {
              return true;
            }
          }
        }
        return false;
      }

      return {
        ClassProperty(node) {
          const { key, typeAnnotation } = node;
          // const type = typeChecker.getTypeAtLocation(node.typeAnnotation);
          const typeNode = parserServices.esTreeNodeToTSNodeMap.get(node);
          const type = typeChecker.getTypeAtLocation(typeNode);
          let isEdvoObj = false;
          if (type.isUnion()) {
            isEdvoObj = !!type.types.find((t) => typeExtends(t, 'GuardedObj'));
          } else {
            isEdvoObj = typeExtends(type, 'GuardedObj');
          }

          console.log('ClassProperty', key.name, { isEdvoObj: isEdvoObj });

          if (isEdvoObj && !hasValidDecorator(node)) {
            context.report({
              node,
              message:
                'All properties which extend EdvoObj/EdvoObjRS Must have an OwnedProperty OR WeakProperty decorator',
              fix(fixer) {
                return fixer.insertTextBefore(node, '@OwnedProperty\n');
              },
            });
          }
        },
      };
    },
  },
};
