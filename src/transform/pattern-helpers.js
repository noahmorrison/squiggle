var es = require("../es");

function pluckPattern(transform, root, p) {
    var obj = {identifiers: [], expressions: []};
    return _pluckPattern(transform, obj, root, p);
}

function satisfiesPattern(transform, root, p) {
    if (p && p.type in _satisfiesPattern) {
        return _satisfiesPattern[p.type](transform, root, p);
    }
    throw new Error("can't satisfiesPattern of " + j(p));
}

function esAnd(a, b) {
    return es.LogicalExpression(null, "&&", a, b);
}

function esEq(a, b) {
    return es.BinaryExpression(null, "===", a, b);
}

function esGe(a, b) {
    return es.BinaryExpression(null, ">=", a, b);
}

function esHas(a, b) {
    var prop = es.MemberExpression(null, true, a, b);
    var undef = es.Identifier(null, "undefined");
    return es.BinaryExpression(null, "!==", prop, undef);
}

function esSlice(xs, i) {
    var slice = es.Identifier(null, "$slice");
    return es.CallExpression(null, slice, [xs, i]);
}

function esProp(obj, prop) {
    return es.MemberExpression(null, false, obj, es.Identifier(null, prop));
}

function esNth(a, i) {
    return es.MemberExpression(null, true, a, es.Literal(null, i));
}

function esNth2(a, i) {
    return es.MemberExpression(null, true, a, i);
}

function objGet2(obj, k) {
    return es.MemberExpression(null, true, obj, k);
}

// var matchTmp = es.Identifier("$_");

// function assignTemp(expr) {
//     return es.AssignmentExpression("=", matchTmp, expr);
// }

var j = JSON.stringify;

function notEsTrue(x) {
    return !isEsTrue(x);
}

function isEsTrue(x) {
    return x.type === "Literal" && x.value === true;
}

var _satisfiesPattern = {
    PatternSimple: function(transform, root, p) {
        return es.Literal(p.loc, true);
    },
    PatternLiteral: function(transform, root, p) {
        var lit = transform(p.data);
        return es.CallExpression(
            p.loc, es.Identifier(null, "$is"), [root, lit]);
    },
    PatternParenExpr: function(transform, root, p) {
        var expr = transform(p.expr);
        return es.CallExpression(
            null, es.Identifier(null, "$eq"), [root, expr]);
    },
    PatternArray: function(transform, root, p) {
        var ps = p.patterns;
        var n = ps.length;
        var lengthEq = esEq(esProp(root, "length"), es.Literal(null, n));
        return ps
            .map(function(x, i) {
                return satisfiesPattern(transform, esNth(root, i), x);
            })
            .filter(notEsTrue)
            .reduce(esAnd, esAnd(root, lengthEq));
    },
    PatternArraySlurpy: function(transform, root, p) {
        var ps = p.patterns;
        var n = es.Literal(null, ps.length);
        var atLeastLength = esGe(esProp(root, "length"), n);
        var a = ps
            .map(function(x, i) {
                return satisfiesPattern(transform, esNth(root, i), x);
            })
            .filter(notEsTrue)
            .reduce(esAnd, esAnd(root, atLeastLength));
        var b = satisfiesPattern(transform, esSlice(root, n), p.slurp);
        return esAnd(a, b);
    },
    PatternObject: function(transform, root, p) {
        var id = es.Identifier(null, "$isObjectish");
        var isObjectish = es.CallExpression(null, id, [root]);
        return p
            .pairs
            .map(function(x) {
                return satisfiesPattern(transform, root, x);
            })
            .filter(notEsTrue)
            .reduce(esAnd, isObjectish);
    },
    PatternObjectPair: function(transform, root, p) {
        var expr = transform(p.key);
        var has = esHas(root, expr);
        var rootObj = esNth2(root, expr);
        return esAnd(has, satisfiesPattern(transform, rootObj, p.value));
    },
};

var __pluckPattern = {
    PatternSimple: function(transform, acc, root, p) {
        if (p.identifier.data !== "_") {
            acc.identifiers.push(transform(p.identifier));
            acc.expressions.push(root);
        }
        return acc;
    },
    PatternLiteral: function(transform, acc, root, p) {
        // Literals are just for the expression, they don't bind any values.
        return acc;
    },
    PatternParenExpr: function(transform, acc, root, p) {
        // We've already checked the values match, nothing to bind.
        return acc;
    },
    PatternArray: function(transform, acc, root, p) {
        p.patterns.forEach(function(x, i) {
            _pluckPattern(transform, acc, esNth(root, i), x);
        });
        return acc;
    },
    PatternArraySlurpy: function(transform, acc, root, p) {
        p.patterns.forEach(function(x, i) {
            _pluckPattern(transform, acc, esNth(root, i), x);
        });
        var n = es.Literal(null, p.patterns.length);
        _pluckPattern(transform, acc, esSlice(root, n), p.slurp);
        return acc;
    },
    PatternObject: function(transform, acc, root, p) {
        p.pairs.forEach(function(v) {
            _pluckPattern(transform, acc, root, v);
        });
        return acc;
    },
    PatternObjectPair: function(transform, acc, root, p) {
        // TODO: Don't assume p.key is a string literal.
        var objRoot = objGet2(root, transform(p.key));
        _pluckPattern(transform, acc, objRoot, p.value);
        return acc;
    },
};

function _pluckPattern(transform, acc, root, p) {
    if (p && p.type in __pluckPattern) {
        return __pluckPattern[p.type](transform, acc, root, p);
    }
    throw new Error("can't pluckPattern of " + j(p));
}

module.exports = {
    pluckPattern: pluckPattern,
    satisfiesPattern: satisfiesPattern
};
